'use client'

import { Wallet, TrendingUp, AlertCircle, Clock, CheckCircle } from 'lucide-react'
import { useClient } from '../ClientContext'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

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

const TOOLTIP_STYLE = {
    contentStyle: {
        backgroundColor: '#FFFFFF',
        border: `1px solid ${JA.BORDER}`,
        borderRadius: '2px',
        color: JA.TEXT,
        fontSize: '11px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    },
}

export default function PortfolioPage() {
    const { data: clientData, loading } = useClient()

    if (loading || !clientData) {
        return (
            <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '12px', color: JA.GREY, fontSize: '14px' }}>
                <div style={{ width: '16px', height: '16px', border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Analizando estado de cartera...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    const { portfolio } = clientData
    const healthScore = portfolio.current.percent + portfolio.dueSoon.percent

    const pieData = [
        { name: 'Al Día', value: portfolio.current.percent, color: JA.NAVY },
        { name: 'Por Vencer', value: portfolio.dueSoon.percent, color: JA.GOLD },
        { name: 'Vencida', value: portfolio.overdue.percent, color: JA.RED },
    ].filter(d => d.value > 0)

    const stats = [
        { label: 'Total Cartera', value: portfolio.total, icon: Wallet, color: JA.NAVY },
        { label: 'Al Día', value: portfolio.current.value, icon: CheckCircle, color: JA.GREEN },
        { label: 'Por Vencer (7d)', value: portfolio.dueSoon.value, icon: Clock, color: JA.GOLD },
        { label: 'Cartera Vencida', value: portfolio.overdue.value, icon: AlertCircle, color: JA.RED },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Gestión de Cartera <span style={{ color: JA.GOLD }}>ERP</span></h1>
                    <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Análisis de antigüedad y cobro de facturas acumuladas</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>Score de Salud</p>
                    <p style={{ fontSize: '24px', fontWeight: 700, color: healthScore >= 80 ? JA.GREEN : healthScore >= 60 ? JA.GOLD : JA.RED, margin: 0 }}>
                        {healthScore}%
                    </p>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {stats.map((s, i) => (
                    <div key={i} style={{ ...cardStyle, borderTop: `3px solid ${s.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>{s.label}</p>
                            <s.icon style={{ width: '14px', height: '14px', color: s.color }} />
                        </div>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: JA.TEXT, margin: 0, fontFamily: 'monospace' }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Distribución */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                {/* Donut Analysis */}
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '24px' }}>Composición de Cuentas por Cobrar</h3>
                    <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                        <div style={{ width: '150px', height: '150px', flexShrink: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" strokeWidth={0}>
                                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, '']} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[
                                { label: 'Vigente', val: portfolio.current.value, pct: portfolio.current.percent, color: JA.NAVY },
                                { label: 'En Riesgo', val: portfolio.dueSoon.value, pct: portfolio.dueSoon.percent, color: JA.GOLD },
                                { label: 'Vencida', val: portfolio.overdue.value, pct: portfolio.overdue.percent, color: JA.RED },
                            ].map((item, i) => (
                                <div key={i} style={{ borderBottom: `1px solid ${JA.BG}`, paddingBottom: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '1px', background: item.color }} />
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT }}>{item.label}</span>
                                        </div>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: item.color }}>{item.pct}%</span>
                                    </div>
                                    <p style={{ fontSize: '10px', color: JA.GREY, margin: 0, fontFamily: 'monospace' }}>{item.val}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Progress Tracking */}
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '24px' }}>Seguimiento de Recaudo</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', color: JA.GREY }}>Estado Global de Recaudo</span>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: JA.GREEN }}>{portfolio.current.percent}% al día</span>
                            </div>
                            <div style={{ height: '12px', background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '1px', overflow: 'hidden', display: 'flex' }}>
                                <div style={{ width: `${portfolio.current.percent}%`, background: JA.NAVY }} />
                                <div style={{ width: `${portfolio.dueSoon.percent}%`, background: JA.GOLD }} />
                                <div style={{ width: `${portfolio.overdue.percent}%`, background: JA.RED }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[
                                { label: 'Recuperación al Día', pct: portfolio.current.percent, color: JA.NAVY },
                                { label: 'Vencimientos Próximos', pct: portfolio.dueSoon.percent, color: JA.GOLD },
                                { label: 'Morosidad Crítica', pct: portfolio.overdue.percent, color: JA.RED },
                            ].map((item, i) => (
                                <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '10px', color: JA.GREY }}>{item.label}</span>
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: item.color }}>{item.pct}%</span>
                                    </div>
                                    <div style={{ height: '4px', background: JA.BG, borderRadius: '1px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${item.pct}%`, background: item.color }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: '24px', padding: '12px', background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px' }}>
                        <p style={{ fontSize: '10px', color: JA.GREY, fontStyle: 'italic', margin: 0 }}>
                            Nota: Las proyecciones de vencimiento se calculan desde la fecha de recepción de factura registrada en los sistemas corporativos del cliente.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

