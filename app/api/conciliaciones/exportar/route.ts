/**
 * POST /api/conciliaciones/exportar
 * Recibe un ResultadoConciliacion como JSON y devuelve un Excel (.xlsx)
 * con 9 hojas: Portada, KPIs, Conciliación, Sin Conciliar, Facturas DIAN,
 * IVA, Retefuente, ICA, Discrepancias, Log Auditoría.
 */
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import type {
  ResultadoConciliacion, MovimientoBancario, FacturaElectronica,
} from '@/lib/conciliaciones/models'

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
const PCT = (n: number) => `${n.toFixed(1)}%`
const DATE_NOW = () => new Date().toLocaleDateString('es-CO')

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map(w => ({ wch: w }))
}

// ── Hoja 1: Portada ────────────────────────────────────────────────────────
function hojaPortada(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const data = [
    ['J&A Contadores — Módulo de Conciliaciones Bancarias y Tributario'],
    [],
    ['Empresa:', r.config.nombreEmpresa || '—'],
    ['NIT:', r.config.nitEmpresa || '—'],
    ['Banco:', r.config.banco || '—'],
    ['Período inicio:', r.config.periodoInicio || '—'],
    ['Período fin:', r.config.periodoFin || '—'],
    ['Fecha proceso:', DATE_NOW()],
    ['Versión motor:', r.version],
    [],
    ['KPI', 'Valor'],
    ['Total créditos banco', COP(r.kpis.totalBancoCreditos)],
    ['Total débitos banco', COP(r.kpis.totalBancoDebitos)],
    ['Total ventas (facturas emitidas)', COP(r.kpis.totalFacturasVentas)],
    ['Movimientos banco conciliados', `${r.kpis.numBancoConciliados} / ${r.kpis.numBancoConciliados + r.kpis.numBancoNoConciliados}`],
    ['% conciliado banco', PCT(r.kpis.porcentajeConciliadoBanco)],
    ['Facturas DIAN conciliadas', `${r.kpis.numFacturasConciliadas} / ${r.kpis.numFacturasConciliadas + r.kpis.numFacturasNoConciliadas}`],
    ['% conciliado facturas', PCT(r.kpis.porcentajeConciliadoFacturas)],
    [],
    ['Normatividad:', 'Retefuente Dto. 1625/2016 + Comunicado DIAN 070/2026 · UVT 2026 $52.374 · Res. 000165/2023'],
  ]
  XLSX.utils.sheet_add_aoa(ws, data, { origin: 'A1' })
  setColWidths(ws, [38, 30])
  return ws
}

// ── Hoja 2: Conciliación bancaria (matches) ───────────────────────────────
function hojaConciliacion(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const bancoById = new Map<string, MovimientoBancario>(r.movimientosBanco.map(m => [m.id, m]))

  const rows = [
    ['ID Match', 'Tipo Match', 'Confianza', 'Monto Banco', 'Monto Factura', 'Diferencia $', 'Diferencia Días', 'IDs Banco', 'CUFEs Facturas', 'IDs Siigo', 'Pago Parcial', 'Pago Agrupado'],
    ...r.matches.map(m => {
      const primBanco = bancoById.get(m.idsBanco[0])
      return [
        m.idMatch,
        m.tipoMatch,
        PCT(m.confianza * 100),
        m.montoBanco,
        m.montoFactura,
        m.diferenciaMonto,
        m.diferenciaDias,
        m.idsBanco.join(' | '),
        m.idsFacturas.join(' | '),
        m.idsSiigo.join(' | '),
        m.esPagoParcial ? 'Sí' : 'No',
        m.esPagoAgrupado ? 'Sí' : 'No',
        primBanco?.descripcion ?? '',
        primBanco?.fecha ?? '',
      ]
    }),
  ]
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A1' })
  setColWidths(ws, [18, 12, 10, 16, 16, 14, 14, 40, 50, 30, 12, 12, 40, 14])
  return ws
}

