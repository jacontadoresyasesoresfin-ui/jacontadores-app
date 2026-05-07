'use client'

import { useClient } from '../ClientContext'
import { AlertTriangle, CheckCircle, TrendingUp, FileText, DollarSign, Receipt, Info } from 'lucide-react'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie, Legend, CartesianGrid
} from 'recharts'

const JA = {
    NAVY:    '#13213C',
    GOLD:    '#B8960C',
    TEXT:    '#1C2B45',
    GREY:    '#4B5563',
    GREY_LT: '#9CA3AF',
    BORDER:  '#E5E7EB',
    BG:      '#F8FAFC',
    GREEN:   '#10B981',
    RED:     '#EF4444',
    BLUE:    '#3B82F6',
    PURPLE:  '#8B5CF6'
}

const COP = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

const TOOLTIP_STYLE = {
    contentStyle: {
        backgroundColor: '#FFFFFF',
        border: `1px solid ${JA.BORDER}`,
        borderRadius: '2px',
        color: JA.TEXT,
        fontSize: '11px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    },
    cursor: { fill: 'rgba(19,33,60,0.03)' }
}

const AXIS_STYLE = { fill: JA.GREY, fontSize: 10, fontFamily: 'Inter, sans-serif' }
const PIE_COLORS = [JA.NAVY, JA.GOLD, JA.GREEN, JA.BLUE, JA.PURPLE]

const cardStyle = {
    background: '#FFFFFF',
    border: `1px solid ${JA.BORDER}`,
    borderRadius: '2px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    padding: '20px',
}

export default function TaxesPage() {
    const { data: clientData, loading } = useClient()

    if (loading || !clientData) {
        return (
            <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '12px', color: JA.GREY, fontSize: '14px' }}>
                <div style={{ width: '16px', height: '16px', border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Calculando obligaciones tributarias...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Planeación Tributaria <span style={{ color: JA.GOLD }}>Colombia</span></h1>
                    <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>
                        {tax.fuenteDatos.columnasDetectadas.length > 0
                            ? `Auditoría basada en registros reales · Ley 2277/2022`
                            : 'Proyecciones basadas en modelos financieros estándar · DIAN'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ background: JA.BG, border: `1px solid ${JA.BORDER}`, padding: '4px 12px', borderRadius: '2px', fontSize: '10px', fontWeight: 700, color: JA.NAVY }}>
                        ⚖️ ESTATUTO TRIBUTARIO
                    </div>
                </div>
            </div>

            {/* Régimen + Alertas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ background: `${JA.GOLD}15`, padding: '8px', borderRadius: '2px' }}>
                            <FileText style={{ width: '18px', height: '18px', color: JA.GOLD }} />
                        </div>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>Régimen Sugerido</p>
                            <p style={{ fontSize: '14px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>{tax.regimenSugerido}</p>
                        </div>
                    </div>
                    <div style={{ background: JA.BG, border: `1px solid ${JA.BORDER}`, padding: '12px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <p style={{ fontSize: '11px', color: JA.GREY, margin: 0, display: 'flex', justifyContent: 'space-between' }}>
                            <span>IVA Bimestral Est:</span>
                            <span style={{ fontWeight: 700, color: JA.TEXT }}>{COP(tax.ivaDeclaracionBimestral)}</span>
                        </p>
                        <p style={{ fontSize: '11px', color: JA.GREY, margin: 0, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Tasa Efectiva:</span>
                            <span style={{ fontWeight: 700, color: JA.GREEN }}>{tax.tasaEfectivaTributaria}%</span>
                        </p>
                    </div>
                </div>

                <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <AlertTriangle style={{ width: '16px', height: '16px', color: JA.GOLD }} />
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Alertas de Cumplimiento</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tax.alertas.length > 0 ? tax.alertas.map((alerta, i) => (
                            <div key={i} style={{ display: 'flex', gap: '8px', padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '2px', fontSize: '11px', color: '#92400E' }}>
                                <span style={{ opacity: 0.7 }}>•</span> {alerta}
                            </div>
                        )) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: JA.GREEN, fontWeight: 600 }}>
                                <CheckCircle style={{ width: '16px', height: '16px' }} /> No se detectaron inconsistencias críticas
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {[
                    { label: 'Ventas Base', value: COP(tax.totalVentasBruto), color: JA.NAVY, icon: DollarSign },
                    { label: 'IVA Cobrado', value: COP(tax.totalIVACobrado), color: JA.GOLD, icon: Receipt },
                    { label: 'IVA a Pagar', value: COP(tax.totalIVAPorPagar), color: JA.RED, icon: AlertTriangle },
                    { label: 'ReteFuente', value: COP(tax.totalReteFuente), color: JA.BLUE, icon: TrendingUp },
                    { label: 'ReteIVA', value: COP(tax.totalReteIVA), color: JA.PURPLE, icon: Receipt },
                    { label: 'ReteICA', value: COP(tax.totalReteICA), color: JA.GREEN, icon: Info },
                ].map((kpi, i) => (
                    <div key={i} style={{ ...cardStyle, padding: '12px 16px', borderTop: `3px solid ${kpi.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>{kpi.label}</p>
                            <kpi.icon style={{ width: '12px', height: '12px', color: kpi.color }} />
                        </div>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Gráficas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '20px' }}>Análisis de Flujo Tributario</h3>
                    {hasMontlyData ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={tax.monthlyBreakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={JA.BORDER} vertical={false} />
                                <XAxis dataKey="month" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={50}
                                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`} />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, n: any) => [COP(Number(v)), n]} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                <Area type="monotone" dataKey="ventas" name="Ventas" stroke={JA.NAVY} strokeWidth={2} fill={JA.NAVY} fillOpacity={0.05} dot={false} />
                                <Area type="monotone" dataKey="iva" name="IVA" stroke={JA.RED} strokeWidth={1.5} fill={JA.RED} fillOpacity={0.05} dot={false} />
                                <Area type="monotone" dataKey="neto" name="Neto" stroke={JA.GREEN} strokeWidth={1.5} fill={JA.GREEN} fillOpacity={0.05} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: JA.GREY_LT, fontSize: '12px' }}>Datos insuficientes</div>}
                </div>

                <div style={cardStyle}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '20px' }}>Composición de Carga</h3>
                    <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={2} dataKey="value" strokeWidth={0}>
                                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, n: any) => [COP(Number(v)), n]} />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Renta + IVA Detalle */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                <div style={{ ...cardStyle, borderLeft: `4px solid ${JA.GOLD}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <TrendingUp style={{ width: '16px', height: '16px', color: JA.GOLD }} />
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Proyección Impuesto de Renta</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ background: JA.BG, padding: '12px', borderRadius: '2px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: '0 0 4px 0' }}>Base Gravable (35%)</p>
                            <p style={{ fontSize: '15px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>{COP(tax.baseGravableRenta)}</p>
                        </div>
                        <div style={{ background: JA.BG, padding: '12px', borderRadius: '2px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: '0 0 4px 0' }}>Impuesto Est.</p>
                            <p style={{ fontSize: '15px', fontWeight: 700, color: JA.GOLD, margin: 0 }}>{COP(tax.impuestoRentaEstimado)}</p>
                        </div>
                    </div>
                    <p style={{ fontSize: '10px', color: JA.GREY_LT, fontStyle: 'italic', margin: 0 }}>* Cálculos basados en tarifa estándar para personas jurídicas (Art. 240 E.T.).</p>
                </div>

                <div style={{ ...cardStyle, borderLeft: `4px solid ${JA.RED}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Receipt style={{ width: '16px', height: '16px', color: JA.RED }} />
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Promedios de Declaración IVA</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ background: JA.BG, padding: '12px', borderRadius: '2px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: '0 0 4px 0' }}>Bimestral</p>
                            <p style={{ fontSize: '15px', fontWeight: 700, color: JA.RED, margin: 0 }}>{COP(tax.ivaDeclaracionBimestral)}</p>
                        </div>
                        <div style={{ background: JA.BG, padding: '12px', borderRadius: '2px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: '0 0 4px 0' }}>Cuatrimestral</p>
                            <p style={{ fontSize: '15px', fontWeight: 700, color: JA.GOLD, margin: 0 }}>{COP(tax.ivaDeclaracionCuatrimestral)}</p>
                        </div>
                    </div>
                    <p style={{ fontSize: '10px', color: JA.GREY_LT, fontStyle: 'italic', margin: 0 }}>* Proyecciones basadas en periodicidad DIAN según ingresos brutos.</p>
                </div>
            </div>

            {/* Tabla resumen */}
            <div style={cardStyle}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '20px' }}>Consolidado Tributario Detallado</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead style={{ background: JA.BG, color: JA.GREY, textAlign: 'left', borderBottom: `1px solid ${JA.BORDER}` }}>
                            <tr>
                                <th style={{ padding: '10px 16px', fontWeight: 700, textTransform: 'uppercase' }}>Concepto</th>
                                <th style={{ padding: '10px 16px', fontWeight: 700, textTransform: 'uppercase' }}>Base Gravable</th>
                                <th style={{ padding: '10px 16px', fontWeight: 700, textTransform: 'uppercase' }}>Tarifa</th>
                                <th style={{ padding: '10px 16px', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Valor Total</th>
                                <th style={{ padding: '10px 16px', fontWeight: 700, textTransform: 'uppercase' }}>Estado</th>
                            </tr>
                        </thead>
                        <tbody style={{ color: JA.TEXT }}>
                            {[
                                { concepto: 'IVA Generado', base: COP(tax.totalVentasBruto), tarifa: '19%', valor: COP(tax.totalIVACobrado), fuente: tax.fuenteDatos.ivaReal ? 'REAL' : 'CALC', color: JA.GOLD },
                                { concepto: 'ReteFuente', base: COP(tax.totalVentasBruto), tarifa: '3.5%', valor: COP(tax.totalReteFuente), fuente: tax.fuenteDatos.reteFuenteReal ? 'REAL' : 'CALC', color: JA.BLUE },
                                { concepto: 'ReteIVA', base: COP(tax.totalIVACobrado), tarifa: '15%', valor: COP(tax.totalReteIVA), fuente: 'CALC', color: JA.PURPLE },
                                { concepto: 'ReteICA (Bogotá)', base: COP(tax.totalVentasBruto), tarifa: '4.14‰', valor: COP(tax.totalReteICA), fuente: tax.fuenteDatos.reteICAReal ? 'REAL' : 'CALC', color: JA.GREEN },
                                { concepto: 'Impuesto Renta', base: COP(tax.baseGravableRenta), tarifa: '35%', valor: COP(tax.impuestoRentaEstimado), fuente: 'EST', color: JA.NAVY },
                            ].map((row, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${JA.BG}` }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: row.color }}>{row.concepto}</td>
                                    <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{row.base}</td>
                                    <td style={{ padding: '12px 16px' }}>{row.tarifa}</td>
                                    <td style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>{row.valor}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', background: row.fuente === 'REAL' ? '#DCFCE7' : JA.BG, color: row.fuente === 'REAL' ? '#166534' : JA.GREY, borderRadius: '1px' }}>{row.fuente}</span>
                                    </td>
                                </tr>
                            ))}
                            <tr style={{ background: JA.BG, fontWeight: 700 }}>
                                <td colSpan={3} style={{ padding: '12px 16px', color: JA.NAVY }}>TOTAL CARGA TRIBUTARIA ESTIMADA</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px' }}>{COP(tax.totalImpuestosCargo)}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

