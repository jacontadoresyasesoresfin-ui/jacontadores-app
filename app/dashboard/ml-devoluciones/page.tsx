'use client'

import { useState } from 'react'
import { AlertCircle, RotateCcw, DollarSign, TrendingDown, MessageSquare, Info, LayoutGrid, List, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const JA = {
    NAVY:    '#13213C',
    GOLD:    '#B8960C',
    TEXT:    '#1C2B45',
    GREY:    '#4B5563',
    GREY_LT: '#9CA3AF',
    BORDER:  '#E5E7EB',
    BG:      '#F8FAFC',
    GREEN:   '#10B981',
    RED:     '#EF4444'
}

const cardStyle = {
    background: '#FFFFFF',
    border: `1px solid ${JA.BORDER}`,
    borderRadius: '2px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    padding: '20px',
}

const COP = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

const TOOLTIP_STYLE = {
    contentStyle: { backgroundColor: '#FFFFFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', color: JA.TEXT, fontSize: '11px', fontWeight: 600 },
    cursor: { fill: 'rgba(19,33,60,0.03)' }
}

const DEVOLUCIONES = [
    { orden: '#2310450', producto: 'Auriculares Bluetooth Pro', motivo: 'No funciona correctamente', valorReembolsado: 185000, fecha: '2025-02-15', tipo: 'devolución', impactoUtilidad: -75000 },
    { orden: '#2320980', producto: 'Cable USB-C 2m', motivo: 'Descripción no corresponde', valorReembolsado: 42000, fecha: '2025-02-18', tipo: 'devolución', impactoUtilidad: -18000 },
    { orden: '#2325100', producto: 'Teclado Mecánico RGB', motivo: 'Producto dañado en envío', valorReembolsado: 320000, fecha: '2025-02-22', tipo: 'reclamo', impactoUtilidad: -120000 },
    { orden: '#2341200', producto: 'Webcam HD 1080p', motivo: 'Arrepentimiento de compra', valorReembolsado: 210000, fecha: '2025-02-28', tipo: 'devolución', impactoUtilidad: -85000 },
    { orden: '#2356700', producto: 'Hub USB 7 puertos', motivo: 'Producto llega tarde', valorReembolsado: 130000, fecha: '2025-03-03', tipo: 'reclamo', impactoUtilidad: -48000 },
    { orden: '#2371000', producto: 'Mouse Inalámbrico 2.4G', motivo: 'No funciona correctamente', valorReembolsado: 160000, fecha: '2025-03-07', tipo: 'devolución', impactoUtilidad: -65000 },
    { orden: '#2379100', producto: 'Auriculares Bluetooth Pro', motivo: 'Calidad inferior a lo esperado', valorReembolsado: 185000, fecha: '2025-03-09', tipo: 'devolución', impactoUtilidad: -75000 },
]

const MOTIVOS_STATS = [
    { motivo: 'No funciona correctamente', cantidad: 2, valor: 345000 },
    { motivo: 'Descripción no corresponde', cantidad: 1, valor: 42000 },
    { motivo: 'Producto dañado en envío', cantidad: 1, valor: 320000 },
    { motivo: 'Arrepentimiento de compra', cantidad: 1, valor: 210000 },
    { motivo: 'Producto llega tarde', cantidad: 1, valor: 130000 },
    { motivo: 'Calidad inferior', cantidad: 1, valor: 185000 },
]

const AXIS_STYLE = { fill: JA.GREY, fontSize: 10, fontWeight: 600 }

export default function DevolucionesPage() {
    const [filtro, setFiltro] = useState<'todos' | 'devolución' | 'reclamo'>('todos')

    const devolucionesFiltradas = filtro === 'todos' ? DEVOLUCIONES : DEVOLUCIONES.filter(d => d.tipo === filtro)

    const totalDevuelto = DEVOLUCIONES.reduce((s, d) => s + d.valorReembolsado, 0)
    const impactoTotal = DEVOLUCIONES.reduce((s, d) => s + d.impactoUtilidad, 0)
    const cantDevoluaciones = DEVOLUCIONES.filter(d => d.tipo === 'devolución').length
    const cantReclamos = DEVOLUCIONES.filter(d => d.tipo === 'reclamo').length
    const tasaDev = ((DEVOLUCIONES.length / 48) * 100).toFixed(1)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Gestión de <span style={{ color: JA.RED }}>Devoluciones</span></h1>
                    <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Auditoría técnica de reversiones, reclamos y cargos por logística inversa.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{
                        padding: '8px 16px', fontSize: '11px', fontWeight: 700, border: `1px solid ${JA.BORDER}`,
                        background: 'white', color: JA.TEXT, borderRadius: '2px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        <Info style={{ width: '14px', height: '14px', color: JA.GOLD }} />
                        PROTOCOLO LOGÍSTICO
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {[
                    { label: 'Unidades Devueltas', value: cantDevoluaciones, color: JA.GOLD, icon: RotateCcw },
                    { label: 'Reclamos Administrativos', value: cantReclamos, color: JA.RED, icon: MessageSquare },
                    { label: 'Capital Reembolsado', value: COP(totalDevuelto), color: JA.NAVY, icon: DollarSign },
                    { label: 'Impacto Utilidad (Pérdida)', value: COP(Math.abs(impactoTotal)), color: JA.RED, icon: TrendingDown },
                ].map((kpi, i) => (
                    <div key={i} style={{ ...cardStyle, borderLeft: `4px solid ${kpi.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>{kpi.label}</p>
                            <kpi.icon style={{ width: '12px', height: '12px', color: kpi.color }} />
                        </div>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: JA.TEXT, margin: 0, fontFamily: 'monospace' }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Alert Indicator */}
            {parseFloat(tasaDev) > 5 && (
                <div style={{ ...cardStyle, background: JA.RED + '08', border: `1px solid ${JA.RED}20`, display: 'flex', gap: '16px', alignItems: 'center', padding: '12px 20px' }}>
                    <AlertTriangle style={{ width: '24px', height: '24px', color: JA.RED }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: JA.RED, margin: 0 }}>CRITICAL: TASA DE DEVOLUCIÓN EXCEDIDA ({tasaDev}%)</p>
                        <p style={{ fontSize: '10px', color: JA.GREY, margin: '2px 0 0 0' }}>El indicador supera el umbral de tolerancia del 5.0%. Existe riesgo de penalización en el posicionamiento de Mercado Libre.</p>
                    </div>
                </div>
            )}

            {/* Analysis Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '20px' }}>Pareto de Motivos de Devolución</h3>
                    <div style={{ height: '240px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={MOTIVOS_STATS} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }} barSize={10}>
                                <CartesianGrid strokeDasharray="3 3" stroke={JA.BG} horizontal={false} />
                                <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                                <YAxis type="category" dataKey="motivo" tick={{ ...AXIS_STYLE, fontSize: 8 }} axisLine={false} tickLine={false} width={120} />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [COP(v), 'Capital']} />
                                <Bar dataKey="valor" fill={JA.RED} radius={[0, 1, 1, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div style={cardStyle}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '20px' }}>Conciliación de Pérdidas</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ padding: '16px', background: JA.BG, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: JA.GREY }}>Capital reembolsado a clientes</span>
                                <span style={{ color: JA.RED, fontWeight: 700, fontFamily: 'monospace' }}>{COP(totalDevuelto)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: JA.GREY }}>Comisiones no bonificadas</span>
                                <span style={{ color: JA.RED, fontWeight: 700, fontFamily: 'monospace' }}>{COP(Math.round(totalDevuelto * 0.12))}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: JA.GREY }}>Costos logísticos hundidos</span>
                                <span style={{ color: JA.RED, fontWeight: 700, fontFamily: 'monospace' }}>{COP(Math.round(totalDevuelto * 0.06))}</span>
                            </div>
                            <div style={{ borderTop: `1px solid ${JA.BORDER}`, paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ fontWeight: 800, color: JA.NAVY }}>IMPACTO FINANCIERO TOTAL</span>
                                <span style={{ color: JA.RED, fontWeight: 900, fontFamily: 'monospace' }}>{COP(Math.abs(impactoTotal))}</span>
                            </div>
                        </div>
                        <div style={{ padding: '12px', background: JA.GOLD + '08', border: `1px solid ${JA.GOLD}30`, borderRadius: '2px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GOLD, margin: '0 0 4px 0' }}>RECOMENDACIÓN TÉCNICA</p>
                            <p style={{ fontSize: '10px', color: JA.GREY, margin: 0 }}>Optimizar embalaje de &quot;Auriculares Bluetooth Pro&quot;. Registra una tasa de incidencia del 4.2% por daños en tránsito.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Audit Table */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Historial de Incidencias Operativas</h3>
                    <div style={{ display: 'flex', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
                        {(['todos', 'devolución', 'reclamo'] as const).map(f => (
                            <button key={f} onClick={() => setFiltro(f)} style={{
                                padding: '6px 12px', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer',
                                background: filtro === f ? JA.NAVY : 'white', color: filtro === f ? 'white' : JA.GREY,
                                borderLeft: f !== 'todos' ? `1px solid ${JA.BORDER}` : 'none',
                                textTransform: 'uppercase'
                            }}>
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ background: JA.BG, textAlign: 'left', borderBottom: `2px solid ${JA.BORDER}` }}>
                                <th style={{ padding: '12px' }}>ORDEN / REFERENCIA</th>
                                <th style={{ padding: '12px' }}>PRODUCTO AFECTADO</th>
                                <th style={{ padding: '12px' }}>TIPO</th>
                                <th style={{ padding: '12px' }}>MOTIVO DE RECLAMO</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>VALOR REEMBOLSO</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>PÉRDIDA EST.</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>FECHA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devolucionesFiltradas.map((d, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${JA.BG}` }}>
                                    <td style={{ padding: '12px', fontFamily: 'monospace', color: JA.GREY }}>{d.orden}</td>
                                    <td style={{ padding: '12px', fontWeight: 700, color: JA.TEXT }}>{d.producto}</td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{ 
                                            padding: '2px 8px', borderRadius: '1px', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase',
                                            background: d.tipo === 'reclamo' ? JA.RED + '15' : JA.GOLD + '15',
                                            color: d.tipo === 'reclamo' ? JA.RED : JA.GOLD
                                        }}>{d.tipo}</span>
                                    </td>
                                    <td style={{ padding: '12px', color: JA.GREY }}>{d.motivo}</td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: JA.RED, fontWeight: 700 }}>{COP(d.valorReembolsado)}</td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: JA.RED }}>{COP(Math.abs(d.impactoUtilidad))}</td>
                                    <td style={{ padding: '12px', textAlign: 'center', color: JA.GREY_LT }}>{d.fecha}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
