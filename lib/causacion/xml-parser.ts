/**
 * Parser UBL 2.1 para facturas electrónicas colombianas (DIAN).
 * No depende de bibliotecas externas — extrae campos con regex sobre el XML raw.
 */

export interface ItemFactura {
    descripcion: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    porcentaje_iva: number
    valor_iva: number
}

export interface ImpuestoUBL {
    tipo: string      // IVA, INC, ReteIVA, RetefuenteIVA, etc.
    codigo: string    // 01=IVA, 04=INC, etc.
    base: number
    tasa: number
    valor: number
}

export interface FacturaUBL {
    // Identificación
    cufe: string
    numero_factura: string
    tipo_documento: string  // 01=FV, 02=FE, 91=NC, 92=ND
    fecha_emision: string   // YYYY-MM-DD
    hora_emision: string
    // Proveedor (emisor)
    proveedor_nit: string
    proveedor_nombre: string
    proveedor_direccion: string
    proveedor_municipio: string
    proveedor_regimen: string  // responsable IVA, no responsable, simple, etc.
    // Adquiriente (receptor)
    receptor_nit: string
    receptor_nombre: string
    // Valores
    subtotal: number
    descuento_total: number
    base_gravable: number
    iva_total: number
    ica_total: number
    total: number
    // Ítems
    items: ItemFactura[]
    // Impuestos detallados
    impuestos: ImpuestoUBL[]
    // Forma de pago
    forma_pago: string   // 1=contado, 2=crédito
    fecha_vencimiento: string
}

// ── Helpers ──────────────────────────────────────────────────

function tag(xml: string, tagName: string, index = 0): string {
    const regex = new RegExp(`<(?:[a-z]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-z]+:)?${tagName}>`, 'gi')
    const matches: string[] = []
    let m
    while ((m = regex.exec(xml)) !== null) matches.push(m[1].trim())
    return matches[index] ?? ''
}

function attr(element: string, attrName: string): string {
    const m = element.match(new RegExp(`${attrName}="([^"]*)"`, 'i'))
    return m ? m[1] : ''
}

function num(s: string): number {
    return parseFloat(s.replace(/[^\d.-]/g, '')) || 0
}

function allTags(xml: string, tagName: string): string[] {
    const regex = new RegExp(`<(?:[a-z]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-z]+:)?${tagName}>`, 'gi')
    const result: string[] = []
    let m
    while ((m = regex.exec(xml)) !== null) result.push(m[0])
    return result
}

// ── Parser principal ──────────────────────────────────────────

export function parseUBL21(xmlRaw: string): FacturaUBL {
    const xml = xmlRaw

    // CUFE / UUID
    const uuidEl = xml.match(/<(?:[a-z]+:)?UUID[^>]*>([a-f0-9]{96})<\/(?:[a-z]+:)?UUID>/i)
    const cufe = uuidEl ? uuidEl[1] : ''

    const numero_factura = tag(xml, 'ID')
    const tipo_documento = tag(xml, 'DocumentTypeCode') || tag(xml, 'InvoiceTypeCode')
    const fecha_emision = tag(xml, 'IssueDate')
    const hora_emision = tag(xml, 'IssueTime')

    // Bloque del proveedor
    const supplierBlock = tag(xml, 'AccountingSupplierParty')
    const proveedor_nit = tag(supplierBlock, 'CompanyID') || tag(supplierBlock, 'ID')
    const proveedor_nombre = tag(supplierBlock, 'RegistrationName') || tag(supplierBlock, 'Name')
    const proveedor_direccion = tag(supplierBlock, 'Line') || tag(supplierBlock, 'AddressLine')
    const proveedor_municipio = tag(supplierBlock, 'CityName')
    const proveedor_regimen = tag(supplierBlock, 'TaxLevelCode')

    // Bloque del receptor
    const customerBlock = tag(xml, 'AccountingCustomerParty')
    const receptor_nit = tag(customerBlock, 'CompanyID') || tag(customerBlock, 'ID')
    const receptor_nombre = tag(customerBlock, 'RegistrationName') || tag(customerBlock, 'Name')

    // Totales monetarios
    const moneyBlock = tag(xml, 'LegalMonetaryTotal')
    const subtotal = num(tag(moneyBlock, 'LineExtensionAmount'))
    const descuento_total = num(tag(moneyBlock, 'AllowanceTotalAmount'))
    const base_gravable = num(tag(moneyBlock, 'TaxExclusiveAmount')) || subtotal
    const total = num(tag(moneyBlock, 'PayableAmount')) || num(tag(moneyBlock, 'TaxInclusiveAmount'))

    // Impuestos (TaxTotal blocks)
    const taxBlocks = allTags(xml, 'TaxTotal')
    let iva_total = 0
    let ica_total = 0
    const impuestos: ImpuestoUBL[] = []

    for (const tb of taxBlocks) {
        const subtaxBlocks = allTags(tb, 'TaxSubtotal')
        for (const stb of subtaxBlocks) {
            const codigo = tag(tag(stb, 'TaxScheme'), 'ID') || tag(stb, 'ID')
            const nombre = tag(tag(stb, 'TaxScheme'), 'Name') || ''
            const base = num(tag(stb, 'TaxableAmount'))
            const tasa = num(tag(tag(stb, 'TaxCategory'), 'Percent') || tag(stb, 'Percent'))
            const valor = num(tag(stb, 'TaxAmount'))

            impuestos.push({ tipo: nombre || codigo, codigo, base, tasa, valor })

            if (codigo === '01' || nombre.toLowerCase().includes('iva')) iva_total += valor
            if (codigo === '03' || nombre.toLowerCase().includes('ica') || nombre.toLowerCase().includes('reteica')) ica_total += valor
        }
    }

    // Ítems / líneas
    const lineBlocks = allTags(xml, 'InvoiceLine').length > 0
        ? allTags(xml, 'InvoiceLine')
        : allTags(xml, 'CreditNoteLine')

    const items: ItemFactura[] = lineBlocks.map(line => {
        const descripcion = tag(line, 'Description') || tag(tag(line, 'Item'), 'Name') || ''
        const cantidad = num(tag(line, 'InvoicedQuantity') || tag(line, 'CreditedQuantity')) || 1
        const subtotalLine = num(tag(line, 'LineExtensionAmount'))
        const precio_unitario = num(tag(tag(line, 'Price'), 'PriceAmount')) || (subtotalLine / cantidad)
        const taxSubLine = allTags(line, 'TaxSubtotal')[0] || ''
        const tasa_iva = num(tag(tag(taxSubLine, 'TaxCategory'), 'Percent'))
        const valor_iva = num(tag(taxSubLine, 'TaxAmount'))
        return { descripcion, cantidad, precio_unitario, subtotal: subtotalLine, porcentaje_iva: tasa_iva, valor_iva }
    })

    // Forma de pago
    const pagoBlock = tag(xml, 'PaymentMeans')
    const forma_pago = tag(pagoBlock, 'PaymentMeansCode') || '1'
    const fecha_vencimiento = tag(xml, 'PaymentDueDate') || fecha_emision

    return {
        cufe, numero_factura, tipo_documento, fecha_emision, hora_emision,
        proveedor_nit, proveedor_nombre, proveedor_direccion, proveedor_municipio, proveedor_regimen,
        receptor_nit, receptor_nombre,
        subtotal, descuento_total, base_gravable, iva_total, ica_total, total,
        items, impuestos, forma_pago, fecha_vencimiento,
    }
}
