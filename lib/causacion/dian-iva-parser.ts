import * as XLSX from 'xlsx'

export type ClasificacionIVA =
  | 'GRAVADA_19'   // IVA 19 %
  | 'GRAVADA_5'    // IVA 5 %
  | 'EXENTA'       // tarifa 0 % (bienes exentos)
  | 'EXCLUIDA'     // no sujeta a IVA por ley
  | 'MIXTA'        // más de una tarifa en la misma factura
  | 'SIN_DATO'     // no se pudo determinar

export type FuenteClasificacion = 'preexistente' | 'matematico' | 'ia' | 'regla'

export interface DianFactura {
  cufe: string
  tipo_documento: string
  folio: string
  prefijo: string
  fecha_emision: string
  nit_emisor: string
  nombre_emisor: string
  nit_receptor: string
  nombre_receptor: string
  grupo: string          // 'Emitido' | 'Recibido'
  iva_total: number
  total: number
  base_gravada_19: number
  iva_19: number
  base_gravada_5: number
  iva_5: number
  base_exenta: number    // bien exento tarifa 0 %
  base_excluida: number  // no sujeta a IVA
  clasificacion: ClasificacionIVA
  fuente_clasificacion: FuenteClasificacion
  nota_ia?: string
  año: number
  estado_dian: string
  hoja_origen: string
}

// Índices de columnas estándar DIAN (base 0)
const C = {
  TIPO: 0, CUFE: 1, FOLIO: 2, PREFIJO: 3,
  FECHA_EMISION: 7, FECHA_RECEPCION: 8,
  NIT_EMISOR: 9, NOMBRE_EMISOR: 10,
  NIT_RECEPTOR: 11, NOMBRE_RECEPTOR: 12,
  IVA: 13, ICA: 14, IC: 15, INC: 16, TIMBRE: 17,
  INC_BOLSAS: 18, IN_CARBONO: 19, IN_COMBUSTIBLES: 20,
  TOTAL: 29, ESTADO: 30, GRUPO: 31,
}

function num(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const n = parseFloat(String(v ?? '').replace(/,/g, '.'))
  return isNaN(n) ? 0 : n
}
function str(v: unknown): string { return String(v ?? '').trim() }

interface SheetMeta {
  colBase: number | null
  colBase19: number | null
  colBase5: number | null
  colIva19: number | null
  colIva5: number | null
}

function analyzeHeaders(headers: unknown[]): SheetMeta | null {
  const h = headers.map(x => str(x).toUpperCase())
  if (!h.some(x => x.includes('CUFE'))) return null

  const fi = (pred: (s: string) => boolean): number | null => {
    const i = h.findIndex(pred)
    return i >= 0 ? i : null
  }

  return {
    colBase: fi(x => x === 'BASE' || x === 'SUBTOTAL'),
    colBase19: fi(x => x.startsWith('BASE 19') || x === 'BASE19%'),
    colBase5: fi(x => (x.startsWith('BASE 5') || x === 'BASE5%') && !x.startsWith('BASE 19')),
    colIva19: fi(x => x.startsWith('IVA 19') || x === 'IVA19%'),
    colIva5: fi(x => (x.startsWith('IVA 5') || x === 'IVA5%') && !x.startsWith('IVA 19')),
  }
}

function detectYear(rows: unknown[][]): number {
  for (let i = 1; i < Math.min(rows.length, 15); i++) {
    const m = str(rows[i][C.FECHA_EMISION]).match(/(\d{4})/)
    if (m) return parseInt(m[1])
  }
  return new Date().getFullYear()
}

function computeBase(row: unknown[], meta: SheetMeta): number {
  if (meta.colBase !== null) {
    const b = num(row[meta.colBase])
    if (b > 0) return b
  }
  // fallback: Total minus all impuestos
  const allTaxCols = [C.IVA, C.ICA, C.IC, C.INC, C.TIMBRE, C.INC_BOLSAS, C.IN_CARBONO, C.IN_COMBUSTIBLES]
  const taxes = allTaxCols.reduce((s, col) => s + num(row[col]), 0)
  const total = num(row[C.TOTAL])
  return total > taxes ? total - taxes : total - num(row[C.IVA])
}

function classifyRow(
  row: unknown[],
  meta: SheetMeta,
): Pick<DianFactura,
  'base_gravada_19' | 'iva_19' | 'base_gravada_5' | 'iva_5' |
  'base_exenta' | 'base_excluida' | 'clasificacion' | 'fuente_clasificacion'
