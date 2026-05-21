/**
 * Parser de archivos xlsx en estructura DIAN (Prevalidador)
 *
 * Los contadores entregan el xlsx ya estructurado por su software contable
 * (Siigo, World Office, Helisa, Aspel, etc.) con columnas en el formato
 * exacto del Prevalidador DIAN. Este parser lo convierte en estructuras
 * internas para validación y re-exportación.
 *
 * Formato esperado:
 *   - Cada hoja = un formato (nombre de hoja ≈ código: "1001", "1005", etc.)
 *   - Fila 0    = encabezados en español (nombre oficial DIAN)
 *   - Filas 1+  = datos; las filas de totales (sin concepto/id) se ignoran
 */
import * as XLSX from 'xlsx'
import type { FilaFormato } from '../types'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface FilaXlsx1001 extends FilaFormato {
  conceptoCodigo: string
  tipoDocumento: string
  numeroId: string
  dv: string
  primerApellido: string
  segundoApellido: string
  primerNombre: string
  otrosNombres: string
  razonSocial: string
  direccion: string
  deptoCodigo: string
  municipioCodigo: string
  paisCodigo: string
  valorPagoDeducible: number
  valorPagoNoDeducible: number
  valorPago: number           // deducible + no deducible
  valorIvaDeducible: number
  valorIvaNoDeducible: number
  valorIva: number            // deducible + no deducible
  valorRetefuente: number
  valorRetefuenteAsumida: number
  valorReteIva: number
  valorReteIvaNoResidentes: number
  valorReteIca: number
}

export interface FormatoXlsx {
  codigo: string
  nombreHoja: string
  filas: FilaXlsx1001[]
  totalRegistros: number
  totalFilas: number        // incluyendo filas de totales omitidas
  advertencias: string[]
}

export interface ResultadoParseoXlsx {
  formatosDetectados: string[]
  formatos: FormatoXlsx[]
  advertencias: string[]
  softwareDetectado?: string
}

// ── Alias de columnas → campo interno ────────────────────────────────────────
// Insensible a mayúsculas, tildes y espacios extra

const ALIAS_1001: Record<string, keyof FilaXlsx1001> = {
  'concepto':                               'conceptoCodigo',
  'tipo de documento':                      'tipoDocumento',
  'numero identificacion':                  'numeroId',
  'primer apellido del informado':          'primerApellido',
  'segundo apellido del informado':         'segundoApellido',
  'primer nombre del informado':            'primerNombre',
  'otros nombres del informado':            'otrosNombres',
  'razon social informado':                 'razonSocial',
  'direccion':                              'direccion',
  'codigo departamento':                    'deptoCodigo',
  'codigo municipio':                       'municipioCodigo',
  'pais de residencia o domicilio':         'paisCodigo',
  'pago o abono en cuenta deducible':       'valorPagoDeducible',
  'pago o abono en cuenta no deducible':    'valorPagoNoDeducible',
  'iva mayor valor del costo o gasto deducible':     'valorIvaDeducible',
  'iva mayor valor del costo o gasto no deducible':  'valorIvaNoDeducible',
  'retencion en la fuente practicada renta':         'valorRetefuente',
  'retencion en la fuente asumida renta':            'valorRetefuenteAsumida',
  'retencion en la fuente practicada iva a responsables de iva': 'valorReteIva',
  'retencion en la fuente practicada iva a no residentes':       'valorReteIvaNoResidentes',
  'retencion en la fuente practicada iva a no residentes o no domiciliados': 'valorReteIvaNoResidentes',
}

// ── Normalización de textos para comparación ─────────────────────────────────

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quitar tildes
    .replace(/\s+/g, ' ')
    .trim()
}

function n(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  if (typeof v === 'string') {
    const limpio = v.replace(/[.$\s]/g, '').replace(',', '.')
    const n = parseFloat(limpio)
    return isNaN(n) ? 0 : n
  }
  return 0
}

