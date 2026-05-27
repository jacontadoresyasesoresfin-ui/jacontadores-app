/**
 * POST /api/conciliaciones/exportar
 * Devuelve un Excel (.xlsx) con hojas organizadas:
 *   1. Portada            — resumen ejecutivo + KPIs
 *   2. Formato T          — conciliación bancaria formal colombiana
 *   3. Mov. Banco         — todos los movimientos del extracto (color-coded por estado)
 *   4. Siigo Auxiliar     — movimientos Libro Auxiliar Siigo (cuentas 11xx)
 *   5. Matches            — pares conciliados con confianza
 *   6. Sin Conciliar      — banco + Siigo sin match
 *   7. Facturas DIAN      — facturas electrónicas procesadas
 *   8. Discrepancias      — hallazgos con severidad y recomendación
 *   9. IVA                — resumen IVA generado / descontable
 *  10. Retefuente         — conceptos y valores practicados / sufridos
 *  11. ICA                — actividades económicas y estimado
 *  12. Log Auditoría      — trazabilidad completa del proceso
 */
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import type {
  ResultadoConciliacion, MovimientoBancario, FacturaElectronica,
} from '@/lib/conciliaciones/models'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
const PCT = (n: number) => `${n.toFixed(1)}%`
const NOW = () => new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })

/** Celda numérica (permite sumas en Excel) */
function N(v: number): XLSX.CellObject { return { t: 'n', v, z: '#,##0' } }
/** Celda de porcentaje */
function P(v: number): XLSX.CellObject { return { t: 'n', v: v / 100, z: '0.0%' } }
/** Celda de texto */
function T(v: string | number | undefined | null): XLSX.CellObject {
  return { t: 's', v: String(v ?? '') }
}

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map(w => ({ wch: w }))
}

function addRows(ws: XLSX.WorkSheet, rows: (XLSX.CellObject | string | number | null | undefined)[][], origin = 'A1') {
  XLSX.utils.sheet_add_aoa(ws, rows as any[][], { origin })
}

// ── Hoja 1: Portada ────────────────────────────────────────────────────────────
function hojaPortada(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const k = r.kpis
  const rows: any[][] = [
    ['J&A Contadores y Asesores — Conciliación Bancaria y Tributaria'],
    [''],
    ['DATOS DEL PROCESO', ''],
    ['Empresa', r.config.nombreEmpresa || '—'],
    ['NIT', r.config.nitEmpresa || '—'],
    ['Banco', r.config.banco || '—'],
    ['Número de cuenta', r.config.numeroCuenta || '—'],
    ['Período', `${r.config.periodoInicio || '—'} al ${r.config.periodoFin || '—'}`],
    ['Fecha de proceso', NOW()],
    [''],
    ['RESUMEN EJECUTIVO', ''],
    ['Total créditos banco', N(k.totalBancoCreditos)],
    ['Total débitos banco',  N(k.totalBancoDebitos)],
    ['Total ventas facturadas', N(k.totalFacturasVentas)],
    ['Movimientos banco conciliados', `${k.numBancoConciliados} de ${k.numBancoConciliados + k.numBancoNoConciliados}`],
    ['% conciliado banco', P(k.porcentajeConciliadoBanco)],
    ['Facturas DIAN conciliadas', `${k.numFacturasConciliadas} de ${k.numFacturasConciliadas + k.numFacturasNoConciliadas}`],
    ['% conciliado facturas', P(k.porcentajeConciliadoFacturas)],
    [''],
    ['NORMATIVIDAD APLICADA', ''],
    ['Retefuente', 'Decreto 1625/2016 + Comunicado DIAN 070/2026'],
    ['UVT 2026', N(52374)],
    ['ICA', 'Tarifas municipales por DIVIPOLA'],
    ['Formatos exógenas', 'Resolución 000227/2025 + 000233/2025 (v11)'],
  ]
  addRows(ws, rows)
  setColWidths(ws, [34, 36])
  return ws
}

