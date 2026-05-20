/**
 * Parser de facturas electrónicas DIAN — UBL 2.1.
 * Compatible con Resolución 000165/2023 + 000202/2025, Anexo Técnico 1.9+.
 * Soporta: facturas (01), notas crédito (92), notas débito (91), doc. soporte (05).
 */
import { XMLParser } from 'fast-xml-parser'
import { createHash } from 'crypto'
import type {
  FacturaElectronica, ImpuestoDetalle, ItemFactura, TipoDocumentoDIAN,
} from '../models'

// ─── CONFIGURACIÓN PARSER XML ─────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,          // Elimina prefijos de namespace (cbc:, cac:, etc.)
  parseTagValue: true,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => [
    'InvoiceLine', 'CreditNoteLine', 'DebitNoteLine',
    'TaxTotal', 'TaxSubtotal', 'WithholdingTaxTotal',
    'AllowanceCharge', 'BillingReference', 'DiscrepancyResponse',
  ].includes(name),
})

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function str(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object' && '#text' in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>)['#text']).trim()
  }
  return String(val).trim()
}

function num(val: unknown): number {
  const s = str(val).replace(',', '.')
  return parseFloat(s) || 0
}

function nitLimpio(nit: string): string {
  return nit.replace(/[^0-9]/g, '')
}

