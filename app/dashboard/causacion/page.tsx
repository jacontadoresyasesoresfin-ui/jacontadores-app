'use client'

import { useState, useEffect, useCallback, useRef, DragEvent } from 'react'
import {
    FileText, BookOpen, History, Plus, Trash2, Download, Upload,
    CheckCircle2, AlertCircle, ChevronDown, ChevronRight, RefreshCw,
    Filter, Search, FolderOpen, ExternalLink, Shield, X, Check,
    AlertTriangle, Eye, Zap, BarChart3, Clock,
} from 'lucide-react'
import { useClient } from '../ClientContext'

/* ─── Paleta J&A ─────────────────────────────────────────── */
const JA = {
    NAVY: '#13213C', GOLD: '#B8960C', GOLD_LT: '#D4A843',
    TEXT: '#1C2B45', GREY: '#4B5563', GREY_LT: '#9CA3AF',
    BORDER: '#E5E7EB', BG: '#F8FAFC', WHITE: '#FFFFFF',
    GREEN: '#059669', GREEN_LT: '#D1FAE5', RED: '#DC2626', RED_LT: '#FEE2E2',
    BLUE: '#2563EB', BLUE_LT: '#DBEAFE', YELLOW: '#D97706', YELLOW_LT: '#FEF3C7',
    PURPLE: '#7C3AED', PURPLE_LT: '#EDE9FE',
}

const UVT = 49799

