/**
 * Parser de exportaciones de Siigo (software contable colombiano).
 * Soporta:
 *   - Libro Auxiliar General (Mov. aux cuenta contable-*.xlsx)
 *   - Facturas de venta, Cartera, CxP
 *   - Movimientos contables genéricos
 *
 * El Libro Auxiliar tiene filas de metadatos arriba; se detecta el
 * renglón real de encabezados buscando CUENTA + DÉBITOS/CRÉDITOS.
 */
import * as XLSX from 'xlsx'
import { createHash } from 'crypto'
import type { MovimientoSiigo } from '../models'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function limpiarMonto(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const txt = String(val).replace(/\$/g, '').trim()
  if (!txt || txt === '-' || txt === '(-)') return 0
  // Colombiano con decimales: 1.234.567,89
  if (/^-?[\d.]+,\d{1,2}$/.test(txt))
    return Math.abs(parseFloat(txt.replace(/\./g, '').replace(',', '.')) || 0)
  // Solo miles con puntos: 1.234.567
  if (/^-?[\d.]+$/.test(txt))
    return Math.abs(parseFloat(txt.replace(/\./g, '')) || 0)
  // Internacional: 1,234,567.89
  if (/^-?[\d,]+\.\d{1,2}$/.test(txt))
    return Math.abs(parseFloat(txt.replace(/,/g, '')) || 0)
  return Math.abs(parseFloat(txt.replace(/[.,]/g, '')) || 0)
}

function parsearFechaSiigo(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const txt = String(val).trim()
  const m1 = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt
  const m2 = txt.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
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
  return 'SIG_' + createHash('md5').update(`${tipo}|${numero}|${nit}|${idx}`).digest('hex').slice(0, 12).toUpperCase()
}

// ─── DETECCIÓN LIBRO AUXILIAR ─────────────────────────────────────────────────

/**
 * Busca la fila que contiene los encabezados reales del Libro Auxiliar
 * (CUENTA / CUENTA PUC y DÉBITO o CRÉDITO).
 * Devuelve el índice de esa fila o -1 si no es formato Libro Auxiliar.
 */
function encontrarFilaEncabezado(raw: unknown[][]): number {
  for (let i = 0; i < Math.min(raw.length, 20); i++) {
    const row = (raw[i] as unknown[]).map(c => String(c ?? '').trim().toUpperCase())
    const tieneCuenta = row.some(c => c === 'CUENTA' || c === 'CUENTA PUC' || c.startsWith('CUENTA'))
    const tieneDebito = row.some(c =>
      c === 'DÉBITOS' || c === 'DEBITOS' || c === 'DÉBITO' || c === 'DEBITO' ||
      c.includes('DÉBITO') || c.includes('DEBITO')
    )
    if (tieneCuenta && tieneDebito) return i
  }
  return -1
}

/** Construye un mapa nombre-columna → índice a partir de la fila de encabezados. */
function mapearColumnas(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((cell, idx) => {
    const h = String(cell ?? '').trim().toUpperCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
    map[h] = idx
  })
  return map
}

function resolverColumna(colMap: Record<string, number>, ...candidatos: string[]): number {
  for (const c of candidatos) {
    const norm = c.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (norm in colMap) return colMap[norm]
    // búsqueda parcial
    const key = Object.keys(colMap).find(k => k.includes(norm) || norm.includes(k))
    if (key) return colMap[key]
  }
  return -1
}

// ─── PARSER LIBRO AUXILIAR ───────────────────────────────────────────────────