// ── Hoja 3: Movimientos sin conciliar ─────────────────────────────────────
function hojaNoConc(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const noConcBanco = r.movimientosBanco.filter(m => m.estado !== 'conciliado')
  const rows = [
    ['Fecha', 'Descripción', 'Tipo', 'Monto', 'Referencia', 'Estado'],
    ...noConcBanco.map(m => [m.fecha, m.descripcion, m.tipo, m.monto, m.referencia ?? '', m.estado]),
  ]
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A1' })
  setColWidths(ws, [14, 40, 10, 14, 20, 16])
  return ws
}

// ── Hoja 4: Facturas DIAN ─────────────────────────────────────────────────
function hojaFacturas(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const rows = [
    ['Fecha', 'Número', 'NIT Emisor', 'Nombre Emisor', 'NIT Receptor', 'Subtotal', 'Total', 'Tipo', 'Estado', 'CUFE'],
    ...r.facturasDian.map((f: FacturaElectronica) => [
      f.fechaEmision,
      f.numero,
      f.nitEmisor,
      f.nombreEmisor,
      f.nitReceptor,
      f.subtotal,
      f.total,
      f.esNota ? 'nota' : 'factura',
      f.estado,
      f.cufe,
    ]),
  ]
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A1' })
  setColWidths(ws, [14, 18, 14, 30, 14, 16, 16, 10, 14, 40])
  return ws
}

// ── Hoja 5: IVA ───────────────────────────────────────────────────────────
function hojaIva(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  if (!r.resumenIva) {
    XLSX.utils.sheet_add_aoa(ws, [['IVA no calculado']], { origin: 'A1' })
    return ws
  }
  const iva = r.resumenIva
  const rows: unknown[][] = [
    ['IVA — Período:', iva.periodo],
    ['NIT:', iva.nitEmpresa],
    [],
    ['Tipo', 'Tarifa', 'N° Facturas', 'Base Gravable', 'Valor IVA'],
    ...iva.lineasGenerado.map(l => ['Generado', l.tarifa + '%', l.numFacturas, l.baseGravable, l.valorIva]),
    ...iva.lineasDescontable.map(l => ['Descontable', l.tarifa + '%', l.numFacturas, l.baseGravable, l.valorIva]),
    [],
    ['Total base ventas', '', '', iva.totalBaseVentas, iva.totalIvaGenerado],
    ['Total base compras', '', '', iva.totalBaseCompras, iva.totalIvaDescontable],
    [],
    ['Saldo a pagar', COP(iva.saldoAPagar)],
    ['Saldo a favor', COP(iva.saldoAFavor)],
    ['IVA bimestral estimado', COP(iva.ivaBimestral)],
    ['IVA cuatrimestral estimado', COP(iva.ivaCuatrimestral)],
  ]
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A1' })
  setColWidths(ws, [28, 12, 14, 18, 16])
  return ws
}

// ── Hoja 6: Retefuente ────────────────────────────────────────────────────
function hojaRfte(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  if (!r.resumenRetefuente) {
    XLSX.utils.sheet_add_aoa(ws, [['Retefuente no calculada']], { origin: 'A1' })
    return ws
  }
  const rfte = r.resumenRetefuente
  const rows: unknown[][] = [
    ['Retefuente — Período:', rfte.periodo],
    ['NIT:', rfte.nitEmpresa],
    ['UVT vigente:', rfte.uvtVigente],
    [],
    ['Código', 'Concepto', 'Tarifa %', 'Base min UVT', 'Base Practicada', 'Valor Practicado', 'Transacciones', 'Base Sufrida', 'Valor Sufrido'],
    ...rfte.conceptos.map(c => [
      c.codigoConcepto, c.nombre, c.tarifaPct + '%', c.baseMinimaUvt,
      c.basePracticada, c.valorPracticado, c.numTransPracticadas,
      c.baseSufrida, c.valorSufrido,
    ]),
    [],
    ['Total practicado', '', '', '', '', rfte.totalPracticado],
    ['Total sufrido', '', '', '', '', '', '', '', rfte.totalSufrido],
    ['Saldo neto', COP(rfte.saldoNeto)],
  ]
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A1' })
  setColWidths(ws, [10, 30, 10, 12, 18, 18, 14, 18, 16])
  return ws
}