/* ─── Tipos ──────────────────────────────────────────────── */
interface Concepto {
    id: string; label: string; tasa: number; baseUVT: number
    cuentaRete: string; cuentaGasto: string; desc: string
}
const CONCEPTOS: Concepto[] = [
    { id: 'compras', label: 'Compras generales (bienes)', tasa: 2.5, baseUVT: 27, cuentaRete: '236540', cuentaGasto: '1430', desc: 'Adquisición de bienes muebles o inventario' },
    { id: 'honorarios_pn', label: 'Honorarios — Persona Natural', tasa: 10, baseUVT: 0, cuentaRete: '236506', cuentaGasto: '5120', desc: 'Servicios profesionales persona natural sin declaración de renta' },
    { id: 'honorarios_pj', label: 'Honorarios — Persona Jurídica', tasa: 11, baseUVT: 0, cuentaRete: '236506', cuentaGasto: '5120', desc: 'Servicios profesionales persona jurídica o empresa' },
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

interface LineaAsiento { cuenta: string; descripcion: string; debito: number; credito: number }

interface Factura {
    id?: string
    tipo: 'compra' | 'venta'
    numero_factura: string
    fecha: string
    nit_tercero: string
    nombre_tercero: string
    valor_base: number
    porcentaje_iva: number
    valor_iva: number
    concepto_retefuente: string
    tasa_retefuente: number
    valor_retefuente: number
    tasa_reteiva: number
    valor_reteiva: number
    tasa_reteica: number
    valor_reteica: number
    valor_neto: number
    cuenta_gasto: string
    cuenta_proveedor: string
    estado: 'pendiente' | 'causado' | 'contabilizado'
    fuente: 'manual' | 'pdf' | 'drive' | 'csv'
    archivo_nombre?: string
    cufe?: string
    dian_verificado?: boolean
    asiento?: LineaAsiento[]
    notas?: string
}

type PdfQueueItem = {
    file: File
    status: 'pending' | 'processing' | 'done' | 'error'
    data?: Partial<Factura>
    error?: string
}

/* ─── Helpers ─────────────────────────────────────────────── */
const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
const fmtN = (n: number) => new Intl.NumberFormat('es-CO').format(n)

function calcular(f: Partial<Factura>): Partial<Factura> {
    const base = f.valor_base || 0
    const ivaP = f.porcentaje_iva || 0
    const valor_iva = Math.round(base * ivaP / 100)

    const concepto = CONCEPTOS.find(c => c.id === f.concepto_retefuente) || CONCEPTOS[CONCEPTOS.length - 1]
    const baseMinima = concepto.baseUVT * UVT
    let valor_retefuente = 0
    if (concepto.tasa > 0 && base >= baseMinima) {
        valor_retefuente = Math.round(base * concepto.tasa / 100)
    }

    const tasa_reteiva = f.tasa_reteiva || 0
    const valor_reteiva = ivaP > 0 ? Math.round(valor_iva * tasa_reteiva / 100) : 0
    const tasa_reteica = f.tasa_reteica || 0
    const valor_reteica = Math.round(base * tasa_reteica / 100)

    const valor_neto = base + valor_iva - valor_retefuente - valor_reteiva - valor_reteica

    return {
        ...f,
        valor_iva,
        valor_retefuente,
        valor_reteiva,
        valor_reteica,
        valor_neto,
        tasa_retefuente: concepto.tasa,
        cuenta_gasto: f.cuenta_gasto || concepto.cuentaGasto,
    }
}

function generarAsiento(f: Partial<Factura>): LineaAsiento[] {
    const c = calcular(f)
    const lineas: LineaAsiento[] = []
    const concepto = CONCEPTOS.find(x => x.id === c.concepto_retefuente)

    if (f.tipo === 'compra') {
        lineas.push({ cuenta: c.cuenta_gasto || '5195', descripcion: `Gasto/Activo — ${f.nombre_tercero || 'Proveedor'}`, debito: c.valor_base || 0, credito: 0 })
        if ((c.valor_iva || 0) > 0) lineas.push({ cuenta: '240801', descripcion: `IVA Descontable ${c.porcentaje_iva}%`, debito: c.valor_iva || 0, credito: 0 })
        lineas.push({ cuenta: c.cuenta_proveedor || '22050101', descripcion: `Proveedores — ${f.nombre_tercero || 'Proveedor'}`, debito: 0, credito: (c.valor_base || 0) + (c.valor_iva || 0) })
        if ((c.valor_retefuente || 0) > 0 && concepto?.cuentaRete) lineas.push({ cuenta: concepto.cuentaRete, descripcion: `Retefuente ${c.tasa_retefuente}%`, debito: 0, credito: c.valor_retefuente || 0 })
        if ((c.valor_reteiva || 0) > 0) lineas.push({ cuenta: '236701', descripcion: `Reteiva ${c.tasa_reteiva}%`, debito: 0, credito: c.valor_reteiva || 0 })
        if ((c.valor_reteica || 0) > 0) lineas.push({ cuenta: '236801', descripcion: `Reteica ${c.tasa_reteica}%`, debito: 0, credito: c.valor_reteica || 0 })
    } else {
        lineas.push({ cuenta: '130505', descripcion: `Clientes — ${f.nombre_tercero || 'Cliente'}`, debito: (c.valor_base || 0) + (c.valor_iva || 0), credito: 0 })
        lineas.push({ cuenta: '410505', descripcion: `Ingresos — ${f.nombre_tercero || 'Cliente'}`, debito: 0, credito: c.valor_base || 0 })
        if ((c.valor_iva || 0) > 0) lineas.push({ cuenta: '240805', descripcion: `IVA Generado ${c.porcentaje_iva}%`, debito: 0, credito: c.valor_iva || 0 })
    }
    return lineas
}

function facturaVacia(): Partial<Factura> {
    return {
        tipo: 'compra', numero_factura: '', fecha: new Date().toISOString().slice(0, 10),
        nit_tercero: '', nombre_tercero: '', valor_base: 0, porcentaje_iva: 19,
        concepto_retefuente: 'servicios', tasa_reteiva: 15, tasa_reteica: 0,
        cuenta_proveedor: '22050101', estado: 'pendiente', fuente: 'manual',
        valor_iva: 0, valor_retefuente: 0, valor_reteiva: 0, valor_reteica: 0, valor_neto: 0,
    }
}

/* ─── Badge estado ───────────────────────────────────────── */
function EstadoBadge({ estado }: { estado: string }) {
    const map: Record<string, { bg: string; color: string; label: string }> = {
        pendiente: { bg: JA.YELLOW_LT, color: JA.YELLOW, label: 'Pendiente' },
        causado: { bg: JA.BLUE_LT, color: JA.BLUE, label: 'Causado' },
        contabilizado: { bg: JA.GREEN_LT, color: JA.GREEN, label: 'Contabilizado' },
    }
    const s = map[estado] || map.pendiente
    return (
        <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
            {s.label}
        </span>
    )
}

function FuenteBadge({ fuente }: { fuente: string }) {
    const map: Record<string, { icon: string; label: string }> = {
        manual: { icon: '✏️', label: 'Manual' },
        pdf: { icon: '📄', label: 'PDF' },
        drive: { icon: '☁️', label: 'Drive' },
        csv: { icon: '📊', label: 'CSV' },
    }
    const s = map[fuente] || map.manual
    return <span style={{ fontSize: 11, color: JA.GREY }}>{s.icon} {s.label}</span>
}

/* ─── Formulario individual de factura ───────────────────── */
function FacturaForm({
    initial, onSave, onCancel, profileId,
}: {
    initial: Partial<Factura>
    onSave: (f: Factura) => void
    onCancel: () => void
    profileId: string
}) {
    const [f, setF] = useState<Partial<Factura>>({ ...facturaVacia(), ...initial })
    const [saving, setSaving] = useState(false)
    const [dianResult, setDianResult] = useState<{ valid_format: boolean; portal_url?: string; message: string } | null>(null)

    const computed = calcular(f)
    const asiento = generarAsiento(f)
    const totalDB = asiento.reduce((a, l) => a + l.debito, 0)
    const totalCR = asiento.reduce((a, l) => a + l.credito, 0)
    const balanced = Math.abs(totalDB - totalCR) < 1

    const set = (k: keyof Factura, v: unknown) => setF(prev => ({ ...prev, [k]: v }))

    async function verifyDian() {
        if (!f.cufe) return
        const res = await fetch('/api/causacion/dian-verify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cufe: f.cufe }),
        })
        const data = await res.json()
        setDianResult(data)
    }

    async function handleSave() {
        if (!f.nombre_tercero || !f.fecha || !f.valor_base) {
            alert('Completa proveedor, fecha y valor base')
            return
        }
        setSaving(true)
        const c = calcular(f)
        const finalF: Factura = {
            ...(c as Factura),
            asiento: generarAsiento(f),
            estado: f.estado || 'pendiente',
            fuente: f.fuente || 'manual',
        }
        try {
            const res = await fetch('/api/causacion/facturas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile_id: profileId, facturas: [finalF] }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            onSave(data.facturas[0])
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    const inputStyle = { width: '100%', padding: '7px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: 6, fontSize: 13, color: JA.TEXT, background: JA.WHITE, boxSizing: 'border-box' as const }
    const labelStyle = { fontSize: 11, fontWeight: 600, color: JA.GREY, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 3, display: 'block' }
    const fieldStyle = { display: 'flex', flexDirection: 'column' as const }

    return (
        <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 10, padding: 24 }}>
            {/* Tipo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {(['compra', 'venta'] as const).map(t => (
                    <button key={t} onClick={() => set('tipo', t)}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: `2px solid ${f.tipo === t ? JA.GOLD : JA.BORDER}`, background: f.tipo === t ? JA.GOLD_LT + '22' : JA.WHITE, color: f.tipo === t ? JA.NAVY : JA.GREY, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                        {t === 'compra' ? '🛒 Compra / Gasto' : '💰 Venta / Ingreso'}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={fieldStyle}>
                    <label style={labelStyle}>N° Factura</label>
                    <input style={inputStyle} value={f.numero_factura || ''} onChange={e => set('numero_factura', e.target.value)} placeholder="FE-0001234" />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Fecha</label>
                    <input type="date" style={inputStyle} value={f.fecha || ''} onChange={e => set('fecha', e.target.value)} />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>NIT Proveedor/Cliente</label>
                    <input style={inputStyle} value={f.nit_tercero || ''} onChange={e => set('nit_tercero', e.target.value)} placeholder="900123456-1" />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Razón Social</label>
                    <input style={inputStyle} value={f.nombre_tercero || ''} onChange={e => set('nombre_tercero', e.target.value)} placeholder="Empresa Proveedora S.A.S." />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Valor Base ($)</label>
                    <input type="number" style={inputStyle} value={f.valor_base || ''} onChange={e => set('valor_base', parseFloat(e.target.value) || 0)} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={fieldStyle}>
                    <label style={labelStyle}>IVA %</label>
                    <select style={inputStyle} value={f.porcentaje_iva || 0} onChange={e => set('porcentaje_iva', parseInt(e.target.value))}>
                        {[0, 5, 19].map(v => <option key={v} value={v}>{v}%</option>)}
                    </select>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Concepto Retefuente</label>
                    <select style={inputStyle} value={f.concepto_retefuente || 'sin_retencion'} onChange={e => set('concepto_retefuente', e.target.value)}>
                        {CONCEPTOS.map(c => <option key={c.id} value={c.id}>{c.label} ({c.tasa}%)</option>)}
                    </select>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Reteiva %</label>
                    <select style={inputStyle} value={f.tasa_reteiva || 0} onChange={e => set('tasa_reteiva', parseFloat(e.target.value))}>
                        {[0, 15, 100].map(v => <option key={v} value={v}>{v}%</option>)}
                    </select>
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Reteica %</label>
                    <input type="number" step="0.01" style={inputStyle} value={f.tasa_reteica || 0} onChange={e => set('tasa_reteica', parseFloat(e.target.value) || 0)} placeholder="0.414" />
                </div>
            </div>

            {/* CUFE */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
                <div style={{ ...fieldStyle, flex: 1 }}>
                    <label style={labelStyle}>CUFE (Código DIAN — opcional)</label>
                    <input style={inputStyle} value={f.cufe || ''} onChange={e => set('cufe', e.target.value)} placeholder="96 caracteres hexadecimales..." />
                </div>
                <button onClick={verifyDian} disabled={!f.cufe}
                    style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${JA.BORDER}`, background: JA.WHITE, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <Shield size={14} /> Verificar DIAN
                </button>
            </div>

            {dianResult && (
                <div style={{ background: dianResult.valid_format ? JA.BLUE_LT : JA.RED_LT, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
                    <p style={{ margin: '0 0 6px', color: dianResult.valid_format ? JA.BLUE : JA.RED, fontWeight: 600 }}>{dianResult.message}</p>
                    {dianResult.portal_url && (
                        <a href={dianResult.portal_url} target="_blank" rel="noopener noreferrer"
                            style={{ color: JA.BLUE, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12 }}>
                            <ExternalLink size={12} /> Verificar en portal DIAN
                        </a>
                    )}
                </div>
            )}

            {/* Resumen calculado */}
            <div style={{ background: JA.BG, borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {[
                        { label: 'Base', value: computed.valor_base || 0 },
                        { label: `IVA ${f.porcentaje_iva}%`, value: computed.valor_iva || 0 },
                        { label: `Retefuente ${computed.tasa_retefuente}%`, value: computed.valor_retefuente || 0 },
                        { label: `Reteiva ${f.tasa_reteiva}%`, value: computed.valor_reteiva || 0 },
                        { label: 'Neto a Pagar', value: computed.valor_neto || 0, highlight: true },
                    ].map(({ label, value, highlight }) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: JA.GREY, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: highlight ? JA.NAVY : JA.TEXT }}>{fmt(value)}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Asiento preview */}
            <details style={{ marginBottom: 16 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: JA.GREY, fontWeight: 600, userSelect: 'none' }}>
                    Ver asiento contable {balanced ? '✅ Balanceado' : '⚠️ Desbalanceado'}
                </summary>
                <table style={{ width: '100%', marginTop: 8, fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: JA.BG }}>
                            {['Cuenta', 'Descripción', 'Débito', 'Crédito'].map(h => (
                                <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600, color: JA.GREY, fontSize: 10 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {asiento.map((l, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${JA.BORDER}` }}>
                                <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: JA.NAVY }}>{l.cuenta}</td>
                                <td style={{ padding: '4px 8px', color: JA.TEXT }}>{l.descripcion}</td>
                                <td style={{ padding: '4px 8px', textAlign: 'right', color: JA.GREEN, fontWeight: l.debito > 0 ? 600 : 400 }}>{l.debito > 0 ? fmtN(l.debito) : ''}</td>
                                <td style={{ padding: '4px 8px', textAlign: 'right', color: JA.BLUE, fontWeight: l.credito > 0 ? 600 : 400 }}>{l.credito > 0 ? fmtN(l.credito) : ''}</td>
                            </tr>
                        ))}
                        <tr style={{ background: JA.BG }}>
                            <td colSpan={2} style={{ padding: '4px 8px', fontWeight: 700, fontSize: 11 }}>TOTALES</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: JA.GREEN }}>{fmtN(totalDB)}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: JA.BLUE }}>{fmtN(totalCR)}</td>
                        </tr>
                    </tbody>
                </table>
            </details>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 6, border: `1px solid ${JA.BORDER}`, background: JA.WHITE, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                <button onClick={handleSave} disabled={saving}
                    style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: JA.NAVY, color: JA.WHITE, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    {saving ? 'Guardando...' : '💾 Causar Factura'}
                </button>
            </div>
        </div>
    )
}

