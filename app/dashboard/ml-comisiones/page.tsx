'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { Percent, DollarSign, Package, Megaphone, Warehouse, MoreHorizontal, TrendingDown, Info, LayoutGrid, List } from 'lucide-react'

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
    PURPLE:  '#8B5CF6',
    BLUE:    '#3B82F6'
}

const cardStyle = {
    background: '#FFFFFF',
    border: `1px solid ${JA.BORDER}`,
    borderRadius: '2px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    padding: '20px',
}

const COP = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`
const PCT = (n: number) => `${n.toFixed(1)}%`

const TOOLTIP_STYLE = {
    contentStyle: { backgroundColor: '#FFFFFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', color: JA.TEXT, fontSize: '11px', fontWeight: 600 },
    cursor: { fill: 'rgba(19,33,60,0.03)' }
}

const COMISIONES_PRODUCTO = [
    { producto: 'Auriculares Bluetooth Pro', ventas: 1850000, comisionVenta: 222000, envio: 90000, publicidad: 45000, total: 357000, pct: 19.3 },
    { producto: 'Teclado Mecánico RGB', ventas: 2400000, comisionVenta: 288000, envio: 120000, publicidad: 60000, total: 468000, pct: 19.5 },
    { producto: 'Mouse Inalámbrico 2.4G', ventas: 960000, comisionVenta: 115200, envio: 48000, publicidad: 24000, total: 187200, pct: 19.5 },
    { producto: 'Webcam HD 1080p', ventas: 1680000, comisionVenta: 201600, envio: 84000, publicidad: 42000, total: 327600, pct: 19.5 },
    { producto: 'Cable USB-C 2m', ventas: 420000, comisionVenta: 50400, envio: 21000, publicidad: 0, total: 71400, pct: 17.0 },
    { producto: 'Hub USB 7 puertos', ventas: 780000, comisionVenta: 93600, envio: 39000, publicidad: 15000, total: 147600, pct: 18.9 },
]

const COMISIONES_MES = [
    { mes: 'Oct', comision: 820000, envio: 210000, publicidad: 95000, full: 45000 },
    { mes: 'Nov', comision: 950000, envio: 245000, publicidad: 110000, full: 52000 },
    { mes: 'Dic', comision: 1320000, envio: 340000, publicidad: 155000, full: 72000 },
    { mes: 'Ene', comision: 875000, envio: 225000, publicidad: 105000, full: 49000 },
    { mes: 'Feb', comision: 920000, envio: 238000, publicidad: 112000, full: 53000 },
    { mes: 'Mar', comision: 1050000, envio: 270000, publicidad: 130000, full: 61000 },
]

const TIPO_CARGO = [
    { tipo: 'Comisión por venta', icon: DollarSign, color: JA.GOLD, total: 1569600, pct: 12.0 },
    { tipo: 'Cargo por envío ML', icon: Package, color: JA.GREEN, total: 402000, pct: 3.1 },
    { tipo: 'Publicidad ML', icon: Megaphone, color: JA.BLUE, total: 186000, pct: 1.4 },
    { tipo: 'Almacenamiento Full', icon: Warehouse, color: JA.PURPLE, total: 61000, pct: 0.5 },
    { tipo: 'Otros cargos', icon: MoreHorizontal, color: JA.RED, total: 23400, pct: 0.2 },
]

const PIE_DATA = TIPO_CARGO.map(t => ({ name: t.tipo, value: t.total }))
const PIE_COLORS = [JA.GOLD, JA.GREEN, JA.BLUE, JA.PURPLE, JA.RED]
const AXIS_STYLE = { fill: JA.GREY, fontSize: 10, fontWeight: 600 }

export default function ComisionesPage() {
    const [vista, setVista] = useState<'producto' | 'mes'>('mes')

    const totalComisiones = TIPO_CARGO.reduce((s, t) => s + t.total, 0)
    const totalVentas = COMISIONES_PRODUCTO.reduce((s, p) => s + p.ventas, 0)
    const pctTotal = (totalComisiones / totalVentas) * 100

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Comisiones <span style={{ color: JA.GOLD }}>Mercado Libre</span></h1>
                    <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Auditoría técnica de cargos operativos y márgenes de intermediación.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{
                        padding: '8px 16px', fontSize: '11px', fontWeight: 700, border: `1px solid ${JA.BORDER}`,
                        background: 'white', color: JA.TEXT, borderRadius: '2px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        <Info style={{ width: '14px', height: '14px', color: JA.GOLD }} />
                        VER POLÍTICAS ML
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {[
                    { label: 'Costo Operativo Total', value: COP(totalComisiones), color: JA.RED, icon: TrendingDown },
                    { label: 'Margen de Retención', value: PCT(pctTotal), color: JA.GOLD, icon: Percent },
                    { label: 'Retención Directa Venta', value: COP(TIPO_CARGO[0].total), color: JA.NAVY, icon: DollarSign },
                    { label: 'Logística y Envíos', value: COP(TIPO_CARGO[1].total), color: JA.GREEN, icon: Package },
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

            {/* Breakdown Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '20px' }}>Desglose de Cargos por Tipo</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {TIPO_CARGO.map((t, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '32px', height: '32px', background: JA.BG, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '1px' }}>
                                    <t.icon style={{ width: '16px', height: '16px', color: t.color }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT }}>{t.tipo}</span>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: JA.TEXT, fontFamily: 'monospace' }}>{COP(t.total)}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '4px', background: JA.BG, borderRadius: '1px' }}>
                                        <div style={{ width: `${(t.total / totalComisiones) * 100}%`, height: '100%', background: t.color, borderRadius: '1px' }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '24px', padding: '12px', background: JA.NAVY, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'white' }}>TOTAL CARGOS ML</span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: JA.GOLD, fontFamily: 'monospace' }}>{COP(totalComisiones)}</span>
                    </div>
                </div>

                <div style={cardStyle}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '20px' }}>Proporción de Intermediación</h3>
                    <div style={{ height: '240px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                                    {PIE_DATA.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                                </Pie>
                                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [COP(v), 'Costo']} />
                                <Legend verticalAlign="bottom" align="center" iconType="rect" wrapperStyle={{ fontSize: '9px', fontWeight: 700, paddingTop: '20px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Evolution Area */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Análisis de Tendencia</h3>
                        <p style={{ fontSize: '10px', color: JA.GREY, marginTop: '2px' }}>Histórico consolidado de costos de plataforma.</p>
                    </div>
                    <div style={{ display: 'flex', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
                        <button onClick={() => setVista('mes')} style={{
                            padding: '6px 12px', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: vista === 'mes' ? JA.NAVY : 'white', color: vista === 'mes' ? 'white' : JA.GREY,
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                            <LayoutGrid style={{ width: '12px', height: '12px' }} /> MENSUAL
                        </button>
                        <button onClick={() => setVista('producto')} style={{
                            padding: '6px 12px', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: vista === 'producto' ? JA.NAVY : 'white', color: vista === 'producto' ? 'white' : JA.GREY,
                            borderLeft: `1px solid ${JA.BORDER}`, display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                            <List style={{ width: '12px', height: '12px' }} /> POR PRODUCTO
                        </button>
                    </div>
                </div>

                {vista === 'mes' ? (
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={COMISIONES_MES} barGap={4} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={JA.BG} vertical={false} />
                                <XAxis dataKey="mes" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} width={50} />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [COP(v), '']} />
                                <Legend verticalAlign="top" align="right" iconType="rect" wrapperStyle={{ fontSize: '10px', fontWeight: 600, paddingBottom: '20px' }} />
                                <Bar dataKey="comision" name="Comisión Venta" fill={JA.GOLD} radius={[1, 1, 0, 0]} maxBarSize={25} />
                                <Bar dataKey="envio" name="Logística" fill={JA.GREEN} radius={[1, 1, 0, 0]} maxBarSize={25} />
                                <Bar dataKey="publicidad" name="Publicidad" fill={JA.BLUE} radius={[1, 1, 0, 0]} maxBarSize={25} />
                                <Bar dataKey="full" name="Almacenaje" fill={JA.PURPLE} radius={[1, 1, 0, 0]} maxBarSize={25} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                            <thead>
                                <tr style={{ background: JA.BG, textAlign: 'left', borderBottom: `2px solid ${JA.BORDER}` }}>
                                    <th style={{ padding: '12px' }}>PRODUCTO / SKU</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>VTAS BRUTAS</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>COMISIÓN</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>LOGÍSTICA</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>ADS</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>TOTAL ML</th>
                                    <th style={{ padding: '12px', textAlign: 'center' }}>% RETENCIÓN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {COMISIONES_PRODUCTO.map((p, i) => (
                                    <tr key={i} style={{ borderBottom: `1px solid ${JA.BG}` }}>
                                        <td style={{ padding: '12px', fontWeight: 600, color: JA.TEXT }}>{p.producto}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: JA.GREY }}>{COP(p.ventas)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: JA.GOLD, fontWeight: 600 }}>{COP(p.comisionVenta)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: JA.GREEN }}>{COP(p.envio)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: JA.BLUE }}>{COP(p.publicidad)}</td>
                                        <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: JA.RED, fontWeight: 700 }}>{COP(p.total)}</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{ 
                                                padding: '2px 8px', borderRadius: '1px', fontSize: '10px', fontWeight: 800,
                                                background: p.pct > 19 ? JA.RED + '15' : JA.BG,
                                                color: p.pct > 19 ? JA.RED : JA.GREY
                                            }}>
                                                {PCT(p.pct)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Audit Notice */}
            <div style={{ ...cardStyle, background: JA.BG, display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Info style={{ width: '16px', height: '16px', color: JA.GREY }} />
                <p style={{ fontSize: '10px', color: JA.GREY, margin: 0, fontStyle: 'italic' }}>
                    * Los cálculos de comisiones presentados corresponden a los cargos liquidados directamente por Mercado Libre. 
                    No incluyen IVA sobre comisiones ni retenciones en la fuente adicionales que puedan aplicar según el régimen tributario.
                </p>
            </div>
        </div>
    )
}