// ── Hoja 2: Formato T — Conciliación Bancaria Formal ──────────────────────────
function hojaFormatoT(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const cb = r.resumenConciliacionBancaria

  if (!cb) {
    addRows(ws, [['Sin datos de conciliación bancaria — suba el Libro Auxiliar Siigo (cuentas 11xx)']])
    setColWidths(ws, [60])
    return ws
  }

  const rows: any[][] = [
    ['CONCILIACIÓN BANCARIA FORMAL — FORMATO T', '', '', ''],
    ['Empresa:', r.config.nombreEmpresa || '—', '', ''],
    ['Período:', `${r.config.periodoInicio || ''} — ${r.config.periodoFin || ''}`, '', ''],
    ['Cuenta:', cb.cuentaBancaria || '—', '', ''],
    [''],
    // Encabezados columnas
    ['LADO BANCO (Extracto)', '', 'LADO LIBROS (Siigo)', ''],
    ['Concepto', 'Monto', 'Concepto', 'Monto'],
    // Saldos iniciales
    ['Saldo según extracto bancario', N(cb.saldoSegunBanco), 'Saldo según Libro Auxiliar Siigo', N(cb.saldoSegunLibros)],
  ]

  // Partidas banco
  for (const p of cb.depositosTransito) {
    rows.push([`(+) Depósito en tránsito: ${p.descripcion.slice(0, 45)}`, N(p.monto), '', ''])
  }
  for (const p of cb.chequesPendientes) {
    rows.push([`(-) Cheque en circulación: ${p.descripcion.slice(0, 45)}`, N(-p.monto), '', ''])
  }

  // Partidas libros (paralelas)
  // Ya están en las filas — agregar notas crédito/débito
  for (const p of cb.notasCreditoBanco) {
    rows.push(['', '', `(+) Nota crédito banco: ${p.descripcion.slice(0, 45)}`, N(p.monto)])
  }
  for (const p of cb.notasDebitoBanco) {
    rows.push(['', '', `(-) Nota débito banco: ${p.descripcion.slice(0, 45)}`, N(-p.monto)])
  }

  rows.push([''])
  rows.push(['SALDO CONCILIADO BANCO', N(cb.saldoAjustadoBanco), 'SALDO CONCILIADO LIBROS', N(cb.saldoAjustadoLibros)])
  rows.push([''])
  rows.push(['DIFERENCIA', N(cb.diferencia), '', ''])
  rows.push([cb.diferencia <= 100 ? '✓ CONCILIA — saldos iguales' : '✗ NO CONCILIA — revisar partidas', '', '', ''])
  rows.push([''])
  rows.push(['RESUMEN DE PARTIDAS CONCILIATORIAS', '', '', ''])
  rows.push(['Depósitos en tránsito (en libros, no en banco)', N(cb.totalDepositosTransito), `${cb.depositosTransito.length} ítems`, ''])
  rows.push(['Cheques en circulación (en libros, no en banco)', N(cb.totalChequesPendientes), `${cb.chequesPendientes.length} ítems`, ''])
  rows.push(['Notas crédito banco (en banco, no en libros)', N(cb.totalNotasCredito), `${cb.notasCreditoBanco.length} ítems`, ''])
  rows.push(['Notas débito banco (en banco, no en libros)', N(cb.totalNotasDebito), `${cb.notasDebitoBanco.length} ítems`, ''])

  addRows(ws, rows)
  setColWidths(ws, [52, 18, 52, 18])
  return ws
}