function parsearLibroAuxiliar(raw: unknown[][], headerIdx: number, nombre: string): ResultadoSiigo {
  const movimientos: MovimientoSiigo[] = []
  const errores: string[] = []

  const colMap = mapearColumnas(raw[headerIdx] as unknown[])

  // Índices de columnas clave
  const iCuenta   = resolverColumna(colMap, 'CUENTA', 'CUENTA PUC', 'COD CUENTA')
  const iNomCta   = resolverColumna(colMap, 'NOMBRE CUENTA', 'NOMBRE CTA', 'DESCRIPCION CUENTA')
  const iNit      = resolverColumna(colMap, 'NIT', 'IDENTIFICACION', 'DOC')
  const iDv       = resolverColumna(colMap, 'DIG.VER.', 'DV', 'DIGITO')
  const iNombre   = resolverColumna(colMap, 'NOMBRE', 'RAZON SOCIAL', 'TERCERO')
  const iComp     = resolverColumna(colMap, 'COMPROBANTE', 'No. COMPROBANTE', 'NUMERO', 'DOCUMENTO')
  const iFecha    = resolverColumna(colMap, 'FECHA', 'FECHA MOV', 'FECHA COMPROBANTE')
  const iDetalle  = resolverColumna(colMap, 'DETALLE', 'DESCRIPCION', 'CONCEPTO', 'GLOSA')
  const iDebito   = resolverColumna(colMap, 'DEBITOS', 'DEBITO', 'VALOR DEBITO', 'CARGO')
  const iCredito  = resolverColumna(colMap, 'CREDITOS', 'CREDITO', 'VALOR CREDITO', 'ABONO')
  const iSaldo    = resolverColumna(colMap, 'SALDO', 'SALDO ACUMULADO')

  if (iDebito < 0 || iCredito < 0) {
    errores.push('Libro Auxiliar: no se encontraron columnas DÉBITOS/CRÉDITOS. Verifique el formato del archivo.')
    return { movimientos, errores }
  }

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] as unknown[]
    if (!row || row.every(c => !c)) continue

    try {
      const cuenta = String(row[iCuenta] ?? '').trim()
      // Saltar filas de totales / subtotales
      if (!cuenta || /^(TOTAL|SUBTOTAL|GRAND)/i.test(cuenta)) continue
      if (/^(TOTAL|SUBTOTAL)/i.test(String(row[iNombre] ?? ''))) continue

      const fecha = parsearFechaSiigo(iFecha >= 0 ? row[iFecha] : undefined)
      if (!fecha) continue

      const debito  = limpiarMonto(iDebito  >= 0 ? row[iDebito]  : undefined)
      const credito = limpiarMonto(iCredito >= 0 ? row[iCredito] : undefined)
      if (debito === 0 && credito === 0) continue

      const nit       = String(row[iNit]     ?? '').trim()
      const nombre_t  = String(row[iNombre]  ?? '').trim()
      const comprobante = String(row[iComp]  ?? '').trim()
      const detalle   = String(row[iDetalle] ?? '').trim()
      const nomCta    = String(iNomCta >= 0 ? (row[iNomCta] ?? '') : '').trim()
      const saldo     = iSaldo >= 0 ? limpiarMonto(row[iSaldo]) : undefined

      const monto = debito > 0 ? debito : credito

      movimientos.push({
        id: idSiigo('libro_auxiliar', comprobante, nit || cuenta, i),
        tipoExportacion: 'libro_auxiliar',
        fecha,
        numeroDocumento: comprobante || undefined,
        tipoDocumento: nomCta || undefined,
        cuentaContable: cuenta,
        nitTercero: nit || undefined,
        nombreTercero: nombre_t || undefined,
        descripcion: detalle || comprobante || `${cuenta} ${nomCta}`.trim(),
        debito, credito, monto,
        iva: 0, retefuente: 0, reteica: 0,
        saldo,
        estado: 'no_conciliado',
        matchIds: [],
        confianzaMatch: 0,
      })
    } catch (e) {
      errores.push(`Fila ${i}: ${e}`)
    }
  }

  if (movimientos.length === 0 && errores.length === 0)
    errores.push('Libro Auxiliar: no se encontraron movimientos con monto y fecha. Verifique que el archivo no esté vacío.')

  return { movimientos, errores }
}

// ─── PARSER FORMATO ESTÁNDAR ─────────────────────────────────────────────────