/* ─── Página principal ───────────────────────────────────── */
export default function CausacionPage() {
    const { activeProfile, profile } = useClient()
    const profileId = activeProfile?.id || profile?.id || ''
    const clientName = activeProfile?.company_name || 'Cliente'
    const driveUrl = activeProfile?.drive_invoices_url || ''

    const [tab, setTab] = useState<'bandeja' | 'carga' | 'manual' | 'asientos' | 'drive' | 'guia'>('bandeja')
    const [facturas, setFacturas] = useState<Factura[]>([])
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [showForm, setShowForm] = useState(false)

    // Filtros
    const [fEstado, setFEstado] = useState('')
    const [fTipo, setFTipo] = useState('')
    const [fQ, setFQ] = useState('')
    const [fFrom, setFFrom] = useState('')
    const [fTo, setFTo] = useState('')

    // PDF queue
    const [pdfQueue, setPdfQueue] = useState<PdfQueueItem[]>([])
    const [droppingPdf, setDroppingPdf] = useState(false)
    const [processingPdf, setProcessingPdf] = useState(false)
    const [reviewItems, setReviewItems] = useState<Partial<Factura>[]>([])
    const [savingBatch, setSavingBatch] = useState(false)

    // Drive sync
    const [driveStatus, setDriveStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
    const [driveMessage, setDriveMessage] = useState('')
    const [driveResults, setDriveResults] = useState<Partial<Factura>[]>([])

    const fileInputRef = useRef<HTMLInputElement>(null)

    const loadFacturas = useCallback(async () => {
        if (!profileId) return
        setLoading(true)
        const params = new URLSearchParams({ profile_id: profileId, limit: '200' })
        if (fEstado) params.set('estado', fEstado)
        if (fTipo) params.set('tipo', fTipo)
        if (fQ) params.set('q', fQ)
        if (fFrom) params.set('fecha_from', fFrom)
        if (fTo) params.set('fecha_to', fTo)
        try {
            const res = await fetch(`/api/causacion/facturas?${params}`)
            const data = await res.json()
            if (res.ok) setFacturas(data.facturas || [])
        } finally {
            setLoading(false)
        }
    }, [profileId, fEstado, fTipo, fQ, fFrom, fTo])

    useEffect(() => { loadFacturas() }, [loadFacturas])

    // Estadísticas
    const stats = {
        total: facturas.length,
        pendientes: facturas.filter(f => f.estado === 'pendiente').length,
        causadas: facturas.filter(f => f.estado === 'causado').length,
        contabilizadas: facturas.filter(f => f.estado === 'contabilizado').length,
        valorMes: facturas.filter(f => {
            const mes = new Date().toISOString().slice(0, 7)
            return f.fecha?.startsWith(mes)
        }).reduce((a, f) => a + (f.valor_base || 0), 0),
    }

    /* ── Acciones masivas ── */
    async function bulkEstado(estado: 'causado' | 'contabilizado') {
        const ids = Array.from(selected)
        if (ids.length === 0) return
        const res = await fetch('/api/causacion/facturas', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, profile_id: profileId, estado }),
        })
        if (res.ok) { setSelected(new Set()); loadFacturas() }
    }

    async function bulkDelete() {
        const ids = Array.from(selected)
        if (ids.length === 0 || !confirm(`¿Eliminar ${ids.length} factura(s)?`)) return
        await fetch('/api/causacion/facturas', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, profile_id: profileId }),
        })
        setSelected(new Set()); loadFacturas()
    }

    /* ── PDF upload ── */
    function handleDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault(); setDroppingPdf(false)
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'))
        addToQueue(files)
    }

    function addToQueue(files: File[]) {
        setPdfQueue(prev => [...prev, ...files.map(f => ({ file: f, status: 'pending' as const }))])
    }

    async function processPdfQueue() {
        const pending = pdfQueue.filter(i => i.status === 'pending')
        if (pending.length === 0) return
        setProcessingPdf(true)

        const formData = new FormData()
        pending.forEach(item => formData.append('files', item.file))

        setPdfQueue(prev => prev.map(i => i.status === 'pending' ? { ...i, status: 'processing' } : i))

        try {
            const res = await fetch('/api/causacion/extract-pdf', { method: 'POST', body: formData })
            const data = await res.json()
            const results: { filename: string; ok: boolean; data?: Partial<Factura>; error?: string }[] = data.results || []

            setPdfQueue(prev => prev.map(item => {
                const r = results.find(x => x.filename === item.file.name)
                if (!r) return item
                return { ...item, status: r.ok ? 'done' : 'error', data: r.data, error: r.error }
            }))

            const extracted = results.filter(r => r.ok && r.data).map(r => {
                const base: Partial<Factura> = { ...facturaVacia(), ...r.data, fuente: 'pdf' }
                return calcular(base)
            })
            setReviewItems(prev => [...prev, ...extracted])
        } finally {
            setProcessingPdf(false)
        }
    }

    function updateReviewItem(idx: number, patch: Partial<Factura>) {
        setReviewItems(prev => prev.map((item, i) => i === idx ? { ...calcular({ ...item, ...patch }) } : item))
    }

    async function saveReviewItems() {
        if (reviewItems.length === 0) return
        setSavingBatch(true)
        const rows = reviewItems.map(item => ({
            ...calcular(item),
            asiento: generarAsiento(item),
            profile_id: profileId,
        }))
        try {
            const res = await fetch('/api/causacion/facturas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile_id: profileId, facturas: rows }),
            })
            if (res.ok) {
                setReviewItems([])
                setPdfQueue([])
                loadFacturas()
                setTab('bandeja')
            }
        } finally {
            setSavingBatch(false)
        }
    }

    /* ── Drive sync ── */
    async function syncDrive() {
        if (!driveUrl) { setDriveMessage('Configura la URL de carpeta Drive en tu perfil primero.'); return }
        setDriveStatus('syncing'); setDriveMessage('')
        try {
            const res = await fetch('/api/causacion/drive-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_url: driveUrl }),
            })
            const data = await res.json()
            if (data.setup_required) {
                setDriveStatus('error')
                setDriveMessage('La cuenta de servicio Google no está configurada. Ver instrucciones abajo.')
                return
            }
            if (!res.ok) throw new Error(data.error)
            const extracted = (data.results || []).filter((r: { ok: boolean }) => r.ok).map((r: { data: Partial<Factura> }) => {
                const base: Partial<Factura> = { ...facturaVacia(), ...r.data, fuente: 'drive' }
                return calcular(base)
            })
            setDriveResults(extracted)
            setDriveStatus('done')
            setDriveMessage(`${extracted.length} facturas extraídas de ${data.total_files} archivos PDF en Drive.`)
        } catch (err) {
            setDriveStatus('error')
            setDriveMessage(err instanceof Error ? err.message : 'Error al conectar con Drive')
        }
    }

    async function saveDriveResults() {
        if (driveResults.length === 0) return
        setSavingBatch(true)
        const rows = driveResults.map(item => ({ ...calcular(item), asiento: generarAsiento(item) }))
        const res = await fetch('/api/causacion/facturas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile_id: profileId, facturas: rows }),
        })
        if (res.ok) { setDriveResults([]); loadFacturas(); setTab('bandeja') }
        setSavingBatch(false)
    }

    /* ── Exportar asientos CSV ── */
    function exportAsientos() {
        const rows = [['Fecha', 'N° Factura', 'Proveedor', 'Cuenta', 'Descripcion', 'Debito', 'Credito']]
        facturas.filter(f => selected.size === 0 || selected.has(f.id!)).forEach(f => {
            (f.asiento || []).forEach(l => {
                rows.push([f.fecha || '', f.numero_factura || '', f.nombre_tercero || '', l.cuenta, l.descripcion, String(l.debito), String(l.credito)])
            })
        })
        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `asientos_${clientName}_${new Date().toISOString().slice(0, 10)}.csv`
        a.click(); URL.revokeObjectURL(url)
    }

    /* ── Estilos comunes ── */
    const tabBtn = (active: boolean) => ({
        padding: '8px 16px', borderRadius: 6, border: 'none',
        background: active ? JA.NAVY : 'transparent',
        color: active ? JA.WHITE : JA.GREY,
        cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
        display: 'flex', alignItems: 'center', gap: 6,
    })

    const TABS = [
        { id: 'bandeja', label: 'Bandeja', icon: <History size={14} /> },
        { id: 'carga', label: 'Cargar PDFs', icon: <Upload size={14} /> },
        { id: 'manual', label: 'Manual', icon: <Plus size={14} /> },
        { id: 'asientos', label: 'Asientos', icon: <FileText size={14} /> },
        { id: 'drive', label: 'Drive Sync', icon: <FolderOpen size={14} /> },
        { id: 'guia', label: 'Guía de Uso', icon: <BookOpen size={14} /> },
    ] as const

    return (
        <div style={{ padding: '0 0 40px', maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <div style={{ background: JA.NAVY, borderRadius: '0 0 12px 12px', padding: '20px 24px 24px', marginBottom: 24, color: JA.WHITE }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>⚡ Causación de Facturas</h1>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: JA.GOLD_LT, opacity: 0.9 }}>
                            {clientName} · Automatización masiva · DIAN verificado
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {[
                            { label: 'Total', value: stats.total, color: JA.WHITE },
                            { label: 'Pendientes', value: stats.pendientes, color: '#FCD34D' },
                            { label: 'Causadas', value: stats.causadas, color: '#6EE7B7' },
                            { label: 'Base mes', value: fmt(stats.valorMes), color: JA.GOLD_LT },
                        ].map(({ label, value, color }) => (
                            <div key={label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: JA.BG, borderRadius: 8, padding: 4, border: `1px solid ${JA.BORDER}` }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={tabBtn(tab === t.id)}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ─── TAB: BANDEJA ─────────────────────────── */}
            {tab === 'bandeja' && (
                <div>
                    {/* Filtros */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${JA.BORDER}`, borderRadius: 6, padding: '0 10px', background: JA.WHITE }}>
                            <Search size={13} color={JA.GREY} />
                            <input placeholder="Buscar proveedor, NIT, N° factura..." value={fQ} onChange={e => setFQ(e.target.value)}
                                style={{ border: 'none', outline: 'none', fontSize: 13, padding: '7px 0', width: 220, color: JA.TEXT }} />
                        </div>
                        <select value={fEstado} onChange={e => setFEstado(e.target.value)}
                            style={{ padding: '7px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: 6, fontSize: 13, color: JA.TEXT, background: JA.WHITE }}>
                            <option value="">Todos los estados</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="causado">Causado</option>
                            <option value="contabilizado">Contabilizado</option>
                        </select>
                        <select value={fTipo} onChange={e => setFTipo(e.target.value)}
                            style={{ padding: '7px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: 6, fontSize: 13, color: JA.TEXT, background: JA.WHITE }}>
                            <option value="">Compras + Ventas</option>
                            <option value="compra">Solo Compras</option>
                            <option value="venta">Solo Ventas</option>
                        </select>
                        <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)}
                            style={{ padding: '7px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: 6, fontSize: 13, color: JA.TEXT, background: JA.WHITE }} />
                        <input type="date" value={fTo} onChange={e => setFTo(e.target.value)}
                            style={{ padding: '7px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: 6, fontSize: 13, color: JA.TEXT, background: JA.WHITE }} />
                        <button onClick={loadFacturas} style={{ padding: '7px 12px', borderRadius: 6, border: `1px solid ${JA.BORDER}`, background: JA.WHITE, cursor: 'pointer' }}>
                            <RefreshCw size={14} color={JA.GREY} />
                        </button>
                        <button onClick={() => { setFEstado(''); setFTipo(''); setFQ(''); setFFrom(''); setFTo('') }}
                            style={{ padding: '7px 12px', borderRadius: 6, border: `1px solid ${JA.BORDER}`, background: JA.WHITE, cursor: 'pointer', fontSize: 12, color: JA.GREY }}>
                            Limpiar
                        </button>
                    </div>

                    {/* Acciones masivas */}
                    {selected.size > 0 && (
                        <div style={{ background: JA.BLUE_LT, border: `1px solid ${JA.BLUE}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: JA.BLUE }}>{selected.size} seleccionadas</span>
                            <button onClick={() => bulkEstado('causado')}
                                style={{ padding: '5px 12px', borderRadius: 5, border: 'none', background: JA.BLUE, color: JA.WHITE, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                <Check size={12} style={{ display: 'inline', marginRight: 4 }} /> Marcar Causadas
                            </button>
                            <button onClick={() => bulkEstado('contabilizado')}
                                style={{ padding: '5px 12px', borderRadius: 5, border: 'none', background: JA.GREEN, color: JA.WHITE, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                ✓✓ Contabilizadas
                            </button>
                            <button onClick={exportAsientos}
                                style={{ padding: '5px 12px', borderRadius: 5, border: 'none', background: JA.GOLD, color: JA.WHITE, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                <Download size={12} style={{ display: 'inline', marginRight: 4 }} /> Exportar Asientos
                            </button>
                            <button onClick={bulkDelete}
                                style={{ padding: '5px 12px', borderRadius: 5, border: 'none', background: JA.RED, color: JA.WHITE, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                <Trash2 size={12} style={{ display: 'inline', marginRight: 4 }} /> Eliminar
                            </button>
                            <button onClick={() => setSelected(new Set())}
                                style={{ padding: '5px 12px', borderRadius: 5, border: `1px solid ${JA.BORDER}`, background: JA.WHITE, cursor: 'pointer', fontSize: 12 }}>
                                Deseleccionar
                            </button>
                        </div>
                    )}

                    {/* Tabla */}
                    <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                        {loading ? (
                            <div style={{ padding: 40, textAlign: 'center', color: JA.GREY }}>
                                <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Cargando...
                            </div>
                        ) : facturas.length === 0 ? (
                            <div style={{ padding: 60, textAlign: 'center' }}>
                                <FileText size={40} color={JA.GREY_LT} style={{ display: 'block', margin: '0 auto 12px' }} />
                                <p style={{ color: JA.GREY, margin: 0, fontSize: 14 }}>No hay facturas registradas para {clientName}.</p>
                                <p style={{ color: JA.GREY_LT, margin: '8px 0 0', fontSize: 13 }}>Carga PDFs, sincroniza Drive o registra manualmente.</p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: JA.BG, borderBottom: `2px solid ${JA.BORDER}` }}>
                                        <th style={{ padding: '10px 12px', width: 32 }}>
                                            <input type="checkbox"
                                                checked={selected.size === facturas.length && facturas.length > 0}
                                                onChange={e => setSelected(e.target.checked ? new Set(facturas.map(f => f.id!)) : new Set())} />
                                        </th>
                                        {['Fecha', 'N° Factura', 'Proveedor / NIT', 'Tipo', 'Base', 'IVA', 'Rete', 'Neto', 'Estado', 'Fuente', 'DIAN'].map(h => (
                                            <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {facturas.map(f => (
                                        <tr key={f.id} style={{ borderBottom: `1px solid ${JA.BORDER}`, background: selected.has(f.id!) ? JA.BLUE_LT : JA.WHITE }}
                                            onMouseEnter={e => { if (!selected.has(f.id!)) (e.currentTarget as HTMLTableRowElement).style.background = JA.BG }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = selected.has(f.id!) ? JA.BLUE_LT : JA.WHITE }}>
                                            <td style={{ padding: '10px 12px' }}>
                                                <input type="checkbox" checked={selected.has(f.id!)}
                                                    onChange={e => {
                                                        const s = new Set(selected)
                                                        e.target.checked ? s.add(f.id!) : s.delete(f.id!)
                                                        setSelected(s)
                                                    }} />
                                            </td>
                                            <td style={{ padding: '10px 8px', fontSize: 12, color: JA.TEXT, whiteSpace: 'nowrap' }}>{f.fecha || '—'}</td>
                                            <td style={{ padding: '10px 8px', fontSize: 12, fontFamily: 'monospace', color: JA.NAVY }}>{f.numero_factura || '—'}</td>
                                            <td style={{ padding: '10px 8px', fontSize: 12 }}>
                                                <div style={{ fontWeight: 600, color: JA.TEXT }}>{f.nombre_tercero || '—'}</div>
                                                <div style={{ fontSize: 11, color: JA.GREY }}>{f.nit_tercero}</div>
                                            </td>
                                            <td style={{ padding: '10px 8px' }}>
                                                <span style={{ background: f.tipo === 'compra' ? JA.PURPLE_LT : JA.GREEN_LT, color: f.tipo === 'compra' ? JA.PURPLE : JA.GREEN, borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                                                    {f.tipo === 'compra' ? '🛒' : '💰'} {f.tipo}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 8px', fontSize: 12, textAlign: 'right', fontWeight: 600 }}>{fmt(f.valor_base || 0)}</td>
                                            <td style={{ padding: '10px 8px', fontSize: 12, textAlign: 'right', color: JA.GOLD }}>{fmt(f.valor_iva || 0)}</td>
                                            <td style={{ padding: '10px 8px', fontSize: 12, textAlign: 'right', color: JA.RED }}>{fmt((f.valor_retefuente || 0) + (f.valor_reteiva || 0) + (f.valor_reteica || 0))}</td>
                                            <td style={{ padding: '10px 8px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: JA.NAVY }}>{fmt(f.valor_neto || 0)}</td>
                                            <td style={{ padding: '10px 8px' }}><EstadoBadge estado={f.estado} /></td>
                                            <td style={{ padding: '10px 8px' }}><FuenteBadge fuente={f.fuente} /></td>
                                            <td style={{ padding: '10px 8px' }}>
                                                {f.cufe ? (
                                                    <a href={`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${f.cufe}`}
                                                        target="_blank" rel="noopener noreferrer"
                                                        style={{ color: JA.BLUE, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                                                        <ExternalLink size={11} /> DIAN
                                                    </a>
                                                ) : <span style={{ color: JA.GREY_LT, fontSize: 11 }}>—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: JA.GREY }}>{facturas.length} factura(s) · {clientName}</span>
                        <button onClick={exportAsientos}
                            style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${JA.BORDER}`, background: JA.WHITE, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Download size={13} /> Exportar todos los asientos
                        </button>
                    </div>
                </div>
            )}

            {/* ─── TAB: CARGA PDF ───────────────────────── */}
            {tab === 'carga' && (
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: JA.NAVY, margin: '0 0 16px' }}>
                        📄 Carga masiva de facturas en PDF
                    </h2>

                    {/* Drop zone */}
                    <div
                        onDragOver={e => { e.preventDefault(); setDroppingPdf(true) }}
                        onDragLeave={() => setDroppingPdf(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${droppingPdf ? JA.GOLD : JA.BORDER}`,
                            borderRadius: 12, padding: 40, textAlign: 'center',
                            background: droppingPdf ? JA.GOLD_LT + '11' : JA.BG,
                            cursor: 'pointer', marginBottom: 16, transition: 'all 0.15s',
                        }}>
                        <Upload size={32} color={droppingPdf ? JA.GOLD : JA.GREY_LT} style={{ display: 'block', margin: '0 auto 12px' }} />
                        <p style={{ margin: 0, fontWeight: 600, color: JA.TEXT, fontSize: 15 }}>
                            Arrastra facturas PDF aquí o haz clic para seleccionar
                        </p>
                        <p style={{ margin: '6px 0 0', color: JA.GREY, fontSize: 13 }}>
                            Acepta facturas electrónicas DIAN · Hasta 50 archivos a la vez · La IA extrae NIT, fecha, valores e IVA automáticamente
                        </p>
                        <input ref={fileInputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
                            onChange={e => addToQueue(Array.from(e.target.files || []))} />
                    </div>

                    {/* Cola de PDFs */}
                    {pdfQueue.length > 0 && (
                        <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                            <div style={{ padding: '12px 16px', background: JA.BG, borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: JA.NAVY }}>{pdfQueue.length} archivo(s) en cola</span>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={processPdfQueue} disabled={processingPdf || pdfQueue.every(i => i.status !== 'pending')}
                                        style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: JA.NAVY, color: JA.WHITE, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                                        {processingPdf ? <><RefreshCw size={12} style={{ display: 'inline', marginRight: 4 }} />Procesando...</> : <><Zap size={12} style={{ display: 'inline', marginRight: 4 }} />Extraer datos</>}
                                    </button>
                                    <button onClick={() => { setPdfQueue([]); setReviewItems([]) }}
                                        style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${JA.BORDER}`, background: JA.WHITE, cursor: 'pointer', fontSize: 12 }}>
                                        <X size={13} style={{ display: 'inline' }} />
                                    </button>
                                </div>
                            </div>
                            {pdfQueue.map((item, i) => (
                                <div key={i} style={{ padding: '10px 16px', borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <FileText size={16} color={JA.GREY} />
                                    <span style={{ flex: 1, fontSize: 13, color: JA.TEXT }}>{item.file.name}</span>
                                    <span style={{ fontSize: 11, color: JA.GREY }}>{(item.file.size / 1024).toFixed(0)} KB</span>
                                    {item.status === 'pending' && <Clock size={14} color={JA.GREY_LT} />}
                                    {item.status === 'processing' && <RefreshCw size={14} color={JA.GOLD} />}
                                    {item.status === 'done' && <CheckCircle2 size={14} color={JA.GREEN} />}
                                    {item.status === 'error' && (
                                        <span style={{ color: JA.RED, fontSize: 11 }}>
                                            <AlertCircle size={12} style={{ display: 'inline', marginRight: 2 }} />{item.error}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Revisión antes de guardar */}
                    {reviewItems.length > 0 && (
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: JA.NAVY, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Eye size={16} /> Revisar y ajustar datos extraídos ({reviewItems.length} facturas)
                            </h3>
                            <p style={{ fontSize: 13, color: JA.GREY, margin: '0 0 12px' }}>
                                Verifica cada factura. El sistema extrae automáticamente los datos de las facturas electrónicas DIAN.
                                Ajusta el concepto de retefuente antes de guardar.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {reviewItems.map((item, idx) => {
                                    const c = calcular(item)
                                    return (
                                        <div key={idx} style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 10, padding: 16 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <span style={{ fontWeight: 600, fontSize: 13, color: JA.NAVY }}>
                                                    📄 {item.archivo_nombre} — {item.nombre_tercero || 'Sin nombre'}
                                                </span>
                                                <button onClick={() => setReviewItems(prev => prev.filter((_, i) => i !== idx))}
                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: JA.RED }}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                                <div>
                                                    <div style={{ fontSize: 10, color: JA.GREY, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>N° Factura</div>
                                                    <input value={item.numero_factura || ''} onChange={e => updateReviewItem(idx, { numero_factura: e.target.value })}
                                                        style={{ width: '100%', padding: '5px 8px', border: `1px solid ${JA.BORDER}`, borderRadius: 5, fontSize: 12, boxSizing: 'border-box' }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, color: JA.GREY, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Fecha</div>
                                                    <input type="date" value={item.fecha || ''} onChange={e => updateReviewItem(idx, { fecha: e.target.value })}
                                                        style={{ width: '100%', padding: '5px 8px', border: `1px solid ${JA.BORDER}`, borderRadius: 5, fontSize: 12, boxSizing: 'border-box' }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, color: JA.GREY, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>NIT</div>
                                                    <input value={item.nit_tercero || ''} onChange={e => updateReviewItem(idx, { nit_tercero: e.target.value })}
                                                        style={{ width: '100%', padding: '5px 8px', border: `1px solid ${JA.BORDER}`, borderRadius: 5, fontSize: 12, boxSizing: 'border-box' }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, color: JA.GREY, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Concepto Rete</div>
                                                    <select value={item.concepto_retefuente || 'sin_retencion'} onChange={e => updateReviewItem(idx, { concepto_retefuente: e.target.value })}
                                                        style={{ width: '100%', padding: '5px 8px', border: `1px solid ${JA.BORDER}`, borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }}>
                                                        {CONCEPTOS.map(co => <option key={co.id} value={co.id}>{co.label}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 16, marginTop: 10, padding: '8px 0 0', borderTop: `1px solid ${JA.BORDER}`, fontSize: 12 }}>
                                                <span>Base: <strong>{fmt(item.valor_base || 0)}</strong></span>
                                                <span>IVA {item.porcentaje_iva}%: <strong>{fmt(c.valor_iva || 0)}</strong></span>
                                                <span>Retefuente: <strong style={{ color: JA.RED }}>{fmt(c.valor_retefuente || 0)}</strong></span>
                                                <span>Neto a pagar: <strong style={{ color: JA.NAVY }}>{fmt(c.valor_neto || 0)}</strong></span>
                                                {item.cufe && (
                                                    <a href={`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${item.cufe}`}
                                                        target="_blank" rel="noopener noreferrer"
                                                        style={{ marginLeft: 'auto', color: JA.BLUE, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                                                        <Shield size={11} /> Ver DIAN
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button onClick={() => setReviewItems([])}
                                    style={{ padding: '9px 18px', borderRadius: 6, border: `1px solid ${JA.BORDER}`, background: JA.WHITE, cursor: 'pointer', fontSize: 13 }}>
                                    Cancelar
                                </button>
                                <button onClick={saveReviewItems} disabled={savingBatch}
                                    style={{ padding: '9px 18px', borderRadius: 6, border: 'none', background: JA.GREEN, color: JA.WHITE, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                                    {savingBatch ? 'Guardando...' : `💾 Causar ${reviewItems.length} facturas`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── TAB: MANUAL ──────────────────────────── */}
            {tab === 'manual' && (
                <div>
                    {showForm ? (
                        <FacturaForm
                            initial={facturaVacia()}
                            profileId={profileId}
                            onSave={() => { setShowForm(false); loadFacturas() }}
                            onCancel={() => setShowForm(false)}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <Plus size={40} color={JA.GREY_LT} style={{ display: 'block', margin: '0 auto 12px' }} />
                            <p style={{ color: JA.GREY, margin: '0 0 16px' }}>Registra una factura de compra o venta manualmente</p>
                            <button onClick={() => setShowForm(true)}
                                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: JA.NAVY, color: JA.WHITE, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                                + Registrar Factura
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ─── TAB: ASIENTOS ────────────────────────── */}
            {tab === 'asientos' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: JA.NAVY }}>📋 Asientos contables generados</h2>
                        <button onClick={exportAsientos}
                            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: JA.GOLD, color: JA.WHITE, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Download size={14} /> Exportar CSV
                        </button>
                    </div>
                    {facturas.filter(f => f.asiento && f.asiento.length > 0).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: JA.GREY }}>
                            No hay asientos generados aún. Registra facturas para ver los asientos.
                        </div>
                    ) : (
                        facturas.filter(f => f.asiento && f.asiento.length > 0).map(f => (
                            <div key={f.id} style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
                                <div style={{ padding: '10px 16px', background: JA.BG, borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: JA.NAVY }}>{f.numero_factura || 'Sin número'}</span>
                                    <span style={{ fontSize: 12, color: JA.GREY }}>{f.fecha}</span>
                                    <span style={{ fontSize: 12, color: JA.TEXT }}>{f.nombre_tercero}</span>
                                    <EstadoBadge estado={f.estado} />
                                    <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: JA.NAVY }}>Neto: {fmt(f.valor_neto || 0)}</span>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <tbody>
                                        {(f.asiento || []).map((l, i) => (
                                            <tr key={i} style={{ borderBottom: `1px solid ${JA.BORDER}` }}>
                                                <td style={{ padding: '6px 16px', fontFamily: 'monospace', color: JA.NAVY, fontWeight: 600, width: 90 }}>{l.cuenta}</td>
                                                <td style={{ padding: '6px 16px', color: JA.TEXT, flex: 1 }}>{l.descripcion}</td>
                                                <td style={{ padding: '6px 16px', textAlign: 'right', color: JA.GREEN, fontWeight: l.debito > 0 ? 600 : 400, width: 120 }}>{l.debito > 0 ? fmtN(l.debito) : ''}</td>
                                                <td style={{ padding: '6px 16px', textAlign: 'right', color: JA.BLUE, fontWeight: l.credito > 0 ? 600 : 400, width: 120 }}>{l.credito > 0 ? fmtN(l.credito) : ''}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ─── TAB: DRIVE SYNC ──────────────────────── */}
            {tab === 'drive' && (
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: JA.NAVY, margin: '0 0 8px' }}>☁️ Sincronización con Google Drive</h2>
                    <p style={{ fontSize: 13, color: JA.GREY, margin: '0 0 20px' }}>
                        Conecta la carpeta Drive del cliente donde llegan sus facturas de proveedor. El sistema las descarga y extrae los datos automáticamente.
                    </p>

                    {/* Estado de la carpeta configurada */}
                    <div style={{ background: driveUrl ? JA.GREEN_LT : JA.YELLOW_LT, border: `1px solid ${driveUrl ? JA.GREEN : JA.YELLOW}`, borderRadius: 8, padding: 12, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        {driveUrl ? <CheckCircle2 size={18} color={JA.GREEN} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={18} color={JA.YELLOW} style={{ flexShrink: 0, marginTop: 1 }} />}
                        <div>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: driveUrl ? JA.GREEN : JA.YELLOW }}>
                                {driveUrl ? 'Carpeta Drive configurada' : 'Sin carpeta Drive configurada'}
                            </p>
                            {driveUrl ? (
                                <a href={driveUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: JA.BLUE, wordBreak: 'break-all' }}>{driveUrl}</a>
                            ) : (
                                <p style={{ margin: '4px 0 0', fontSize: 12, color: JA.GREY }}>
                                    Configura la URL de la carpeta en el perfil del cliente (Panel Firma → Editar cliente → URL Carpeta Drive).
                                </p>
                            )}
                        </div>
                    </div>

                    <button onClick={syncDrive} disabled={driveStatus === 'syncing' || !driveUrl}
                        style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: driveUrl ? JA.NAVY : JA.GREY_LT, color: JA.WHITE, cursor: driveUrl ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        {driveStatus === 'syncing' ? <><RefreshCw size={16} /> Sincronizando Drive...</> : <><FolderOpen size={16} /> Sincronizar carpeta Drive</>}
                    </button>

                    {driveMessage && (
                        <div style={{ background: driveStatus === 'error' ? JA.RED_LT : JA.BLUE_LT, border: `1px solid ${driveStatus === 'error' ? JA.RED : JA.BLUE}`, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: driveStatus === 'error' ? JA.RED : JA.BLUE }}>
                            {driveMessage}
                        </div>
                    )}

                    {driveResults.length > 0 && (
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: JA.NAVY, margin: '0 0 12px' }}>{driveResults.length} facturas listas para causar</h3>
                            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead>
                                        <tr style={{ background: JA.BG }}>
                                            {['Archivo', 'N° Factura', 'Proveedor', 'Fecha', 'Base', 'IVA', 'Neto'].map(h => (
                                                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: JA.GREY }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {driveResults.map((item, i) => {
                                            const c = calcular(item)
                                            return (
                                                <tr key={i} style={{ borderBottom: `1px solid ${JA.BORDER}` }}>
                                                    <td style={{ padding: '8px 10px', color: JA.GREY }}>{item.archivo_nombre}</td>
                                                    <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{item.numero_factura || '—'}</td>
                                                    <td style={{ padding: '8px 10px' }}>{item.nombre_tercero || '—'}</td>
                                                    <td style={{ padding: '8px 10px' }}>{item.fecha || '—'}</td>
                                                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{fmt(item.valor_base || 0)}</td>
                                                    <td style={{ padding: '8px 10px' }}>{fmt(c.valor_iva || 0)}</td>
                                                    <td style={{ padding: '8px 10px', fontWeight: 700, color: JA.NAVY }}>{fmt(c.valor_neto || 0)}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={saveDriveResults} disabled={savingBatch}
                                    style={{ padding: '9px 20px', borderRadius: 6, border: 'none', background: JA.GREEN, color: JA.WHITE, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                                    {savingBatch ? 'Guardando...' : `💾 Causar ${driveResults.length} facturas de Drive`}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Instrucciones de configuración */}
                    <div style={{ marginTop: 24, background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 10, padding: 20 }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: JA.NAVY }}>⚙️ Configuración de Drive API</h3>
                        <p style={{ fontSize: 13, color: JA.GREY, margin: '0 0 8px' }}>Para sincronizar automáticamente con Drive, un administrador debe:</p>
                        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: JA.TEXT, lineHeight: 1.8 }}>
                            <li>Ir a <strong>Google Cloud Console</strong> → Crear proyecto → Habilitar Drive API</li>
                            <li>Crear una <strong>Cuenta de Servicio</strong> → Descargar clave JSON</li>
                            <li>En el servidor (cPanel), agregar variable de entorno: <code style={{ background: JA.BG, padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>GOOGLE_SERVICE_ACCOUNT_KEY_JSON</code> con el contenido del JSON</li>
                            <li><strong>Compartir la carpeta de Drive</strong> del cliente con el email de la cuenta de servicio (ej: <code style={{ background: JA.BG, padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>mi-cuenta@proyecto.iam.gserviceaccount.com</code>)</li>
                            <li>En el perfil del cliente, ingresar la URL de la carpeta Drive</li>
                        </ol>
                    </div>
                </div>
            )}

            {/* ─── TAB: GUÍA DE USO ─────────────────────── */}
            {tab === 'guia' && (
                <div>
                    <div style={{ background: `linear-gradient(135deg, ${JA.NAVY} 0%, #1e3a5f 100%)`, borderRadius: 12, padding: 28, color: JA.WHITE, marginBottom: 24 }}>
                        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>📘 Guía práctica: Causación masiva de facturas</h2>
                        <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>
                            Cómo un contador colombiano puede procesar 100 facturas en minutos con este módulo.
                        </p>
                    </div>

                    {[
                        {
                            titulo: '¿Qué es la causación y por qué hacerla bien?',
                            icono: '📌',
                            contenido: `La causación es el registro contable de una factura en el momento en que se genera la obligación económica, independientemente del pago (principio de devengado — NIIF).

Una causación correcta incluye:
• Débito a la cuenta de gasto o activo (PUC 5xxx o 1xxx)
• Débito al IVA descontable (240801) si aplica
• Crédito a proveedores (220501xx) por el valor bruto
• Crédito a retefuente (2365xx) si el proveedor está sujeto a retención
• Crédito a reteiva (236701) si aplica
• Crédito a reteica (236801) si el municipio tiene esta retención

El saldo neto que pagas al proveedor = Base + IVA − Retefuente − Reteiva − Reteica.`,
                        },
                        {
                            titulo: 'Flujo recomendado para el contador',
                            icono: '🔄',
                            contenido: `Flujo mensual con este módulo (ejemplo: 80 facturas de un cliente):

SEMANA 1-4 (durante el mes):
1. El cliente sube sus facturas PDF a la carpeta Drive compartida
2. Cada vez que quieras procesar, entra al módulo y usa "Drive Sync" o "Cargar PDFs"
3. El sistema extrae NIT, fecha, base, IVA y CUFE automáticamente
4. Tú solo verificas el concepto de retefuente y ajustas lo necesario
5. Haz clic en "Causar X facturas" → quedan en estado Pendiente

AL CIERRE DEL MES:
6. Filtra por estado "Pendiente" en la Bandeja
7. Selecciona todas → "Marcar Causadas"
8. Exporta los asientos CSV para importar a tu software contable (Siigo, Helisa, etc.)
9. Marca como "Contabilizadas"

RESULTADO: 80 facturas procesadas en ~30 minutos, no en 2 días.`,
                        },
                        {
                            titulo: 'Retefuente 2025: cuándo y cuánto retener',
                            icono: '💰',
                            contenido: `La retención en la fuente la aplicas TÚ como empresa compradora (agente retenedor) al pagar al proveedor.

Reglas clave:
• Solo retienes si el proveedor NO está en régimen simple de tributación
• Solo retienes si el pago supera la base mínima en UVT (UVT 2025: $49.799)
• La base mínima en compras generales es 27 UVT = $1.344.573

Conceptos más comunes:
┌─────────────────────────┬────────┬──────────────┐
│ Concepto                │ Tasa   │ Base mínima  │
├─────────────────────────┼────────┼──────────────┤
│ Honorarios persona nat. │ 10%    │ Sin base min │
│ Honorarios persona jur. │ 11%    │ Sin base min │
│ Servicios generales     │ 4%     │ 4 UVT        │
│ Compras de bienes       │ 2.5%   │ 27 UVT       │
│ Arrendamiento inmueble  │ 3.5%   │ Sin base min │
│ Comisiones              │ 11%    │ Sin base min │
└─────────────────────────┴────────┴──────────────┘

El módulo calcula automáticamente si aplica la base mínima.`,
                        },
                        {
                            titulo: 'Verificación con la DIAN',
                            icono: '🛡️',
                            contenido: `Todas las facturas electrónicas colombianas tienen un CUFE (Código Único de Factura Electrónica), un hash de 96 caracteres hexadecimales generado por la DIAN.

¿Para qué sirve verificar el CUFE?
• Confirmar que la factura fue validada por la DIAN (no es falsa)
• Verificar que los datos (NIT, valor, fecha) coinciden con lo registrado
• Protegerte como contador si en una auditoría cuestionan la factura

Cómo verificar en este módulo:
1. Al registrar una factura manualmente, ingresa el CUFE en el campo correspondiente
2. Haz clic en "Verificar DIAN" → el sistema valida el formato y genera el enlace
3. Haz clic en "Ver en portal DIAN" para confirmar la factura en el sistema oficial
4. En la Bandeja, las facturas con CUFE muestran el enlace directo a DIAN

Las facturas cargadas por PDF: si el PDF contiene el CUFE, el sistema lo extrae automáticamente.`,
                        },
                        {
                            titulo: 'Aislamiento de datos por cliente',
                            icono: '🔒',
                            contenido: `Cada factura que registras queda vinculada únicamente al cliente activo en ese momento.

Cómo funciona:
• Cuando cambias de cliente en el selector (barra superior del dashboard), el módulo recarga automáticamente solo las facturas de ese cliente
• Los datos de la Empresa A nunca aparecen en la Empresa B
• El contador ve todos sus clientes, pero los datos son 100% independientes
• Todos los registros se almacenan en la base de datos con el ID del cliente, no en tu navegador

Buenas prácticas:
• Antes de cargar PDFs, confirma qué cliente está seleccionado (aparece en el header del módulo)
• Si trabajas con varios clientes al tiempo, abre pestañas separadas del navegador
• Usa el filtro de fechas para separar períodos contables`,
                        },
                        {
                            titulo: 'Exportar e importar a software contable',
                            icono: '📤',
                            contenido: `El módulo genera asientos compatibles con los principales software colombianos.

Exportación CSV de asientos:
• Ve a la pestaña "Asientos" o selecciona facturas en la Bandeja → "Exportar Asientos"
• El CSV incluye: Fecha, N° Factura, Proveedor, Cuenta PUC, Débito, Crédito
• Compatible con Siigo (importación de comprobantes), Helisa (plantilla estándar), World Office

Flujo de importación en Siigo:
1. Descarga el CSV del módulo
2. En Siigo: Contabilidad → Importar Comprobantes
3. Mapea las columnas (Cuenta, Débito, Crédito, Fecha)
4. Valida y aprueba

Siigo URL directa: Si configuraste la URL de Siigo en el perfil del cliente, puedes acceder desde la barra de herramientas del dashboard (enlace rápido).`,
                        },
                    ].map(({ titulo, icono, contenido }) => (
                        <details key={titulo} style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                            <summary style={{ padding: '14px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: JA.NAVY, display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none', listStyle: 'none' }}>
                                <span style={{ fontSize: 18 }}>{icono}</span> {titulo}
                                <ChevronRight size={16} color={JA.GREY_LT} style={{ marginLeft: 'auto' }} />
                            </summary>
                            <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${JA.BORDER}` }}>
                                <pre style={{ margin: '16px 0 0', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, color: JA.TEXT, lineHeight: 1.7 }}>{contenido}</pre>
                            </div>
                        </details>
                    ))}

                    <div style={{ background: JA.GOLD_LT + '22', border: `1px solid ${JA.GOLD}`, borderRadius: 10, padding: 16, marginTop: 20 }}>
                        <p style={{ margin: 0, fontSize: 13, color: JA.NAVY }}>
                            <strong>💡 Tip profesional:</strong> Establece con cada cliente una carpeta Drive compartida dedicada exclusivamente a facturas de proveedores del mes. Pídeles que suban las facturas electrónicas (PDF de la DIAN) directamente ahí. Al final del mes, un solo clic en "Sincronizar Drive" procesa todo el lote sin que tengas que descargar ningún archivo manualmente.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