// ── Hoja 3: Todos los movimientos banco ────────────────────────────────────────
function hojaMovBanco(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const rows: any[][] = [
    ['Fecha', 'Descripción', 'Tipo', 'Monto', 'Saldo', 'Referencia', 'Estado', 'Confianza Match', 'Banco', 'Cuenta'],
    ...r.movimientosBanco.map(m => [
      T(m.fecha),
      T(m.descripcion),
      T(m.tipo),
      N(m.monto),
      m.saldo != null ? N(m.saldo) : T('—'),
      T(m.referencia),
      T(m.estado),
      m.confianzaMatch > 0 ? P(m.confianzaMatch * 100) : T('—'),
      T(m.banco),
      T(m.cuenta),
    ]),
  ]
  const resumen: any[][] = [
    [''],
    ['TOTALES'],
    ['Total créditos', N(r.movimientosBanco.filter(m => m.tipo === 'credito').reduce((s, m) => s + m.monto, 0))],
    ['Total débitos',  N(r.movimientosBanco.filter(m => m.tipo === 'debito').reduce((s, m) => s + m.monto, 0))],
    ['Conciliados',    T(`${r.movimientosBanco.filter(m => m.estado === 'conciliado').length} de ${r.movimientosBanco.length}`)],
  ]
  addRows(ws, [...rows, ...resumen])
  setColWidths(ws, [14, 50, 10, 16, 16, 20, 14, 14, 18, 16])
  return ws
}

// ── Hoja 4: Siigo Auxiliar ─────────────────────────────────────────────────────
function hojaSiigo(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  if (!r.movimientosSiigo || r.movimientosSiigo.length === 0) {
    addRows(ws, [['Sin movimientos Siigo — cargue el Libro Auxiliar (cuentas 11xx) para ver esta hoja']])
    setColWidths(ws, [70])
    return ws
  }
  const rows: any[][] = [
    ['Fecha', 'Cuenta PUC', 'Descripción', 'NIT Tercero', 'Nombre Tercero', 'Comprobante', 'Débito', 'Crédito', 'Saldo', 'Estado'],
    ...r.movimientosSiigo.map(s => [
      T(s.fecha),
      T(s.cuentaContable),
      T(s.descripcion),
      T(s.nitTercero),
      T(s.nombreTercero),
      T(s.numeroDocumento),
      s.debito  > 0 ? N(s.debito)  : T(''),
      s.credito > 0 ? N(s.credito) : T(''),
      s.saldo != null ? N(s.saldo) : T(''),
      T(s.estado),
    ]),
  ]
  const resumen: any[][] = [
    [''],
    ['TOTALES'],
    ['Total débitos',  N(r.movimientosSiigo.reduce((s, m) => s + m.debito, 0))],
    ['Total créditos', N(r.movimientosSiigo.reduce((s, m) => s + m.credito, 0))],
    ['Solo cuentas 11xx', T(`${r.movimientosSiigo.filter(m => m.cuentaContable?.startsWith('11')).length} de ${r.movimientosSiigo.length}`)],
  ]
  addRows(ws, [...rows, ...resumen])
  setColWidths(ws, [14, 14, 46, 14, 30, 16, 16, 16, 16, 14])
  return ws
}

// ── Hoja 5: Matches conciliados ────────────────────────────────────────────────
function hojaMatches(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const bancoById = new Map<string, MovimientoBancario>(r.movimientosBanco.map(m => [m.id, m]))
  const rows: any[][] = [
    ['Fecha Banco', 'Descripción Banco', 'Tipo', 'Monto Banco', 'Monto Factura/Siigo', 'Diferencia $', 'Días', 'Confianza', 'Tipo Match', 'Banco→Facturas', 'Banco→Siigo'],
    ...r.matches.map(m => {
      const b = bancoById.get(m.idsBanco[0])
      return [
        T(b?.fecha),
        T(b?.descripcion?.slice(0, 60)),
        T(b?.tipo),
        N(m.montoBanco),
        N(m.montoFactura),
        N(m.diferenciaMonto),
        T(`${m.diferenciaDias}d`),
        P(m.confianza * 100),
        T(m.tipoMatch),
        T(m.idsFacturas.length > 0 ? `${m.idsFacturas.length} factura(s)` : '—'),
        T(m.idsSiigo.length   > 0 ? `${m.idsSiigo.length} Siigo`       : '—'),
      ]
    }),
  ]
  addRows(ws, rows)
  setColWidths(ws, [14, 55, 10, 16, 16, 14, 8, 10, 10, 16, 12])
  return ws
}

