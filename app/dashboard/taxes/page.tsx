'use client'

import { useClient } from '../ClientContext'
import { AlertTriangle, CheckCircle, TrendingUp, FileText, DollarSign, Receipt, Info } from 'lucide-react'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie, Legend, CartesianGrid
} from 'recharts'

const TEAL = '#14B8A6'
const NAVY = '#0B2447'
const GOLD = '#D4A843'
const GREEN = '#10B981'
const RED = '#EF4444'
const PURPLE = '#8B5CF6'
const BLUE = '#3B82F6'

const COP = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

const TOOLTIP_STYLE = {
    contentStyle: {
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        color: '#1E293B',
        fontSize: '12px',
        boxShadow: '0 8px 32px rgba(15,23,42,0.12)'
    },
    cursor: { fill: 'rgba(20,184,166,0.04)' }
}

const AXIS_STYLE = { fill: '#94A3B8', fontSize: 11, fontFamily: 'var(--font-inter)' }
const PIE_COLORS = [TEAL, NAVY, GOLD, GREEN, PURPLE]

const card = {
    background: '#FFFFFF',
    border: '1.5px solid #E2E8F0',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
    padding: '20px',
}

export default function TaxesPage() {
    const { data: clientData, loading } = useClient()

    if (loading || !clientData) {
        return (
            <div className="p-8 flex items-center gap-3 text-slate-600">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: `${TEAL}40`, borderTopColor: TEAL }} />
                Calculando datos tributarios...
            </div>
        )
    }

    const tax = clientData.taxData
    const pieData = [
        { name: 'IVA a Pagar', value: tax.totalIVAPorPagar },
        { name: 'Venta Neta', value: tax.totalVentasBruto - tax.totalReteFuente - tax.totalReteICA },
        { name: 'ReteFuente', value: tax.totalReteFuente },
        { name: 'ReteIVA', value: tax.totalReteIVA },
        { name: 'ReteICA', value: tax.totalReteICA },
    ].filter(d => d.value > 0)

    const hasMontlyData = tax.monthlyBreakdown.length > 0

    return (
        <div className="space-y-6 pb-10" style={{ fontFamily: 'var(--font-inter)' }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-800" style={{ fontFamily: 'var(--font-outfit)' }}>
                        Módulo Tributario <span style={{ color: TEAL }}>Colombia</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {tax.fuenteDatos.columnasDetectadas.length > 0
                            ? `Datos reales del CSV · columnas: ${tax.fuenteDatos.columnasDetectadas.join(', ')} · Ley 2277/2022`
                            : 'Estimaciones basadas en datos del cliente · Ley 2277/2022 · IVA 19% · Renta 35%'}
                    </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: '#CCFBF1', color: '#0F766E', border: `1px solid ${TEAL}30` }}>
                    ⚖️ DIAN Colombia
                </div>
            </div>

            {/* Régimen + Alertas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div style={card}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}20` }}>
                            <FileText className="w-5 h-5" style={{ color: GOLD }} />
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Régimen Sugerido</p>
                            <p className="text-slate-800 font-bold text-sm">{tax.regimenSugerido}</p>
                        </div>
                    </div>
                    <div className="rounded-lg p-3 space-y-1.5 text-xs text-slate-500" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <p>· IVA bimestral: <span className="font-bold" style={{ color: GOLD }}>{COP(tax.ivaDeclaracionBimestral)}</span></p>
                        <p>· IVA cuatrimestral: <span className="font-bold" style={{ color: GOLD }}>{COP(tax.ivaDeclaracionCuatrimestral)}</span></p>
                        <p>· Tasa efectiva: <span className="font-bold" style={{ color: GREEN }}>{tax.tasaEfectivaTributaria}%</span></p>
                    </div>
                </div>

                <div className="lg:col-span-2" style={card}>
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4" style={{ color: GOLD }} />
                        <h3 className="font-bold text-slate-800 text-sm">Alertas Tributarias</h3>
                    </div>
                    <div className="space-y-2">
                        {tax.alertas.length > 0 ? tax.alertas.map((alerta, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg text-xs text-slate-700"
                                style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}>
                                <span>⚡</span> {alerta}
                            </div>
                        )) : (
                            <div className="flex items-center gap-2 text-sm" style={{ color: GREEN }}>
                                <CheckCircle className="w-4 h-4" /> Sin alertas tributarias activas
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Ventas Base', value: COP(tax.totalVentasBruto), color: NAVY, icon: DollarSign, sub: tax.fuenteDatos.subtotalReal ? '📄 col. Subtotal CSV' : 'Sin IVA (calculado)', real: tax.fuenteDatos.subtotalReal },
                    { label: 'IVA Cobrado', value: COP(tax.totalIVACobrado), color: GOLD, icon: Receipt, sub: tax.fuenteDatos.ivaReal ? '📄 col. IVA CSV' : 'Calculado 19%', real: tax.fuenteDatos.ivaReal },
                    { label: 'IVA a Pagar', value: COP(tax.totalIVAPorPagar), color: RED, icon: AlertTriangle, sub: 'IVA cobrado s/descontable', real: false },
                    { label: 'ReteFuente', value: COP(tax.totalReteFuente), color: BLUE, icon: TrendingUp, sub: tax.fuenteDatos.reteFuenteReal ? '📄 col. ReteFuente' : 'Estimada 3.5%', real: tax.fuenteDatos.reteFuenteReal },
                    { label: 'ReteIVA', value: COP(tax.totalReteIVA), color: PURPLE, icon: Receipt, sub: 'Calculado del IVA (15%)', real: false },
                    { label: 'ReteICA', value: COP(tax.totalReteICA), color: GREEN, icon: Info, sub: tax.fuenteDatos.reteICAReal ? '📄 col. ReteICA' : 'Est. Bogotá 4.14‰', real: tax.fuenteDatos.reteICAReal },
                ].map((kpi, i) => (
                    <div key={i} className="hover:-translate-y-0.5 transition-transform" style={{ ...card, padding: '14px 16px' }}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <kpi.icon className="w-3 h-3" style={{ color: kpi.color }} />
                            <p className="text-slate-400 text-[9px] uppercase font-bold tracking-wider truncate">{kpi.label}</p>
                            {kpi.real && <span className="ml-auto text-[8px] px-1 py-0.5 rounded font-bold" style={{ background: '#D1FAE5', color: '#065F46' }}>REAL</span>}
                        </div>
                        <p className="font-bold text-sm" style={{ color: kpi.color }}>{kpi.value}</p>
                        <p className="text-slate-400 text-[9px] mt-0.5">{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* Gráficas */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3" style={card}>
                    <h3 className="font-bold text-slate-800 text-sm mb-1">Ventas vs Obligaciones Tributarias</h3>
                    <p className="text-slate-400 text-[10px] mb-4">Ventas brutas, IVA cobrado e ingreso neto · COP</p>
                    {hasMontlyData ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={tax.monthlyBreakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    {[['gTV', NAVY], ['gIV', RED], ['gNT', GREEN]].map(([id, c]) => (
                                        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={c} stopOpacity={0.2} />
                                            <stop offset="95%" stopColor={c} stopOpacity={0} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                <XAxis dataKey="month" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={50}
                                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`} />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, n: any) => [COP(Number(v)), n]}
                                    labelStyle={{ color: '#1E293B', fontWeight: 'bold' }} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }}
                                    formatter={(v) => <span style={{ color: '#64748B' }}>{v}</span>} />
                                <Area type="monotone" dataKey="ventas" name="Ventas" stroke={NAVY} strokeWidth={2} fill="url(#gTV)" dot={false} />
                                <Area type="monotone" dataKey="iva" name="IVA Cobrado" stroke={RED} strokeWidth={1.5} fill="url(#gIV)" dot={false} />
                                <Area type="monotone" dataKey="neto" name="Ingreso Neto" stroke={GREEN} strokeWidth={1.5} fill="url(#gNT)" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">Sin datos mensuales disponibles</div>}
                </div>

                <div className="lg:col-span-2" style={card}>
                    <h3 className="font-bold text-slate-800 text-sm mb-1">Distribución Carga Tributaria</h3>
                    <p className="text-slate-400 text-[10px] mb-2">Composición del total facturado</p>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={pieData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>
                                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '12px' }}
                                formatter={(v: any, n: any) => [COP(Number(v)), n]} />
                            <Legend wrapperStyle={{ fontSize: '10px' }}
                                formatter={(v) => <span style={{ color: '#64748B' }}>{v}</span>} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Retenciones mensuales */}
            {hasMontlyData && (
                <div style={card}>
                    <h3 className="font-bold text-slate-800 text-sm mb-1">Retenciones Mensuales · ReteFuente vs ReteICA</h3>
                    <p className="text-slate-400 text-[10px] mb-4">Valores descontados por agentes retenedores · COP</p>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={tax.monthlyBreakdown} barGap={4} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                            <XAxis dataKey="month" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                            <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={45}
                                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, n: any) => [COP(Number(v)), n]}
                                labelStyle={{ color: '#1E293B', fontWeight: 'bold' }} />
                            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }}
                                formatter={(v) => <span style={{ color: '#64748B' }}>{v}</span>} />
                            <Bar dataKey="reteFuente" name="ReteFuente" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
                            <Bar dataKey="reteICA" name="ReteICA" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={28} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Renta + IVA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div style={{ ...card, borderLeft: `4px solid ${GOLD}` }}>
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-4 h-4" style={{ color: GOLD }} />
                        <h3 className="font-bold text-slate-800 text-sm">Estimación Impuesto de Renta</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        {[
                            { label: 'Base gravable (35%)', value: COP(tax.baseGravableRenta), color: NAVY },
                            { label: 'Impuesto de renta', value: COP(tax.impuestoRentaEstimado), color: GOLD },
                        ].map((item, i) => (
                            <div key={i} className="p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                <p className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">{item.label}</p>
                                <p className="font-bold text-base" style={{ color: item.color }}>{item.value}</p>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-lg p-3 text-[10px] text-slate-500 space-y-1" style={{ background: '#FFFBEB', border: `1px solid ${GOLD}30` }}>
                        <p className="font-bold text-[11px] mb-1" style={{ color: GOLD }}>⚠ Valores estimados — no reemplazan asesoría contable</p>
                        <p>· Tarifa renta personas jurídicas: 35% (Art. 240 E.T. Ley 2277/2022)</p>
                        <p>· Anticipo renta: 75% del impuesto del año anterior (Art. 807 E.T.)</p>
                    </div>
                </div>

                <div style={{ ...card, borderLeft: `4px solid ${RED}` }}>
                    <div className="flex items-center gap-2 mb-4">
                        <Receipt className="w-4 h-4" style={{ color: RED }} />
                        <h3 className="font-bold text-slate-800 text-sm">Declaración de IVA — DIAN</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        {[
                            { label: 'IVA bimestral promedio', value: COP(tax.ivaDeclaracionBimestral), color: RED },
                            { label: 'IVA cuatrimestral promedio', value: COP(tax.ivaDeclaracionCuatrimestral), color: GOLD },
                        ].map((item, i) => (
                            <div key={i} className="p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                <p className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">{item.label}</p>
                                <p className="font-bold text-base" style={{ color: item.color }}>{item.value}</p>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-lg p-3 text-[10px] text-slate-500 space-y-1" style={{ background: '#FEF2F2', border: `1px solid ${RED}20` }}>
                        <p className="font-bold text-[11px] mb-1" style={{ color: RED }}>📋 Periodicidad declaración IVA — DIAN</p>
                        <p>· <strong className="text-slate-700">Bimestral:</strong> grandes contribuyentes y ventas {'>'} 92.000 UVT</p>
                        <p>· <strong className="text-slate-700">Cuatrimestral:</strong> ingresos {'<'} 92.000 UVT año anterior</p>
                    </div>
                </div>
            </div>

            {/* Tabla resumen */}
            <div style={card}>
                <h3 className="font-bold text-slate-800 text-sm mb-4">Resumen Consolidado de Obligaciones Tributarias</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr style={{ borderBottom: '1.5px solid #E2E8F0' }}>
                                {['Concepto', 'Base', 'Tarifa', 'Valor', 'Fuente', 'Norma'].map(h => (
                                    <th key={h} className="text-left text-slate-400 font-bold uppercase tracking-wider py-2 pr-4">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { concepto: 'IVA Generado', base: COP(tax.totalVentasBruto), tarifa: '19%', valor: COP(tax.totalIVACobrado), fuente: tax.fuenteDatos.ivaReal ? '🟢 CSV' : '🟡 Estimado', norma: 'Art. 420 E.T.', color: GOLD },
                                { concepto: 'IVA Neto a Pagar', base: COP(tax.totalIVACobrado), tarifa: 'Cobrado - Desc.', valor: COP(tax.totalIVAPorPagar), fuente: '🟡 Estimado', norma: 'Art. 483 E.T.', color: RED },
                                { concepto: 'Retención en la Fuente', base: COP(tax.totalVentasBruto), tarifa: tax.fuenteDatos.reteFuenteReal ? 'Real CSV' : '3.5%', valor: COP(tax.totalReteFuente), fuente: tax.fuenteDatos.reteFuenteReal ? '🟢 CSV' : '🟡 Estimado', norma: 'Art. 401 E.T.', color: BLUE },
                                { concepto: 'ReteIVA', base: COP(tax.totalIVACobrado), tarifa: '15%', valor: COP(tax.totalReteIVA), fuente: '🟡 Calculado', norma: 'Art. 437-1 E.T.', color: PURPLE },
                                { concepto: 'ReteICA — Bogotá', base: COP(tax.totalVentasBruto), tarifa: '4.14‰', valor: COP(tax.totalReteICA), fuente: tax.fuenteDatos.reteICAReal ? '🟢 CSV' : '🟡 Estimado', norma: 'Acuerdo 648/2016', color: GREEN },
                                { concepto: 'Impuesto de Renta', base: COP(tax.baseGravableRenta), tarifa: '35%', valor: COP(tax.impuestoRentaEstimado), fuente: '🟡 Estimado', norma: 'Art. 240 E.T.', color: NAVY },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}>
                                    <td className="py-2.5 pr-4 font-bold" style={{ color: row.color }}>{row.concepto}</td>
                                    <td className="py-2.5 pr-4 text-slate-500 font-mono">{row.base}</td>
                                    <td className="py-2.5 pr-4 text-slate-700">{row.tarifa}</td>
                                    <td className="py-2.5 pr-4 text-slate-800 font-bold font-mono">{row.valor}</td>
                                    <td className="py-2.5 pr-4 text-[10px] text-slate-500">{row.fuente}</td>
                                    <td className="py-2.5 text-slate-400">{row.norma}</td>
                                </tr>
                            ))}
                            <tr style={{ borderTop: `2px solid ${TEAL}30` }}>
                                <td className="py-3 pr-4 font-black" style={{ color: TEAL }}>TOTAL IMPUESTOS CORRIENTE</td>
                                <td className="py-3 pr-4 text-slate-400">—</td>
                                <td className="py-3 pr-4 text-slate-400">—</td>
                                <td className="py-3 pr-4 font-black font-mono text-sm" style={{ color: TEAL }}>{COP(tax.totalImpuestosCargo)}</td>
                                <td className="py-3 pr-4 text-slate-400">—</td>
                                <td className="py-3 text-slate-400 italic">Tasa efectiva: {tax.tasaEfectivaTributaria}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 p-3 rounded-lg text-[10px] text-slate-500" style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}>
                    <p className="font-bold text-slate-700 mb-1">⚠ Aviso Legal</p>
                    <p>Los valores son estimaciones automáticas basadas en los datos del Google Sheet. No constituyen asesoría contable ni tributaria certificada. Siempre consulte con un contador público titulado y la DIAN.</p>
                </div>
            </div>
        </div>
    )
}
