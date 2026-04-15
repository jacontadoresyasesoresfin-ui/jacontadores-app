'use client'

import { Wallet, TrendingUp, AlertCircle, Clock, CheckCircle } from 'lucide-react'
import { useClient } from '../ClientContext'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const TEAL = '#14B8A6'
const GOLD = '#D4A843'
const RED = '#EF4444'

const card = {
    background: '#FFFFFF',
    border: '1.5px solid #E2E8F0',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
    padding: '20px',
}

export default function PortfolioPage() {
    const { data: clientData, loading } = useClient()

    if (loading || !clientData) {
        return (
            <div className="p-8 flex items-center gap-3 text-slate-600">
                <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: `${TEAL}40`, borderTopColor: TEAL }} />
                Cargando Cartera...
            </div>
        )
    }

    const { portfolio } = clientData

    const pieData = [
        { name: 'Al Día', value: portfolio.current.percent, color: TEAL },
        { name: 'Por Vencer', value: portfolio.dueSoon.percent, color: GOLD },
        { name: 'Vencida', value: portfolio.overdue.percent, color: RED },
    ].filter(d => d.value > 0)

    const stats = [
        { label: 'Total Cartera', value: portfolio.total, icon: Wallet, color: '#0B2447', bg: '#E0F2FE', sub: 'Saldo total pendiente' },
        { label: 'Al Día', value: portfolio.current.value, icon: CheckCircle, color: TEAL, bg: '#CCFBF1', sub: `${portfolio.current.percent}% del total` },
        { label: 'Por Vencer (7d)', value: portfolio.dueSoon.value, icon: Clock, color: GOLD, bg: '#FEF3C7', sub: `${portfolio.dueSoon.percent}% del total` },
        { label: 'Cartera Vencida', value: portfolio.overdue.value, icon: AlertCircle, color: RED, bg: '#FEE2E2', sub: `${portfolio.overdue.percent}% del total` },
    ]

    const healthScore = portfolio.current.percent + portfolio.dueSoon.percent

    return (
        <div className="space-y-6 pb-10" style={{ fontFamily: 'var(--font-inter)' }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-800" style={{ fontFamily: 'var(--font-outfit)' }}>
                        Cartera <span style={{ color: TEAL }}>— Cuentas por Cobrar</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Gestión de cuentas por cobrar basada en facturación acumulada
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Salud de Cartera</p>
                    <p className="text-2xl font-black" style={{ color: healthScore >= 80 ? TEAL : healthScore >= 60 ? GOLD : RED }}>
                        {healthScore}%
                    </p>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s, i) => (
                    <div key={i} style={card} className="hover:-translate-y-1 transition-transform duration-200">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{s.label}</p>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                                <s.icon className="w-4 h-4" style={{ color: s.color }} />
                            </div>
                        </div>
                        <p className="font-black text-xl font-mono" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-slate-400 text-xs mt-1">{s.sub}</p>
                    </div>
                ))}
            </div>

            {/* Distribución + Barras */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Donut */}
                <div style={card}>
                    <h3 className="font-bold text-slate-800 text-sm mb-4">Distribución de Cartera</h3>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="relative w-40 h-40 flex-shrink-0">
                            <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                                <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="12" />
                                <circle cx="50" cy="50" r="40" fill="none" stroke={TEAL} strokeWidth="13"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(portfolio.current.percent * 251.3) / 100} 251.3`} />
                                <circle cx="50" cy="50" r="40" fill="none" stroke={GOLD} strokeWidth="13"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(portfolio.dueSoon.percent * 251.3) / 100} 251.3`}
                                    strokeDashoffset={`-${(portfolio.current.percent * 251.3) / 100}`} />
                                <circle cx="50" cy="50" r="40" fill="none" stroke={RED} strokeWidth="13"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(portfolio.overdue.percent * 251.3) / 100} 251.3`}
                                    strokeDashoffset={`-${((portfolio.current.percent + portfolio.dueSoon.percent) * 251.3) / 100}`} />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-2xl font-black text-slate-800">{healthScore}%</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: TEAL }}>Saludable</span>
                            </div>
                        </div>
                        <div className="flex-1 space-y-3 w-full">
                            <div className="p-3 rounded-xl mb-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Cartera Total</p>
                                <p className="text-xl font-black text-slate-800">{portfolio.total}</p>
                            </div>
                            {[
                                { label: 'Al Día', val: portfolio.current.value, pct: portfolio.current.percent, color: TEAL },
                                { label: 'Por Vencer (7d)', val: portfolio.dueSoon.value, pct: portfolio.dueSoon.percent, color: GOLD },
                                { label: 'Vencida', val: portfolio.overdue.value, pct: portfolio.overdue.percent, color: RED },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">{item.label}</p>
                                            <p className="text-[10px] text-slate-400">{item.val}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black" style={{ color: item.color }}>{item.pct}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Barra compuesta */}
                <div style={card}>
                    <h3 className="font-bold text-slate-800 text-sm mb-4">Barra de Progreso de Recaudo</h3>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-xs mb-1.5">
                                <span className="text-slate-500">Estado global</span>
                                <span className="font-bold text-slate-700">{portfolio.current.percent}% al día</span>
                            </div>
                            <div className="w-full h-4 rounded-full overflow-hidden flex" style={{ background: '#F1F5F9' }}>
                                <div className="h-full transition-all duration-1000 ease-out"
                                    style={{ width: `${portfolio.current.percent}%`, background: TEAL }} />
                                <div className="h-full transition-all duration-1000 ease-out"
                                    style={{ width: `${portfolio.dueSoon.percent}%`, background: GOLD }} />
                                <div className="h-full transition-all duration-1000 ease-out"
                                    style={{ width: `${portfolio.overdue.percent}%`, background: RED }} />
                            </div>
                            <div className="flex gap-4 mt-2 justify-center flex-wrap">
                                {[{ c: TEAL, l: 'Al Día' }, { c: GOLD, l: 'Por Vencer' }, { c: RED, l: 'Vencida' }].map(x => (
                                    <div key={x.l} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ background: x.c }} />
                                        <span className="text-[10px] text-slate-500">{x.l}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Detalle individual */}
                        {[
                            { label: 'Cartera al Día', pct: portfolio.current.percent, color: TEAL },
                            { label: 'Por Vencer', pct: portfolio.dueSoon.percent, color: GOLD },
                            { label: 'Cartera Vencida', pct: portfolio.overdue.percent, color: RED },
                        ].map((item, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-slate-500 font-medium">{item.label}</span>
                                    <span className="font-bold" style={{ color: item.color }}>{item.pct}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                                    <div className="h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${item.pct}%`, background: item.color }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 p-3 rounded-lg text-[10px] text-slate-500" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <p className="italic">Los datos de vencimiento son proyecciones basadas en la fecha de recepción de la factura en el Google Sheet del cliente.</p>
                    </div>
                </div>
            </div>

            {/* Gráfico de pastel recharts */}
            <div style={card}>
                <h3 className="font-bold text-slate-800 text-sm mb-4">Distribución Porcentual de Cartera</h3>
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
                            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip
                            contentStyle={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '12px' }}
                            formatter={(v: any) => [`${Number(v).toFixed(1)}%`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }}
                            formatter={(v) => <span style={{ color: '#64748B' }}>{v}</span>} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