function parsearFechaXml(val: unknown): string | null {
  const s = str(val)
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function extraerImpuesto(taxSubtotal: Record<string, unknown>): ImpuestoDetalle {
  const base  = num((taxSubtotal as Record<string, unknown>)['TaxableAmount'])
  const valor = num((taxSubtotal as Record<string, unknown>)['TaxAmount'])
  const cat   = (taxSubtotal as Record<string, unknown>)['TaxCategory'] as Record<string, unknown> || {}
  const tarifa = num(cat['Percent'])
  const scheme = (cat['TaxScheme'] as Record<string, unknown>) || {}
  const nombre = str(scheme['Name']) || 'IVA'
  return { nombre, tarifaPct: tarifa, baseGravable: base, valor }
}

// ─── PARSER ───────────────────────────────────────────────────────────────────

export interface ResultadoParserXml {
  facturas: FacturaElectronica[]
  errores: string[]
}

export function parsearXmlDian(contenido: string | Buffer, nombreArchivo = ''): FacturaElectronica | null {
  try {
    const xmlStr = typeof contenido === 'string' ? contenido : contenido.toString('utf-8')
    const parsed = xmlParser.parse(xmlStr) as Record<string, unknown>

    // Detectar raíz (Invoice, CreditNote, DebitNote)
    const invoice    = (parsed['Invoice'] ?? parsed['invoice']) as Record<string, unknown> | undefined
    const creditNote = (parsed['CreditNote'] ?? parsed['CreditNote']) as Record<string, unknown> | undefined
    const debitNote  = (parsed['DebitNote'] ?? parsed['DebitNote']) as Record<string, unknown> | undefined

    const root = invoice ?? creditNote ?? debitNote
    if (!root) {
      // Intentar buscar en cualquier clave que contenga los campos esperados
      const rootKey = Object.keys(parsed).find(k => parsed[k] && typeof parsed[k] === 'object'
        && 'ID' in (parsed[k] as Record<string, unknown>))
      if (!rootKey) return null
      return _construirFactura(parsed[rootKey] as Record<string, unknown>, nombreArchivo,
        !!creditNote ? '92' : !!debitNote ? '91' : '01')
    }

    const tipoDoc: TipoDocumentoDIAN = creditNote ? '92' : debitNote ? '91' : '01'
    return _construirFactura(root, nombreArchivo, tipoDoc)
  } catch (e) {
    console.error(`[dian-xml] Error parseando ${nombreArchivo}: ${e}`)
    return null
  }
}

function _construirFactura(
  root: Record<string, unknown>,
  xmlPath: string,
  tipoDefault: TipoDocumentoDIAN,
): FacturaElectronica {
  const cufe   = str(root['UUID']) || str(root['CUFE']) || ''
  const numero = str(root['ID']) || ''
  const tipoCode = str(root['InvoiceTypeCode'] ?? root['CreditNoteTypeCode'] ?? root['DebitNoteTypeCode'])
  const tipoDoc: TipoDocumentoDIAN = (tipoCode as TipoDocumentoDIAN) || tipoDefault
  const moneda = str(root['DocumentCurrencyCode']) || 'COP'
  const fechaEmision = parsearFechaXml(root['IssueDate']) ?? new Date().toISOString().slice(0, 10)
  const fechaVencimiento = parsearFechaXml(root['DueDate']) ?? undefined

  // Emisor
  const supplier = (root['AccountingSupplierParty'] as Record<string, unknown>) || {}
  const supplierParty = (supplier['Party'] as Record<string, unknown>) || {}
  const nitEmisor = nitLimpio(
    str(((supplier['Party'] as Record<string, unknown>)?.['PartyIdentification'] as Record<string, unknown>)?.['ID'])
    || str((supplierParty?.['PartyLegalEntity'] as Record<string, unknown>)?.['CompanyID'])
    || ''
  )
  const nombreEmisor =
    str((supplierParty?.['PartyLegalEntity'] as Record<string, unknown>)?.['RegistrationName'])
    || str((supplierParty?.['PartyName'] as Record<string, unknown>)?.['Name'])
    || 'Emisor'

  // Receptor
  const customer = (root['AccountingCustomerParty'] as Record<string, unknown>) || {}
  const customerParty = (customer['Party'] as Record<string, unknown>) || {}
  const nitReceptor = nitLimpio(
    str(((customer['Party'] as Record<string, unknown>)?.['PartyIdentification'] as Record<string, unknown>)?.['ID'])
    || str((customerParty?.['PartyLegalEntity'] as Record<string, unknown>)?.['CompanyID'])
    || ''
  )
  const nombreReceptor =
    str((customerParty?.['PartyLegalEntity'] as Record<string, unknown>)?.['RegistrationName'])
    || str((customerParty?.['PartyName'] as Record<string, unknown>)?.['Name'])
    || 'Receptor'

  // Totales
  const monetary = (root['LegalMonetaryTotal'] as Record<string, unknown>) || {}
  const subtotal        = num(monetary['LineExtensionAmount'])
  const descuentoTotal  = num(monetary['AllowanceTotalAmount'])
  const total           = num(monetary['PayableAmount'])

  // Impuestos
  const impuestos: ImpuestoDetalle[] = []
  const taxTotals = (root['TaxTotal'] as Record<string, unknown>[]) || []
  for (const tt of taxTotals) {
    const subtotals = (tt['TaxSubtotal'] as Record<string, unknown>[]) || []
    for (const st of subtotals) {
      impuestos.push(extraerImpuesto(st))
    }
  }

  // Retenciones (WithholdingTaxTotal)
  const retenciones: ImpuestoDetalle[] = []
  const whTotals = (root['WithholdingTaxTotal'] as Record<string, unknown>[]) || []
  for (const wh of whTotals) {
    const subtotals = (wh['TaxSubtotal'] as Record<string, unknown>[]) || []
    for (const st of subtotals) {
      retenciones.push(extraerImpuesto(st))
    }
  }

  // Líneas
  const lineasRaw = (
    root['InvoiceLine'] ?? root['CreditNoteLine'] ?? root['DebitNoteLine']
  ) as Record<string, unknown>[] || []
  const items: ItemFactura[] = lineasRaw.map((l, i) => _parsearLinea(l, i + 1))

  // Base gravable
  const baseGravable = impuestos
    .filter(imp => imp.nombre.toUpperCase() === 'IVA')
    .reduce((s, imp) => s + imp.baseGravable, 0) || subtotal

  // Referencias para notas
  let cufeReferenciado: string | undefined
  let numeroReferenciado: string | undefined
  let razonNota: string | undefined
  const billingRefs = (root['BillingReference'] as Record<string, unknown>[]) || []
  if (billingRefs.length > 0) {
    const docRef = (billingRefs[0]['InvoiceDocumentReference'] ?? billingRefs[0]) as Record<string, unknown>
    cufeReferenciado  = str(docRef['UUID']) || undefined
    numeroReferenciado = str(docRef['ID']) || undefined
  }
  const discRefs = (root['DiscrepancyResponse'] as Record<string, unknown>[]) || []
  if (discRefs.length > 0) {
    razonNota = str(discRefs[0]['Description']) || undefined
  }

  const esNota = tipoDoc === '91' || tipoDoc === '92'

  return {
    cufe,
    numero,
    tipoDocumento: tipoDoc,
    fechaEmision,
    fechaVencimiento,
    nitEmisor,
    nombreEmisor,
    nitReceptor,
    nombreReceptor,
    moneda,
    subtotal,
    descuentoTotal,
    baseGravable,
    impuestos,
    retenciones,
    total,
    items,
    esNota,
    cufeReferenciado,
    numeroReferenciado,
    razonNota,
    estadoDian: 'VALIDADA',
    xmlPath,
    estado: 'no_conciliado',
    matchIds: [],
    confianzaMatch: 0,
  }
}

function _parsearLinea(linea: Record<string, unknown>, num_linea: number): ItemFactura {
  const cantidadEl = linea['InvoicedQuantity'] ?? linea['CreditedQuantity'] ?? linea['DebitedQuantity']
  const cantidad = typeof cantidadEl === 'object' && cantidadEl !== null
    ? num((cantidadEl as Record<string, unknown>)['#text'] ?? cantidadEl)
    : num(cantidadEl)
  const subtotalLinea = num(linea['LineExtensionAmount'])
  const priceEl = (linea['Price'] as Record<string, unknown>) || {}
  const precioUnit = num(priceEl['PriceAmount'])
  const itemEl = (linea['Item'] as Record<string, unknown>) || {}
  const descripcion = str(itemEl['Description']) || `Ítem ${num_linea}`
  const codigo = str((itemEl['SellersItemIdentification'] as Record<string, unknown>)?.['ID']) || undefined

  // IVA de línea
  let tarifaIva = 0
  let valorIva = 0
  const ttLinea = (linea['TaxTotal'] as Record<string, unknown>[]) || []
  if (ttLinea.length > 0) {
    valorIva = num(ttLinea[0]['TaxAmount'])
    const st = (ttLinea[0]['TaxSubtotal'] as Record<string, unknown>[])?.[0] || {}
    const cat = (st['TaxCategory'] as Record<string, unknown>) || {}
    tarifaIva = num(cat['Percent'])
  }

  return {
    linea: num_linea,
    codigo,
    descripcion,
    cantidad,
    precioUnitario: precioUnit,
    descuento: 0,
    subtotal: subtotalLinea,
    tarifaIva,
    valorIva,
    totalLinea: subtotalLinea + valorIva,
  }
}

/** Parsea múltiples archivos XML en bytes */
export function parsearXmlsMultiples(
  archivos: Array<{ nombre: string; contenido: Buffer }>
): ResultadoParserXml {
  const facturas: FacturaElectronica[] = []
  const errores: string[] = []

  for (const { nombre, contenido } of archivos) {
    const factura = parsearXmlDian(contenido, nombre)
    if (factura) {
      facturas.push(factura)
    } else {
      errores.push(`No se pudo parsear: ${nombre}`)
    }
  }

  return { facturas, errores }
}
