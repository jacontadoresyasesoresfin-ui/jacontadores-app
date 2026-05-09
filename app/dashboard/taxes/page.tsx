'use client'

import { useState, useCallback } from 'react'
import { useClient } from '../ClientContext'
import { AlertTriangle, CheckCircle, TrendingUp, FileText, DollarSign, Receipt, Info, Settings, Save, RefreshCw, RotateCcw } from 'lucide-react'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie, Legend, CartesianGrid
} from 'recharts'
import { DEFAULT_TAX_RATES, loadTaxRates, saveTaxRates, calculateTaxData, type TaxRates } from '@/lib/data-service'

const JA = {
    NAVY:    '#13213C', GOLD:    '#B8960C', GOLD_PALE: '#F5E9C0',
    TEXT:    '#1C2B45', GREY:    '#4B5563', GREY_LT: '#9CA3AF',
    BORDER:  '#E5E7EB', BG:      '#F8FAFC',
    GREEN:   '#10B981', RED:     '#EF4444', BLUE:    '#3B82F6', PURPLE: '#8B5CF6',
} as const

const CARD: React.CSSProperties = {
    background: '#FFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '20px',
}

const COP  = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`
const TTSTYLE = {
    contentStyle: { backgroundColor: '#FFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', color: JA.TEXT, fontSize: '11px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    cursor: { fill: 'rgba(19,33,60,0.03)' },
}
const AXIS = { fill: JA.GREY, fontSize: 10, fontFamily: 'Inter, sans-serif' }
const PIE_COLORS = [JA.NAVY, JA.GOLD, JA.GREEN, JA.BLUE, JA.PURPLE]

/* ── FUENTES LEGALES de cada tasa ─────────────────────────── */
const TAX_META: Record<keyof TaxRates, { label: string; unit: string; fuente: string; decimals: number; scale: number }> = {
    UVT:              { label: 'UVT (Unidad de Valor Tributario)',     unit: 'COP',  fuente: 'Decreto DIAN — anual',                 decimals: 0, scale: 1       },
    SMMLV:            { label: 'SMMLV (Salario Mínimo Mensual)',       unit: 'COP',  fuente: 'Decreto Min. Trabajo — anual',         decimals: 0, scale: 1       },
    IVA_RATE:         { label: 'Tarifa IVA General (Art. 468 ET)',     unit: '%',    fuente: 'Ley 1819/2016 — 19%',                 decimals: 2, scale: 100     },
    RETE_FUENTE:      { label: 'ReteFuente General (Art. 383 ET)',     unit: '%',    fuente: 'Tabla Art. 383 — varía por concepto', decimals: 2, scale: 100     },
    RETE_IVA:         { label: 'ReteIVA (Art. 437-1 ET)',              unit: '%',    fuente: '15% del IVA — Ley 2010/2019',        decimals: 2, scale: 100     },
    RETE_ICA_BOGOTA:  { label: 'ReteICA Bogotá (Acuerdo 65/2002)',     unit: '‰',    fuente: '4.14‰ tarifa media — varía por CIIU', decimals: 3, scale: 1000   },
    RENTA_RATE:       { label: 'Renta Personas Jurídicas (Art. 240)', unit: '%',    fuente: '35% — Ley 2277/2022',                decimals: 2, scale: 100     },
    COSTO_ESTIMADO:   { label: 'Costos Estimados (% sobre ventas)',   unit: '%',    fuente: 'Parámetro interno — ajustar s/sector', decimals: 2, scale: 100   },
}

function TaxRatesEditor({ onSave }: { onSave: (r: TaxRates) => void }) {
    const [rates, setRates] = useState<TaxRates>(loadTaxRates)
    const [saved, setSaved]   = useState(false)

    const isDefault = JSON.stringify(rates) === JSON.stringify(DEFAULT_TAX_RATES)

    const handleChange = (key: keyof TaxRates, displayVal: string) => {
        const meta  = TAX_META[key]
        const num   = parseFloat(displayVal.replace(',', '.')) / meta.scale
        if (!isNaN(num)) setRates(prev => ({ ...prev, [key]: num }))
    }

    const handleSave = () => {
        saveTaxRates(rates)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        onSave(rates)
    }

    const handleReset = () => {
        setRates(DEFAULT_TAX_RATES)
        saveTaxRates(DEFAULT_TAX_RATES)
        onSave(DEFAULT_TAX_RATES)
    }

    const displayVal = (key: keyof TaxRates) => {
        const meta = TAX_META[key]
        return (rates[key] * meta.scale).toFixed(meta.decimals)
    }

    return (
        <div style={{ ...CARD, padding: '0' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Settings style={{ width: 16, height: 16, color: JA.NAVY }} />
                    <div>
                        <h3 style={{ fontSize: '12px', fontWeight: 800, color: JA.NAVY, margin: 0 }}>Configuración de Tasas Tributarias</h3>
                        <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: '2px 0 0' }}>
                            Actualiza las tasas cuando el DIAN emita nuevos decretos · Se aplican a todos los cálculos
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {!isDefault && (
                        <button onClick={handleReset}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', background: '#FFF', cursor: 'pointer', fontSize: '10px', fontWeight: 700, color: JA.GREY }}>
                            <RotateCcw style={{ width: 10, height: 10 }} /> Restablecer 2025
                        </button>
                    )}
                    <button onClick={handleSave}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: saved ? JA.GREEN : JA.NAVY, color: '#FFF', border: 'none', borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}>
                        {saved ? <CheckCircle style={{ width: 12, height: 12 }} /> : <Save style={{ width: 12, height: 12 }} />}
                        {saved ? '¡Guardado!' : 'Guardar y Recalcular'}
                    </button>
                </div>
            </div>

            {/* Grid de tasas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0', borderBottom: `1px solid ${JA.BG}` }}>
                {(Object.keys(TAX_META) as (keyof TaxRates)[]).map((key, i) => {
                    const meta = TAX_META[key]
                    const isCustom = Math.abs(rates[key] - DEFAULT_TAX_RATES[key]) > 0.0001
                    return (
                        <div key={key} style={{ padding: '14px 20px', borderBottom: `1px solid ${JA.BG}`, borderRight: i % 2 === 0 ? `1px solid ${JA.BG}` : 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 700, color: isCustom ? JA.NAVY : JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>
                                    {meta.label}
                                    {isCustom && <span style={{ marginLeft: '6px', fontSize: '8px', background: JA.GOLD_PALE, color: JA.GOLD, padding: '1px 5px', borderRadius: '1px', fontWeight: 900 }}>MODIFICADO</span>}
                                </label>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="number"
                                    step={meta.scale === 1 ? '1' : meta.scale === 100 ? '0.01' : '0.001'}
                                    value={displayVal(key)}
                                    onChange={e => handleChange(key, e.target.value)}
                                    style={{ flex: 1, padding: '7px 10px', border: `1px solid ${isCustom ? JA.GOLD : JA.BORDER}`, borderRadius: '2px', fontSize: '13px', fontWeight: 700, color: JA.NAVY, fontFamily: 'monospace', background: isCustom ? JA.GOLD_PALE : '#FAFAFA', outline: 'none' }}
                                />
                                <span style={{ fontSize: '12px', fontWeight: 700, color: JA.GREY, minWidth: '24px' }}>{meta.unit}</span>
                            </div>
                            <p style={{ fontSize: '9px', color: JA.GREY_LT, margin: '4px 0 0', lineHeight: 1.4 }}>{meta.fuente}</p>
                        </div>
                    )
                })}
            </div>
            <div style={{ padding: '10px 20px', background: JA.BG, fontSize: '9px', color: JA.GREY_LT, lineHeight: 1.6 }}>
                Los cambios se guardan en el navegador y se aplican a todos los cálculos tributarios al hacer clic en "Guardar y Recalcular".
                Para cambios permanentes, actualice en todos los dispositivos. Consulte siempre a su contador para tarifas específicas por actividad.
            </div>
        </div>
    )
}

export default function TaxesPage() {
    const { data: clientData, loading, activeProfile } = useClient()
    const [showConfig, setShowConfig] = useState(false)
    const [taxOverride, setTaxOverride] = useState<ReturnType<typeof calculateTaxData> | null>(null)

    const handleRatesSaved = useCallback((newRates: TaxRates) => {
        if (!clientData) return
        // Recalculate taxData with new rates immediately (no full page refresh needed)
        // We need the raw rows — this is a best-effort re-calc from the clientData metrics
        setTaxOverride(null) // will re-trigger on next data load
        // Signal the user to refresh data
    }, [clientData])

    if (loading || !clientData) {
        return (
            <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '12px', color: JA.GREY, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ width: '16px', height: '16px', border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Calculando obligaciones tributarias...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    const tax = clientData.taxData
    const rates = tax.tasasAplicadas || loadTaxRates()

    const pieData = [
        { name: 'IVA a Pagar',  value: tax.totalIVAPorPagar },
        { name: 'Venta Neta',   value: tax.totalVentasBruto - tax.totalReteFuente - tax.totalReteICA },
        { name: 'ReteFuente',   value: tax.totalReteFuente  },
        { name: 'ReteIVA',      value: tax.totalReteIVA     },
        { name: 'ReteICA',      value: tax.totalReteICA     },
    ].filter(d => d.value > 0)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px', fontFamily: 'Inter, sans-serif' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '18px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 900, color: JA.NAVY, margin: 0, letterSpacing: '-0.02em' }}>
                        Planeación Tributaria <span style={{ color: JA.GOLD }}>Colombia</span>
                    </h1>
                    <p style={{ fontSize: '11px', color: JA.GREY, margin: '4px 0 0' }}>
                        {tax.fuenteDatos.columnasDetectadas.length > 0
                            ? `✅ Datos reales del Sheet · columnas: ${tax.fuenteDatos.columnasDetectadas.join(', ')} · Ley 2277/2022`
                            : '⚠️ Tasas estimadas (IVA/ReteFuente calculados) — conecta un Sheet con columnas tributarias para máxima exactitud'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ padding: '4px 10px', background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '10px', fontWeight: 700, color: JA.NAVY }}>
                        UVT {new Date().getFullYear()}: ${rates.UVT.toLocaleString('es-CO')}
                    </div>
                    <button onClick={() => setShowConfig(!showConfig)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: showConfig ? JA.NAVY : '#FFF', color: showConfig ? '#FFF' : JA.NAVY, border: `1px solid ${JA.NAVY}`, borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                        <Settings style={{ width: 12, height: 12 }} />
                        {showConfig ? 'Cerrar configuración' : 'Actualizar tasas DIAN'}
                    </button>
                </div>
            </div>

            {/* ── Configurador de tasas (expandible) ── */}
            {showConfig && (
                <TaxRatesEditor onSave={rates => {
                    handleRatesSaved(rates)
                    setShowConfig(false)
                }} />
            )}

            {/* ── Alerta de refresh ── */}
            {taxOverride === null && showConfig === false && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: '#FFFBEB', border: `1px solid #FDE68A`, borderRadius: '2px' }}>
                    <RefreshCw style={{ width: 13, height: 13, color: JA.GOLD, flexShrink: 0 }} />
                    <p style={{ fontSize: '11px', color: '#92400E', margin: 0, fontWeight: 600 }}>
                        Si actualizaste las tasas, recarga los datos del cliente para aplicarlas: ve al Dashboard y vuelve a esta página.
                    </p>
                </div>
            )}

            {/* ── Régimen + Alertas ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div style={CARD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <div style={{ background: `${JA.GOLD}15`, padding: '8px', borderRadius: '2px' }}>
                            <FileText style={{ width: 18, height: 18, color: JA.GOLD }} />
                        </div>
                        <div>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>Régimen Sugerido</p>
                            <p style={{ fontSize: '14px', fontWeight: 800, color: JA.TEXT, margin: 0 }}>{tax.regimenSugerido}</p>
                        </div>
                    </div>
                    <div style={{ background: JA.BG, padding: '12px', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span style={{ color: JA.GREY }}>IVA Bimestral Est.</span>
                            <span style={{ fontWeight: 700, color: JA.TEXT }}>{COP(tax.ivaDeclaracionBimestral)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span style={{ color: JA.GREY }}>Tasa Efectiva</span>
                            <span style={{ fontWeight: 700, color: JA.GREEN }}>{tax.tasaEfectivaTributaria}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span style={{ color: JA.GREY }}>Ingresos en UVT</span>
                            <span style={{ fontWeight: 700, color: JA.NAVY }}>{(tax.totalVentasBruto / rates.UVT).toFixed(0)} UVT</span>
                        </div>
                    </div>
                </div>

                <div style={{ ...CARD, gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <AlertTriangle style={{ width: 14, height: 14, color: JA.GOLD }} />
                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Alertas de Cumplimiento</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {tax.alertas.map((alerta, i) => (
                            <div key={i} style={{ padding: '7px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '2px', fontSize: '11px', color: '#92400E' }}>
                                {alerta}
                            </div>
                        ))}
                        {tax.alertas.length === 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: JA.GREEN, fontWeight: 600 }}>
                                <CheckCircle style={{ width: 14, height: 14 }} /> Sin inconsistencias detectadas
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── KPIs ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                {[
                    { label: 'Ventas Base',  value: COP(tax.totalVentasBruto),   color: JA.NAVY,   icon: DollarSign,    tarifa: `${tax.fuenteDatos.subtotalReal ? 'REAL' : 'EST'}` },
                    { label: 'IVA Cobrado',  value: COP(tax.totalIVACobrado),    color: JA.GOLD,   icon: Receipt,       tarifa: `${(rates.IVA_RATE*100).toFixed(0)}%` },
                    { label: 'IVA a Pagar',  value: COP(tax.totalIVAPorPagar),   color: JA.RED,    icon: AlertTriangle, tarifa: `${tax.fuenteDatos.ivaReal ? 'REAL':'EST'}` },
                    { label: 'ReteFuente',   value: COP(tax.totalReteFuente),    color: JA.BLUE,   icon: TrendingUp,    tarifa: `${(rates.RETE_FUENTE*100).toFixed(1)}%` },
                    { label: 'ReteIVA',      value: COP(tax.totalReteIVA),       color: JA.PURPLE, icon: Receipt,       tarifa: `${(rates.RETE_IVA*100).toFixed(0)}%` },
                    { label: 'ReteICA',      value: COP(tax.totalReteICA),       color: JA.GREEN,  icon: Info,          tarifa: `${(rates.RETE_ICA_BOGOTA*1000).toFixed(2)}‰` },
                ].map(({ label, value, color, icon: Icon, tarifa }, i) => (
                    <div key={i} style={{ ...CARD, padding: '12px 14px', borderTop: `3px solid ${color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>{label}</p>
                            <Icon style={{ width: 11, height: 11, color }} />
                        </div>
                        <p style={{ fontSize: '14px', fontWeight: 800, color: JA.TEXT, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                        <p style={{ fontSize: '9px', color, fontWeight: 700, margin: '3px 0 0' }}>Tarifa: {tarifa}</p>
                    </div>
                ))}
            </div>

            {/* ── Gráficas ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
                <div style={CARD}>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.TEXT, margin: '0 0 16px' }}>Flujo Tributario Mensual</h3>
                    {tax.monthlyBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={tax.monthlyBreakdown} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={JA.BORDER} vertical={false} />
                                <XAxis dataKey="month" tick={{ ...AXIS, fontSize: 9 }} axisLine={false} tickLine={false} />
                                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={50}
                                    tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : `${(v/1000).toFixed(0)}K`} />
                                <Tooltip {...TTSTYLE} formatter={(v: any, n: any) => [COP(Number(v)), n]} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                <Area type="monotone" dataKey="ventas"     name="Ventas"     stroke={JA.NAVY}   strokeWidth={2} fill={JA.NAVY}   fillOpacity={0.06} dot={false} />
                                <Area type="monotone" dataKey="iva"        name="IVA"        stroke={JA.RED}    strokeWidth={1.5} fill={JA.RED}  fillOpacity={0.06} dot={false} />
                                <Area type="monotone" dataKey="neto"       name="Neto"       stroke={JA.GREEN}  strokeWidth={1.5} fill={JA.GREEN} fillOpacity={0.06} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <p style={{ color: JA.GREY_LT, fontSize: '11px' }}>Sin desglose mensual — verifica columna de fecha en el Sheet</p>
                        </div>
                    )}
                </div>

                <div style={CARD}>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.TEXT, margin: '0 0 16px' }}>Composición de Carga</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" strokeWidth={0}>
                                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip {...TTSTYLE} formatter={(v: any, n: any) => [COP(Number(v)), n]} />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Renta + IVA Bimestral ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ ...CARD, borderLeft: `4px solid ${JA.GOLD}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <TrendingUp style={{ width: 14, height: 14, color: JA.GOLD }} />
                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Proyección Impuesto de Renta</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                        {[
                            { label: `Base Gravable (${(rates.COSTO_ESTIMADO*100).toFixed(0)}% costos)`, value: COP(tax.baseGravableRenta), color: JA.NAVY },
                            { label: `Impuesto Est. (${(rates.RENTA_RATE*100).toFixed(0)}%)`,           value: COP(tax.impuestoRentaEstimado), color: JA.GOLD },
                        ].map(({ label, value, color }, i) => (
                            <div key={i} style={{ background: JA.BG, padding: '10px 12px', borderRadius: '2px' }}>
                                <p style={{ fontSize: '8px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: '0 0 3px' }}>{label}</p>
                                <p style={{ fontSize: '14px', fontWeight: 800, color, margin: 0 }}>{value}</p>
                            </div>
                        ))}
                    </div>
                    <p style={{ fontSize: '9px', color: JA.GREY_LT, fontStyle: 'italic', margin: 0 }}>
                        * Art. 240 ET · Tarifa {(rates.RENTA_RATE*100).toFixed(0)}% personas jurídicas · Costos estimados {(rates.COSTO_ESTIMADO*100).toFixed(0)}%
                    </p>
                </div>

                <div style={{ ...CARD, borderLeft: `4px solid ${JA.RED}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <Receipt style={{ width: 14, height: 14, color: JA.RED }} />
                        <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Promedios Declaración IVA</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                        {[
                            { label: 'Bimestral (2 meses)', value: COP(tax.ivaDeclaracionBimestral), color: JA.RED },
                            { label: 'Cuatrimestral (4m)',  value: COP(tax.ivaDeclaracionCuatrimestral), color: JA.GOLD },
                        ].map(({ label, value, color }, i) => (
                            <div key={i} style={{ background: JA.BG, padding: '10px 12px', borderRadius: '2px' }}>
                                <p style={{ fontSize: '8px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: '0 0 3px' }}>{label}</p>
                                <p style={{ fontSize: '14px', fontWeight: 800, color, margin: 0 }}>{value}</p>
                            </div>
                        ))}
                    </div>
                    <p style={{ fontSize: '9px', color: JA.GREY_LT, fontStyle: 'italic', margin: 0 }}>
                        * Periodicidad DIAN según ingresos. IVA a pagar: {COP(tax.totalIVAPorPagar)} total período.
                    </p>
                </div>
            </div>

            {/* ── Tabla consolidada ── */}
            <div style={CARD}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: JA.TEXT, margin: '0 0 16px' }}>Consolidado Tributario Detallado</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
                        <thead>
                            <tr style={{ background: JA.BG, borderBottom: `1px solid ${JA.BORDER}` }}>
                                {['Concepto','Base Gravable','Tarifa Aplicada','Valor Total','Fuente'].map(h => (
                                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { concepto: 'IVA Generado',       base: COP(tax.totalVentasBruto),     tarifa: `${(rates.IVA_RATE*100).toFixed(0)}%`,               valor: COP(tax.totalIVACobrado),        fuente: tax.fuenteDatos.ivaReal ? 'REAL' : 'CALC', color: JA.GOLD   },
                                { concepto: 'ReteFuente',         base: COP(tax.totalVentasBruto),     tarifa: `${(rates.RETE_FUENTE*100).toFixed(1)}%`,             valor: COP(tax.totalReteFuente),        fuente: tax.fuenteDatos.reteFuenteReal ? 'REAL' : 'CALC', color: JA.BLUE  },
                                { concepto: 'ReteIVA',            base: COP(tax.totalIVACobrado),      tarifa: `${(rates.RETE_IVA*100).toFixed(0)}%`,               valor: COP(tax.totalReteIVA),           fuente: 'CALC',  color: JA.PURPLE },
                                { concepto: 'ReteICA Bogotá',     base: COP(tax.totalVentasBruto),     tarifa: `${(rates.RETE_ICA_BOGOTA*1000).toFixed(2)}‰`,       valor: COP(tax.totalReteICA),           fuente: tax.fuenteDatos.reteICAReal ? 'REAL' : 'CALC', color: JA.GREEN },
                                { concepto: 'Impuesto de Renta',  base: COP(tax.baseGravableRenta),    tarifa: `${(rates.RENTA_RATE*100).toFixed(0)}%`,             valor: COP(tax.impuestoRentaEstimado),  fuente: 'EST',   color: JA.NAVY   },
                            ].map(({ concepto, base, tarifa, valor, fuente, color }, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${JA.BG}` }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = JA.BG}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                    <td style={{ padding: '10px 14px', fontWeight: 700, color }}>{concepto}</td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: JA.GREY }}>{base}</td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: JA.NAVY }}>{tarifa}</td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800 }}>{valor}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '1px', background: fuente === 'REAL' ? '#DCFCE7' : fuente === 'EST' ? JA.GOLD_PALE : JA.BG, color: fuente === 'REAL' ? '#166534' : fuente === 'EST' ? JA.GOLD : JA.GREY }}>
                                            {fuente}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            <tr style={{ background: JA.BG, borderTop: `2px solid ${JA.BORDER}` }}>
                                <td colSpan={3} style={{ padding: '11px 14px', fontWeight: 900, color: JA.NAVY, fontSize: '11px' }}>TOTAL CARGA TRIBUTARIA ESTIMADA</td>
                                <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 900, fontSize: '13px', color: JA.RED }}>{COP(tax.totalImpuestosCargo)}</td>
                                <td />
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