function s(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

// ── Detección de código de formato desde nombre de hoja ──────────────────────

const CODIGOS_SOPORTADOS = ['1001', '1005', '1006', '1007', '1010']

function detectarCodigo(nombreHoja: string): string | null {
  const limpio = nombreHoja.replace(/\D/g, '').trim()
  if (CODIGOS_SOPORTADOS.includes(limpio)) return limpio
  // Buscar código incrustado en el nombre (ej: "F1001", "Formato 1001", "1001-Pagos")
  const match = nombreHoja.match(/\b(1001|1005|1006|1007|1010)\b/)
  return match ? match[1] : null
}

// ── Mapear encabezados a índices de columna ───────────────────────────────────

function mapearEncabezados(headerRow: unknown[]): Record<string, number> {
  const mapa: Record<string, number> = {}
  headerRow.forEach((h, i) => {
    const norm = normalizar(s(h))
    const campo = ALIAS_1001[norm]
    if (campo) mapa[campo] = i
  })
  return mapa
}

// ── Parser principal ─────────────────────────────────────────────────────────

export function parsearXlsxFormato(buffer: Buffer): ResultadoParseoXlsx {
  const resultado: ResultadoParseoXlsx = {
    formatosDetectados: [],
    formatos: [],
    advertencias: [],
  }

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, cellNF: false })
  } catch {
    resultado.advertencias.push('No se pudo leer el archivo xlsx. Verifique que no esté protegido o dañado.')
    return resultado
  }

  // Detectar software (por metadatos o nombre de archivo — best-effort)
  if (wb.Props?.Application) {
    resultado.softwareDetectado = wb.Props.Application
  }

  for (const nombreHoja of wb.SheetNames) {
    const codigo = detectarCodigo(nombreHoja)
    if (!codigo) continue   // hoja no es un formato DIAN reconocido

    const ws = wb.Sheets[nombreHoja]
    if (!ws) continue

    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true })
    if (rows.length < 2) {
      resultado.advertencias.push(`Hoja "${nombreHoja}" está vacía o no tiene datos.`)
      continue
    }

    const headerRow = rows[0] as unknown[]
    const colIdx = mapearEncabezados(headerRow)

    if (Object.keys(colIdx).length < 3) {
      resultado.advertencias.push(`Hoja "${nombreHoja}": no se reconocieron los encabezados DIAN. Verifique que la primera fila tenga los nombres de columna.`)
      continue
    }

    const filas: FilaXlsx1001[] = []
    let totalFilas = 0
    const advertenciasHoja: string[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[]

      // Omitir filas vacías o de totales (sin concepto)
      const concepto = s(row[colIdx['conceptoCodigo']] ?? row[0])
      const id = s(row[colIdx['numeroId']] ?? row[2])
      if (!concepto && !id) continue
      if (!concepto || !id) {
        // Fila de totales (solo tiene valores numéricos)
        totalFilas++
        continue
      }

      totalFilas++

      const get = (campo: string) => row[colIdx[campo]] ?? ''
      const getN = (campo: string) => n(row[colIdx[campo]])

      const pagoDeducible  = getN('valorPagoDeducible')
      const pagoNoDeducible = getN('valorPagoNoDeducible')
      const ivaDeducible   = getN('valorIvaDeducible')
      const ivaNoDeducible = getN('valorIvaNoDeducible')

      // DV: a veces el xlsx incluye el NIT con DV separado (columna extra)
      // o concatenado como "900123456-1". Lo extraemos.
      const idRaw = s(get('numeroId') || row[2])
      let numeroId = idRaw.replace(/\D/g, '')
      let dv = ''
      const conDv = idRaw.match(/^(\d+)-(\d)$/)
      if (conDv) { numeroId = conDv[1]; dv = conDv[2] }

      const fila: FilaXlsx1001 = {
        conceptoCodigo:    concepto,
        tipoDocumento:     s(get('tipoDocumento')),
        numeroId,
        dv,
        primerApellido:    s(get('primerApellido')),
        segundoApellido:   s(get('segundoApellido')),
        primerNombre:      s(get('primerNombre')),
        otrosNombres:      s(get('otrosNombres')),
        razonSocial:       s(get('razonSocial')),
        direccion:         s(get('direccion')),
        deptoCodigo:       s(get('deptoCodigo')).padStart(2, '0'),
        municipioCodigo:   s(get('municipioCodigo')).padStart(3, '0'),
        paisCodigo:        s(get('paisCodigo')) || 'CO',
        valorPagoDeducible:       pagoDeducible,
        valorPagoNoDeducible:     pagoNoDeducible,
        valorPago:                pagoDeducible + pagoNoDeducible,
        valorIvaDeducible:        ivaDeducible,
        valorIvaNoDeducible:      ivaNoDeducible,
        valorIva:                 ivaDeducible + ivaNoDeducible,
        valorRetefuente:          getN('valorRetefuente'),
        valorRetefuenteAsumida:   getN('valorRetefuenteAsumida'),
        valorReteIva:             getN('valorReteIva'),
        valorReteIvaNoResidentes: getN('valorReteIvaNoResidentes'),
        valorReteIca:             0,   // no está en el xlsx 1001 estándar
      }

      if (!fila.numeroId) {
        advertenciasHoja.push(`Fila ${i + 1}: registro sin número de identificación — omitido.`)
        continue
      }

      filas.push(fila)
    }

    resultado.formatosDetectados.push(codigo)
    resultado.formatos.push({
      codigo,
      nombreHoja,
      filas,
      totalRegistros: filas.length,
      totalFilas,
      advertencias: advertenciasHoja,
    })
    if (advertenciasHoja.length) resultado.advertencias.push(...advertenciasHoja)
  }

  if (resultado.formatosDetectados.length === 0) {
    resultado.advertencias.push(
      'No se encontraron hojas con formato DIAN reconocido. ' +
      'El archivo debe tener hojas con nombres como "1001", "1005", "1006", "1007" o "1010".'
    )
  }

  return resultado
}

/** Totaliza los valores de un formato xlsx para mostrar en el resumen */
export function totalizarXlsx1001(filas: FilaXlsx1001[]): Record<string, number> {
  return filas.reduce((acc, f) => ({
    totalFilas:             (acc.totalFilas ?? 0) + 1,
    totalPagoDeducible:     (acc.totalPagoDeducible ?? 0) + f.valorPagoDeducible,
    totalPagoNoDeducible:   (acc.totalPagoNoDeducible ?? 0) + f.valorPagoNoDeducible,
    totalPago:              (acc.totalPago ?? 0) + f.valorPago,
    totalIva:               (acc.totalIva ?? 0) + f.valorIva,
    totalRetefuente:        (acc.totalRetefuente ?? 0) + f.valorRetefuente,
    totalReteIva:           (acc.totalReteIva ?? 0) + f.valorReteIva,
  }), {} as Record<string, number>)
}
