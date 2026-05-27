/**
 * Parser del Libro Auxiliar de Siigo en formato xlsx
 *
 * Siigo exporta el Libro Auxiliar tanto en CSV como en xlsx.
 * Este parser maneja el xlsx (estructura idéntica al CSV pero con celdas tipadas).
 *
 * Estructura del xlsx:
 *   Fila 0   — Título: "Siigo - <Razón Social>"  (col 0) + fecha (última col)
 *   Fila 1   — "LIBRO AUXILIAR - GENERAL"
 *   Fila 2   — "De :  ENE  1/YYYY   A :  DIC 31/YYYY"
 *   Filas 3-5 — vacías / metadatos secundarios
 *   Fila 6   — Encabezados: CUENTA, DESCRIPCION, NIT, DIG.VER., NOMBRE, COMPROBANTE, FECHA, DETALLE, DEBITOS, CREDITOS…
 *   Filas 7+ — Datos + subtotales (a omitir)
 *
 * Se retorna la misma interfaz ResultadoParseoCsv del parser CSV para reutilizar
 * el flujo completo de RulesEngine → formatos DIAN.
 */
import * as XLSX from 'xlsx'
import type { AsientoContable, TerceroExogena, TipoDocumentoDIAN } from '../types'
import type { ResultadoParseoCsv } from './siigo-csv-parser'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'

// ── Códigos de hoja del Prevalidador DIAN (para distinguirlo del Libro Auxiliar) ──
const DIAN_SHEET_CODES = new Set(['1001', '1005', '1006', '1007', '1010'])

/**
 * Retorna true si el xlsx es un Prevalidador DIAN (hojas nombradas 1001, 1005, etc.)
 * Retorna false si es un Libro Auxiliar de Siigo u otro formato.
 */
export function esDianPrevalidador(buffer: Buffer): boolean {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', bookSheets: true })
    return wb.SheetNames.some(n => DIAN_SHEET_CODES.has(n.replace(/\D/g, '').trim()))
  } catch {
    return false
  }
}

/**
 * Parsea el Libro Auxiliar General de Siigo (xlsx) a AsientoContable[].
 * Compatible con Siigo Nube y Siigo Escritorio que exportan xlsx.
 */