function parsearFormatoEstandar(
  rows: Record<string, unknown>[],
  tipo: string,
): ResultadoSiigo {
  const movimientos: MovimientoSiigo[] = []
  const errores: string[] = []

  // Auto-detección por columnas disponibles
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
      const fecha = parsearFechaSiigo(buscar(fila, ['Fecha', 'Fecha Factura', 'Fecha Doc', 'Fecha Mov']))
      if (!fecha) return
      const numero  = String(buscar(fila, ['Número', 'No. Factura', 'No.', 'Número Doc']) || '')
      const nit     = String(buscar(fila, ['NIT', 'Nit', 'NIT Proveedor', 'Identificación']) || '').trim()
      const nombre_t = String(buscar(fila, ['Nombre', 'Razón Social', 'Cliente', 'Proveedor', 'Nombre Tercero']) || '')

      let mov: MovimientoSiigo | null = null

      if (tipo === 'factura_venta') {
        const total = limpiarMonto(buscar(fila, ['Total', 'Valor Total', 'Valor']))
        const iva   = limpiarMonto(buscar(fila, ['IVA', 'Iva']))
        const rfte  = limpiarMonto(buscar(fila, ['ReteFuente', 'Retefuente', 'Rete Fuente']))
        const rica  = limpiarMonto(buscar(fila, ['ReteICA', 'Reteica', 'Rete ICA']))
        mov = {
          id: idSiigo(tipo, numero, nit, idx),
          tipoExportacion: tipo, fecha,
          numeroDocumento: numero || undefined,
          nitTercero: nit || undefined,
          nombreTercero: nombre_t || undefined,
          descripcion: `Factura ${numero} — ${nombre_t}`,
          debito: 0, credito: total, monto: total,
          iva, retefuente: rfte, reteica: rica,
          estado: 'no_conciliado', matchIds: [], confianzaMatch: 0,
        }
      } else if (tipo === 'cartera') {
        const saldo = limpiarMonto(buscar(fila, ['Saldo', 'Valor Saldo', 'Saldo Cartera']))
        mov = {
          id: idSiigo(tipo, numero, nit, idx),
          tipoExportacion: tipo, fecha,
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
        const valor = limpiarMonto(buscar(fila, ['Valor', 'Valor Factura']))
        const saldo = limpiarMonto(buscar(fila, ['Saldo', 'Valor Saldo']))
        mov = {
          id: idSiigo(tipo, numero, nit, idx),
          tipoExportacion: tipo, fecha,
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
        // movimiento contable genérico
        const cuenta  = String(buscar(fila, ['Cuenta', 'Código Cuenta', 'Cta']) || '')
        const desc    = String(buscar(fila, ['Descripción', 'Detalle', 'Concepto']) || '')
        const debito  = limpiarMonto(buscar(fila, ['Débito', 'Debito', 'Débitos', 'Debitos']))
        const credito = limpiarMonto(buscar(fila, ['Crédito', 'Credito', 'Créditos', 'Creditos']))
        mov = {
          id: idSiigo(tipo, numero, nit, idx),
          tipoExportacion: tipo, fecha,
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

      if (mov) movimientos.push(mov)
    } catch (e) {
      errores.push(`Fila ${idx}: ${e}`)
    }
  })

  return { movimientos, errores }
}

// ─── ENTRADA PÚBLICA ─────────────────────────────────────────────────────────

export interface ResultadoSiigo {
  movimientos: MovimientoSiigo[]
  errores: string[]
  esLibroAuxiliar?: boolean
}

export function parsearSiigo(buffer: Buffer | ArrayBuffer, nombre: string, tipo = 'auto'): ResultadoSiigo {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  } catch (e) {
    return { movimientos: [], errores: [`No se pudo leer ${nombre}: ${e}`] }
  }

  const ws = wb.Sheets[wb.SheetNames[0]]

  // Leer como arrays crudos para detectar Libro Auxiliar
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  const headerIdx = encontrarFilaEncabezado(raw)

  if (headerIdx >= 0) {
    // Es Libro Auxiliar (o formato similar con metadatos al inicio)
    const res = parsearLibroAuxiliar(raw, headerIdx, nombre)
    return { ...res, esLibroAuxiliar: true }
  }

  // Formato estándar Siigo
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  return parsearFormatoEstandar(rows, tipo)
}