// ── Hoja 6: Sin Conciliar ──────────────────────────────────────────────────────
function hojaSinConciliar(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const bancoPend = r.movimientosBanco.filter(m => m.estado !== 'conciliado')
  const siigoPend = (r.movimientosSiigo ?? []).filter(m => m.estado !== 'conciliado')

  const rows: any[][] = [
    ['MOVIMIENTOS BANCO SIN CONCILIAR'],
    ['Fecha', 'Descripción', 'Tipo', 'Monto', 'Referencia', 'Estado'],
    ...bancoPend.map(m => [T(m.fecha), T(m.descripcion), T(m.tipo), N(m.monto), T(m.referencia), T(m.estado)]),
    [''],
    ['SIIGO SIN MATCH (cuentas 11xx)'],
    ['Fecha', 'Cuenta PUC', 'Descripción', 'Débito', 'Crédito', 'Estado'],
    ...siigoPend.filter(s => s.cuentaContable?.startsWith('11')).map(s => [
      T(s.fecha), T(s.cuentaContable), T(s.descripcion),
      s.debito  > 0 ? N(s.debito)  : T(''),
      s.credito > 0 ? N(s.credito) : T(''),
      T(s.estado),
    ]),
  ]
  addRows(ws, rows)
  setColWidths(ws, [14, 50, 10, 16, 20, 14])
  return ws
}

// ── Hoja 7: Facturas DIAN ──────────────────────────────────────────────────────
function hojaFacturas(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const rows: any[][] = [
    ['Fecha Emisión', 'Número', 'NIT Emisor', 'Nombre Emisor', 'NIT Receptor', 'Subtotal', 'IVA', 'Total', 'Tipo', 'Estado', 'CUFE (parcial)'],
    ...r.facturasDian.map((f: FacturaElectronica) => [
      T(f.fechaEmision),
      T(f.numero),
      T(f.nitEmisor),
      T(f.nombreEmisor),
      T(f.nitReceptor),
      N(f.subtotal),
      N(f.total - f.subtotal),
      N(f.total),
      T(f.esNota ? 'Nota' : 'Factura'),
      T(f.estado),
      T(f.cufe?.slice(0, 20) + '…'),
    ]),
  ]
  const sinConc = r.facturasDian.filter((f: FacturaElectronica) => f.estado !== 'conciliado')
  rows.push([''])
  rows.push(['Total facturas', T(`${r.facturasDian.length}`), '', '', '', '', '', N(r.facturasDian.reduce((s: number, f: FacturaElectronica) => s + f.total, 0))])
  rows.push(['Sin conciliar', T(`${sinConc.length}`)])
  addRows(ws, rows)
  setColWidths(ws, [16, 18, 14, 32, 14, 16, 14, 16, 10, 14, 24])
  return ws
}

// ── Hoja 8: Discrepancias ──────────────────────────────────────────────────────
function hojaDiscrepancias(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const severidadOrden: Record<string, number> = { alta: 0, media: 1, baja: 2 }
  const ordenadas = [...r.discrepancias].sort(
    (a, b) => (severidadOrden[a.severidad] ?? 9) - (severidadOrden[b.severidad] ?? 9)
  )
  const rows: any[][] = [
    ['Severidad', 'Tipo', 'Descripción', 'Monto Involucrado', 'Fecha Detección', 'Recomendación'],
    ...ordenadas.map(d => [
      T(d.severidad.toUpperCase()),
      T(d.tipo),
      T(d.descripcion),
      d.montoInvolucrado != null ? N(d.montoInvolucrado) : T('—'),
      T(d.fechaDeteccion),
      T(d.recomendacion),
    ]),
  ]
  const alta  = r.discrepancias.filter(d => d.severidad === 'alta').length
  const media = r.discrepancias.filter(d => d.severidad === 'media').length
  const baja  = r.discrepancias.filter(d => d.severidad === 'baja').length
  rows.push([''])
  rows.push(['RESUMEN', '', '', '', '', ''])
  rows.push(['Alta',  T(`${alta}`),  'Media', T(`${media}`), 'Baja', T(`${baja}`)])
  addRows(ws, rows)
  setColWidths(ws, [10, 24, 55, 18, 14, 60])
  return ws
}

