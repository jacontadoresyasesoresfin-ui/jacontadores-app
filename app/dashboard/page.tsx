'use client'

import MetricCard from './components/widgets/MetricCard'
import { DollarSign, Wallet, Package, Users } from 'lucide-react'
import { useClient } from './ClientContext'
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, BarChart, Bar, Cell
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
}

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

const cardStyle = {
    background: '#FFFFFF',
    border: `1px solid ${JA.BORDER}`,
    borderRadius: '2px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    padding: '20px',
}

export default function DashboardPage() {
    const { data: clientData, loading } = useClient()

    if (loading || !clientData) {
        return (
            <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '12px', color: JA.GREY, fontSize: '14px' }}>
                <div style={{ width: '16px', height: '16px', border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Sincronizando datos corporativos...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    const salesData = clientData.salesHistory.map((item) => ({
        day: item.date.split('-').slice(0, 2).join('/'),
        value: item.amount
    }))

    const topClientsData = clientData.topClients.map(c => ({
        name: c.name.length > 14 ? c.name.substring(0, 14) + '…' : c.name,
        amount: Math.round(c.amount),
        percent: c.percent
    }))

    const barColors = [JA.NAVY, '#1C3460', '#2B4A8C', '#3A60B8', '#4976E4']

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>

            {/* ── Métricas Principales ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <MetricCard
                    title={clientData.metrics.sales.title}
                    value={clientData.metrics.sales.value}
                    change={clientData.metrics.sales.change}
                    changeLabel={clientData.metrics.sales.changeLabel}
                    icon={DollarSign}
                    trend={clientData.metrics.sales.trend}
                    sparklineData={clientData.metrics.sales.sparklineData}
                    accentColor={JA.NAVY}
                />
                <MetricCard
                    title={clientData.metrics.newClients.title}
                    value={clientData.metrics.newClients.value}
                    change={clientData.metrics.newClients.change}
                    changeLabel={clientData.metrics.newClients.changeLabel}
                    icon={Users}
                    trend={clientData.metrics.newClients.trend}
                    sparklineData={clientData.metrics.newClients.sparklineData}
                    accentColor={JA.NAVY}
                />
                <MetricCard
                    title={clientData.metrics.overdue.title}
                    value={clientData.metrics.overdue.value}
                    change={clientData.metrics.overdue.change}
                    changeLabel={clientData.metrics.overdue.changeLabel}
                    icon={Wallet}
                    trend={clientData.metrics.overdue.trend}
                    sparklineData={clientData.metrics.overdue.sparklineData}
                    accentColor={JA.RED}
                />
                <MetricCard
                    title={clientData.metrics.productsSold.title}
                    value={clientData.metrics.productsSold.value}
                    change={clientData.metrics.productsSold.change}
                    changeLabel={clientData.metrics.productsSold.changeLabel}
                    icon={Package}
                    trend={clientData.metrics.productsSold.trend}
                    sparklineData={clientData.metrics.productsSold.sparklineData}
                    accentColor={JA.GOLD}
                />
            </div>

            {/* ── Gráficas principales ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>

                {/* Área: Ventas */}
                <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                        <div>
                            <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Ventas Últimos 30 Días</h3>
                            <p style={{ fontSize: '11px', color: JA.GREY, marginTop: '2px' }}>Análisis de facturación mensual en COP</p>
                        </div>
                    </div>
                    {salesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={JA.BORDER} vertical={false} />
                                <XAxis dataKey="day" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={40}
                                    tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Total']} />
                                <Area type="monotone" dataKey="value" stroke={JA.NAVY} strokeWidth={2} fill={JA.NAVY} fillOpacity={0.05} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: JA.GREY_LT, fontSize: '13px' }}>
                            Sin datos registrados
                        </div>
                    )}
                </div>

                {/* Top Clientes */}
                <div style={cardStyle}>
                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Distribución por Clientes</h3>
                        <p style={{ fontSize: '11px', color: JA.GREY, marginTop: '2px' }}>Principales cuentas por volumen</p>
                    </div>
                    {topClientsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={topClientsData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }} barSize={12}>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" tick={AXIS_STYLE} axisLine={false} tickLine={false} width={100} />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Total']} />
                                <Bar dataKey="amount" radius={[0, 2, 2, 0]}>
                                    {topClientsData.map((_, i) => (
                                        <Cell key={i} fill={barColors[i % barColors.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} style={{ height: '12px', background: JA.BG, borderRadius: '1px' }} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Segunda fila ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>

                {/* Cartera */}
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '20px' }}>Estado de Cartera</h3>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{ width: '120px', height: '120px', position: 'relative' }}>
                            <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                                <circle cx="50" cy="50" r="40" fill="none" stroke={JA.BG} strokeWidth="10" />
                                <circle cx="50" cy="50" r="40" fill="none" stroke={JA.GREEN} strokeWidth="10"
                                    strokeDasharray={`${(clientData.portfolio.current.percent * 251) / 100} 251`} />
                                <circle cx="50" cy="50" r="40" fill="none" stroke={JA.RED} strokeWidth="10"
                                    strokeDasharray={`${(clientData.portfolio.overdue.percent * 251) / 100} 251`}
                                    strokeDashoffset={`-${((clientData.portfolio.current.percent + clientData.portfolio.dueSoon.percent) * 251) / 100}`} />
                            </svg>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                <span style={{ fontSize: '16px', fontWeight: 700, color: JA.TEXT }}>{clientData.portfolio.current.percent}%</span>
                                <span style={{ fontSize: '8px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase' }}>Al día</span>
                            </div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                                { label: 'Vigente', color: JA.GREEN, val: clientData.portfolio.current.value },
                                { label: 'Vencida', color: JA.RED, val: clientData.portfolio.overdue.value },
                                { label: 'Total', color: JA.NAVY, val: clientData.portfolio.total }
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${JA.BG}`, paddingBottom: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '1px', background: item.color }} />
                                        <span style={{ fontSize: '11px', color: JA.GREY }}>{item.label}</span>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT }}>{item.val}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actividad */}
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '20px' }}>Historial Operativo</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {clientData.recentActivity.length > 0 ? clientData.recentActivity.slice(0, 5).map((activity, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: JA.BG, borderLeft: `3px solid ${JA.NAVY}` }}>
                                <div>
                                    <p style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT, margin: 0 }}>{activity.text}</p>
                                    <p style={{ fontSize: '10px', color: JA.GREY, margin: 0 }}>{activity.client}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>{activity.amount}</p>
                                    <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>{activity.time}</p>
                                </div>
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', padding: '32px', color: JA.GREY_LT, fontSize: '12px' }}>
                                Sin actividad reciente
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

