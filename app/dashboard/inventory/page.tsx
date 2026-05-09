'use client'

import { useState } from 'react'
import { Package, TrendingDown, AlertTriangle, TrendingUp, Search, BarChart3, Archive } from 'lucide-react'
import { useClient } from '../ClientContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

const JA = {
    NAVY:    '#13213C', GOLD: '#B8960C', GOLD_PALE: '#F5E9C0',
    TEXT:    '#1C2B45', GREY: '#4B5563', GREY_LT: '#9CA3AF',
    BORDER:  '#E5E7EB', BG: '#F8FAFC',
    GREEN:   '#10B981', RED: '#EF4444', ORANGE: '#F59E0B', TEAL: '#0D9488',
} as const

const CARD: React.CSSProperties = {
    background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '2px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

const COP = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
    return `$${Math.round(n).toLocaleString('es-CO')}`
}

const CHART_COLORS = [JA.NAVY, JA.GOLD, JA.TEAL, JA.GREEN, JA.ORANGE, JA.RED, JA.GREY_LT, JA.NAVY]
const AXIS_TICK    = { fill: JA.GREY_LT, fontSize: 9, fontFamily: 'Inter,sans-serif' }
const TT_STYLE     = {
    contentStyle: { background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '2px', fontSize: '11px', fontFamily: 'Inter,sans-serif' },
    cursor: { fill: 'rgba(19,33,60,0.03)' }
}

