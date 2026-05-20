/**
 * Parser de exportaciones de Siigo (software contable colombiano).
 */
import * as XLSX from 'xlsx'
import { createHash } from 'crypto'
import type { MovimientoSiigo } from '../models'

function limpiarMonto(val: unknown): number {
  if (!val) return 0
  const txt = String(val).replace(/[$.]/g, '').replace(',', '.').trim()
  return Math.abs(parseFloat(txt) || 0)
}

function parsearFechaSiigo(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  const txt = String(val).trim()
  const m = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt
  return null
}

function buscar(fila: Record<string, unknown>, candidatos: string[]): unknown {
  for (const c of candidatos) {
    if (c in fila) return fila[c]
    const k = Object.keys(fila).find(kk => kk.trim().toLowerCase() === c.toLowerCase())
    if (k) return fila[k]
  }
  return undefined
}

function idSiigo(tipo: string, numero: string, nit: string, idx: number): string {
  return 'SIG_' + createHash('md5').update(`${tipo}|${numero}|${nit}|${idx}`).digest('hex').slice(0,12).toUpperCase()
}

export interface ResultadoSiigo {
  movimientos: MovimientoSiigo[]
  errores: string[]
}

export function parsearSiigo(buffer: Buffer | ArrayBuffer, nombre: string, tipo = 'auto'): ResultadoSiigo {
  const movimientos: MovimientoSiigo[] = []
  const errores: string[] = []

  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  } catch (e) {
    return { movimientos: [], errores: [`No se pudo leer ${nombre}: ${e}`] }
  }

  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  // Detección automática por columnas
  if (tipo === 'auto') {
    const cols = rows[0] ? Object.keys(rows[0]).map(c => c.toLowerCase()) : []
    if (cols.some(c => c.includes('débito') || c.includes('debito') || c.includes('cuenta')))
      tipo = 'movimiento'
    else if (cols.some(c => c.includes('días') || c.includes('dias') || c.includes('vencimiento')))
      tipo = 'cartera'
    else if (cols.some(c => c.includes('proveedor')))
      tipo = 'cxp'
    else
      tipo = 'factura_venta'
  }

  rows.forEach((fila, idx) => {
    try {
      const fecha = parsearFechaSiigo(buscar(fila, ['Fecha','Fecha Factura','Fecha Doc','Fecha Mov']))
      if (!fecha) return
      const numero = String(buscar(fila, ['Número','No. Factura','No.','Número Doc']) || '')
      const nit    = String(buscar(fila, ['NIT','Nit','NIT Proveedor','Identificación']) || '').trim()
      const nombre_t= String(buscar(fila, ['Nombre','Razón Social','Cliente','Proveedor','Nombre Tercero']) || '')

      let movimiento: MovimientoSiigo | null = null

      if (tipo === 'factura_venta') {
        const total = limpiarMonto(buscar(fila, ['Total','Valor Total','Valor']))
        const iva   = limpiarMonto(buscar(fila, ['IVA','Iva']))
        const rfte  = limpiarMonto(buscar(fila, ['ReteFuente','Retefuente','Rete Fuente']))
        const rica  = limpiarMonto(buscar(fila, ['ReteICA','Reteica','Rete ICA']))
        movimiento = {
          id: idSiigo(tipo, numero, nit, idx),
          tipoExportacion: tipo,
          fecha,
          numeroDocumento: numero || undefined,
          nitTercero: nit || undefined,
          nombreTercero: nombre_t || undefined,
          descripcion: `Factura ${numero} — ${nombre_t}`,
          debito: 0, credito: total, monto: total,
          iva, retefuente: rfte, reteica: rica,
          estado: 'no_conciliado', matchIds: [], confianzaMatch: 0,
        }
      } else if (tipo === 'cartera') {
        const saldo = limpiarMonto(buscar(fila, ['Saldo','Valor Saldo','Saldo Cartera']))
        const diasRaw = buscar(fila, ['Días','Días Vencimiento','Dias'])
        const dias = diasRaw !== undefined ? parseInt(String(diasRaw)) || undefined : undefined
        movimiento = {
          id: idSiigo(tipo, numero, nit, idx),
          tipoExportacion: tipo,
          fecha,
          numeroDocumento: numero || undefined,
          nitTercero: nit || undefined,
          nombreTercero: nombre_t || undefined,
          descripcion: `Cartera ${numero} — ${nombre_t}`,
          debito: 0, credito: saldo, monto: saldo,
          iva: 0, retefuente: 0, reteica: 0,
          saldo,
          estado: 'no_conciliado', matchIds: [], confianzaMatch: 0,
        }
      } else if (tipo === 'cxp') {
        const valor = limpiarMonto(buscar(fila, ['Valor','Valor Factura']))
        const saldo = limpiarMonto(buscar(fila, ['Saldo','Valor Saldo']))
        movimiento = {
          id: idSiigo(tipo, numero, nit, idx),
          tipoExportacion: tipo,
          fecha,
          numeroDocumento: numero || undefined,
          nitTercero: nit || undefined,
          nombreTercero: nombre_t || undefined,
          descripcion: `CxP ${numero} — ${nombre_t}`,
          debito: valor, credito: 0, monto: valor,
          iva: 0, retefuente: 0, reteica: 0,
          saldo,
          estado: 'no_conciliado', matchIds: [], confianzaMatch: 0,
        }
      } else {
        // movimiento contable
        const cuenta = String(buscar(fila, ['Cuenta','Código Cuenta']) || '')
        const desc   = String(buscar(fila, ['Descripción','Detalle','Concepto']) || '')
        const debito = limpiarMonto(buscar(fila, ['Débito','Debito']))
        const credito= limpiarMonto(buscar(fila, ['Crédito','Credito']))
        movimiento = {
          id: idSiigo(tipo, numero, nit, idx),
          tipoExportacion: tipo,
          fecha,
          numeroDocumento: numero || undefined,
          cuentaContable: cuenta || undefined,
          descripcion: desc || `Mov. ${numero}`,
          nitTercero: nit || undefined,
          nombreTercero: nombre_t || undefined,
          debito, credito, monto: credito > 0 ? credito : debito,
          iva: 0, retefuente: 0, reteica: 0,
          estado: 'no_conciliado', matchIds: [], confianzaMatch: 0,
        }
      }

      if (movimiento) movimientos.push(movimiento)
    } catch (e) {
      errores.push(`Fila ${idx}: ${e}`)
    }
  })

  return { movimientos, errores }
}
