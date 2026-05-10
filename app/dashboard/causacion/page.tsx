'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    FileText, BookOpen, History, Plus, Trash2, Download,
    CheckCircle2, AlertCircle, ChevronDown, ChevronRight,
    Calculator, ArrowRight, RefreshCw, Info, X,
} from 'lucide-react'

/* ─── Paleta J&A ─────────────────────────────────────────── */
const JA = {
    NAVY: '#13213C', GOLD: '#B8960C', GOLD_LT: '#D4A843',
    TEXT: '#1C2B45', GREY: '#4B5563', GREY_LT: '#9CA3AF',
    BORDER: '#E5E7EB', BG: '#F8FAFC', WHITE: '#FFFFFF',
    GREEN: '#059669', RED: '#DC2626', BLUE: '#2563EB',
    TEAL: '#0F7B71', PURPLE: '#7C3AED',
    CREAM: '#F4F4F0',
}

/* ─── UVT 2025 ───────────────────────────────────────────── */
const UVT = 49799

/* ─── Conceptos de retención en la fuente ───────────────── */
interface Concepto {
    id: string; label: string; tasa: number; baseUVT: number
    cuentaRete: string; cuentaGasto: string; desc: string
}
const CONCEPTOS: Concepto[] = [
    { id: 'compras', label: 'Compras generales (bienes)', tasa: 2.5, baseUVT: 27, cuentaRete: '236540', cuentaGasto: '1430', desc: 'Adquisición de bienes muebles o inventario' },
    { id: 'honorarios_pn', label: 'Honorarios — Persona Natural', tasa: 10, baseUVT: 0, cuentaRete: '236506', cuentaGasto: '5120', desc: 'Servicios profesionales de persona natural sin declaración de renta' },
    { id: 'honorarios_pj', label: 'Honorarios — Persona Jurídica', tasa: 11, baseUVT: 0, cuentaRete: '236506', cuentaGasto: '5120', desc: 'Servicios profesionales de persona jurídica o empresa' },
    { id: 'servicios', label: 'Servicios generales', tasa: 4, baseUVT: 4, cuentaRete: '236515', cuentaGasto: '5135', desc: 'Prestación de servicios no clasificados en otras categorías' },
    { id: 'arrendamiento_mueble', label: 'Arrendamiento — Bienes muebles', tasa: 4, baseUVT: 0, cuentaRete: '236518', cuentaGasto: '5140', desc: 'Alquiler de maquinaria, equipos, vehículos' },
    { id: 'arrendamiento_inmueble', label: 'Arrendamiento — Bienes inmuebles', tasa: 3.5, baseUVT: 0, cuentaRete: '236518', cuentaGasto: '5140', desc: 'Arrendamiento de oficinas, bodegas, locales' },
    { id: 'comisiones', label: 'Comisiones', tasa: 11, baseUVT: 0, cuentaRete: '236515', cuentaGasto: '5125', desc: 'Pagos por comisiones de ventas o intermediación' },
    { id: 'transporte_carga', label: 'Transporte de carga nacional', tasa: 1, baseUVT: 27, cuentaRete: '236515', cuentaGasto: '5160', desc: 'Fletes y transporte de mercancías dentro del país' },
    { id: 'transporte_pasajeros', label: 'Transporte nacional de pasajeros', tasa: 3.5, baseUVT: 27, cuentaRete: '236515', cuentaGasto: '5160', desc: 'Tiquetes aéreos y terrestres nacionales' },
    { id: 'mantenimiento', label: 'Mantenimiento y reparaciones', tasa: 4, baseUVT: 4, cuentaRete: '236515', cuentaGasto: '5196', desc: 'Reparación de equipos, maquinaria e instalaciones' },
    { id: 'publicidad', label: 'Publicidad y propaganda', tasa: 3.5, baseUVT: 4, cuentaRete: '236515', cuentaGasto: '5130', desc: 'Pauta publicitaria, diseño gráfico, marketing' },
    { id: 'sin_retencion', label: 'Sin retención en la fuente', tasa: 0, baseUVT: 0, cuentaRete: '', cuentaGasto: '5195', desc: 'Proveedor exento, régimen simple, o monto inferior a la base' },
]

const TASAS_IVA = [0, 5, 19] as const
type TasaIVA = typeof TASAS_IVA[number]

/* ─── Tipos ──────────────────────────────────────────────── */
interface LineaAsiento { cuenta: string; descripcion: string; debito: number; credito: number }

interface Causacion {
    id: string; tipo: 'compra' | 'venta'
    fecha: string; tercero: string; nit: string; numeroFactura: string
    conceptoId: string; descripcionAdicional: string
    valorBase: number; tasaIVA: TasaIVA; iva: number
    aplicaRetefuente: boolean; tasaRetefuente: number; retefuente: number
    aplicaReteiva: boolean; reteiva: number
    aplicaReteica: boolean; tasaReteica: number; reteica: number
    valorNeto: number; asiento: LineaAsiento[]
    creadoEn: string
}

/* ─── Helpers ────────────────────────────────────────────── */
const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
const pct = (n: number) => `${n}%`
const uid = () => Math.random().toString(36).slice(2, 10)

