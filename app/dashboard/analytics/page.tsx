'use client'

import { useClient } from '../ClientContext'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell, CartesianGrid, Legend
} from 'recharts'
import { TrendingUp, Users, FileText } from 'lucide-react'

const TEAL = '#14B8A6'
const NAVY = '#0B2447'
const GOLD = '#D4A843'
const GREEN = '#10B981'
const RED = '#EF4444'
const PURPLE = '#8B5CF6'

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

const cardStyle = {
    background: '#FFFFFF',
    border: '1.5px solid #E2E8F0',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
    padding: '20px',
}

const ACCENT_COLORS = [TEAL, NAVY, GOLD, GREEN, PURPLE]

export default function AnalyticsPage() {
    const { data: clientData, loading } = useClient()

    if (loading || !clientData) {
        return (
            <div className="p-8 flex items-center gap-3 text-slate-600">
                <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: `${TEAL}40`, borderTopColor: TEAL }} />
                Cargando Business Intelligence...
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
        <div className="space-y-6 pb-10" style={{ fontFamily: 'var(--font-inter)' }}>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-800" style={{ fontFamily: 'var(--font-outfit)' }}>
                        Business Intelligence <span style={{ color: TEAL }}>— Tiempo Real</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Datos extraídos directamente del Google Sheet del cliente</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{ background: '#CCFBF1', color: '#0F766E', border: '1px solid #99F6E4' }}>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#14B8A6' }} />
                    Datos en tiempo real
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: clientData.metrics.sales.title, value: clientData.metrics.sales.value, color: TEAL, icon: TrendingUp, sub: `${clientData.metrics.sales.change}% vs mes anterior`, bgColor: '#CCFBF1' },
                    { label: 'Clientes Únicos', value: clientData.metrics.newClients.value, color: GREEN, icon: Users, sub: `${clientData.metrics.newClients.change}% vs mes anterior`, bgColor: '#D1FAE5' },
                    { label: 'Facturas Procesadas', value: clientData.metrics.productsSold.value, color: NAVY, icon: FileText, sub: `${clientData.metrics.productsSold.change}% vs mes anterior`, bgColor: '#E0F2FE' },
                ].map((kpi, i) => (
                    <div key={i} style={cardStyle} className="hover:-translate-y-1 transition-transform duration-200">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: kpi.bgColor }}>
                                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                            </div>
                        </div>
                        <p className="font-black text-3xl font-mono" style={{ color: kpi.color }}>{kpi.value}</p>
                        <p className="text-slate-400 text-xs mt-1">{kpi.sub}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Área: Tendencia de ventas */}
                <div style={cardStyle}>
                    <div className="mb-4">
                        <h3 className="font-bold text-slate-800 text-sm">Tendencia de Ventas</h3>
                        <p className="text-slate-400 text-xs mt-0.5">Últimos {salesData.length} registros · COP</p>
                    </div>
                    {salesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gTealAn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={TEAL} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                <XAxis dataKey="day" tick={AXIS_STYLE} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false}
                                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`}
                                    width={48} />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [COP(Number(v)), 'Total']}
                                    labelStyle={{ color: '#1E293B', fontWeight: 'bold' }} />
                                <Area type="monotone" dataKey="value" stroke={TEAL} strokeWidth={2.5}
                                    fill="url(#gTealAn)" dot={false}
                                    activeDot={{ r: 5, fill: TEAL, strokeWidth: 0 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">Sin historial de ventas</div>
                    )}
                </div>

                {/* Barras: Top Clientes */}
                <div style={cardStyle}>
                    <div className="mb-4">
                        <h3 className="font-bold text-slate-800 text-sm">Top Clientes por Facturación</h3>
                        <p className="text-slate-400 text-xs mt-0.5">Ranking por monto total · COP</p>
                    </div>
                    {topClientsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={topClientsData} layout="vertical"
                                margin={{ top: 5, right: 20, left: 0, bottom: 0 }} barSize={10}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                                <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false}
                                    tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`} />
                                <YAxis type="category" dataKey="name" tick={AXIS_STYLE} axisLine={false} tickLine={false} width={100} />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [COP(Number(v)), 'Total']}
                                    labelStyle={{ color: '#1E293B', fontWeight: 'bold' }} />
                                <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                                    {topClientsData.map((_, i) => (
                                        <Cell key={i} fill={ACCENT_COLORS[i % ACCENT_COLORS.length]} fillOpacity={1 - i * 0.08} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">Sin datos de clientes</div>
                    )}
                </div>
            </div>

            {/* Clientes recurrentes + Predicción */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Recurrencia */}
                <div style={cardStyle}>
                    <div className="mb-4">
                        <h3 className="font-bold text-slate-800 text-sm">Clientes Recurrentes</h3>
                        <p className="text-slate-400 text-xs mt-0.5">Número de órdenes por cliente</p>
                    </div>
                    {recurringData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={recurringData} barSize={14} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                <XAxis dataKey="name" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={30} />
                                <Tooltip {...TOOLTIP_STYLE}
                                    formatter={(v: unknown, name: unknown) => [
                                        name === 'compras' ? `${v} órdenes` : COP(Number(v)),
                                        name === 'compras' ? 'Compras' : 'Total'
                                    ]}
                                    labelStyle={{ color: '#1E293B', fontWeight: 'bold' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }}
                                    formatter={(value) => <span style={{ color: '#64748B' }}>{value === 'compras' ? 'Número de Órdenes' : 'Total COP'}</span>} />
                                <Bar dataKey="compras" fill={GREEN} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">Sin datos de recurrencia</div>
                    )}
                </div>

                {/* Predicción IA */}
                <div style={{ ...cardStyle, borderLeft: `4px solid ${TEAL}` }}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 text-sm">Predicción de Ventas (30d)</h3>
                        <span className="px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider"
                            style={{ background: '#CCFBF1', color: '#0F766E', border: `1px solid ${TEAL}30` }}>
                            IA Predictiva
                        </span>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Monto Estimado Próximo Mes</p>
                            <p className="text-3xl font-black text-slate-800 font-mono">
                                COP {Math.round(clientData.prediction.nextMonth).toLocaleString('es-CO')}
                            </p>
                        </div>

                        <div className="p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <p className="text-slate-400 text-[9px] uppercase font-bold mb-1">Fórmula — Regresión Lineal</p>
                            <code className="text-xs font-mono italic" style={{ color: GREEN }}>
                                {clientData.prediction.formula}
                            </code>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className={`px-2 py-1 rounded-lg text-[10px] font-bold`}
                                style={clientData.prediction.growthRate >= 0
                                    ? { background: '#CCFBF1', color: '#0F766E' }
                                    : { background: '#FEE2E2', color: '#DC2626' }}>
                                {clientData.prediction.growthRate >= 0 ? '↑' : '↓'} {Math.abs(clientData.prediction.growthRate).toFixed(1)}% Tendencia
                            </div>
                            <p className="text-slate-400 text-[10px]">
                                Basado en {clientData.salesHistory.length} registros
                            </p>
                        </div>

                        {/* Últimas transacciones */}
                        <div className="space-y-2 pt-2">
                            <p className="text-slate-400 text-[10px] uppercase font-bold">Últimas Transacciones</p>
                            {clientData.recentActivity.slice(0, 3).map((a, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg"
                                    style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                                    <div className="min-w-0">
                                        <p className="text-slate-800 text-xs font-bold truncate">{a.client}</p>
                                        <p className="text-slate-400 text-[9px]">{a.time}</p>
                                    </div>
                                    <span className="text-xs font-black font-mono ml-2 shrink-0" style={{ color: TEAL }}>
                                        {a.amount}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
