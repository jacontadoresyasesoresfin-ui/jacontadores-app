import * as XLSX from 'xlsx'
import type { AsientoContable, TerceroExogena, TipoDocumentoDIAN } from '../types'
import type { ResultadoParseoCsv } from './siigo-csv-parser'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'

export function parsearSiigoBalance(buffer: Buffer): ResultadoParseoCsv {
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
  const col = {
    grupo: 0, cuenta: 1, subcuenta: 2, auxiliar: 3, subauxiliar: 4,
    nit: 5, dv: 7, descripcion: 10,
    saldoAnterior: 12, debitos: 13, creditos: 14, nuevoSaldo: 15
  }

  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i] as unknown[]
    const rowJoined = row.map(c => str(c).toUpperCase()).join('|')
    if (rowJoined.includes('GRUPO') && rowJoined.includes('NIT') && rowJoined.includes('DEBITOS')) {
      headerIdx = i
      // Detect exact positions if they shift
      row.forEach((hRaw, idx) => {
        const hClean = str(hRaw).toUpperCase().replace(/[^A-Z]/g, '')
        if (hClean === 'GRUPO') col.grupo = idx
        else if (hClean === 'CUENTA') col.cuenta = idx
        else if (hClean === 'SUBCUENT' || hClean === 'SUBCUENTA') col.subcuenta = idx
        else if (hClean === 'AUXILIAR') col.auxiliar = idx
        else if (hClean === 'SUBAUXIL' || hClean === 'SUBAUXILIAR') col.subauxiliar = idx
        else if (hClean === 'NIT') col.nit = idx
        else if (hClean.includes('DIGVERIFICACION') || hClean === 'DV') col.dv = idx
        else if (hClean === 'DESCRIPCION' || hClean === 'NOMBRE') col.descripcion = idx
        else if (hClean === 'SALDOANTERIOR') col.saldoAnterior = idx
        else if (hClean === 'DEBITOS' || hClean === 'DEBITO') col.debitos = idx
        else if (hClean === 'CREDITOS' || hClean === 'CREDITO') col.creditos = idx
        else if (hClean === 'NUEVOSALDO') col.nuevoSaldo = idx
      })
      break
    }
  }

  if (headerIdx === -1) {
    return {
      asientos: [],
      advertencias: ['No se reconoció la estructura del Balance de Prueba de Siigo.'],
      totalFilas: 0, filasFallidas: 0,
    }
  }

  const asientos: AsientoContable[] = []
  let filasFallidas = 0
  let idCounter = 1

  let currentCuentaPuc = ''
  let currentNombreCuenta = ''

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const grupo = str(row[col.grupo])
    const nitRaw = str(row[col.nit]) // USE str() to trim spaces!
    const desc = str(row[col.descripcion])

    // Skip empty rows
    if (!grupo && !nitRaw && !desc) continue

    // Detect if this is an account header row (has grupo/cuenta but no NIT)
    // Sometimes Siigo outputs the account levels in the first columns
    if (grupo && !nitRaw) {
      const g = str(row[col.grupo])
      const c = str(row[col.cuenta])
      const sc = str(row[col.subcuenta])
      const aux = str(row[col.auxiliar])
      const saux = str(row[col.subauxiliar])
      
      const combined = `${g}${c}${sc}${aux}${saux}`.replace(/\s+/g, '')
      if (combined.length > 0) {
        currentCuentaPuc = combined
        currentNombreCuenta = desc
      }
      continue
    }

    // Third-party row under an account
    if (nitRaw && currentCuentaPuc) {
      try {
        const saldoAnterior = toNum(row[col.saldoAnterior])
        const debitos = toNum(row[col.debitos])
        const creditos = toNum(row[col.creditos])
        // If there's no movement and no balance, skip
        if (saldoAnterior === 0 && debitos === 0 && creditos === 0) continue

        const dv = str(row[col.dv])
        const tercero = construirTercero(str(nitRaw), dv, desc)
        const fecha = new Date().toISOString().slice(0, 10) // Fictitious date since it's an aggregate

        // Emit Saldo Anterior (Only if != 0)
        // Note: For Exógena, opening balances are only useful for ending balances.
        // We emit it as a distinct entry so that Formatos like 1001 can ignore it.
        if (saldoAnterior !== 0) {
          asientos.push({
            id: `BAL-SA-${String(idCounter++).padStart(5, '0')}`,
            fecha,
            cuentaPuc: currentCuentaPuc,
            nombreCuenta: currentNombreCuenta,
            naturaleza: saldoAnterior > 0 ? 'debito' : 'credito',
            monto: Math.abs(saldoAnterior),
            tercero,
            documentoId: 'BALANCE',
            descripcion: 'Saldo Anterior',
            esSaldoInicial: true
          })
        }

        // Emit Debitos (Movements in the period)
        if (debitos !== 0) {
          asientos.push({
            id: `BAL-DB-${String(idCounter++).padStart(5, '0')}`,
            fecha,
            cuentaPuc: currentCuentaPuc,
            nombreCuenta: currentNombreCuenta,
            naturaleza: 'debito',
            monto: Math.abs(debitos),
            tercero,
            documentoId: 'BALANCE',
            descripcion: 'Débitos del período'
          })
        }

        // Emit Creditos (Movements in the period)
        if (creditos !== 0) {
          asientos.push({
            id: `BAL-CR-${String(idCounter++).padStart(5, '0')}`,
            fecha,
            cuentaPuc: currentCuentaPuc,
            nombreCuenta: currentNombreCuenta,
            naturaleza: 'credito',
            monto: Math.abs(creditos),
            tercero,
            documentoId: 'BALANCE',
            descripcion: 'Créditos del período'
          })
        }

      } catch {
        filasFallidas++
      }
    }
  }

  if (asientos.length === 0) {
    advertencias.push('No se encontraron terceros ni movimientos. Verifique que sea un "Balance de Prueba por Terceros".')
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
  if (typeof v === 'number') return v // Can be negative (Siigo outputs negative for credits in some cols, but we check > 0)
  if (typeof v === 'string') {
    const limpio = v.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
    const n = parseFloat(limpio)
    return isNaN(n) ? 0 : n
  }
  return 0
}

function construirTercero(nitRaw: string, dvRaw: string, nombreRaw: string): TerceroExogena {
  const soloDigitos = nitRaw.replace(/\D/g, '')
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
