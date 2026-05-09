'use client'

import { useMemo } from 'react'
import { useClient } from '../ClientContext'
import {
    ComposedChart, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, Tooltip, ResponsiveContainer,
    Cell, CartesianGrid, Legend, Line, ReferenceLine
} from 'recharts'
import { TrendingUp, Users, FileText, BarChart3, Activity, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const JA = {
    NAVY:    '#13213C', GOLD:    '#B8960C', GOLD_PALE: '#F5E9C0',
    TEXT:    '#1C2B45', GREY:    '#4B5563', GREY_LT: '#9CA3AF',
    BORDER:  '#E5E7EB', BG:      '#F8FAFC',
    GREEN:   '#10B981', RED:     '#EF4444', TEAL: '#0D9488', BLUE: '#3B82F6',
} as const

const CARD: React.CSSProperties = {
    background: '#FFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}
const COP = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
    return `$${Math.round(n).toLocaleString('es-CO')}`
}
const AXIS  = { fill: JA.GREY_LT, fontSize: 9, fontFamily: 'Inter,sans-serif' }
const TT    = { contentStyle: { background: '#FFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '11px', fontFamily: 'Inter,sans-serif' }, cursor: { fill: 'rgba(19,33,60,0.03)' } }

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function linReg(ys: number[]) {
    const n = ys.length
    if (n < 2) return { slope: 0, intercept: ys[0] || 0, stdDev: 0 }
    const xs = ys.map((_, i) => i)
    const sumX  = xs.reduce((s, x) => s + x, 0)
    const sumY  = ys.reduce((s, y) => s + y, 0)
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
    const sumX2 = xs.reduce((s, x) => s + x * x, 0)
    const denom = n * sumX2 - sumX ** 2
    const slope     = denom ? (n * sumXY - sumX * sumY) / denom : 0
    const intercept = (sumY - slope * sumX) / n
    const predicted = xs.map(x => slope * x + intercept)
    const stdDev    = Math.sqrt(ys.reduce((s, y, i) => s + (y - predicted[i]) ** 2, 0) / n)
    return { slope, intercept, stdDev }
}

export default function AnalyticsPage() {
    const { data: clientData, loading } = useClient()

    const analysis = useMemo(() => {
        if (!clientData) return null

        /* ── Group by month ── */
        const monthMap = new Map<string, number>()
        clientData.salesHistory.forEach(item => {
            const key = item.date.slice(0, 7)
            monthMap.set(key, (monthMap.get(key) || 0) + item.amount)
        })
        const sortedKeys = Array.from(monthMap.keys()).sort()
        const monthly    = sortedKeys.map(k => {
            const [y, m] = k.split('-').map(Number)
            return { key: k, mes: MONTHS_ES[m - 1], total: monthMap.get(k)! }
        })

        if (monthly.length === 0) return null

        const ys = monthly.map(d => d.total)
        const { slope, intercept, stdDev } = linReg(ys)

        /* ── Moving average (3-month) ── */
        const histData = monthly.map((d, i) => {
            const win = ys.slice(Math.max(0, i - 2), i + 1)
            const ma  = win.reduce((s, v) => s + v, 0) / win.length
            return { mes: d.mes, total: d.total, ma: Math.round(ma), forecast: null as number | null, lower: null as number | null, band: null as number | null }
        })

        /* ── 3-month forecast ── */
        const lastKey   = sortedKeys.at(-1)!
        const [ly, lm]  = lastKey.split('-').map(Number)
        const forecastPts = [1, 2, 3].map(offset => {
            const mIdx   = (lm - 1 + offset) % 12
            const label  = MONTHS_ES[mIdx] + '★'
            const x      = ys.length - 1 + offset
            const yhat   = slope * x + intercept
            const lo     = Math.max(0, yhat - stdDev * 1.28)
            const hi     = yhat + stdDev * 1.28
            return { mes: label, total: null as number | null, ma: null as number | null,
                forecast: Math.round(Math.max(0, yhat)), lower: Math.round(lo), band: Math.round(hi - lo) }
        })

        const chartData = [...histData, ...forecastPts]

        /* ── Growth & confidence ── */
        const growthRate  = ys.length >= 2 ? ((ys.at(-1)! - ys[0]) / ys[0]) * 100 : 0
        const nextMonthY  = slope * ys.length + intercept
        const confidence  = Math.max(0, Math.min(100, 100 - (stdDev / (intercept || 1)) * 100))
        const bestMonth   = monthly.reduce((best, d) => d.total > best.total ? d : best, monthly[0])
        const worstMonth  = monthly.reduce((low,  d) => d.total < low.total  ? d : low,  monthly[0])

        return { chartData, monthly, growthRate, nextMonth: Math.round(nextMonthY), confidence, bestMonth, worstMonth, stdDev, n: ys.length }
    }, [clientData])

    if (loading || !clientData) {
        return (
            <div style={{ padding: '40px', display: 'flex', alignItems: 'center', gap: '12px', color: JA.GREY, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ width: '16px', height: '16px', border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Procesando Inteligencia de Negocios...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    const topClientsData = clientData.topClients.map(c => ({
        name:   c.name.length > 18 ? c.name.slice(0, 17) + '…' : c.name,
        amount: Math.round(c.amount), percent: c.percent
    }))
    const recurringData = clientData.recurringCustomers.slice(0, 6).map(c => ({
        name:    c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name,
        compras: c.count, total: Math.round(c.total)
    }))

    const growthPositive = (analysis?.growthRate || 0) >= 0

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '32px', fontFamily: 'Inter, sans-serif' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '18px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 900, color: JA.NAVY, margin: 0, letterSpacing: '-0.02em' }}>
                        Business <span style={{ color: JA.GOLD }}>Intelligence</span>
                    </h1>
                    <p style={{ fontSize: '11px', color: JA.GREY, margin: '4px 0 0' }}>
                        Predicción por regresión lineal · Intervalo de confianza 80% · Media móvil 3m
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 12px', background: JA.GREEN + '15', border: `1px solid ${JA.GREEN}40`, borderRadius: '2px' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: JA.GREEN, animation: 'pulse 2s infinite' }} />
                    <span style={{ fontSize: '10px', fontWeight: 800, color: JA.GREEN }}>LIVE DATA</span>
                </div>
            </div>

            {/* ── KPIs ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {[
                    { label: 'Facturación Mensual',  value: clientData.metrics.sales.value,       color: JA.NAVY,  bg: '#EEF2F8', Icon: TrendingUp,  change: clientData.metrics.sales.change },
                    { label: 'Cartera de Clientes',  value: clientData.metrics.newClients.value,  color: JA.GOLD,  bg: JA.GOLD_PALE, Icon: Users,  change: clientData.metrics.newClients.change },
                    { label: 'Volumen Documental',   value: clientData.metrics.productsSold.value,color: JA.TEAL,  bg: '#F0FDFA', Icon: FileText, change: clientData.metrics.productsSold.change },
                    { label: 'Proyección 30D',        value: analysis ? COP(analysis.nextMonth) : '—', color: JA.GREEN, bg: '#F0FDF4', Icon: Target, change: null },
                    { label: 'Tasa de Crecimiento',  value: analysis ? (growthPositive ? '+' : '') + analysis.growthRate.toFixed(1) + '%' : '—', color: growthPositive ? JA.GREEN : JA.RED, bg: growthPositive ? '#F0FDF4' : '#FEF2F2', Icon: Activity, change: null },
                ].map(({ label, value, color, bg, Icon, change }, i) => (
                    <div key={i} style={{ ...CARD, padding: '15px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{label}</p>
                            <div style={{ width: 26, height: 26, borderRadius: '5px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon style={{ width: 12, height: 12, color }} />
                            </div>
                        </div>
                        <p style={{ fontSize: '17px', fontWeight: 800, color, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                        {change !== null && (
                            <p style={{ fontSize: '9px', fontWeight: 700, color: Number(change) >= 0 ? JA.GREEN : JA.RED, margin: '4px 0 0' }}>
                                {Number(change) >= 0 ? '↑' : '↓'} {Math.abs(Number(change))}% vs anterior
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Prediction Chart + Top Clients ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px' }}>
                {/* Prediction ComposedChart */}
                <div style={{ ...CARD, padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div>
                            <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: '0 0 2px' }}>Tendencia + Predicción Avanzada</h3>
                            <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>
                                Histórico mensual · Media móvil 3m (dorado) · Proyección ★ con IC 80% (banda)
                            </p>
                        </div>
                        {analysis && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px', background: JA.NAVY, borderRadius: '2px' }}>
                                {growthPositive ? <ArrowUpRight style={{ width: 11, height: 11, color: JA.GREEN }} /> : <ArrowDownRight style={{ width: 11, height: 11, color: JA.RED }} />}
                                <span style={{ fontSize: '10px', fontWeight: 800, color: '#FFF' }}>
                                    {growthPositive ? '+' : ''}{analysis.growthRate.toFixed(1)}%
                                </span>
                            </div>
                        )}
                    </div>

                    {analysis && analysis.chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <ComposedChart data={analysis.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gNavyAdv" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor={JA.NAVY} stopOpacity={0.12} />
                                        <stop offset="95%" stopColor={JA.NAVY} stopOpacity={0}    />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="4 3" stroke="#F0F0F0" vertical={false} />
                                <XAxis dataKey="mes" tick={AXIS} axisLine={false} tickLine={false} />
                                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={45}
                                    tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : `${(v/1_000).toFixed(0)}K`} />
                                <Tooltip {...TT} formatter={(v: any, name?: string) => {
                                    if (!name || name === 'lower' || name === 'band') return false
                                    return [COP(Number(v)), name === 'total' ? 'Ventas' : name === 'ma' ? 'Media Móvil 3m' : 'Proyección']
                                }} />

                                {/* Confidence interval band (stacked areas) */}
                                <Area type="monotone" dataKey="lower"    stackId="ci" fill="transparent" stroke="none" dot={false} legendType="none" connectNulls={false} />
                                <Area type="monotone" dataKey="band"     stackId="ci" fill={JA.GOLD}     fillOpacity={0.15} stroke="none" dot={false} name="IC 80%" legendType="square" connectNulls={false} />

                                {/* Historical area */}
                                <Area type="monotone" dataKey="total"    fill="url(#gNavyAdv)" stroke={JA.NAVY} strokeWidth={2} dot={false} name="Ventas" connectNulls={false} />

                                {/* Moving average */}
                                <Line type="monotone" dataKey="ma"       stroke={JA.GOLD}  strokeWidth={1.5} dot={false} name="Media Móvil" connectNulls={false} />

                                {/* Forecast dashed */}
                                <Line type="monotone" dataKey="forecast" stroke={JA.GREEN} strokeWidth={2} strokeDasharray="5 3" dot={{ fill: JA.GREEN, r: 3, strokeWidth: 0 }} name="Proyección" connectNulls={false} />

                                {/* Separator between historical and forecast */}
                                <ReferenceLine x={analysis.monthly.at(-1)?.mes} stroke={JA.GREY_LT} strokeDasharray="3 3" label={{ value: 'HOY', fill: JA.GREY_LT, fontSize: 8, position: 'insideTopRight' }} />

                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '12px', fontFamily: 'Inter,sans-serif' }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <p style={{ fontSize: '12px', color: JA.GREY_LT }}>Datos insuficientes — conecta tu Google Sheet.</p>
                        </div>
                    )}
                </div>

                {/* Top Clients */}
                <div style={{ ...CARD, padding: '20px' }}>
                    <div style={{ marginBottom: '14px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: '0 0 2px' }}>Concentración de Facturación</h3>
                        <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>Top clientes por ingreso acumulado</p>
                    </div>
                    {topClientsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={topClientsData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }} barSize={8}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false}
                                    tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}M` : `${(v/1_000).toFixed(0)}K`} />
                                <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={100} />
                                <Tooltip {...TT} formatter={(v: any) => [COP(Number(v)), 'Total']} />
                                <Bar dataKey="amount" radius={[0, 2, 2, 0]}>
                                    {topClientsData.map((_, i) => (
                                        <Cell key={i} fill={[JA.NAVY, JA.GOLD, JA.TEAL, JA.GREEN, JA.BLUE][i % 5]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <p style={{ fontSize: '11px', color: JA.GREY_LT }}>Sin datos de clientes</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Recurrence + Analysis Panel ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px' }}>
                {/* Recurrence */}
                <div style={{ ...CARD, padding: '20px' }}>
                    <div style={{ marginBottom: '14px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: '0 0 2px' }}>Recurrencia por Identificación</h3>
                        <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>Número de transacciones por cliente recurrente</p>
                    </div>
                    {recurringData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={recurringData} barSize={12} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                                <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 8 }} axisLine={false} tickLine={false} />
                                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={25} />
                                <Tooltip {...TT} />
                                <Bar dataKey="compras" name="Transacciones" fill={JA.NAVY} radius={[1, 1, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <p style={{ fontSize: '11px', color: JA.GREY_LT }}>Datos insuficientes</p>
                        </div>
                    )}
                </div>

                {/* Advanced Analysis Panel */}
                <div style={{ ...CARD, background: JA.NAVY, border: 'none', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#FFF', margin: 0 }}>Análisis Predictivo</h3>
                        <span style={{ fontSize: '9px', fontWeight: 900, color: JA.GOLD, border: `1px solid ${JA.GOLD}50`, padding: '2px 6px', borderRadius: '1px' }}>IA · REGRESIÓN</span>
                    </div>

                    {analysis ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {/* Projected revenue */}
                            <div>
                                <p style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', margin: '0 0 3px', textTransform: 'uppercase' }}>Recaudo Estimado Próximo Mes</p>
                                <p style={{ fontSize: '28px', fontWeight: 800, color: '#FFF', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{COP(analysis.nextMonth)}</p>
                                <p style={{ fontSize: '9px', color: JA.GOLD, margin: '3px 0 0', fontWeight: 700 }}>
                                    Confianza estadística: {analysis.confidence.toFixed(0)}%
                                </p>
                            </div>

                            {/* Stats grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {[
                                    { label: 'Mejor Mes', value: analysis.bestMonth.mes,  sub: COP(analysis.bestMonth.total),  color: JA.GREEN },
                                    { label: 'Peor Mes',  value: analysis.worstMonth.mes, sub: COP(analysis.worstMonth.total), color: JA.RED   },
                                    { label: 'Meses Analizados', value: analysis.n.toString(), sub: 'registros', color: JA.GOLD },
                                    { label: 'Desv. Estándar',   value: COP(analysis.stdDev), sub: 'variabilidad', color: '#9CA3AF' },
                                ].map(({ label, value, sub, color }, i) => (
                                    <div key={i} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', margin: '0 0 3px', textTransform: 'uppercase', fontWeight: 700 }}>{label}</p>
                                        <p style={{ fontSize: '13px', fontWeight: 800, color, margin: 0 }}>{value}</p>
                                        <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>{sub}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Formula */}
                            <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                                <p style={{ fontSize: '8px', fontWeight: 800, color: JA.GOLD, margin: '0 0 4px', textTransform: 'uppercase' }}>Fórmula Técnica</p>
                                <code style={{ fontSize: '10px', color: '#FFF', fontFamily: 'monospace' }}>
                                    {clientData.prediction.formula}
                                </code>
                            </div>

                            {/* Recent activity */}
                            <div>
                                <p style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', margin: '0 0 6px', textTransform: 'uppercase' }}>Últimas Operaciones</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {clientData.recentActivity.slice(0, 3).map((a, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '1px' }}>
                                            <div style={{ minWidth: 0 }}>
                                                <p style={{ fontSize: '10px', fontWeight: 700, color: '#FFF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.client}</p>
                                                <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>{a.time}</p>
                                            </div>
                                            <span style={{ fontSize: '10px', fontWeight: 800, color: JA.GOLD, fontFamily: 'monospace', marginLeft: '8px', flexShrink: 0 }}>{a.amount}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px' }}>
                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Conecta datos para activar el modelo</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
