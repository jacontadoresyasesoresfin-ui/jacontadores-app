'use client'

import React from 'react'
import { useClient, Profile } from './ClientContext'
import {
    ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell
} from 'recharts'
import Link from 'next/link'
import {
    DollarSign, Users, FileText, AlertTriangle, TrendingUp, TrendingDown,
    CheckCircle2, Calendar, ArrowUpRight, ArrowDownRight, Clock,
    ShoppingCart, Store, Wallet, Package, FileSpreadsheet, FileCheck, Receipt, Calculator, Search,
    ChevronRight
} from 'lucide-react'

/* ── Paleta corporativa ────────────────────────────────── */
const JA = {
    NAVY:     '#13213C',
    GOLD:     '#B8960C',
    GOLD_PALE:'#F5E9C0',
    TEXT:     '#1C2B45',
    GREY:     '#4B5563',
    GREY_LT:  '#9CA3AF',
    BORDER:   '#E5E7EB',
    BG:       '#F8FAFC',
    GREEN:    '#10B981',
    RED:      '#EF4444',
    ORANGE:   '#F59E0B',
    TEAL:     '#0D9488',
} as const

const CARD: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '2px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

const COP = (n: number): string => {
    const abs = Math.abs(n); const s = n < 0 ? '-' : ''
    if (abs >= 1_000_000_000) return `${s}$${(abs / 1_000_000_000).toFixed(1)}B`
    if (abs >= 1_000_000)     return `${s}$${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000)         return `${s}$${(abs / 1_000).toFixed(0)}K`
    return `${s}$${Math.round(abs).toLocaleString('es-CO')}`
}

/* ── Calendario DIAN 2026 ──────────────────────────────── */
const TODAY = new Date()
const DIAN_DEADLINES = [
    { label: 'ReteFuente Abril',             fecha: '2026-05-13', tipo: 'retefuente', desc: 'Retención en la fuente — declaración mensual Abril 2026' },
    { label: 'IVA Bimestre Mar–Abr',         fecha: '2026-05-19', tipo: 'iva',        desc: 'Declaración IVA bimestral — bimestre 2 de 2026' },
    { label: 'ReteFuente Mayo',              fecha: '2026-06-11', tipo: 'retefuente', desc: 'Retención en la fuente — declaración mensual Mayo 2026' },
    { label: 'IVA Bimestre May–Jun',         fecha: '2026-07-16', tipo: 'iva',        desc: 'Declaración IVA bimestral — bimestre 3 de 2026' },
    { label: 'Renta Personas Jurídicas 2025',fecha: '2026-08-10', tipo: 'renta',      desc: 'Declaración de Renta año gravable 2025 — personas jurídicas' },
    { label: 'IVA Bimestre Jul–Ago',         fecha: '2026-09-17', tipo: 'iva',        desc: 'Declaración IVA bimestral — bimestre 4 de 2026' },
].map(d => ({
    ...d,
    diasRestantes: Math.ceil((new Date(d.fecha + 'T00:00:00').getTime() - TODAY.getTime()) / 86_400_000)
})).filter(d => d.diasRestantes > -3).sort((a, b) => a.diasRestantes - b.diasRestantes).slice(0, 4)

const TIPO_COLOR: Record<string, string> = { iva: JA.GOLD, retefuente: JA.NAVY, renta: JA.TEAL }
const AXIS_TICK = { fill: JA.GREY_LT, fontSize: 9, fontFamily: 'Inter,sans-serif' }
const TT_STYLE  = {
    contentStyle: { background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '2px', fontSize: '11px', fontFamily: 'Inter,sans-serif', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
    cursor: { fill: 'rgba(19,33,60,0.03)' }
}

export default function DashboardPage() {
    const { data: clientData, loading, activeProfile, modules } = useClient()

    if (loading || !clientData) {
        return (
            <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: JA.GREY, fontFamily: 'Inter, sans-serif' }}>
                <div style={{ width: '32px', height: '32px', border: `3px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ fontSize: '13px', margin: 0 }}>Sincronizando datos corporativos...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    const { metrics, salesHistory, topClients, portfolio, recentActivity, taxData, prediction } = clientData

    /* ── Financial Health Score ────────────────────────── */
    const healthScore = Math.min(100, Math.max(0, (() => {
        let s = Math.round(portfolio.current.percent * 0.35)
        const ivaPct = taxData.totalIVACobrado / (metrics.sales.rawValue || 1)
        s += ivaPct < 0.20 ? 25 : ivaPct < 0.25 ? 15 : 5
        s += metrics.sales.change > 5 ? 25 : metrics.sales.change > 0 ? 18 : metrics.sales.change > -5 ? 10 : 0
        s += (taxData.facturasPendientes / (taxData.totalFacturas || 1)) < 0.08 ? 15 : 8
        return s
    })()))
    const healthColor = healthScore >= 75 ? JA.GREEN : healthScore >= 50 ? JA.ORANGE : JA.RED
    const healthLabel = healthScore >= 75 ? 'Excelente' : healthScore >= 50 ? 'Regular' : 'Atención'

    /* ── Cash Flow mensual ─────────────────────────────── */
    const monthMap: Record<string, number> = {}
    salesHistory.forEach(item => {
        const p = item.date.split('-')
        const key = p.length >= 2
            ? (p[0].length <= 2 ? `${p[1]}/${(p[2] || '').slice(-2)}` : `${p[1]}/${p[0].slice(-2)}`)
            : 'N/A'
        monthMap[key] = (monthMap[key] || 0) + item.amount
    })
    const cashFlow = Object.entries(monthMap).slice(-8).map(([mes, ingresos]) => ({
        mes, ingresos, egresos: Math.round(ingresos * 0.62), neto: Math.round(ingresos * 0.38)
    }))

    /* ── Tax Exposure pie ──────────────────────────────── */
    const taxPie = [
        { name: 'IVA a Pagar',    value: taxData.totalIVAPorPagar,   color: JA.GOLD  },
        { name: 'ReteFuente',     value: taxData.totalReteFuente,    color: JA.NAVY  },
        { name: 'ReteICA',        value: taxData.totalReteICA,       color: JA.TEAL  },
        { name: 'Neto Operativo', value: Math.max(0, metrics.sales.rawValue - taxData.totalImpuestosCargo), color: JA.GREEN },
    ].filter(d => d.value > 0)

    const COLS = [JA.NAVY, JA.GOLD, JA.TEAL, JA.GREEN, JA.ORANGE, JA.RED]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '40px', fontFamily: 'Inter, sans-serif' }}>

            {/* ── Header ─────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '18px', borderBottom: `1px solid ${JA.BORDER}` }}>
                <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GOLD, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Panel de Control Financiero</p>
                    <h1 style={{ fontSize: '22px', fontWeight: 900, color: JA.NAVY, margin: 0, letterSpacing: '-0.02em' }}>
                        {activeProfile?.company_name || 'Mi Empresa'}
                    </h1>
                    <p style={{ fontSize: '11px', color: JA.GREY, margin: '4px 0 0' }}>
                        {TODAY.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, color: JA.GREEN, background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '6px 12px', borderRadius: '2px' }}>
                        <CheckCircle2 style={{ width: 11, height: 11 }} /> Datos sincronizados
                    </div>
                    <div style={{ fontSize: '10px', color: JA.GREY, background: JA.BG, border: `1px solid ${JA.BORDER}`, padding: '6px 10px', borderRadius: '2px', fontWeight: 600 }}>
                        {taxData.regimenSugerido}
                    </div>
                </div>
            </div>



            {/* ── Accesos Rápidos a Módulos ──────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Módulos Disponibles
                    </h3>
                    {/* Enlace Panel Firma sólo para firma_admin y superadmin */}
                    {(activeProfile as Profile & { role: string })?.role === 'firma_admin' && (
                        <Link href="/firma-admin" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: JA.GOLD, textDecoration: 'none', padding: '4px 10px', border: `1px solid ${JA.GOLD}40`, borderRadius: '2px', background: '#FFFBEB' }}>
                            <Users style={{ width: 12, height: 12 }} /> Gestionar Empresas
                        </Link>
                    )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                    {([
                        { key: 'analytics',      name: 'Analytics',         href: '/dashboard/analytics',      icon: TrendingUp },
                        { key: 'reports',        name: 'Reportes',          href: '/dashboard/reports',        icon: FileText },
                        { key: 'sales',          name: 'Ventas',            href: '/dashboard/sales',          icon: ShoppingCart },
                        { key: 'ecommerce',      name: 'Ecommerce',         href: '/dashboard/ecommerce',      icon: Store },
                        { key: 'portfolio',      name: 'Cartera',           href: '/dashboard/portfolio',      icon: Wallet },
                        { key: 'inventory',      name: 'Inventario',        href: '/dashboard/inventory',      icon: Package },
                        { key: 'siigo_bi',       name: 'Siigo BI',          href: '/dashboard/siigo',          icon: FileSpreadsheet },
                        { key: 'reconciliation', name: 'Conciliación',      href: '/dashboard/reconciliation', icon: FileCheck },
                        { key: 'taxes',          name: 'Impuestos',         href: '/dashboard/taxes',          icon: Receipt },
                        { key: 'nomina',         name: 'Nómina PILA',       href: '/dashboard/nomina',         icon: Calculator },
                        { key: 'nit',            name: 'Verificar NIT',     href: '/dashboard/nit',            icon: Search },
                    ] as { key: string; name: string; href: string; icon: React.ElementType }[])
                        .filter(m => modules?.[m.key])
                        .map(mod => {
                            const Icon = mod.icon
                            return (
                                <Link key={mod.key} href={mod.href} className="module-card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div className="module-card-icon">
                                            <Icon style={{ width: 15, height: 15, color: JA.GOLD }} />
                                        </div>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: JA.NAVY, fontFamily: 'Inter, sans-serif' }}>
                                            {mod.name}
                                        </span>
                                    </div>
                                    <ChevronRight style={{ width: 13, height: 13, color: '#9CA3AF' }} />
                                </Link>
                            )
                        })
                    }
                </div>
            </div>


            {/* ── KPIs Fila 1 — Financieros ──────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                    { label: 'Ventas Totales (Periodo)',  value: metrics.sales.value,         sub: `${metrics.sales.change >= 0 ? '+' : ''}${metrics.sales.change.toFixed(1)}% vs mes anterior`,    trend: metrics.sales.change,      Icon: DollarSign,     accent: JA.NAVY,   bg: '#EEF2F8' },
                    { label: 'Clientes Únicos Activos',   value: metrics.newClients.value,    sub: `${metrics.newClients.change >= 0 ? '+' : ''}${metrics.newClients.change.toFixed(1)}% vs mes ant.`, trend: metrics.newClients.change, Icon: Users,          accent: JA.TEAL,   bg: '#F0FDFA' },
                    { label: 'IVA Estimado (Generado)',   value: COP(taxData.totalIVACobrado),sub: `ReteFuente acumulada: ${COP(taxData.totalReteFuente)}`,                                          trend: 0,                         Icon: FileText,       accent: JA.GOLD,   bg: JA.GOLD_PALE },
                ].map(({ label, value, sub, trend, Icon, accent, bg }, i) => (
                    <div key={i} style={{ ...CARD, padding: '18px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{label}</p>
                            <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon style={{ width: 14, height: 14, color: accent }} />
                            </div>
                        </div>
                        <p style={{ fontSize: '20px', fontWeight: 800, color: accent, margin: '0 0 5px', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {trend > 0 && <ArrowUpRight style={{ width: 11, height: 11, color: JA.GREEN }} />}
                            {trend < 0 && <ArrowDownRight style={{ width: 11, height: 11, color: JA.RED }} />}
                            <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>{sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── KPIs Fila 2 — Operativos ───────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                    { label: 'Cartera Vencida (Est.)', value: metrics.overdue.value,  sub: `${portfolio.overdue.percent}% del total de cartera`,   Icon: AlertTriangle, accent: JA.RED,   bdr: JA.RED   },
                    { label: 'Facturas Emitidas',      value: metrics.productsSold.value, sub: `${taxData.facturasPendientes} pendientes de pago`, Icon: FileText,      accent: JA.NAVY,  bdr: JA.NAVY  },
                    { label: 'Ticket Promedio',        value: COP(metrics.sales.rawValue / (taxData.totalFacturas || 1)), sub: 'Valor promedio por transacción', Icon: TrendingUp, accent: JA.GREEN, bdr: JA.GREEN },
                ].map(({ label, value, sub, Icon, accent, bdr }, i) => (
                    <div key={i} style={{ ...CARD, padding: '18px 20px', borderLeft: `3px solid ${bdr}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{label}</p>
                            <Icon style={{ width: 13, height: 13, color: accent }} />
                        </div>
                        <p style={{ fontSize: '18px', fontWeight: 800, color: JA.TEXT, margin: '0 0 4px', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                        <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>{sub}</p>
                    </div>
                ))}
            </div>

            {/* ── DIAN Calendar + Health Score ───────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '12px' }}>

                {/* DIAN Fiscal Calendar */}
                <div style={{ ...CARD, padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ width: '30px', height: '30px', background: JA.NAVY, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Calendar style={{ width: 14, height: 14, color: JA.GOLD }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Calendario Tributario DIAN 2026</h3>
                            <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>Próximas obligaciones fiscales — contabilizado automáticamente</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {DIAN_DEADLINES.map((d, i) => {
                            const urg    = d.diasRestantes <= 5 ? JA.RED : d.diasRestantes <= 20 ? JA.ORANGE : JA.GREY_LT
                            const bgCard = d.diasRestantes <= 5 ? '#FEF2F2' : d.diasRestantes <= 20 ? '#FFFBEB' : JA.BG
                            const bdCard = d.diasRestantes <= 5 ? '#FECACA' : d.diasRestantes <= 20 ? '#FDE68A' : JA.BORDER
                            const tc     = TIPO_COLOR[d.tipo] || JA.GREY
                            const labelD = d.diasRestantes <= 0 ? 'VENCIDO' : d.diasRestantes === 1 ? 'MAÑANA' : `${d.diasRestantes}d`
                            return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: bgCard, borderRadius: '2px', border: `1px solid ${bdCard}` }}>
                                    <div style={{ width: '46px', height: '40px', background: tc, borderRadius: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: '14px', fontWeight: 900, color: '#FFF', lineHeight: 1 }}>{d.diasRestantes <= 0 ? '!' : d.diasRestantes}</span>
                                        <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.75)' }}>días</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                            <p style={{ fontSize: '11px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>{d.label}</p>
                                            <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '1px', background: tc, color: '#FFF', textTransform: 'uppercase', flexShrink: 0 }}>{d.tipo}</span>
                                        </div>
                                        <p style={{ fontSize: '9px', color: JA.GREY_LT, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.desc}</p>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ fontSize: '9px', fontWeight: 800, color: urg, margin: 0, textTransform: 'uppercase' }}>{labelD}</p>
                                        <p style={{ fontSize: '9px', color: JA.GREY_LT, margin: 0 }}>
                                            {new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Financial Health Score */}
                <div style={{ ...CARD, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: '0 0 4px' }}>Salud Financiera</h3>
                    <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: '0 0 16px' }}>Score consolidado del periodo actual</p>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'center' }}>
                        <div style={{ width: '110px', height: '110px', borderRadius: '50%', border: `9px solid ${healthColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFF', boxShadow: `0 0 0 3px ${healthColor}22, 0 4px 20px rgba(0,0,0,0.08)` }}>
                            <span style={{ fontSize: '28px', fontWeight: 900, color: healthColor, lineHeight: 1 }}>{healthScore}</span>
                            <span style={{ fontSize: '9px', color: JA.GREY_LT }}>/&nbsp;100</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: healthColor }}>{healthLabel}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                        {[
                            { label: 'Cartera corriente',     val: portfolio.current.percent },
                            { label: 'Exposición tributaria', val: Math.max(0, 100 - (taxData.totalIVACobrado / (metrics.sales.rawValue || 1)) * 150) },
                            { label: 'Tendencia ingresos',    val: Math.max(0, Math.min(100, 50 + metrics.sales.change * 2)) },
                        ].map((item, i) => (
                            <div key={i}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                    <span style={{ fontSize: '9px', color: JA.GREY }}>{item.label}</span>
                                    <span style={{ fontSize: '9px', fontWeight: 700, color: JA.TEXT }}>{Math.round(item.val)}%</span>
                                </div>
                                <div style={{ height: '4px', background: JA.BG, borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.min(100, item.val)}%`, background: item.val >= 70 ? JA.GREEN : item.val >= 40 ? JA.ORANGE : JA.RED, borderRadius: '2px' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Cash Flow Chart ─────────────────────────── */}
            <div style={{ ...CARD, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: '0 0 3px' }}>Flujo de Caja — Ingresos vs Egresos Estimados</h3>
                        <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>Evolución mensual · egresos estimados al 62% · COP</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {[{ c: JA.NAVY, l: 'Ingresos' }, { c: JA.GREY_LT, l: 'Egresos' }, { c: JA.GOLD, l: 'Neto' }].map((x, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: JA.GREY }}>
                                <div style={{ width: 10, height: 3, background: x.c, borderRadius: 2 }} />{x.l}
                            </div>
                        ))}
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={230}>
                    <ComposedChart data={cashFlow} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 3" stroke="#F0F0F0" vertical={false} />
                        <XAxis dataKey="mes"  tick={AXIS_TICK} axisLine={false} tickLine={false} />
                        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={52}
                            tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}M` : `${(v/1000).toFixed(0)}K`} />
                        <Tooltip {...TT_STYLE} formatter={(v: any, n: any) => [COP(Number(v)), n]} labelStyle={{ color: JA.TEXT, fontWeight: 700 }} />
                        <Bar dataKey="ingresos" name="Ingresos"     fill={JA.NAVY}    opacity={0.82} radius={[2,2,0,0]} maxBarSize={26} />
                        <Bar dataKey="egresos"  name="Egresos Est." fill={JA.GREY_LT} opacity={0.5}  radius={[2,2,0,0]} maxBarSize={26} />
                        <Line type="monotone" dataKey="neto" name="Neto" stroke={JA.GOLD} strokeWidth={2.5}
                            dot={{ r: 3, fill: JA.GOLD, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* ── Top Clientes + Tax Exposure ─────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '12px' }}>

                {/* Top Clientes */}
                <div style={{ ...CARD, padding: '20px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: '0 0 16px' }}>Top Clientes por Facturación</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {topClients.slice(0, 6).map((c, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: COLS[i], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#FFF' }}>{i + 1}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '58%' }}>{c.name}</span>
                                        <span style={{ fontSize: '11px', fontWeight: 800, color: JA.NAVY, fontFamily: 'monospace', flexShrink: 0 }}>{COP(c.amount)}</span>
                                    </div>
                                    <div style={{ height: '5px', background: JA.BG, borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${c.percent}%`, background: COLS[i], borderRadius: '2px' }} />
                                    </div>
                                </div>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY_LT, width: '32px', textAlign: 'right', flexShrink: 0 }}>{c.percent}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tax Exposure Pie */}
                <div style={{ ...CARD, padding: '20px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: '0 0 4px' }}>Exposición Tributaria</h3>
                    <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: '0 0 6px' }}>Distribución del flujo fiscal · COP</p>
                    <ResponsiveContainer width="100%" height={145}>
                        <PieChart>
                            <Pie data={taxPie} cx="50%" cy="46%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value" strokeWidth={0}>
                                {taxPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <Tooltip contentStyle={TT_STYLE.contentStyle} formatter={(v: any, n: any) => [COP(Number(v)), n]} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {taxPie.map((d, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '2px', background: d.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: '9px', color: JA.GREY }}>{d.name}</span>
                                </div>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: JA.TEXT, fontFamily: 'monospace' }}>{COP(d.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Predicción + Actividad Reciente ─────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>

                {/* Predicción */}
                <div style={{ ...CARD, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <TrendingUp style={{ width: 14, height: 14, color: JA.GOLD }} />
                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Proyección Próximo Mes</h3>
                    </div>
                    <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: '0 0 16px' }}>Regresión lineal sobre histórico de ventas</p>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center', padding: '12px 0' }}>
                        <div style={{ fontSize: '30px', fontWeight: 900, color: prediction.growthRate >= 0 ? JA.GREEN : JA.RED, fontVariantNumeric: 'tabular-nums' }}>
                            {COP(prediction.nextMonth)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {prediction.growthRate >= 0
                                ? <TrendingUp style={{ width: 13, height: 13, color: JA.GREEN }} />
                                : <TrendingDown style={{ width: 13, height: 13, color: JA.RED }} />}
                            <span style={{ fontSize: '12px', fontWeight: 700, color: prediction.growthRate >= 0 ? JA.GREEN : JA.RED }}>
                                {prediction.growthRate >= 0 ? '+' : ''}{prediction.growthRate.toFixed(1)}%
                            </span>
                            <span style={{ fontSize: '11px', color: JA.GREY_LT }}>tendencia</span>
                        </div>
                    </div>
                    <div style={{ padding: '8px 10px', background: JA.BG, borderRadius: '2px' }}>
                        <p style={{ fontSize: '9px', color: JA.GREY_LT, margin: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>{prediction.formula}</p>
                    </div>
                </div>

                {/* Actividad Reciente */}
                <div style={{ ...CARD, padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Actividad Reciente</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: JA.GREY_LT }}>
                            <Clock style={{ width: 10, height: 10 }} /> Últimas transacciones
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {recentActivity.slice(0, 6).map((act, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: i < 5 ? `1px solid ${JA.BG}` : 'none' }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: act.color, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT, margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.client}</p>
                                    <p style={{ fontSize: '9px', color: JA.GREY_LT, margin: 0 }}>{act.text} · {act.time}</p>
                                </div>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: JA.TEXT, fontFamily: 'monospace', flexShrink: 0 }}>{act.amount}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Alertas del sistema ─────────────────────── */}
            {taxData.alertas.length > 0 && (
                <div style={{ ...CARD, padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <AlertTriangle style={{ width: 12, height: 12, color: JA.GOLD }} />
                        <h3 style={{ fontSize: '11px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Alertas Tributarias del Sistema</h3>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {taxData.alertas.slice(0, 4).map((alerta, i) => (
                            <div key={i} style={{ fontSize: '10px', color: JA.GREY, background: JA.BG, border: `1px solid ${JA.BORDER}`, padding: '4px 10px', borderRadius: '2px' }}>
                                {alerta}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