// ── Hoja 9: IVA ───────────────────────────────────────────────────────────────
function hojaIva(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  if (!r.resumenIva) {
    addRows(ws, [['IVA no calculado — requiere facturas DIAN cargadas']])
    setColWidths(ws, [50])
    return ws
  }
  const iva = r.resumenIva
  const rows: any[][] = [
    ['IVA — Período', iva.periodo],
    ['NIT', iva.nitEmpresa],
    [''],
    ['Naturaleza', 'Tarifa', 'N° Facturas', 'Base Gravable', 'Valor IVA'],
    ...iva.lineasGenerado.map(l    => ['Generado',    T(`${l.tarifa}%`), T(`${l.numFacturas}`), N(l.baseGravable), N(l.valorIva)]),
    ...iva.lineasDescontable.map(l => ['Descontable', T(`${l.tarifa}%`), T(`${l.numFacturas}`), N(l.baseGravable), N(l.valorIva)]),
    [''],
    ['IVA generado total',    '', '', N(iva.totalBaseVentas),  N(iva.totalIvaGenerado)],
    ['IVA descontable total', '', '', N(iva.totalBaseCompras), N(iva.totalIvaDescontable)],
    [''],
    ['Saldo a pagar', N(iva.saldoAPagar)],
    ['Saldo a favor', N(iva.saldoAFavor)],
    ['IVA bimestral estimado',     N(iva.ivaBimestral)],
    ['IVA cuatrimestral estimado', N(iva.ivaCuatrimestral)],
  ]
  addRows(ws, rows)
  setColWidths(ws, [28, 12, 14, 18, 16])
  return ws
}

// ── Hoja 10: Retefuente ───────────────────────────────────────────────────────
function hojaRfte(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  if (!r.resumenRetefuente) {
    addRows(ws, [['Retefuente no calculada — requiere facturas DIAN o Siigo cargados']])
    setColWidths(ws, [60])
    return ws
  }
  const rfte = r.resumenRetefuente
  const rows: any[][] = [
    ['Retefuente — Período', rfte.periodo],
    ['NIT', rfte.nitEmpresa],
    ['UVT vigente', N(rfte.uvtVigente)],
    [''],
    ['Código', 'Concepto', 'Tarifa %', 'Base min UVT', 'Base Practicada', 'Valor Practicado', 'Transacciones', 'Base Sufrida', 'Valor Sufrido'],
    ...rfte.conceptos.map(c => [
      T(c.codigoConcepto), T(c.nombre), T(`${c.tarifaPct}%`), N(c.baseMinimaUvt),
      N(c.basePracticada), N(c.valorPracticado), T(`${c.numTransPracticadas}`),
      N(c.baseSufrida), N(c.valorSufrido),
    ]),
    [''],
    ['Total practicado', '', '', '', '', N(rfte.totalPracticado)],
    ['Total sufrido',    '', '', '', '', '', '', '', N(rfte.totalSufrido)],
    ['Saldo neto',       N(rfte.saldoNeto)],
  ]
  addRows(ws, rows)
  setColWidths(ws, [10, 32, 10, 14, 18, 18, 14, 18, 16])
  return ws
}