// ── Hoja 7: ICA ───────────────────────────────────────────────────────────
function hojaIca(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  if (!r.resumenIca) {
    XLSX.utils.sheet_add_aoa(ws, [['ICA no calculado']], { origin: 'A1' })
    return ws
  }
  const ica = r.resumenIca
  const rows: unknown[][] = [
    ['ICA — Período:', ica.periodo],
    ['Municipio:', ica.municipio],
    [],
    ['CIIU', 'Descripción', 'Municipio', 'Tarifa x Mil', 'Base Gravable', 'Impuesto Estimado', 'N° Facturas'],
    ...ica.actividades.map(a => [
      a.ciiu, a.descripcion, a.municipio,
      a.tarifaPorMil, a.baseGravable, a.impuestoEstimado, a.numFacturas,
    ]),
    [],
    ['Ingresos brutos', COP(ica.totalIngresosBrutos)],
    ['Base gravable', COP(ica.totalBaseGravable)],
    ['Ingresos excluidos', COP(ica.totalIngresosExcluidos)],
    ['Impuesto ICA estimado', COP(ica.totalImpuestoEstimado)],
  ]
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A1' })
  setColWidths(ws, [10, 30, 18, 12, 18, 20, 12])
  return ws
}

// ── Hoja 8: Discrepancias ─────────────────────────────────────────────────
function hojaDiscrepancias(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const rows = [
    ['ID', 'Tipo', 'Severidad', 'Descripción', 'Monto Involucrado', 'Fecha Detección', 'Recomendación'],
    ...r.discrepancias.map(d => [
      d.id,
      d.tipo,
      d.severidad,
      d.descripcion,
      d.montoInvolucrado != null ? d.montoInvolucrado : '',
      d.fechaDeteccion,
      d.recomendacion,
    ]),
  ]
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A1' })
  setColWidths(ws, [18, 24, 10, 50, 18, 14, 60])
  return ws
}

// ── Hoja 9: Log Auditoría ─────────────────────────────────────────────────
function hojaLog(r: ResultadoConciliacion): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const rows = [
    ['Log de proceso — ' + r.fechaProceso],
    [],
    ...r.logProceso.map((linea, i) => [i + 1, linea]),
  ]
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A1' })
  setColWidths(ws, [6, 120])
  return ws
}

// ── Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const resultado = (await req.json()) as ResultadoConciliacion

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, hojaPortada(resultado),       'Portada')
    XLSX.utils.book_append_sheet(wb, hojaConciliacion(resultado),  'Conciliación')
    XLSX.utils.book_append_sheet(wb, hojaNoConc(resultado),        'Sin Conciliar')
    XLSX.utils.book_append_sheet(wb, hojaFacturas(resultado),      'Facturas DIAN')
    XLSX.utils.book_append_sheet(wb, hojaIva(resultado),           'IVA')
    XLSX.utils.book_append_sheet(wb, hojaRfte(resultado),          'Retefuente')
    XLSX.utils.book_append_sheet(wb, hojaIca(resultado),           'ICA')
    XLSX.utils.book_append_sheet(wb, hojaDiscrepancias(resultado), 'Discrepancias')
    XLSX.utils.book_append_sheet(wb, hojaLog(resultado),           'Log Auditoría')

    const empresa = (resultado.config.nombreEmpresa || 'empresa').replace(/\s+/g, '_').slice(0, 20)
    const periodo = resultado.config.periodoInicio?.slice(0, 7) ?? 'periodo'
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
      { status: 500 },
    )
  }
}