export default function InventoryPage() {
    const { data: clientData, loading } = useClient()
    const [search, setSearch]   = useState('')
    const [sortBy, setSortBy]   = useState<'total' | 'count' | 'precio'>('total')

    if (loading || !clientData) {
        return (
            <div style={{ padding: '40px', display: 'flex', alignItems: 'center', gap: '12px', color: JA.GREY, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ width: '16px', height: '16px', border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Cargando catálogo de inventario...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    /* ── Derivar métricas de inventario desde facturación ── */
    const productos = (clientData.topProducts || []).map(p => {
        const precioPromedio = p.count > 0 ? p.total / p.count : 0
        const velocidadSemanal = p.count / 4
        const stockEstimado   = Math.round(velocidadSemanal * 3)
        const diasStock       = velocidadSemanal > 0 ? Math.round((stockEstimado / velocidadSemanal) * 7) : 999
        const estado: 'OK' | 'BAJO' | 'AGOTADO' = diasStock <= 7 ? 'AGOTADO' : diasStock <= 21 ? 'BAJO' : 'OK'
        return { ...p, precioPromedio, stockEstimado, diasStock, estado, valorInventario: stockEstimado * precioPromedio }
    })

    const filtered = productos
        .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) =>
            sortBy === 'total'  ? b.total - a.total :
            sortBy === 'count'  ? b.count - a.count :
            b.precioPromedio - a.precioPromedio
        )

    const agotados  = productos.filter(p => p.estado === 'AGOTADO').length
    const bajos     = productos.filter(p => p.estado === 'BAJO').length
    const valorTotal = productos.reduce((s, p) => s + p.valorInventario, 0)
    const rotProm   = productos.length > 0 ? productos.reduce((s, p) => s + p.count, 0) / productos.length : 0

    const chartData = filtered.slice(0, 8).map(p => ({
        name:  p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name,
        total: p.total, count: p.count
    }))

    const ESTADO_STYLE = {
        OK:      { bg: '#F0FDF4', color: JA.GREEN,  bd: '#BBF7D0' },
        BAJO:    { bg: '#FFFBEB', color: JA.ORANGE, bd: '#FDE68A' },
        AGOTADO: { bg: '#FEF2F2', color: JA.RED,    bd: '#FECACA' },
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '32px', fontFamily: 'Inter, sans-serif' }}>

            {/* ── Header ─────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '18px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 900, color: JA.NAVY, margin: 0, letterSpacing: '-0.02em' }}>
                        Inventario <span style={{ color: JA.GOLD }}>&amp; Catálogo</span>
                    </h1>
                    <p style={{ fontSize: '11px', color: JA.GREY, marginTop: '4px', margin: '4px 0 0' }}>
                        {productos.length} SKUs detectados en facturación · Stock estimado por velocidad de venta
                    </p>
                </div>
                <div style={{ fontSize: '10px', color: JA.GREY_LT, textAlign: 'right', lineHeight: 1.6 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: JA.GREY }}>Fuente: Google Sheets</p>
                    <p style={{ margin: 0 }}>Derivado de registros de facturación</p>
                </div>
            </div>

            {/* ── KPIs ───────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                {[
                    { label: 'SKUs Activos',           value: productos.length.toString(), Icon: Package,   color: JA.NAVY,   bg: '#EEF2F8' },
                    { label: 'Valor Inventario Est.',  value: COP(valorTotal),             Icon: BarChart3, color: JA.GREEN,  bg: '#F0FDF4' },
                    { label: 'Rotación Prom. (mes)',   value: rotProm.toFixed(1) + ' u',   Icon: TrendingUp,color: JA.GOLD,   bg: JA.GOLD_PALE },
                    { label: 'Stock Bajo Alerta',      value: bajos.toString(),            Icon: TrendingDown, color: JA.ORANGE, bg: '#FFFBEB' },
                    { label: 'Riesgo Agotamiento',     value: agotados.toString(),         Icon: AlertTriangle, color: JA.RED, bg: '#FEF2F2' },
                ].map(({ label, value, Icon, color, bg }, i) => (
                    <div key={i} style={{ ...CARD, padding: '16px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{label}</p>
                            <div style={{ width: 28, height: 28, borderRadius: '6px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon style={{ width: 13, height: 13, color }} />
                            </div>
                        </div>
                        <p style={{ fontSize: '18px', fontWeight: 800, color, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Bar Chart ──────────────────────────────── */}
            {chartData.length > 0 ? (
                <div style={{ ...CARD, padding: '20px' }}>
                    <div style={{ marginBottom: '14px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: '0 0 2px' }}>Top Productos por Facturación</h3>
                        <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>Volumen de ventas acumulado · COP</p>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }} barSize={10}>
                            <CartesianGrid strokeDasharray="4 3" stroke="#F0F0F0" horizontal={false} />
                            <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false}
                                tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}M` : `${(v/1_000).toFixed(0)}K`} />
                            <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={140} />
                            <Tooltip {...TT_STYLE} formatter={(v: any) => [COP(Number(v)), 'Facturado']} />
                            <Bar dataKey="total" radius={[0, 3, 3, 0]}>
                                {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div style={{ ...CARD, padding: '48px', textAlign: 'center' }}>
                    <Archive style={{ width: 32, height: 32, color: JA.BORDER, margin: '0 auto 12px' }} />
                    <p style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT, margin: '0 0 6px' }}>Sin productos detectados</p>
                    <p style={{ fontSize: '11px', color: JA.GREY_LT, margin: 0 }}>Configura tu Google Sheet con una columna "Descripción" para generar el catálogo.</p>
                </div>
            )}

            {/* ── Tabla de Productos ─────────────────────── */}
            <div style={CARD}>
                {/* Search + Sort bar */}
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${JA.BG}`, display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '160px' }}>
                        <Search style={{ width: 13, height: 13, color: JA.GREY_LT, flexShrink: 0 }} />
                        <input
                            type="text"
                            placeholder="Buscar producto o servicio..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ border: 'none', outline: 'none', fontSize: '12px', color: JA.TEXT, background: 'none', flex: 1, fontFamily: 'Inter, sans-serif' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {(['total', 'count', 'precio'] as const).map(k => (
                            <button key={k} onClick={() => setSortBy(k)}
                                style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 600, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', cursor: 'pointer', background: sortBy === k ? JA.NAVY : '#FFF', color: sortBy === k ? '#FFF' : JA.GREY, fontFamily: 'Inter, sans-serif' }}>
                                {k === 'total' ? 'Mayor valor' : k === 'count' ? 'Más vendido' : 'Mayor precio'}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
                        <thead>
                            <tr style={{ background: JA.BG, borderBottom: `1px solid ${JA.BORDER}` }}>
                                {['Producto / Servicio', 'Unidades Vendidas', 'Total Facturado', 'Precio Prom.', 'Stock Est.', 'Días Stock', 'Estado'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p, i) => {
                                const s = ESTADO_STYLE[p.estado]
                                return (
                                    <tr key={i} style={{ borderBottom: `1px solid ${JA.BG}` }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = JA.BG}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                        <td style={{ padding: '10px 14px', fontWeight: 600, color: JA.TEXT, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: JA.NAVY, fontWeight: 700 }}>{p.count}</td>
                                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: JA.TEXT, fontWeight: 700 }}>{COP(p.total)}</td>
                                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: JA.GREY }}>{COP(p.precioPromedio)}</td>
                                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: JA.TEXT }}>{p.stockEstimado} uds</td>
                                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: p.diasStock <= 21 ? JA.ORANGE : JA.GREY }}>{p.diasStock >= 999 ? '—' : p.diasStock + 'd'}</td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '1px', background: s.bg, color: s.color, border: `1px solid ${s.bd}` }}>{p.estado}</span>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: JA.GREY_LT }}>No se encontraron productos</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Nota metodológica ──────────────────────── */}
            <div style={{ padding: '10px 16px', background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '10px', color: JA.GREY_LT, lineHeight: 1.6 }}>
                Stock estimado: velocidad de venta histórica × 3 semanas de buffer. "Días Stock" = días hasta agotamiento al ritmo actual.
                Para gestión de inventario física, sincroniza con un WMS o sistema de almacén.
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