// ── Hoja 11: ICA ──────────────────────────────────────────────────────────────
function hojaIca(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  if (!r.resumenIca) {
    addRows(ws, [['ICA no calculado — requiere facturas DIAN cargadas']])
    setColWidths(ws, [50])
    return ws
  }
  const ica = r.resumenIca
  const rows: any[][] = [
    ['ICA — Período', ica.periodo],
    ['Municipio', ica.municipio],
    [''],
    ['CIIU', 'Descripción', 'Municipio', 'Tarifa x Mil', 'Base Gravable', 'Impuesto Estimado', 'N° Facturas'],
    ...ica.actividades.map(a => [
      T(a.ciiu), T(a.descripcion), T(a.municipio),
      T(`${a.tarifaPorMil}‰`), N(a.baseGravable), N(a.impuestoEstimado), T(`${a.numFacturas}`),
    ]),
    [''],
    ['Ingresos brutos',       N(ica.totalIngresosBrutos)],
    ['Base gravable',         N(ica.totalBaseGravable)],
    ['Ingresos excluidos',    N(ica.totalIngresosExcluidos)],
    ['Impuesto ICA estimado', N(ica.totalImpuestoEstimado)],
  ]
  addRows(ws, rows)
  setColWidths(ws, [10, 30, 18, 12, 18, 20, 12])
  return ws
}

// ── Hoja 12: Log Auditoría ────────────────────────────────────────────────────
function hojaLog(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const rows: any[][] = [
    [`Log de proceso — ${r.fechaProceso}`],
    [''],
    ['#', 'Mensaje', 'Tipo'],
    ...r.logProceso.map((linea, i) => [
      T(`${i + 1}`),
      T(linea.replace(/^⚠️\s*/, '').replace(/^[✓✗]\s*/, '')),
      T(linea.startsWith('⚠️') ? 'Advertencia' : linea.startsWith('✓') ? 'OK' : 'Info'),
    ]),
  ]
  addRows(ws, rows)
  setColWidths(ws, [6, 110, 12])
  return ws
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const resultado = (await req.json()) as ResultadoConciliacion

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, hojaPortada(resultado),       '1. Portada')
    XLSX.utils.book_append_sheet(wb, hojaFormatoT(resultado),      '2. Formato T')
    XLSX.utils.book_append_sheet(wb, hojaMovBanco(resultado),      '3. Mov. Banco')
    XLSX.utils.book_append_sheet(wb, hojaSiigo(resultado),         '4. Siigo Auxiliar')
    XLSX.utils.book_append_sheet(wb, hojaMatches(resultado),       '5. Matches')
    XLSX.utils.book_append_sheet(wb, hojaSinConciliar(resultado),  '6. Sin Conciliar')
    XLSX.utils.book_append_sheet(wb, hojaFacturas(resultado),      '7. Facturas DIAN')
    XLSX.utils.book_append_sheet(wb, hojaDiscrepancias(resultado), '8. Discrepancias')
    XLSX.utils.book_append_sheet(wb, hojaIva(resultado),           '9. IVA')
    XLSX.utils.book_append_sheet(wb, hojaRfte(resultado),          '10. Retefuente')
    XLSX.utils.book_append_sheet(wb, hojaIca(resultado),           '11. ICA')
    XLSX.utils.book_append_sheet(wb, hojaLog(resultado),           '12. Log Auditoría')

    const empresa  = (resultado.config.nombreEmpresa || 'empresa').replace(/[\s/\\]/g, '_').slice(0, 20)
    const periodo  = resultado.config.periodoInicio?.slice(0, 7) ?? 'periodo'
    const filename = `Conciliacion_${empresa}_${periodo}.xlsx`

    const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const buf = Buffer.from(raw)

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[conciliaciones/exportar]', error)
    return NextResponse.json(
      { error: 'Error generando Excel', detalle: String(error) },
      { status: 500 }
    )
  }
}
