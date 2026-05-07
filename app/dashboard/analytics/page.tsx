'use client'

import { useClient } from '../ClientContext'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell, CartesianGrid, Legend
} from 'recharts'
import { TrendingUp, Users, FileText, Info, BarChart3, LineChart } from 'lucide-react'

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

const TOOLTIP_STYLE = {
    contentStyle: { backgroundColor: '#FFFFFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', color: JA.TEXT, fontSize: '11px', fontWeight: 600 },
    cursor: { fill: 'rgba(19,33,60,0.03)' }
}

const AXIS_STYLE = { fill: JA.GREY, fontSize: 10, fontWeight: 600 }

const ACCENT_COLORS = [JA.NAVY, JA.GOLD, JA.BLUE, JA.GREEN, JA.GREY]

export default function AnalyticsPage() {
    const { data: clientData, loading } = useClient()

    if (loading || !clientData) {
        return (
            <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '12px', color: JA.GREY, fontSize: '14px' }}>
                <div style={{ width: '16px', height: '16px', border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Procesando Inteligencia de Negocios...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    const salesData = clientData.salesHistory.map((item) => ({
        day: item.date.split('-').slice(0, 2).join('/'),
        value: item.amount
    }))

    const topClientsData = clientData.topClients.map(c => ({
        name: c.name.length > 18 ? c.name.substring(0, 18) + '…' : c.name,
        amount: Math.round(c.amount),
        percent: c.percent
    }))

    const recurringData = clientData.recurringCustomers.slice(0, 6).map(c => ({
        name: c.name.length > 16 ? c.name.substring(0, 16) + '…' : c.name,
        compras: c.count,
        total: Math.round(c.total)
    }))

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Business <span style={{ color: JA.GOLD }}>Intelligence</span></h1>
                    <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Auditoría técnica de flujos financieros y recurrencia de cartera.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: JA.GREEN + '10', border: `1px solid ${JA.GREEN}30`, borderRadius: '2px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: JA.GREEN, animation: 'pulse 2s infinite' }} />
                    <span style={{ fontSize: '10px', fontWeight: 800, color: JA.GREEN }}>LIVE DATA CONNECTION</span>
                </div>
                <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }`}</style>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {[
                    { label: 'Facturación Mensual', value: clientData.metrics.sales.value, color: JA.NAVY, icon: TrendingUp, sub: `${clientData.metrics.sales.change}% TREND` },
                    { label: 'Cartera de Clientes', value: clientData.metrics.newClients.value, color: JA.GOLD, icon: Users, sub: `${clientData.metrics.newClients.change}% TREND` },
                    { label: 'Volumen Documental', value: clientData.metrics.productsSold.value, color: JA.BLUE, icon: FileText, sub: `${clientData.metrics.productsSold.change}% TREND` },
                ].map((kpi, i) => (
                    <div key={i} style={{ ...cardStyle, borderLeft: `4px solid ${kpi.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>{kpi.label}</p>
                            <kpi.icon style={{ width: '12px', height: '12px', color: kpi.color }} />
                        </div>
                        <p style={{ fontSize: '24px', fontWeight: 800, color: JA.TEXT, margin: 0, fontFamily: 'monospace' }}>{kpi.value}</p>
                        <p style={{ fontSize: '10px', fontWeight: 800, color: kpi.sub.includes('-') ? JA.RED : JA.GREEN, marginTop: '4px' }}>{kpi.sub}</p>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                {/* Sales Trend */}
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <LineChart style={{ width: '16px', height: '16px', color: JA.NAVY }} /> TENDENCIA CRÍTICA DE VENTAS
                        </h3>
                    </div>
                    {salesData.length > 0 ? (
                        <div style={{ height: '240px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={salesData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gNavyAn" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={JA.NAVY} stopOpacity={0.1} />
                                            <stop offset="95%" stopColor={JA.NAVY} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={JA.BG} vertical={false} />
                                    <XAxis dataKey="day" tick={AXIS_STYLE} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false}
                                        tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`}
                                        width={40} />
                                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [COP(Number(v)), 'Total']} />
                                    <Area type="monotone" dataKey="value" stroke={JA.NAVY} strokeWidth={2}
                                        fill="url(#gNavyAn)" dot={false}
                                        activeDot={{ r: 4, fill: JA.NAVY, strokeWidth: 0 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: JA.GREY_LT, fontSize: '11px' }}>AUDITORÍA DE DATOS REQUERIDA</div>
                    )}
                </div>

                {/* Top Clients */}
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BarChart3 style={{ width: '16px', height: '16px', color: JA.GOLD }} /> CONCENTRACIÓN DE FACTURACIÓN
                        </h3>
                    </div>
                    {topClientsData.length > 0 ? (
                        <div style={{ height: '240px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topClientsData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }} barSize={8}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={JA.BG} horizontal={false} />
                                    <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false}
                                        tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`} />
                                    <YAxis type="category" dataKey="name" tick={AXIS_STYLE} axisLine={false} tickLine={false} width={100} />
                                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [COP(Number(v)), 'Total']} />
                                    <Bar dataKey="amount" radius={[0, 1, 1, 0]}>
                                        {topClientsData.map((_, i) => (
                                            <Cell key={i} fill={ACCENT_COLORS[i % ACCENT_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: JA.GREY_LT, fontSize: '11px' }}>SIN DATOS DE CARTERA</div>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                {/* Recurrence */}
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Recurrencia por Identificación</h3>
                    </div>
                    {recurringData.length > 0 ? (
                        <div style={{ height: '220px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={recurringData} barSize={12} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={JA.BG} vertical={false} />
                                    <XAxis dataKey="name" tick={{ ...AXIS_STYLE, fontSize: 8 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={30} />
                                    <Tooltip {...TOOLTIP_STYLE} />
                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '12px' }} />
                                    <Bar dataKey="compras" name="Nº Transacciones" fill={JA.NAVY} radius={[1, 1, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: JA.GREY_LT, fontSize: '11px' }}>DATOS INSUFICIENTES</div>
                    )}
                </div>

                {/* IA Prediction */}
                <div style={{ ...cardStyle, background: JA.NAVY, border: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>PREDICCIÓN GERENCIAL (30D)</h3>
                        <span style={{ fontSize: '9px', fontWeight: 900, color: JA.GOLD, border: `1px solid ${JA.GOLD}50`, padding: '2px 6px', borderRadius: '1px' }}>MODELO PREDICTIVO IA</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Recaudo Estimado Próximo Mes</p>
                            <p style={{ fontSize: '32px', fontWeight: 800, color: '#FFFFFF', margin: 0, fontFamily: 'monospace' }}>
                                {COP(clientData.prediction.nextMonth)}
                            </p>
                        </div>

                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 800, color: JA.GOLD, margin: '0 0 4px 0' }}>FÓRMULA TÉCNICA (REGRESIÓN)</p>
                            <code style={{ fontSize: '11px', color: '#FFFFFF', fontFamily: 'monospace' }}>
                                {clientData.prediction.formula}
                            </code>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                                padding: '4px 10px', borderRadius: '1px', fontSize: '11px', fontWeight: 900, 
                                background: clientData.prediction.growthRate >= 0 ? JA.GREEN : JA.RED, color: 'white'
                            }}>
                                {clientData.prediction.growthRate >= 0 ? '↑' : '↓'} {Math.abs(clientData.prediction.growthRate).toFixed(1)}% TREND
                            </div>
                            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                                Basado en auditoría de {clientData.salesHistory.length} registros históricos.
                            </p>
                        </div>

                        {/* Recent Activity Mini-Table */}
                        <div style={{ marginTop: '10px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginBottom: '8px', textTransform: 'uppercase' }}>Últimas Operaciones</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {clientData.recentActivity.slice(0, 3).map((a, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '1px' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.client}</p>
                                            <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>{a.time}</p>
                                        </div>
                                        <span style={{ fontSize: '11px', fontWeight: 800, color: JA.GOLD, fontFamily: 'monospace', marginLeft: '12px' }}>
                                            {a.amount}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
