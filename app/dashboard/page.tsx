'use client'

import MetricCard from './components/widgets/MetricCard'
import { DollarSign, Wallet, Package, Users } from 'lucide-react'
import { useClient } from './ClientContext'
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, BarChart, Bar, Cell
} from 'recharts'

const TEAL = '#14B8A6'
const NAVY = '#0B2447'
const GOLD = '#D4A843'
const GREEN = '#10B981'
const RED = '#EF4444'

const TOOLTIP_STYLE = {
    contentStyle: {
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        color: '#1E293B',
        fontSize: '12px',
        boxShadow: '0 8px 32px rgba(15,23,42,0.12)',
    },
    cursor: { fill: 'rgba(20,184,166,0.04)' }
}

const AXIS_STYLE = { fill: '#94A3B8', fontSize: 11, fontFamily: 'var(--font-inter)' }

const cardStyle = {
    background: '#FFFFFF',
    border: '1.5px solid #E2E8F0',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
    padding: '20px',
}

export default function DashboardPage() {
    const { data: clientData, loading } = useClient()

    if (loading || !clientData) {
        return (
            <div className="p-8 flex items-center gap-3 text-slate-600">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: `${TEAL}40`, borderTopColor: TEAL }} />
                Cargando datos del cliente...
            </div>
        )
    }

    const salesData = clientData.salesHistory.map((item) => ({
        day: item.date.split('-').slice(0, 2).join('/'),
        value: item.amount
    }))

    const topClientsData = clientData.topClients.map(c => ({
        name: c.name.length > 16 ? c.name.substring(0, 16) + '…' : c.name,
        amount: Math.round(c.amount),
        percent: c.percent
    }))

    const barColors = [TEAL, NAVY, GOLD, GREEN, '#8B5CF6']

    return (
        <div className="space-y-6 pb-8" style={{ fontFamily: 'var(--font-inter)' }}>

            {/* ── Métricas Principales ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title={clientData.metrics.sales.title}
                    value={clientData.metrics.sales.value}
                    change={clientData.metrics.sales.change}
                    changeLabel={clientData.metrics.sales.changeLabel}
                    icon={DollarSign}
                    trend={clientData.metrics.sales.trend}
                    sparklineData={clientData.metrics.sales.sparklineData}
                    accentColor={TEAL}
                />
                <MetricCard
                    title={clientData.metrics.newClients.title}
                    value={clientData.metrics.newClients.value}
                    change={clientData.metrics.newClients.change}
                    changeLabel={clientData.metrics.newClients.changeLabel}
                    icon={Users}
                    trend={clientData.metrics.newClients.trend}
                    sparklineData={clientData.metrics.newClients.sparklineData}
                    accentColor={NAVY}
                />
                <MetricCard
                    title={clientData.metrics.overdue.title}
                    value={clientData.metrics.overdue.value}
                    change={clientData.metrics.overdue.change}
                    changeLabel={clientData.metrics.overdue.changeLabel}
                    icon={Wallet}
                    trend={clientData.metrics.overdue.trend}
                    sparklineData={clientData.metrics.overdue.sparklineData}
                    accentColor={RED}
                />
                <MetricCard
                    title={clientData.metrics.productsSold.title}
                    value={clientData.metrics.productsSold.value}
                    change={clientData.metrics.productsSold.change}
                    changeLabel={clientData.metrics.productsSold.changeLabel}
                    icon={Package}
                    trend={clientData.metrics.productsSold.trend}
                    sparklineData={clientData.metrics.productsSold.sparklineData}
                    accentColor={GOLD}
                />
            </div>

            {/* ── Gráficas principales ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Área: Ventas */}
                <div className="lg:col-span-2" style={cardStyle}>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm">Ventas Últimos 30 Días</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Histórico de facturación · COP</p>
                        </div>
                        <div className="flex items-center gap-1">
                            {['30D', '7D', '24H'].map((p, i) => (
                                <button key={p} className="px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors"
                                    style={i === 0
                                        ? { background: TEAL, color: 'white' }
                                        : { background: '#F1F5F9', color: '#64748B' }}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                    {salesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={salesData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gTeal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={TEAL} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                <XAxis dataKey="day" tick={AXIS_STYLE} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false}
                                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                                    width={48} />
                                <Tooltip {...TOOLTIP_STYLE}
                                    formatter={(v: any) => [`$${Number(v).toLocaleString('es-CO')}`, 'Total']}
                                    labelStyle={{ color: '#1E293B', fontWeight: 'bold' }} />
                                <Area type="monotone" dataKey="value" stroke={TEAL} strokeWidth={2.5}
                                    fill="url(#gTeal)" dot={false}
                                    activeDot={{ r: 5, fill: TEAL, strokeWidth: 0, stroke: 'white' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
                            Sin datos de ventas disponibles
                        </div>
                    )}
                </div>

                {/* Top Clientes */}
                <div style={cardStyle}>
                    <div className="mb-4">
                        <h3 className="font-bold text-slate-800 text-sm">Top Clientes</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Por facturación total</p>
                    </div>
                    {topClientsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={topClientsData} layout="vertical"
                                margin={{ top: 5, right: 12, left: 0, bottom: 0 }} barSize={10}>
                                <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false}
                                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`} />
                                <YAxis type="category" dataKey="name" tick={AXIS_STYLE} axisLine={false} tickLine={false} width={90} />
                                <Tooltip {...TOOLTIP_STYLE}
                                    formatter={(v: any) => [`$${Number(v).toLocaleString('es-CO')}`, 'Total']}
                                    labelStyle={{ color: '#1E293B', fontWeight: 'bold' }} />
                                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                                    {topClientsData.map((_, i) => (
                                        <Cell key={i} fill={barColors[i % barColors.length]} fillOpacity={1 - i * 0.08} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="space-y-3 pt-2">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-400">Sin datos</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Segunda fila ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Estado de Cartera */}
                <div style={cardStyle}>
                    <h3 className="font-bold text-slate-800 text-sm mb-4">Estado de Cartera</h3>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Donut */}
                        <div className="relative w-36 h-36 flex-shrink-0">
                            <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                                <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="12" />
                                <circle cx="50" cy="50" r="40" fill="none" stroke={TEAL} strokeWidth="13"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(clientData.portfolio.current.percent * 251.3) / 100} 251.3`}
                                    className="transition-all duration-1000 ease-out" />
                                <circle cx="50" cy="50" r="40" fill="none" stroke={GOLD} strokeWidth="13"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(clientData.portfolio.dueSoon.percent * 251.3) / 100} 251.3`}
                                    strokeDashoffset={`-${(clientData.portfolio.current.percent * 251.3) / 100}`}
                                    className="transition-all duration-1000 delay-300 ease-out" />
                                <circle cx="50" cy="50" r="40" fill="none" stroke={RED} strokeWidth="13"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(clientData.portfolio.overdue.percent * 251.3) / 100} 251.3`}
                                    strokeDashoffset={`-${((clientData.portfolio.current.percent + clientData.portfolio.dueSoon.percent) * 251.3) / 100}`}
                                    className="transition-all duration-1000 delay-500 ease-out" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-xl font-black text-slate-800">
                                    {clientData.portfolio.current.percent + clientData.portfolio.dueSoon.percent}%
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-teal-600">Saludable</span>
                            </div>
                        </div>

                        {/* Detalle */}
                        <div className="flex-1 w-full space-y-2">
                            <div className="p-3 rounded-xl mb-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Cartera Total</p>
                                <p className="text-xl font-black text-slate-800">{clientData.portfolio.total}</p>
                            </div>
                            {[
                                { label: 'Al Día', data: clientData.portfolio.current, color: TEAL },
                                { label: 'Por Vencer (7d)', data: clientData.portfolio.dueSoon, color: GOLD },
                                { label: 'Vencida', data: clientData.portfolio.overdue, color: RED },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">{item.label}</p>
                                            <p className="text-[10px] text-slate-400">{item.data.value}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black" style={{ color: item.color }}>{item.data.percent}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actividad Reciente */}
                <div style={cardStyle}>
                    <h3 className="font-bold text-slate-800 text-sm mb-4">Actividad Reciente</h3>
                    <div className="space-y-3">
                        {clientData.recentActivity.length > 0 ? clientData.recentActivity.map((activity, i) => (
                            <div key={i} className="flex items-start gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: `${TEAL}15` }}>
                                    <div className="w-2 h-2 rounded-full" style={{ background: TEAL }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-700">{activity.text}</p>
                                    <p className="text-xs text-slate-400 truncate">{activity.client}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-bold font-mono" style={{ color: TEAL }}>{activity.amount}</p>
                                    <p className="text-xs text-slate-400">{activity.time}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-8 text-slate-400 text-sm">
                                Sin actividad reciente registrada
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