function calcularAsiento(c: Omit<Causacion, 'id' | 'asiento' | 'creadoEn'>): LineaAsiento[] {
    const concepto = CONCEPTOS.find(x => x.id === c.conceptoId)
    const lines: LineaAsiento[] = []

    if (c.tipo === 'compra') {
        lines.push({ cuenta: concepto?.cuentaGasto || '5195', descripcion: concepto?.label || 'Gasto / Costo', debito: c.valorBase, credito: 0 })
        if (c.iva > 0) lines.push({ cuenta: '240805', descripcion: 'IVA Descontable', debito: c.iva, credito: 0 })
        lines.push({ cuenta: '220505', descripcion: `Proveedores — ${c.tercero}`, debito: 0, credito: c.valorNeto })
        if (c.retefuente > 0) lines.push({ cuenta: concepto?.cuentaRete || '236515', descripcion: `Retefuente ${pct(c.tasaRetefuente)}`, debito: 0, credito: c.retefuente })
        if (c.reteiva > 0) lines.push({ cuenta: '236701', descripcion: 'Reteiva 15%', debito: 0, credito: c.reteiva })
        if (c.reteica > 0) lines.push({ cuenta: '236901', descripcion: `Reteica ${pct(c.tasaReteica)}`, debito: 0, credito: c.reteica })
    } else {
        const bruto = c.valorBase + c.iva
        lines.push({ cuenta: '130505', descripcion: `Clientes — ${c.tercero}`, debito: bruto, credito: 0 })
        lines.push({ cuenta: '410535', descripcion: 'Ingresos por servicios / ventas', debito: 0, credito: c.valorBase })
        if (c.iva > 0) lines.push({ cuenta: '240810', descripcion: 'IVA Generado', debito: 0, credito: c.iva })
    }

    return lines
}

function calcularCausacion(form: FormState): Omit<Causacion, 'id' | 'asiento' | 'creadoEn'> {
    const base = form.valorBase
    const iva = Math.round(base * form.tasaIVA / 100)
    const concepto = CONCEPTOS.find(x => x.id === form.conceptoId)!
    const baseMinima = concepto.baseUVT * UVT
    const aplicaRete = form.aplicaRetefuente && concepto.tasa > 0 && base >= baseMinima
    const retefuente = aplicaRete ? Math.round(base * concepto.tasa / 100) : 0
    const reteiva = form.aplicaReteiva && iva > 0 ? Math.round(iva * 0.15) : 0
    const reteica = form.aplicaReteica ? Math.round(base * form.tasaReteica / 100) : 0
    const valorNeto = form.tipo === 'compra'
        ? base + iva - retefuente - reteiva - reteica
        : base + iva

    return {
        ...form, iva, tasaRetefuente: concepto.tasa,
        aplicaRetefuente: aplicaRete, retefuente, reteiva, reteica, valorNeto,
    }
}

interface FormState {
    tipo: 'compra' | 'venta'; fecha: string; tercero: string; nit: string
    numeroFactura: string; conceptoId: string; descripcionAdicional: string
    valorBase: number; tasaIVA: TasaIVA
    aplicaRetefuente: boolean; tasaRetefuente: number
    aplicaReteiva: boolean; tasaReteica: number; aplicaReteica: boolean
}

const defaultForm = (): FormState => ({
    tipo: 'compra', fecha: new Date().toISOString().split('T')[0],
    tercero: '', nit: '', numeroFactura: '', conceptoId: 'servicios',
    descripcionAdicional: '', valorBase: 0, tasaIVA: 19,
    aplicaRetefuente: true, tasaRetefuente: 0,
    aplicaReteiva: false, tasaReteica: 0.5, aplicaReteica: false,
})