export function parsearSiigoXlsx(buffer: Buffer): ResultadoParseoCsv {
  const advertencias: string[] = []

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, cellNF: false, raw: true })
  } catch {
    return {
      asientos: [], advertencias: ['No se pudo leer el archivo xlsx. Verifique que no esté protegido o dañado.'],
      totalFilas: 0, filasFallidas: 0,
    }
  }

  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return { asientos: [], advertencias: ['El archivo xlsx no contiene hojas.'], totalFilas: 0, filasFallidas: 0 }
  }

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true })

  if (rows.length < 7) {
    return {
      asientos: [],
      advertencias: ['El archivo tiene muy pocas filas. Verifique que sea el Libro Auxiliar exportado desde Siigo.'],
      totalFilas: 0, filasFallidas: 0,
    }
  }

  // ── Extraer metadata (empresa, período) ──────────────────────────────────────
  let empresa: string | undefined
  let periodo: string | undefined

  const titulo = str(safeGet(rows, 0, 0))
  if (titulo.toLowerCase().includes('siigo')) {
    empresa = titulo.replace(/^siigo\s*[-–]\s*/i, '').trim() || undefined
  } else if (titulo) {
    empresa = titulo
  }

  const periodoStr = str(safeGet(rows, 2, 0))
  if (/de\s*:/i.test(periodoStr)) {
    periodo = periodoStr.trim() || undefined
  }

  // ── Encontrar fila de encabezados ────────────────────────────────────────────
  let headerIdx = -1
  // Índices por defecto (estructura estándar de Siigo)
  const col = {
    cuenta: 1, descripcion: 2, nit: 4, dv: 6, nombre: 7,
    comprobante: 8, fecha: 9, detalle: 10, debito: 15, credito: 16,
  }

  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i] as unknown[]
    const rowUpper = row.map(c => str(c).toUpperCase())
    const rowJoined = rowUpper.join('|')
    if (rowJoined.includes('CUENTA') && (rowJoined.includes('NIT') || rowJoined.includes('DEBITO'))) {
      headerIdx = i
      // Remapear columnas por nombre de encabezado (robustez ante variaciones de versión)
      rowUpper.forEach((h, idx) => {
        const hClean = h.replace(/[^A-ZÁÉÍÓÚÑ.]/g, ' ').trim()
        if (/^CUENTA$/.test(hClean) || hClean === 'CTA') col.cuenta = idx
        else if (/^DESCRIPCION/.test(hClean)) col.descripcion = idx
        else if (/^NIT$/.test(hClean)) col.nit = idx
        else if (/DIG\.?VER|^DV$/.test(hClean)) col.dv = idx
        else if (/^NOMBRE$/.test(hClean)) col.nombre = idx
        else if (/^COMPROBANTE/.test(hClean)) col.comprobante = idx
        else if (/^FECHA$/.test(hClean)) col.fecha = idx
        else if (/^DETALLE/.test(hClean)) col.detalle = idx
        else if (/^DEBITO/.test(hClean)) col.debito = idx
        else if (/^CREDITO/.test(hClean)) col.credito = idx
      })
      break
    }
  }

  if (headerIdx === -1) {
    return {
      asientos: [],
      advertencias: [
        'No se reconoció la estructura del Libro Auxiliar de Siigo. ' +
        'Asegúrese de exportar el "Libro Auxiliar - General" desde Siigo con detalle de movimientos.',
      ],
      totalFilas: 0, filasFallidas: 0,
    }
  }

  // ── Procesar filas de datos ──────────────────────────────────────────────────
  const asientos: AsientoContable[] = []
  let filasFallidas = 0
  let idCounter = 1

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]

    const cuenta    = str(row[col.cuenta]).replace(/\s+/g, '')
    const nitRaw    = row[col.nit]
    const comp      = str(row[col.comprobante]).trim()
    const primeraCol = str(row[0]).trim().toUpperCase()

    // Omitir filas de totales ("Total ...", "Total general"), encabezados de cuenta/tercero
    if (primeraCol.startsWith('TOTAL')) continue
    if (!cuenta || !nitRaw || !comp) continue

    try {
      const debito  = toNum(row[col.debito])
      const credito = toNum(row[col.credito])
      if (debito === 0 && credito === 0) continue

      const naturaleza: 'debito' | 'credito' = debito > 0 ? 'debito' : 'credito'
      const monto = debito > 0 ? debito : credito

      asientos.push({
        id: `SXLS-${String(idCounter++).padStart(5, '0')}`,
        fecha:       excelSerialToIso(row[col.fecha]),
        cuentaPuc:   cuenta.replace(/[.\-]/g, '').toUpperCase(),
        nombreCuenta: str(row[col.descripcion]).trim(),
        naturaleza,
        monto,
        tercero:     construirTercero(str(nitRaw), str(row[col.dv]), str(row[col.nombre])),
        documentoId: comp,
        descripcion: str(row[col.detalle]).trim(),
      })
    } catch {
      filasFallidas++
      if (filasFallidas <= 3) advertencias.push(`Fila ${i + 1}: no se pudo interpretar — omitida.`)
    }
  }

  if (asientos.length === 0) {
    advertencias.push(
      'No se encontraron movimientos. Exporte el Libro Auxiliar desde Siigo con la opción "Detalle de movimientos" activada.',
    )
  }

  return {
    asientos,
    advertencias,
    totalFilas: asientos.length + filasFallidas,
    filasFallidas,
    periodoDetectado: periodo,
    empresaDetectada: empresa,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeGet(rows: unknown[], row: number, col: number): unknown {
  return (rows[row] as unknown[])?.[col] ?? ''
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : Math.abs(v)
  if (typeof v === 'string') {
    const limpio = v.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
    const n = parseFloat(limpio)
    return isNaN(n) ? 0 : Math.abs(n)
  }
  return 0
}

/** Convierte número serial de Excel (días desde 30/12/1899) a ISO YYYY-MM-DD */
function excelSerialToIso(v: unknown): string {
  if (typeof v === 'number' && v > 25000) {
    const d = new Date((v - 25569) * 86400000)
    return d.toISOString().slice(0, 10)
  }
  if (typeof v === 'string' && v.trim()) {
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  }
  return new Date().toISOString().slice(0, 10)
}

function construirTercero(nitRaw: string, dvRaw: string, nombreRaw: string): TerceroExogena {
  const soloDigitos = nitRaw.replace(/\D/g, '')
  // xlsx tiene columna DV separada → si existe, es NIT
  const dv = dvRaw.replace(/\D/g, '') || undefined
  const nombre = nombreRaw.trim()

  const esPJ = esPersonaJuridica(nombre)
  const tipoDocumento: TipoDocumentoDIAN = (dv || esPJ) ? '3' : '1'

  const nombres = !esPJ ? parsearNombreColombia(nombre) : null

  return {
    tipoDocumento,
    numeroId:        soloDigitos,
    dv,
    paisCodigo:      'CO',
    razonSocial:     esPJ ? nombre : undefined,
    primerApellido:  nombres?.primerApellido  || undefined,
    segundoApellido: nombres?.segundoApellido || undefined,
    primerNombre:    nombres?.primerNombre    || undefined,
    otrosNombres:    nombres?.otrosNombres    || undefined,
    tipoTercero:     esPJ ? 'persona_juridica' : 'persona_natural',
  }
}