> {
  const ivaTotal = num(row[C.IVA])
  const total = num(row[C.TOTAL])

  // ── Columnas pre-calculadas por el contador (modo 2024 bimestral) ──
  if (meta.colBase19 !== null && meta.colIva19 !== null) {
    const base19 = num(row[meta.colBase19])
    const iva19  = num(row[meta.colIva19])
    const base5  = meta.colBase5 !== null ? num(row[meta.colBase5]) : 0
    const iva5   = meta.colIva5  !== null ? num(row[meta.colIva5]) : 0

    let clasificacion: ClasificacionIVA
    if (iva19 > 0 && iva5 > 0)   clasificacion = 'MIXTA'
    else if (iva19 > 0)           clasificacion = 'GRAVADA_19'
    else if (iva5 > 0)            clasificacion = 'GRAVADA_5'
    else                          clasificacion = 'EXCLUIDA'

    const baseRest = total - base19 - base5
    return {
      base_gravada_19: base19, iva_19: iva19,
      base_gravada_5: base5,   iva_5: iva5,
      base_exenta: 0,          base_excluida: baseRest > 0 ? baseRest : 0,
      clasificacion, fuente_clasificacion: 'preexistente',
    }
  }

  // ── Clasificación matemática ──────────────────────────────────────
  if (ivaTotal === 0) {
    const base = computeBase(row, meta)
    return {
      base_gravada_19: 0, iva_19: 0,
      base_gravada_5: 0,  iva_5: 0,
      base_exenta: base > 0 ? base : total, base_excluida: 0,
      clasificacion: 'EXCLUIDA',  // IA puede refinarlo
      fuente_clasificacion: 'matematico',
    }
  }

  const base = computeBase(row, meta)
  if (base <= 0) {
    return {
      base_gravada_19: 0, iva_19: ivaTotal,
      base_gravada_5: 0,  iva_5: 0,
      base_exenta: 0,     base_excluida: 0,
      clasificacion: 'SIN_DATO', fuente_clasificacion: 'matematico',
    }
  }

  const rate = Math.abs(ivaTotal) / Math.abs(base)

  if (rate >= 0.17 && rate <= 0.21) {
    return {
      base_gravada_19: base, iva_19: ivaTotal,
      base_gravada_5: 0,     iva_5: 0,
      base_exenta: 0,        base_excluida: 0,
      clasificacion: 'GRAVADA_19', fuente_clasificacion: 'matematico',
    }
  }
  if (rate >= 0.04 && rate <= 0.065) {
    return {
      base_gravada_19: 0,    iva_19: 0,
      base_gravada_5: base,  iva_5: ivaTotal,
      base_exenta: 0,        base_excluida: 0,
      clasificacion: 'GRAVADA_5', fuente_clasificacion: 'matematico',
    }
  }

  return {
    base_gravada_19: 0, iva_19: 0,
    base_gravada_5: 0,  iva_5: 0,
    base_exenta: 0,     base_excluida: 0,
    clasificacion: 'MIXTA', fuente_clasificacion: 'matematico',
  }
}

const SKIP_SHEETS = /^(hoja\d*|anexo|resumen|ing$|sheet\d*)$/i

export function parseDianXlsx(buffer: ArrayBuffer): DianFactura[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const seen = new Map<string, DianFactura>()

  for (const sheetName of wb.SheetNames) {
    if (SKIP_SHEETS.test(sheetName)) continue

    const ws = wb.Sheets[sheetName]
    if (!ws['!ref']) continue

    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
    if (data.length < 2) continue

    const meta = analyzeHeaders(data[0] as unknown[])
    if (!meta) continue

    const año = detectYear(data)

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as unknown[]
      if (row.length < 30) continue

      const cufe = str(row[C.CUFE])
      if (cufe.length < 32) continue  // not a real CUFE

      const clasif = classifyRow(row, meta)

      const factura: DianFactura = {
        cufe,
        tipo_documento: str(row[C.TIPO]),
        folio: str(row[C.FOLIO]),
        prefijo: str(row[C.PREFIJO]),
        fecha_emision: str(row[C.FECHA_EMISION]),
        nit_emisor: str(row[C.NIT_EMISOR]),
        nombre_emisor: str(row[C.NOMBRE_EMISOR]),
        nit_receptor: str(row[C.NIT_RECEPTOR]),
        nombre_receptor: str(row[C.NOMBRE_RECEPTOR]),
        grupo: str(row[C.GRUPO]) || 'Sin grupo',
        iva_total: num(row[C.IVA]),
        total: num(row[C.TOTAL]),
        año,
        estado_dian: str(row[C.ESTADO]),
        hoja_origen: sheetName,
        ...clasif,
      }

      const existing = seen.get(cufe)
      // Prefer rows with pre-calculated columns
      if (!existing || clasif.fuente_clasificacion === 'preexistente') {
        seen.set(cufe, factura)
      }
    }
  }

  return [...seen.values()]
}
