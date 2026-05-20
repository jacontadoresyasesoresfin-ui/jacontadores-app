/**
 * Parser de extractos bancarios — soporta Bancolombia, Davivienda, BBVA,
 * Banco de Bogotá y formato personalizado.
 */
import * as XLSX from 'xlsx'
import { createHash } from 'crypto'
import type { MovimientoBancario, TipoMovimiento } from '../models'
import { FORMATOS_BANCO } from '../config'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function limpiarMonto(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0
  const txt = String(valor)
    .trim()
    .replace(/\$|COP|\s/g, '')
    .replace(/\((.+)\)/, '-$1')   // (1.000) → -1.000
  // Formato colombiano: punto = miles, coma = decimal
  const normalizado = txt.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(normalizado)
  return isNaN(n) ? 0 : Math.abs(n)
}

function parsearFecha(valor: unknown): string | null {
  if (!valor) return null
  // Excel serializa fechas como número
  if (typeof valor === 'number') {
    const d = XLSX.SSF.parse_date_code(valor)
    if (d) {
      const mm = String(d.m).padStart(2, '0')
      const dd = String(d.d).padStart(2, '0')
      return `${d.y}-${mm}-${dd}`
    }
  }
  const txt = String(valor).trim()
  // DD/MM/YYYY
  const m1 = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt
  // DD/MM/YY
  const m2 = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
  if (m2) return `20${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`
  return null
}

function generarId(banco: string, fecha: string, desc: string, monto: number, idx: number): string {
  const semilla = `${banco}|${fecha}|${desc.slice(0,30)}|${monto}|${idx}`
  return 'BCO_' + createHash('md5').update(semilla).digest('hex').slice(0, 12).toUpperCase()
}

function buscarColumna(fila: Record<string, unknown>, candidatos: string[]): unknown {
  for (const c of candidatos) {
    const exacta = fila[c]
    if (exacta !== undefined && exacta !== null && exacta !== '') return exacta
    // Case-insensitive
    const key = Object.keys(fila).find(k => k.trim().toLowerCase() === c.toLowerCase())
    if (key) {
      const val = fila[key]
      if (val !== undefined && val !== null && val !== '') return val
    }
  }
  return undefined
}

// ─── PARSER PRINCIPAL ─────────────────────────────────────────────────────────

export interface ResultadoParser {
  movimientos: MovimientoBancario[]
  errores: string[]
}

export function parsearExtractoBancario(
  buffer: Buffer | ArrayBuffer,
  nombreArchivo: string,
  formatoBanco: keyof typeof FORMATOS_BANCO = 'bancolombia',
  mapeoPersonalizado?: Partial<typeof FORMATOS_BANCO['bancolombia']>,
  cuenta?: string,
): ResultadoParser {
  const movimientos: MovimientoBancario[] = []
  const errores: string[] = []

  const config = {
    ...FORMATOS_BANCO[formatoBanco] ?? FORMATOS_BANCO.bancolombia,
    ...mapeoPersonalizado,
  }

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  } catch (e) {
    return { movimientos: [], errores: [`No se pudo leer el archivo ${nombreArchivo}: ${e}`] }
  }

  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: true,
  })

  const nombreBanco = config.nombre

  rows.forEach((fila, idx) => {
    try {
      const fechaRaw = buscarColumna(fila, [config.colFecha, 'Fecha', 'FECHA', 'Date'])
      const fecha = parsearFecha(fechaRaw)
      if (!fecha) return

      const desc = String(buscarColumna(fila, [
        config.colDescripcion, 'Descripción', 'Descripcion', 'DESCRIPCIÓN', 'Detalle', 'Concepto',
      ]) || 'Sin descripción').trim()

      const refRaw = config.colReferencia
        ? buscarColumna(fila, [config.colReferencia, 'Referencia', 'REFERENCIA', 'Ref'])
        : undefined
      const referencia = refRaw ? String(refRaw).trim() || undefined : undefined

      const saldoRaw = config.colSaldo
        ? buscarColumna(fila, [config.colSaldo, 'Saldo', 'SALDO'])
        : undefined
      const saldo = saldoRaw !== undefined ? limpiarMonto(saldoRaw) : undefined

      let tipo: TipoMovimiento
      let monto: number

      // Banco con columna única de monto
      if ('colMonto' in config && config.colMonto) {
        const raw = buscarColumna(fila, [(config as { colMonto: string }).colMonto])
        const val = parseFloat(String(raw).replace(/\./g,'').replace(',','.')) || 0
        tipo = val >= 0 ? 'credito' : 'debito'
        monto = Math.abs(val)
      } else {
        const debitoRaw = config.colDebito
          ? buscarColumna(fila, [config.colDebito, 'Débito', 'Débitos', 'Debito'])
          : undefined
        const creditoRaw = config.colCredito
          ? buscarColumna(fila, [config.colCredito, 'Crédito', 'Créditos', 'Credito'])
          : undefined
        const debito  = limpiarMonto(debitoRaw)
        const credito = limpiarMonto(creditoRaw)
        if (credito > 0 && debito === 0)      { tipo = 'credito'; monto = credito }
        else if (debito > 0 && credito === 0) { tipo = 'debito';  monto = debito  }
        else if (credito >= debito)           { tipo = 'credito'; monto = credito }
        else                                  { tipo = 'debito';  monto = debito  }
      }

      if (monto === 0) return

      movimientos.push({
        id: generarId(nombreBanco, fecha, desc, monto, idx),
        fecha,
        descripcion: desc,
        referencia,
        tipo,
        monto,
        saldo,
        banco: nombreBanco,
        cuenta: cuenta || undefined,
        estado: 'no_conciliado',
        matchIds: [],
        confianzaMatch: 0,
      })
    } catch (e) {
      errores.push(`Fila ${idx}: ${e}`)
    }
  })

  return { movimientos, errores }
}

/** Retorna las columnas de un archivo Excel sin procesarlo completo. */
export function obtenerColumnasArchivo(buffer: Buffer | ArrayBuffer): string[] {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', sheetRows: 2 })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    return rows.length > 0 ? Object.keys(rows[0]) : []
  } catch {
    return []
  }
}