/* ─── Estilos ────────────────────────────────────────────── */
const s = {
    card: { background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '6px', padding: '20px' },
    label: { fontSize: '11px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '5px', display: 'block' },
    input: { width: '100%', padding: '8px 11px', fontSize: '13px', color: JA.TEXT, background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '4px', outline: 'none', fontFamily: 'Inter, sans-serif' },
    select: { width: '100%', padding: '8px 11px', fontSize: '13px', color: JA.TEXT, background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '4px', outline: 'none', fontFamily: 'Inter, sans-serif' },
    btn: { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, borderRadius: '4px', border: 'none', background: JA.NAVY, color: '#FFF', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
    btnGold: { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, borderRadius: '4px', border: 'none', background: JA.GOLD, color: JA.NAVY, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
    btnSec: { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 18px', fontSize: '13px', fontWeight: 600, borderRadius: '4px', border: `1px solid ${JA.BORDER}`, background: JA.WHITE, color: JA.TEXT, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
    section: { marginBottom: '20px' },
    sectionTitle: { fontSize: '12px', fontWeight: 800, color: JA.NAVY, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '14px', paddingBottom: '8px', borderBottom: `2px solid ${JA.GOLD}`, display: 'flex', alignItems: 'center', gap: '8px' },
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
export default function CausacionPage() {
    const [tab, setTab] = useState<'nueva' | 'historial' | 'aprende'>('nueva')
    const [historial, setHistorial] = useState<Causacion[]>([])
    const [form, setForm] = useState<FormState>(defaultForm())
    const [preview, setPreview] = useState<ReturnType<typeof calcularCausacion> | null>(null)
    const [guardado, setGuardado] = useState(false)
    const [detalleId, setDetalleId] = useState<string | null>(null)
    const [moduloAprende, setModuloAprende] = useState(0)

    useEffect(() => {
        const stored = localStorage.getItem('ja_causaciones')
        if (stored) setHistorial(JSON.parse(stored))
    }, [])

    const actualizarPreview = useCallback(() => {
        if (form.valorBase > 0 && form.tercero && form.conceptoId) {
            setPreview(calcularCausacion(form))
        } else setPreview(null)
    }, [form])

    useEffect(() => { actualizarPreview() }, [actualizarPreview])

    const guardarCausacion = () => {
        if (!preview) return
        const asiento = calcularAsiento(preview)
        const nueva: Causacion = { ...preview, id: uid(), asiento, creadoEn: new Date().toISOString() }
        const nuevo = [nueva, ...historial]
        setHistorial(nuevo)
        localStorage.setItem('ja_causaciones', JSON.stringify(nuevo))
        setGuardado(true)
        setTab('historial')
        setTimeout(() => setGuardado(false), 3000)
        setForm(defaultForm())
    }

    const eliminarCausacion = (id: string) => {
        const nuevo = historial.filter(c => c.id !== id)
        setHistorial(nuevo)
        localStorage.setItem('ja_causaciones', JSON.stringify(nuevo))
    }

    const exportarCSV = () => {
        if (!historial.length) return
        const rows = [['Fecha', 'Tipo', 'Tercero', 'NIT', 'Factura', 'Base', 'IVA', 'Retefuente', 'Reteiva', 'Reteica', 'Neto']]
        historial.forEach(c => rows.push([c.fecha, c.tipo, c.tercero, c.nit, c.numeroFactura, String(c.valorBase), String(c.iva), String(c.retefuente), String(c.reteiva), String(c.reteica), String(c.valorNeto)]))
        const csv = rows.map(r => r.join(';')).join('\n')
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'causaciones_ja.csv'; a.click()
    }

    const concepto = CONCEPTOS.find(c => c.id === form.conceptoId)!

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
                .causa-tab { padding: 10px 20px; font-size: 12px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.06em; border: none; cursor: pointer; border-bottom: 3px solid transparent;
                    background: transparent; color: ${JA.GREY}; transition: all 0.15s; font-family: Inter,sans-serif; }
                .causa-tab.active { color: ${JA.NAVY}; border-bottom-color: ${JA.GOLD}; }
                .causa-tab:hover { color: ${JA.NAVY}; background: #F9FAFB; }
                .tipo-btn { flex: 1; padding: 14px; border: 2px solid ${JA.BORDER}; border-radius: 6px;
                    background: ${JA.WHITE}; cursor: pointer; font-weight: 700; font-size: 13px;
                    color: ${JA.GREY}; transition: all 0.15s; font-family: Inter,sans-serif; }
                .tipo-btn.active { border-color: ${JA.NAVY}; background: ${JA.NAVY}; color: #FFF; }
                .asiento-row:hover { background: #F9F7F2; }
                .aprende-card { background: ${JA.WHITE}; border: 1px solid ${JA.BORDER}; border-radius: 8px;
                    margin-bottom: 12px; overflow: hidden; cursor: pointer; transition: box-shadow 0.15s; }
                .aprende-card:hover { box-shadow: 0 4px 12px rgba(19,33,60,0.1); }
                .tip-box { background: rgba(184,150,12,0.06); border-left: 3px solid ${JA.GOLD};
                    padding: 10px 14px; border-radius: 0 4px 4px 0; font-size: 12px; color: ${JA.TEXT}; margin-top: 12px; }
                input[type=number]::-webkit-inner-spin-button { opacity: 0.5; }
                .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
                .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
                @media(max-width:700px) { .grid2,.grid3 { grid-template-columns: 1fr; } }
            `}</style>

            {/* ── Header ── */}
            <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 800, color: JA.NAVY, margin: 0 }}>
                            Causación de Facturas
                        </h1>
                        <p style={{ fontSize: '13px', color: JA.GREY, margin: '4px 0 0' }}>
                            Automatización contable · Normas NIIF · Colombia 2025 · UVT ${UVT.toLocaleString('es-CO')}
                        </p>
                    </div>
                    {guardado && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: '6px', fontSize: '13px', color: JA.GREEN, fontWeight: 600 }}>
                            <CheckCircle2 style={{ width: 15, height: 15 }} /> Causación guardada
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: `1px solid ${JA.BORDER}`, marginTop: '20px' }}>
                    {([['nueva', FileText, 'Nueva Causación'], ['historial', History, `Historial (${historial.length})`], ['aprende', BookOpen, 'Centro de Aprendizaje']] as const).map(([key, Icon, label]) => (
                        <button key={key} className={`causa-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Icon style={{ width: 13, height: 13 }} />{label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ════════════════════════════════════
                TAB: NUEVA CAUSACIÓN
            ════════════════════════════════════ */}
            {tab === 'nueva' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>

                    {/* Columna izquierda — formulario */}
                    <div>

                        {/* Tipo */}
                        <div style={{ ...s.card, marginBottom: '16px' }}>
                            <div style={s.sectionTitle}><FileText style={{ width: 14, height: 14, color: JA.GOLD }} /> Tipo de Comprobante</div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className={`tipo-btn${form.tipo === 'compra' ? ' active' : ''}`} onClick={() => setForm({ ...form, tipo: 'compra' })}>
                                    📥 Factura de Compra<br />
                                    <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.7 }}>Proveedor → Empresa</span>
                                </button>
                                <button className={`tipo-btn${form.tipo === 'venta' ? ' active' : ''}`} onClick={() => setForm({ ...form, tipo: 'venta' })}>
                                    📤 Factura de Venta<br />
                                    <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.7 }}>Empresa → Cliente</span>
                                </button>
                            </div>
                        </div>

                        {/* Datos del documento */}
                        <div style={{ ...s.card, marginBottom: '16px' }}>
                            <div style={s.sectionTitle}><FileText style={{ width: 14, height: 14, color: JA.GOLD }} /> Datos del Documento</div>
                            <div className="grid3" style={{ marginBottom: '12px' }}>
                                <div>
                                    <span style={s.label}>Fecha</span>
                                    <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={s.input} />
                                </div>
                                <div>
                                    <span style={s.label}>{form.tipo === 'compra' ? 'Proveedor' : 'Cliente'} *</span>
                                    <input value={form.tercero} onChange={e => setForm({ ...form, tercero: e.target.value })} style={s.input} placeholder="Razón social" />
                                </div>
                                <div>
                                    <span style={s.label}>NIT</span>
                                    <input value={form.nit} onChange={e => setForm({ ...form, nit: e.target.value })} style={s.input} placeholder="900.123.456-7" />
                                </div>
                            </div>
                            <div className="grid2">
                                <div>
                                    <span style={s.label}>N° Factura</span>
                                    <input value={form.numeroFactura} onChange={e => setForm({ ...form, numeroFactura: e.target.value })} style={s.input} placeholder="FV-0001" />
                                </div>
                                <div>
                                    <span style={s.label}>Descripción adicional</span>
                                    <input value={form.descripcionAdicional} onChange={e => setForm({ ...form, descripcionAdicional: e.target.value })} style={s.input} placeholder="Opcional" />
                                </div>
                            </div>
                        </div>

                        {/* Concepto y valores */}
                        <div style={{ ...s.card, marginBottom: '16px' }}>
                            <div style={s.sectionTitle}><Calculator style={{ width: 14, height: 14, color: JA.GOLD }} /> Concepto y Valores</div>

                            <div style={{ marginBottom: '14px' }}>
                                <span style={s.label}>Concepto para retención en la fuente</span>
                                <select value={form.conceptoId} onChange={e => setForm({ ...form, conceptoId: e.target.value })} style={s.select}>
                                    {CONCEPTOS.map(c => (
                                        <option key={c.id} value={c.id}>{c.label} {c.tasa > 0 ? `— ${c.tasa}%` : '— No aplica'}</option>
                                    ))}
                                </select>
                                {concepto && (
                                    <div style={{ marginTop: '6px', fontSize: '11px', color: JA.GREY, fontStyle: 'italic' }}>
                                        {concepto.desc}{concepto.baseUVT > 0 ? ` · Base mínima: ${concepto.baseUVT} UVT = ${fmt(concepto.baseUVT * UVT)}` : ''}
                                    </div>
                                )}
                            </div>

                            <div className="grid2">
                                <div>
                                    <span style={s.label}>Valor base gravable (sin IVA) *</span>
                                    <input
                                        type="number" min={0} step={1000}
                                        value={form.valorBase || ''}
                                        onChange={e => setForm({ ...form, valorBase: Number(e.target.value) || 0 })}
                                        style={{ ...s.input, fontWeight: 700, fontSize: '15px' }}
                                        placeholder="0"
                                    />
                                    {form.valorBase > 0 && <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '4px' }}>{fmt(form.valorBase)}</div>}
                                </div>
                                <div>
                                    <span style={s.label}>Tasa IVA</span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {TASAS_IVA.map(t => (
                                            <button key={t} onClick={() => setForm({ ...form, tasaIVA: t })}
                                                style={{ flex: 1, padding: '9px 4px', borderRadius: '4px', border: `2px solid ${form.tasaIVA === t ? JA.NAVY : JA.BORDER}`, background: form.tasaIVA === t ? JA.NAVY : JA.WHITE, color: form.tasaIVA === t ? '#FFF' : JA.GREY, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                                                {t}%
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Retenciones — solo compras */}
                        {form.tipo === 'compra' && (
                            <div style={{ ...s.card, marginBottom: '16px' }}>
                                <div style={s.sectionTitle}><ArrowRight style={{ width: 14, height: 14, color: JA.GOLD }} /> Retenciones Aplicables</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                                    {/* Retefuente */}
                                    <div style={{ padding: '12px', background: JA.BG, borderRadius: '4px', border: `1px solid ${JA.BORDER}` }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={form.aplicaRetefuente} onChange={e => setForm({ ...form, aplicaRetefuente: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT }}>Retención en la Fuente (Retefuente)</div>
                                                <div style={{ fontSize: '11px', color: JA.GREY }}>
                                                    {concepto?.tasa}% sobre base gravable
                                                    {concepto?.baseUVT > 0 && ` · Mínimo ${fmt(concepto.baseUVT * UVT)}`}
                                                    {preview && preview.retefuente > 0 && ` · Valor: ${fmt(preview.retefuente)}`}
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Reteiva */}
                                    <div style={{ padding: '12px', background: JA.BG, borderRadius: '4px', border: `1px solid ${JA.BORDER}` }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={form.aplicaReteiva} onChange={e => setForm({ ...form, aplicaReteiva: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT }}>Retención de IVA (Reteiva) — 15%</div>
                                                <div style={{ fontSize: '11px', color: JA.GREY }}>
                                                    Aplica cuando el comprador es Gran Contribuyente o entidad pública
                                                    {form.tasaIVA > 0 && preview ? ` · Valor: ${fmt(preview.reteiva)}` : ''}
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Reteica */}
                                    <div style={{ padding: '12px', background: JA.BG, borderRadius: '4px', border: `1px solid ${JA.BORDER}` }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: form.aplicaReteica ? '10px' : '0' }}>
                                            <input type="checkbox" checked={form.aplicaReteica} onChange={e => setForm({ ...form, aplicaReteica: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT }}>Retención de ICA (Reteica)</div>
                                                <div style={{ fontSize: '11px', color: JA.GREY }}>Varía por municipio · Bogotá: 1‰ – 14‰ según actividad</div>
                                            </div>
                                        </label>
                                        {form.aplicaReteica && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                                <span style={{ fontSize: '12px', color: JA.GREY, whiteSpace: 'nowrap' }}>Tasa %:</span>
                                                <input type="number" step={0.1} min={0} max={5} value={form.tasaReteica}
                                                    onChange={e => setForm({ ...form, tasaReteica: Number(e.target.value) })}
                                                    style={{ ...s.input, width: '90px' }} />
                                                {preview && <span style={{ fontSize: '12px', color: JA.GREY }}>{fmt(preview.reteica)}</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Columna derecha — asiento contable */}
                    <div style={{ position: 'sticky', top: '120px' }}>
                        {preview && preview.valorBase > 0 ? (
                            <div style={{ animation: 'fadeIn 0.25s ease' }}>
                                <AsientoPanel preview={preview} onGuardar={guardarCausacion} />
                            </div>
                        ) : (
                            <div style={{ ...s.card, textAlign: 'center', padding: '40px 20px', color: JA.GREY }}>
                                <Calculator style={{ width: 36, height: 36, margin: '0 auto 12px', color: JA.GREY_LT }} />
                                <p style={{ fontSize: '13px', fontWeight: 600 }}>Ingresa los datos para ver</p>
                                <p style={{ fontSize: '12px', color: JA.GREY_LT, marginTop: '4px' }}>el asiento contable generado</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════
                TAB: HISTORIAL
            ════════════════════════════════════ */}
            {tab === 'historial' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>
                            {historial.length} causaciones registradas
                        </h2>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={exportarCSV} style={s.btnSec} disabled={!historial.length}>
                                <Download style={{ width: 14, height: 14 }} /> Exportar CSV
                            </button>
                            <button onClick={() => setTab('nueva')} style={s.btnGold}>
                                <Plus style={{ width: 14, height: 14 }} /> Nueva
                            </button>
                        </div>
                    </div>

                    {historial.length === 0 ? (
                        <div style={{ ...s.card, textAlign: 'center', padding: '60px' }}>
                            <History style={{ width: 40, height: 40, margin: '0 auto 16px', color: JA.GREY_LT }} />
                            <p style={{ fontSize: '14px', fontWeight: 600, color: JA.GREY }}>No hay causaciones registradas</p>
                            <button onClick={() => setTab('nueva')} style={{ ...s.btnGold, marginTop: '16px' }}><Plus style={{ width: 14, height: 14 }} /> Crear primera causación</button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {historial.map(c => (
                                <div key={c.id}>
                                    <div style={{ ...s.card, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                                        onClick={() => setDetalleId(detalleId === c.id ? null : c.id)}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: c.tipo === 'compra' ? '#EFF6FF' : '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                                    {c.tipo === 'compra' ? '📥' : '📤'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '14px', color: JA.TEXT }}>{c.tercero}</div>
                                                    <div style={{ fontSize: '11px', color: JA.GREY }}>
                                                        {c.fecha} · {c.numeroFactura || 'Sin N°'} · {CONCEPTOS.find(x => x.id === c.conceptoId)?.label}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '15px', fontWeight: 800, color: JA.NAVY }}>{fmt(c.valorNeto)}</div>
                                                    <div style={{ fontSize: '11px', color: JA.GREY }}>
                                                        {c.tipo === 'compra' ? 'a pagar' : 'a cobrar'}
                                                    </div>
                                                </div>
                                                <button onClick={e => { e.stopPropagation(); eliminarCausacion(c.id) }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: JA.GREY_LT, padding: '4px' }}>
                                                    <Trash2 style={{ width: 15, height: 15 }} />
                                                </button>
                                                {detalleId === c.id ? <ChevronDown style={{ width: 15, height: 15, color: JA.GREY }} /> : <ChevronRight style={{ width: 15, height: 15, color: JA.GREY }} />}
                                            </div>
                                        </div>

                                        {/* Detalle expandible */}
                                        {detalleId === c.id && (
                                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${JA.BORDER}`, animation: 'fadeIn 0.2s ease' }}>
                                                <TablaAsiento asiento={c.asiento} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════
                TAB: APRENDE
            ════════════════════════════════════ */}
            {tab === 'aprende' && <AprendeSection modulo={moduloAprende} setModulo={setModuloAprende} />}
        </div>
    )
}

/* ─── Panel Asiento Contable ─────────────────────────────── */
function AsientoPanel({ preview, onGuardar }: { preview: ReturnType<typeof calcularCausacion>; onGuardar: () => void }) {
    const asiento = calcularAsiento(preview)
    const totalDB = asiento.reduce((s, l) => s + l.debito, 0)
    const totalCR = asiento.reduce((s, l) => s + l.credito, 0)
    const balanceado = Math.abs(totalDB - totalCR) < 1

    return (
        <div>
            {/* Resumen financiero */}
            <div style={{ background: JA.NAVY, borderRadius: '6px', padding: '16px 18px', marginBottom: '14px', color: '#FFF' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: JA.GOLD_LT, marginBottom: '12px' }}>
                    Resumen Financiero
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                        { label: 'Base gravable', value: preview.valorBase },
                        { label: `IVA ${preview.tasaIVA}%`, value: preview.iva },
                        preview.retefuente > 0 ? { label: `Retefuente ${preview.tasaRetefuente}%`, value: -preview.retefuente } : null,
                        preview.reteiva > 0 ? { label: 'Reteiva 15%', value: -preview.reteiva } : null,
                        preview.reteica > 0 ? { label: `Reteica ${preview.tasaReteica}%`, value: -preview.reteica } : null,
                    ].filter(Boolean).map((item, i) => item && (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.label}</span>
                            <span style={{ fontWeight: 600, color: item.value < 0 ? '#FCA5A5' : 'rgba(255,255,255,0.9)' }}>
                                {item.value < 0 ? '- ' : ''}{fmt(Math.abs(item.value))}
                            </span>
                        </div>
                    ))}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 800, fontSize: '13px', color: JA.GOLD_LT }}>
                            Total {preview.tipo === 'compra' ? 'a pagar' : 'a cobrar'}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '15px', color: '#FFF' }}>{fmt(preview.valorNeto)}</span>
                    </div>
                </div>
            </div>

            {/* Asiento contable */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '6px', overflow: 'hidden', marginBottom: '14px' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: JA.NAVY }}>
                        Asiento Contable
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: balanceado ? '#D1FAE5' : '#FEE2E2', color: balanceado ? JA.GREEN : JA.RED }}>
                        {balanceado ? '✓ Cuadrado' : '✗ Descuadrado'}
                    </span>
                </div>
                <TablaAsiento asiento={asiento} />
            </div>

            <button onClick={onGuardar} style={{ ...s.btnGold, width: '100%', justifyContent: 'center', padding: '12px' }}>
                <CheckCircle2 style={{ width: 15, height: 15 }} /> Guardar Causación
            </button>
        </div>
    )
}

function TablaAsiento({ asiento }: { asiento: LineaAsiento[] }) {
    const totalDB = asiento.reduce((s, l) => s + l.debito, 0)
    const totalCR = asiento.reduce((s, l) => s + l.credito, 0)
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
                <tr style={{ background: JA.BG }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: JA.GREY, fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cuenta PUC</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: JA.BLUE, fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>Débito</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: JA.RED, fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>Crédito</th>
                </tr>
            </thead>
            <tbody>
                {asiento.map((l, i) => (
                    <tr key={i} className="asiento-row" style={{ borderTop: `1px solid ${JA.BORDER}` }}>
                        <td style={{ padding: '9px 12px', color: JA.TEXT }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', background: '#F3F4F6', padding: '1px 5px', borderRadius: '3px', marginRight: '6px', color: JA.NAVY }}>{l.cuenta}</span>
                            {l.descripcion}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: l.debito > 0 ? JA.BLUE : JA.GREY_LT }}>
                            {l.debito > 0 ? fmt(l.debito) : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: l.credito > 0 ? JA.RED : JA.GREY_LT }}>
                            {l.credito > 0 ? fmt(l.credito) : '—'}
                        </td>
                    </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${JA.BORDER}`, background: JA.BG }}>
                    <td style={{ padding: '9px 12px', fontWeight: 800, fontSize: '12px', color: JA.TEXT }}>TOTALES</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: JA.BLUE }}>{fmt(totalDB)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: JA.RED }}>{fmt(totalCR)}</td>
                </tr>
            </tbody>
        </table>
    )
}

/* ─── Sección Aprende ────────────────────────────────────── */
const MODULOS_APRENDE = [
    {
        icon: '📚', titulo: '¿Qué es la Causación de Facturas?', color: JA.NAVY,
        contenido: () => (
            <div>
                <p style={{ fontSize: '13px', color: JA.TEXT, lineHeight: 1.7, marginBottom: '12px' }}>
                    La <strong>causación</strong> es el registro contable de una transacción en el momento en que se genera el derecho o la obligación, <em>independientemente de cuándo se reciba o pague el dinero</em>. Este es el principio del <strong>devengado</strong>, base de las NIIF (Normas Internacionales de Información Financiera).
                </p>
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '14px', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '12px', color: JA.BLUE }}>Ejemplo práctico:</strong>
                    <p style={{ fontSize: '12px', color: JA.TEXT, margin: '6px 0 0', lineHeight: 1.6 }}>
                        El 15 de enero recibes una factura de honorarios por $1.000.000. La causas ese mismo día aunque la pagues el 30 de enero. El 15 de enero registras el gasto y la obligación con el proveedor. El 30 de enero registras el pago (débito a Proveedores, crédito a Bancos).
                    </p>
                </div>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '14px' }}>
                    <strong style={{ fontSize: '12px', color: JA.GREEN }}>¿Por qué es importante?</strong>
                    <ul style={{ fontSize: '12px', color: JA.TEXT, margin: '8px 0 0', paddingLeft: '18px', lineHeight: 1.8 }}>
                        <li>Cumplimiento del Estatuto Tributario colombiano</li>
                        <li>Refleja la realidad económica en los estados financieros</li>
                        <li>Base para declaraciones de IVA y Retefuente</li>
                        <li>Obligatoria bajo NIIF para Pymes y NIIF Plenas</li>
                    </ul>
                </div>
            </div>
        )
    },
    {
        icon: '🔢', titulo: 'El Asiento Contable Paso a Paso', color: JA.TEAL,
        contenido: () => (
            <div>
                <p style={{ fontSize: '13px', color: JA.TEXT, lineHeight: 1.6, marginBottom: '14px' }}>
                    Un asiento de causación tiene siempre <strong>débitos = créditos</strong>. Aquí el caso más común: factura de honorarios de persona natural.
                </p>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', background: '#1E293B', color: '#E2E8F0', padding: '16px', borderRadius: '6px', marginBottom: '14px', lineHeight: 2 }}>
                    <div style={{ color: '#94A3B8', marginBottom: '4px' }}>{'/* Factura honorarios $1.000.000 + IVA 19% */\n'}</div>
                    <div><span style={{ color: '#60A5FA' }}>DB</span>  5120 Honorarios           <span style={{ color: '#4ADE80' }}>$1.000.000</span></div>
                    <div><span style={{ color: '#60A5FA' }}>DB</span>  240805 IVA Descontable      <span style={{ color: '#4ADE80' }}>$190.000</span></div>
                    <div><span style={{ color: '#F87171' }}>CR</span>  220505 Proveedores          <span style={{ color: '#FB923C' }}>$1.090.000</span></div>
                    <div><span style={{ color: '#F87171' }}>CR</span>  236506 Retefuente 10%       <span style={{ color: '#FB923C' }}>$100.000</span></div>
                    <div style={{ borderTop: '1px solid #334155', marginTop: '8px', paddingTop: '8px', color: '#94A3B8' }}>
                        DB Total: $1.190.000  |  CR Total: $1.190.000  ✓
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                    <div style={{ background: '#EFF6FF', padding: '12px', borderRadius: '6px', borderLeft: '3px solid #3B82F6' }}>
                        <strong style={{ color: JA.BLUE }}>DÉBITOS — ¿Qué recibimos?</strong>
                        <p style={{ margin: '6px 0 0', color: JA.TEXT, lineHeight: 1.6 }}>El gasto o activo que nos genera la factura + el IVA que podemos descontar</p>
                    </div>
                    <div style={{ background: '#FFF1F2', padding: '12px', borderRadius: '6px', borderLeft: '3px solid #EF4444' }}>
                        <strong style={{ color: JA.RED }}>CRÉDITOS — ¿Qué debemos?</strong>
                        <p style={{ margin: '6px 0 0', color: JA.TEXT, lineHeight: 1.6 }}>La deuda con el proveedor (neta de retenciones que hacemos como agentes retenedores)</p>
                    </div>
                </div>
            </div>
        )
    },
    {
        icon: '📊', titulo: 'Retención en la Fuente — Tabla 2025', color: JA.PURPLE,
        contenido: () => (
            <div>
                <p style={{ fontSize: '13px', color: JA.TEXT, lineHeight: 1.6, marginBottom: '14px' }}>
                    La retención en la fuente es un <strong>anticipo del impuesto de renta</strong> que el comprador descuenta al pagar. Solo aplica si la base supera el mínimo en UVT.
                    <strong> UVT 2025: $49.799</strong>
                </p>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ background: JA.NAVY, color: '#FFF' }}>
                                {['Concepto', 'Tasa', 'Base mín. UVT', 'Base mín. $', 'Cuenta'].map(h => (
                                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {CONCEPTOS.filter(c => c.tasa > 0).map((c, i) => (
                                <tr key={c.id} style={{ background: i % 2 === 0 ? JA.WHITE : JA.BG, borderBottom: `1px solid ${JA.BORDER}` }}>
                                    <td style={{ padding: '7px 10px', color: JA.TEXT }}>{c.label}</td>
                                    <td style={{ padding: '7px 10px', fontWeight: 700, color: JA.NAVY }}>{c.tasa}%</td>
                                    <td style={{ padding: '7px 10px', color: JA.GREY }}>{c.baseUVT > 0 ? `${c.baseUVT} UVT` : 'Ninguna'}</td>
                                    <td style={{ padding: '7px 10px', color: JA.GREY }}>{c.baseUVT > 0 ? fmt(c.baseUVT * UVT) : '—'}</td>
                                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: JA.BLUE, fontSize: '10px' }}>{c.cuentaRete}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="tip-box" style={{ marginTop: '14px' }}>
                    <strong>💡 Tip:</strong> Si el proveedor es del Régimen Simple de Tributación (SIMPLE), <strong>NO aplica retención en la fuente</strong>. Verifica el RUT del proveedor.
                </div>
            </div>
        )
    },
    {
        icon: '💰', titulo: 'IVA: Descontable vs. Generado', color: JA.GOLD,
        contenido: () => (
            <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '14px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: JA.BLUE, marginBottom: '8px' }}>IVA Descontable (Compras)</div>
                        <p style={{ fontSize: '12px', color: JA.TEXT, lineHeight: 1.7, margin: 0 }}>
                            El IVA que pagas al comprar bienes o servicios. <strong>Lo puedes descontar</strong> del IVA que cobras en tus ventas. Va al <strong>Débito</strong> de la cuenta 240805.
                        </p>
                    </div>
                    <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', padding: '14px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#D97706', marginBottom: '8px' }}>IVA Generado (Ventas)</div>
                        <p style={{ fontSize: '12px', color: JA.TEXT, lineHeight: 1.7, margin: 0 }}>
                            El IVA que cobras a tus clientes. <strong>Lo debes pagar</strong> al Estado (bimestralmente). Va al <strong>Crédito</strong> de la cuenta 240810.
                        </p>
                    </div>
                </div>
                <div style={{ background: JA.BG, border: `1px solid ${JA.BORDER}`, padding: '14px', borderRadius: '6px', fontSize: '12px', color: JA.TEXT, lineHeight: 1.8 }}>
                    <strong>Liquidación bimestral del IVA:</strong><br />
                    IVA por pagar = IVA Generado (ventas) − IVA Descontable (compras)<br />
                    Si el resultado es positivo → pagas al Estado<br />
                    Si es negativo → saldo a favor (puedes solicitar devolución o compensar)
                </div>
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    {[['0%', 'Bienes de la canasta familiar, salud, educación, libros', '#D1FAE5', JA.GREEN],
                      ['5%', 'Café, seguros, planes de medicina prepagada, motocicletas', '#FEF9C3', '#D97706'],
                      ['19%', 'Tarifa general — aplica a la mayoría de bienes y servicios', '#FEE2E2', JA.RED]].map(([tasa, desc, bg, color]) => (
                        <div key={tasa} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: bg, padding: '10px', borderRadius: '4px' }}>
                            <span style={{ fontWeight: 800, fontSize: '14px', color, flexShrink: 0, width: '28px' }}>{tasa}</span>
                            <span style={{ color: JA.TEXT, lineHeight: 1.5 }}>{desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        )
    },
    {
        icon: '🏙️', titulo: 'Reteica — Retención de ICA por Municipio', color: '#0F7B71',
        contenido: () => (
            <div>
                <p style={{ fontSize: '13px', color: JA.TEXT, lineHeight: 1.6, marginBottom: '14px' }}>
                    El ICA (Impuesto de Industria y Comercio) es un impuesto <strong>municipal</strong>. La retención (Reteica) la practica quien paga cuando el vendedor no tiene actividad en ese municipio o cuando el comprador es agente retenedor.
                </p>
                <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ background: JA.TEAL, color: '#FFF' }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Ciudad</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Actividad comercial</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Tasa (por mil)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['Bogotá D.C.', 'Comercio', '11,04‰ (1,104%)'],
                                ['Bogotá D.C.', 'Servicios', '9,66‰ (0,966%)'],
                                ['Medellín', 'Comercio', '5‰ (0,5%)'],
                                ['Cali', 'Servicios', '10‰ (1,0%)'],
                                ['Bucaramanga', 'Comercio / Servicios', '7‰ (0,7%)'],
                                ['Barranquilla', 'Industria y comercio', '5‰ – 10‰'],
                            ].map(([ciudad, act, tasa], i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? JA.WHITE : JA.BG, borderBottom: `1px solid ${JA.BORDER}` }}>
                                    <td style={{ padding: '7px 12px', fontWeight: 600, color: JA.TEXT }}>{ciudad}</td>
                                    <td style={{ padding: '7px 12px', color: JA.GREY }}>{act}</td>
                                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: JA.TEAL }}>{tasa}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="tip-box">
                    <strong>💡 Importante:</strong> Siempre verifica la tarifa vigente en el estatuto tributario de cada municipio. Las tarifas cambian anualmente. La base del ICA es el total de ingresos brutos, no solo la utilidad.
                </div>
            </div>
        )
    },
    {
        icon: '⚠️', titulo: 'Errores Comunes y Cómo Evitarlos', color: JA.RED,
        contenido: () => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                    ['Causar sin el soporte físico', 'Toda causación requiere el original de la factura con CUFE (Código Único de Factura Electrónica) para facturas electrónicas, o resolución de numeración para facturas en papel.', '❌'],
                    ['No verificar si el proveedor es agente retenedor', 'Si el proveedor tiene ingresos superiores a 30.000 UVT en el año anterior, puede ser Gran Contribuyente y el tratamiento es diferente.', '❌'],
                    ['Aplicar retefuente cuando no supera la base mínima', 'Si el pago no supera el mínimo en UVT del concepto (ej. compras < 27 UVT = $1.345.000), NO se practica retención.', '❌'],
                    ['Usar cuentas PUC incorrectas', 'Confundir IVA descontable (2408) con IVA generado, o usar una sola cuenta genérica para todas las retenciones, dificulta la conciliación fiscal.', '❌'],
                    ['No causar las notas crédito', 'Cuando el proveedor emite una nota crédito (devolución, descuento), debes hacer el asiento inverso. Si no lo haces, el saldo de proveedores queda errado.', '❌'],
                    ['Causar facturas del exterior sin aplicar retención', 'Los pagos al exterior tienen retenciones especiales (Artículo 406 ET). Siempre verifica si el beneficiario está en un paraíso fiscal.', '❌'],
                ].map(([titulo, desc, icon], i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', background: '#FFF5F5', border: '1px solid #FEE2E2', borderRadius: '6px', padding: '12px 14px' }}>
                        <span style={{ fontSize: '18px', flexShrink: 0 }}>{icon}</span>
                        <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: JA.RED, marginBottom: '4px' }}>{titulo}</div>
                            <div style={{ fontSize: '12px', color: JA.TEXT, lineHeight: 1.6 }}>{desc}</div>
                        </div>
                    </div>
                ))}
            </div>
        )
    },
]

function AprendeSection({ modulo, setModulo }: { modulo: number; setModulo: (n: number) => void }) {
    const [expandido, setExpandido] = useState<number | null>(0)
    return (
        <div>
            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: JA.NAVY, margin: '0 0 6px' }}>Centro de Aprendizaje</h2>
                <p style={{ fontSize: '13px', color: JA.GREY, margin: 0 }}>Guía completa de causación contable para Colombia · NIIF · ET 2025</p>
            </div>

            {/* Progress */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {MODULOS_APRENDE.map((m, i) => (
                    <button key={i} onClick={() => setExpandido(expandido === i ? null : i)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', border: `1px solid ${expandido === i ? m.color : JA.BORDER}`, background: expandido === i ? m.color : JA.WHITE, color: expandido === i ? '#FFF' : JA.GREY, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                        {m.icon} Módulo {i + 1}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {MODULOS_APRENDE.map((m, i) => (
                    <div key={i} className="aprende-card" onClick={() => setExpandido(expandido === i ? null : i)}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderLeft: `4px solid ${m.color}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '22px' }}>{m.icon}</span>
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: m.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Módulo {i + 1}</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: JA.TEXT }}>{m.titulo}</div>
                                </div>
                            </div>
                            {expandido === i
                                ? <ChevronDown style={{ width: 18, height: 18, color: JA.GREY, flexShrink: 0 }} />
                                : <ChevronRight style={{ width: 18, height: 18, color: JA.GREY, flexShrink: 0 }} />}
                        </div>
                        {expandido === i && (
                            <div style={{ padding: '16px 20px 20px', borderTop: `1px solid ${JA.BORDER}`, animation: 'fadeIn 0.2s ease' }}
                                onClick={e => e.stopPropagation()}>
                                {m.contenido()}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
