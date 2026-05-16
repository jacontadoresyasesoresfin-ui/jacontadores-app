'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, CheckCircle, XCircle, Building2, User, RefreshCw, Copy,
         ExternalLink, ChevronDown, ChevronUp, Clock, FileDown, Layers, Hash, AlertCircle,
         BookOpen, MapPin, Briefcase, Award } from 'lucide-react'

const JA = {
    NAVY: '#13213C', GOLD: '#B8960C', GOLD_PALE: '#F5E9C0',
    TEXT: '#1C2B45', GREY: '#4B5563', GREY_LT: '#9CA3AF',
    BORDER: '#E5E7EB', BG: '#F8FAFC',
    GREEN: '#10B981', RED: '#EF4444', ORANGE: '#F59E0B', TEAL: '#0D9488',
} as const

const CARD: React.CSSProperties = {
    background: '#FFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

const MULTIPLIERS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]

function calcDV(base: string): number {
    const digits = base.replace(/\D/g, '').slice(-9).padStart(9, '0')
    const sum = digits.split('').reverse().reduce((acc, d, i) => acc + parseInt(d) * MULTIPLIERS[i], 0)
    const rem = sum % 11
    if (rem === 0) return 0
    if (rem === 1) return 1
    return 11 - rem
}

interface NitResult {
    valid: boolean
    nit: string
    base: string
    checkDigit: number
    providedDigit: number
    formatted: string
    tipoRango: string
    subtipo: string
    esJuridica: boolean
    encontrado: boolean
    razonSocial: string | null
    estadoMatricula: string | null
    organizacionJuridica: string | null
    tipoSociedad: string | null
    categoriaMatricula: string | null
    camaraComercio: string | null
    matricula: string | null
    fechaMatricula: string | null
    fechaRenovacion: string | null
    ultimoAnoRenovado: string | null
    fechaVigencia: string | null
    fechaCancelacion: string | null
    ciuuPrincipal: string | null
    ciuuSecundario: string | null
    ciuu3: string | null
    ciuu4: string | null
    representanteLegal: string | null
    idRepresentante: string | null
    claseIdRL: string | null
    digitoVerificacion: string | null
    municipio: string | null
    departamento: string | null
    direccion: string | null
    telefono: string | null
    email: string | null
    tamanoEmpresa: string | null
    codigoPostal: string | null
    otrasMatriculas: { camara: string; matricula: string; estado: string; renovado: string }[]
    inscripcionProponente?: string | null
}

type BatchStatus = 'pending' | 'loading' | 'done' | 'error'
interface BatchItem {
    id: number
    raw: string
    status: BatchStatus
    result: NitResult | null
    errorMsg?: string
}

const KNOWN_NITS = [
    { label: 'DIAN',           nit: '800197268-4' },
    { label: 'Bancolombia',    nit: '890903938-8' },
    { label: 'Grupo Éxito',    nit: '860002137-4' },
    { label: 'EPM',            nit: '890904996-1' },
    { label: 'Ecopetrol',      nit: '899999068-1' },
    { label: 'Davivienda',     nit: '860034313-7' },
    { label: 'Claro Colombia', nit: '800153993-6' },
    { label: 'Colpatria',      nit: '860007538-1' },
]

function StatusBadge({ estado }: { estado: string | null }) {
    if (!estado) return null
    const e = estado.toUpperCase()
    const isActive   = e === 'ACTIVA' || e === 'VIGENTE'
    const isCanceled = e === 'CANCELADA' || e === 'LIQUIDADA'
    const color = isActive ? JA.GREEN : isCanceled ? JA.RED : JA.ORANGE
    const bg    = isActive ? '#F0FDF4' : isCanceled ? '#FEF2F2' : '#FFFBEB'
    const dot   = isActive ? '#4ADE80' : isCanceled ? '#FCA5A5' : '#FCD34D'
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: bg, color, border: `1px solid ${color}30`, borderRadius: '2px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.03em' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, display: 'inline-block' }} />
            {estado}
        </span>
    )
}

function InfoRow({ label, value, mono = false, highlight = false }: { label: string; value: string | null; mono?: boolean; highlight?: boolean }) {
    if (!value || value === '—') return null
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: `1px solid ${JA.BG}`, gap: '12px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, paddingTop: '1px' }}>{label}</span>
            <span style={{ fontSize: highlight ? '13px' : '11px', fontWeight: highlight ? 800 : 600, color: highlight ? JA.NAVY : JA.TEXT, fontFamily: mono ? 'monospace' : 'Inter, sans-serif', textAlign: 'right', lineHeight: 1.4 }}>{value}</span>
        </div>
    )
}

async function callVerify(nit: string): Promise<NitResult> {
    const cleaned = nit.replace(/\D/g, '')
    const res = await fetch(`/api/nit-verify?nit=${cleaned}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
}

function parseNitList(raw: string): string[] {
    const parts = raw.split(/[\n\r,;|\t]+/)
        .map(s => s.trim().replace(/[^0-9\-]/g, ''))
        .filter(s => s.replace(/\D/g, '').length >= 2)
    const seen = new Set<string>()
    const result: string[] = []
    for (const p of parts) {
        const key = p.replace(/\D/g, '')
        if (!seen.has(key)) { seen.add(key); result.push(p) }
        if (result.length >= 300) break
    }
    return result
}

function exportCSV(items: BatchItem[]) {
    const headers = [
        'NIT', 'Base', 'DV', 'NIT Formateado', 'DV Válido', 'Tipo Rango', 'Subtipo',
        'Es Jurídica', 'Encontrado RUES', 'Razón Social', 'Estado Matrícula',
        'Organización Jurídica', 'Tipo Sociedad', 'Categoría Matrícula',
        'Cámara de Comercio', 'Matrícula', 'Fecha Matrícula', 'Fecha Renovación',
        'Último Año Renovado', 'Fecha Vigencia', 'Fecha Cancelación',
        'CIUU Principal', 'CIUU Secundario', 'CIUU 3', 'CIUU 4',
        'Representante Legal', 'ID Representante', 'Clase ID RL',
        'Municipio', 'Departamento', 'Dirección', 'Teléfono', 'Email',
        'Tamaño Empresa', 'Estado Procesamiento',
    ]
    const esc = (v: unknown) => {
        const s = v == null ? '' : String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = items.map(item => {
        const r = item.result
        if (!r) return [item.raw, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', item.errorMsg || item.status].map(esc).join(',')
        return [
            r.nit, r.base, r.checkDigit, r.formatted, r.valid ? 'Sí' : 'No',
            r.tipoRango, r.subtipo, r.esJuridica ? 'Sí' : 'No',
            r.encontrado ? 'Sí' : 'No', r.razonSocial, r.estadoMatricula,
            r.organizacionJuridica, r.tipoSociedad, r.categoriaMatricula,
            r.camaraComercio, r.matricula, r.fechaMatricula, r.fechaRenovacion,
            r.ultimoAnoRenovado, r.fechaVigencia, r.fechaCancelacion,
            r.ciuuPrincipal, r.ciuuSecundario, r.ciuu3, r.ciuu4,
            r.representanteLegal, r.idRepresentante, r.claseIdRL,
            r.municipio, r.departamento, r.direccion, r.telefono, r.email,
            r.tamanoEmpresa, 'OK',
        ].map(esc).join(',')
    })
    const csv = '﻿' + headers.join(',') + '\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nits_verificados_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
}

function BatchDetail({ r }: { r: NitResult }) {
    return (
        <div style={{ padding: '12px 16px', background: JA.BG, borderTop: `1px solid ${JA.BORDER}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 24px' }}>
            {[
                { label: 'Organización', value: r.organizacionJuridica },
                { label: 'Tipo Sociedad', value: r.tipoSociedad },
                { label: 'Categoría', value: r.categoriaMatricula },
                { label: 'Cámara', value: r.camaraComercio },
                { label: 'Matrícula', value: r.matricula },
                { label: 'F. Matrícula', value: r.fechaMatricula },
                { label: 'Renovación', value: r.fechaRenovacion },
                { label: 'Municipio', value: r.municipio },
                { label: 'Departamento', value: r.departamento },
                { label: 'Dirección', value: r.direccion },
                { label: 'Teléfono', value: r.telefono },
                { label: 'Email', value: r.email },
                { label: 'CIUU Principal', value: r.ciuuPrincipal },
                { label: 'CIUU Secundario', value: r.ciuuSecundario },
                { label: 'Tamaño', value: r.tamanoEmpresa },
                { label: 'Rep. Legal', value: r.representanteLegal },
                { label: 'ID Rep. Legal', value: r.idRepresentante },
                { label: 'Clase ID', value: r.claseIdRL },
            ].filter(x => x.value).map(({ label, value }) => (
                <div key={label}>
                    <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', margin: '0 0 2px' }}>{label}</p>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT, margin: 0 }}>{value}</p>
                </div>
            ))}
        </div>
    )
}

/* ──────────────────────────── BATCH MODE ──────────────────────────── */
function LoteMode() {
    const [raw, setRaw]           = useState('')
    const [items, setItems]       = useState<BatchItem[]>([])
    const [running, setRunning]   = useState(false)
    const [expanded, setExpanded] = useState<Set<number>>(new Set())
    const abortRef = useRef(false)

    const toggleExpand = (id: number) => {
        setExpanded(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const startBatch = useCallback(async () => {
        const nits = parseNitList(raw)
        if (!nits.length) return
        abortRef.current = false
        const queue: BatchItem[] = nits.map((r, i) => ({ id: i, raw: r, status: 'pending', result: null }))
        setItems(queue)
        setRunning(true)

        const idx = { current: 0 }
        const work = async () => {
            while (idx.current < queue.length) {
                if (abortRef.current) break
                const i = idx.current++
                setItems(prev => prev.map(it => it.id === i ? { ...it, status: 'loading' } : it))
                try {
                    const result = await callVerify(queue[i].raw)
                    setItems(prev => prev.map(it => it.id === i ? { ...it, status: 'done', result } : it))
                } catch (e) {
                    const base = queue[i].raw.replace(/\D/g, '').slice(0, -1)
                    const given = parseInt(queue[i].raw.replace(/\D/g, '').slice(-1))
                    const dv = calcDV(base)
                    const n = parseInt(base)
                    const esJur = n >= 800_000_000 && n <= 999_999_999
                    setItems(prev => prev.map(it => it.id === i ? {
                        ...it, status: 'done',
                        result: {
                            valid: given === dv, nit: queue[i].raw.replace(/\D/g, ''),
                            base, checkDigit: dv, providedDigit: given,
                            formatted: base + '-' + dv,
                            tipoRango: esJur ? 'Persona Jurídica' : 'Persona Natural',
                            subtipo: '', esJuridica: esJur,
                            encontrado: false,
                            razonSocial: null, estadoMatricula: null, organizacionJuridica: null,
                            tipoSociedad: null, categoriaMatricula: null, camaraComercio: null,
                            matricula: null, fechaMatricula: null, fechaRenovacion: null,
                            ultimoAnoRenovado: null, fechaVigencia: null, fechaCancelacion: null,
                            ciuuPrincipal: null, ciuuSecundario: null, ciuu3: null, ciuu4: null,
                            representanteLegal: null, idRepresentante: null, claseIdRL: null,
                            digitoVerificacion: String(dv),
                            municipio: null, departamento: null, direccion: null,
                            telefono: null, email: null, tamanoEmpresa: null, codigoPostal: null,
                            otrasMatriculas: [],
                        },
                        errorMsg: (e as Error).message,
                    } : it))
                }
            }
        }
        await Promise.all(Array(4).fill(null).map(() => work()))
        setRunning(false)
    }, [raw])

    const stop = () => { abortRef.current = true }

    const done  = items.filter(x => x.status === 'done').length
    const rues  = items.filter(x => x.result?.encontrado).length
    const activos = items.filter(x => x.result?.estadoMatricula?.toUpperCase() === 'ACTIVA' || x.result?.estadoMatricula?.toUpperCase() === 'VIGENTE').length
    const noEnc = items.filter(x => x.status === 'done' && !x.result?.encontrado).length
    const errors = items.filter(x => x.status === 'error').length
    const total = items.length
    const pct = total ? Math.round(done / total * 100) : 0

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Input */}
            <div style={{ ...CARD, padding: '20px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '10px' }}>
                    Pega la lista de NITs — hasta 300 · separados por enter, coma, punto y coma, pipe o tab
                </label>
                <textarea
                    value={raw}
                    onChange={e => setRaw(e.target.value)}
                    disabled={running}
                    placeholder={'800197268\n890903938-8\n899999068,860002137\n...'}
                    style={{ width: '100%', height: '120px', padding: '10px 14px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', resize: 'vertical', fontSize: '12px', fontFamily: 'monospace', color: JA.TEXT, background: running ? JA.BG : '#FFF', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    <span style={{ fontSize: '10px', color: JA.GREY_LT }}>
                        {parseNitList(raw).length} NITs detectados{parseNitList(raw).length >= 300 ? ' (límite 300)' : ''}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {running && (
                            <button onClick={stop}
                                style={{ padding: '9px 16px', background: JA.RED, color: '#FFF', border: 'none', borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                Detener
                            </button>
                        )}
                        <button onClick={startBatch} disabled={running || !raw.trim()}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 20px', background: running || !raw.trim() ? JA.GREY_LT : JA.NAVY, color: '#FFF', border: 'none', borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: running || !raw.trim() ? 'not-allowed' : 'pointer' }}>
                            {running
                                ? <><div style={{ width: 12, height: 12, border: '2px solid #FFFFFF50', borderTopColor: '#FFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Verificando...</>
                                : <><Layers style={{ width: 13, height: 13 }} /> Verificar Lote</>
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* Progress + stats */}
            {items.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {[
                            { label: 'Verificados',    value: done,    color: JA.NAVY },
                            { label: 'En RUES',        value: rues,    color: JA.TEAL },
                            { label: 'Activos',        value: activos, color: JA.GREEN },
                            { label: 'No encontrados', value: noEnc,   color: JA.ORANGE },
                            { label: 'Errores',        value: errors,  color: JA.RED },
                        ].map(({ label, value, color }) => (
                            <div key={label} style={{ ...CARD, padding: '10px 16px', flex: '1 1 100px', minWidth: '100px' }}>
                                <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', margin: '0 0 4px' }}>{label}</p>
                                <p style={{ fontSize: '20px', fontWeight: 900, color, margin: 0 }}>{value}</p>
                            </div>
                        ))}
                    </div>
                    <div style={{ height: '4px', background: JA.BORDER, borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: JA.GOLD, transition: 'width 0.3s', borderRadius: '2px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: JA.GREY_LT }}>{done}/{total} · {pct}% completado</span>
                        {!running && done > 0 && (
                            <button onClick={() => exportCSV(items.filter(x => x.status === 'done'))}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: JA.GOLD, color: JA.NAVY, border: 'none', borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                <FileDown style={{ width: 13, height: 13 }} /> Exportar CSV ({done})
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Results table */}
            {items.length > 0 && (
                <div style={CARD}>
                    <div style={{ display: 'grid', gridTemplateColumns: '48px 160px 1fr 110px 150px 1fr 36px', padding: '8px 12px', background: JA.BG, borderBottom: `1px solid ${JA.BORDER}`, gap: '0 8px' }}>
                        {['#', 'NIT', 'Razón Social', 'Estado', 'Cámara', 'Actividad', ''].map((h, i) => (
                            <span key={i} style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                        ))}
                    </div>
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {items.map(item => (
                            <div key={item.id} style={{ borderBottom: `1px solid ${JA.BG}` }}>
                                <div
                                    onClick={() => item.status === 'done' && item.result && toggleExpand(item.id)}
                                    style={{ display: 'grid', gridTemplateColumns: '48px 160px 1fr 110px 150px 1fr 36px', padding: '10px 12px', gap: '0 8px', alignItems: 'center', cursor: item.result ? 'pointer' : 'default', background: expanded.has(item.id) ? '#F0F4FF' : '#FFF' }}
                                >
                                    <span style={{ fontSize: '10px', color: JA.GREY_LT, fontFamily: 'monospace' }}>{item.id + 1}</span>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: JA.NAVY, fontFamily: 'monospace' }}>
                                        {item.result?.formatted || item.raw}
                                    </span>
                                    <span style={{ fontSize: '11px', color: JA.TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.status === 'loading'
                                            ? <span style={{ color: JA.GREY_LT }}>Verificando…</span>
                                            : item.status === 'pending'
                                                ? <span style={{ color: JA.GREY_LT }}>En cola</span>
                                                : item.result?.razonSocial || <span style={{ color: JA.GREY_LT }}>—</span>
                                        }
                                    </span>
                                    <span>
                                        {item.result?.estadoMatricula
                                            ? <StatusBadge estado={item.result.estadoMatricula} />
                                            : item.status === 'loading'
                                                ? <span style={{ fontSize: '9px', color: JA.GREY_LT }}>...</span>
                                                : item.result
                                                    ? <span style={{ fontSize: '9px', color: JA.GREY_LT }}>Sin matrícula</span>
                                                    : null
                                        }
                                    </span>
                                    <span style={{ fontSize: '10px', color: JA.GREY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.result?.camaraComercio || ''}
                                    </span>
                                    <span style={{ fontSize: '10px', color: JA.GREY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.result?.ciuuPrincipal
                                            ? item.result.ciuuPrincipal.split(' ').slice(0, 4).join(' ')
                                            : ''}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {item.status === 'done' && item.result && (
                                            expanded.has(item.id)
                                                ? <ChevronUp style={{ width: 14, height: 14, color: JA.GREY_LT }} />
                                                : <ChevronDown style={{ width: 14, height: 14, color: JA.GREY_LT }} />
                                        )}
                                        {item.status === 'error' && <AlertCircle style={{ width: 14, height: 14, color: JA.RED }} />}
                                    </span>
                                </div>
                                {expanded.has(item.id) && item.result && (
                                    <BatchDetail r={item.result} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

/* ──────────────────────────── INDIVIDUAL MODE ──────────────────────────── */
function IndividualMode() {
    const [input,    setInput]    = useState('')
    const [result,   setResult]   = useState<NitResult | null>(null)
    const [loading,  setLoading]  = useState(false)
    const [copied,   setCopied]   = useState(false)
    const [showCalc, setShowCalc] = useState(false)
    const [autoCalc, setAutoCalc] = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const verify = useCallback(async (value: string) => {
        const cleaned = value.replace(/\D/g, '')
        if (cleaned.length < 2) { setResult(null); return }
        setLoading(true)
        try {
            const data = await callVerify(cleaned)
            setResult(data)
        } catch {
            const base  = cleaned.slice(0, -1)
            const given = parseInt(cleaned.slice(-1))
            const dv    = calcDV(base)
            const n     = parseInt(base)
            const esJur = n >= 800_000_000 && n <= 999_999_999
            setResult({
                valid: given === dv, nit: cleaned, base,
                checkDigit: dv, providedDigit: given,
                formatted: base + '-' + given,
                tipoRango: esJur ? 'Persona Jurídica' : 'Persona Natural',
                subtipo: '', esJuridica: esJur,
                encontrado: false,
                razonSocial: null, estadoMatricula: null, organizacionJuridica: null,
                tipoSociedad: null, categoriaMatricula: null, camaraComercio: null,
                matricula: null, fechaMatricula: null, fechaRenovacion: null,
                ultimoAnoRenovado: null, fechaVigencia: null, fechaCancelacion: null,
                ciuuPrincipal: null, ciuuSecundario: null, ciuu3: null, ciuu4: null,
                representanteLegal: null, idRepresentante: null, claseIdRL: null,
                digitoVerificacion: String(dv),
                municipio: null, departamento: null, direccion: null,
                telefono: null, email: null, tamanoEmpresa: null, codigoPostal: null,
                otrasMatriculas: [],
            })
        } finally {
            setLoading(false)
        }
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9\-]/g, '')
        setInput(val)
        setAutoCalc(false)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            const cleaned = val.replace(/\D/g, '')
            if (cleaned.length < 2) { setResult(null); return }
            if (!val.includes('-') && cleaned.length >= 5) {
                const dv   = calcDV(cleaned)
                const full = cleaned + '-' + dv
                setInput(full)
                setAutoCalc(true)
                verify(full)
            } else {
                verify(val)
            }
        }, 600)
    }

    const handleCalcDV = () => {
        const cleaned = input.replace(/\D/g, '')
        if (!cleaned) return
        const digit    = calcDV(cleaned)
        const newInput = cleaned + '-' + digit
        setInput(newInput)
        setAutoCalc(true)
        verify(newInput)
    }

    const handleExample = (nit: string) => {
        setInput(nit)
        setAutoCalc(false)
        verify(nit)
    }

    const copyResult = () => {
        if (result?.formatted) {
            navigator.clipboard.writeText(result.formatted)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        }
    }

    const isNatPerson = result ? !result.esJuridica : false

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Search box */}
            <div style={{ ...CARD, padding: '20px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '10px' }}>
                    Ingresa NIT — con o sin dígito de verificación
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: `2px solid ${result ? (autoCalc ? JA.GOLD : result.valid ? JA.GREEN : JA.RED) : JA.BORDER}`, borderRadius: '2px', transition: 'border-color 0.2s', background: '#FAFAFA' }}>
                        {loading
                            ? <div style={{ width: 18, height: 18, border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                            : <Search style={{ width: 18, height: 18, color: JA.GREY_LT, flexShrink: 0 }} />
                        }
                        <input
                            type="text"
                            placeholder="Ej: 900123456  →  DV se calcula solo"
                            value={input}
                            onChange={handleChange}
                            autoFocus
                            style={{ border: 'none', outline: 'none', fontSize: '18px', fontWeight: 700, color: JA.NAVY, background: 'none', flex: 1, fontFamily: 'monospace', letterSpacing: '0.05em' }}
                        />
                        {result && (
                            autoCalc
                                ? <CheckCircle style={{ width: 20, height: 20, color: JA.GOLD,  flexShrink: 0 }} />
                                : result.valid
                                    ? <CheckCircle style={{ width: 20, height: 20, color: JA.GREEN, flexShrink: 0 }} />
                                    : <XCircle    style={{ width: 20, height: 20, color: JA.RED,   flexShrink: 0 }} />
                        )}
                    </div>
                    <button onClick={handleCalcDV}
                        style={{ padding: '12px 18px', background: JA.NAVY, color: '#FFF', border: 'none', borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <RefreshCw style={{ width: 12, height: 12 }} /> Calcular DV
                    </button>
                </div>
                <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: '8px 0 0' }}>
                    Escribe solo la base → el dígito se calcula automáticamente · Con guión (ej: 900123456-<strong>7</strong>) para validar un DV conocido
                </p>
            </div>

            {/* Examples */}
            {!result && (
                <div style={{ ...CARD, padding: '16px 20px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>NITs de referencia</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {KNOWN_NITS.map(({ label, nit }) => (
                            <button key={nit} onClick={() => handleExample(nit)}
                                style={{ padding: '5px 12px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', background: '#FFF', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: JA.GREY, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Building2 style={{ width: 10, height: 10 }} />
                                {label} · <code style={{ fontFamily: 'monospace', fontSize: '10px' }}>{nit}</code>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Result */}
            {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Validation header */}
                    <div style={{ ...CARD, padding: '18px 20px', borderLeft: `4px solid ${autoCalc ? JA.GOLD : result.valid ? JA.GREEN : JA.RED}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {autoCalc
                                    ? <CheckCircle style={{ width: 26, height: 26, color: JA.GOLD  }} />
                                    : result.valid
                                        ? <CheckCircle style={{ width: 26, height: 26, color: JA.GREEN }} />
                                        : <XCircle    style={{ width: 26, height: 26, color: JA.RED   }} />
                                }
                                <div>
                                    <p style={{ fontSize: '15px', fontWeight: 900, color: autoCalc ? JA.GOLD : result.valid ? JA.GREEN : JA.RED, margin: 0 }}>
                                        {autoCalc ? `DV CALCULADO: ${result.checkDigit}` : result.valid ? 'DÍGITO VÁLIDO' : 'DÍGITO INCORRECTO'}
                                    </p>
                                    <p style={{ fontSize: '11px', color: JA.GREY, margin: '3px 0 0' }}>
                                        {autoCalc
                                            ? `El dígito de verificación para ${result.base} es ${result.checkDigit}`
                                            : result.valid
                                                ? `Dígito de verificación ${result.checkDigit} es correcto`
                                                : `Se esperaba ${result.checkDigit}, se recibió ${result.providedDigit}`
                                        }
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ padding: '6px 14px', background: JA.BG, borderRadius: '2px', border: `1px solid ${JA.BORDER}` }}>
                                    <span style={{ fontSize: '16px', fontWeight: 900, color: JA.NAVY, fontFamily: 'monospace', letterSpacing: '0.08em' }}>{result.formatted}</span>
                                </div>
                                <button onClick={copyResult}
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', background: copied ? '#F0FDF4' : '#FFF', cursor: 'pointer', fontSize: '10px', fontWeight: 700, color: copied ? JA.GREEN : JA.GREY }}>
                                    <Copy style={{ width: 11, height: 11 }} /> {copied ? '¡Copiado!' : 'Copiar'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {result.encontrado ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '14px' }}>
                            {/* Main card */}
                            <div style={CARD}>
                                <div style={{ padding: '20px', borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: '4px', background: '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {isNatPerson ? <User style={{ width: 20, height: 20, color: JA.NAVY }} /> : <Building2 style={{ width: 20, height: 20, color: JA.NAVY }} />}
                                        </div>
                                        <div>
                                            <h2 style={{ fontSize: '16px', fontWeight: 900, color: JA.NAVY, margin: '0 0 4px', lineHeight: 1.2 }}>{result.razonSocial}</h2>
                                            <p style={{ fontSize: '11px', color: JA.GREY, margin: '0 0 8px' }}>{result.organizacionJuridica} · {result.categoriaMatricula}</p>
                                            <StatusBadge estado={result.estadoMatricula} />
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', margin: '0 0 2px' }}>NIT</p>
                                        <p style={{ fontSize: '16px', fontWeight: 900, color: JA.NAVY, margin: 0, fontFamily: 'monospace' }}>{result.formatted}</p>
                                    </div>
                                </div>
                                <div style={{ padding: '0 20px 8px' }}>
                                    <InfoRow label="Cámara de Comercio"    value={result.camaraComercio}      highlight />
                                    <InfoRow label="Municipio"             value={result.municipio}           />
                                    <InfoRow label="Departamento"          value={result.departamento}        />
                                    <InfoRow label="Dirección"             value={result.direccion}           />
                                    <InfoRow label="Teléfono"              value={result.telefono}            mono />
                                    <InfoRow label="Email"                 value={result.email}               />
                                    <InfoRow label="Matrícula Mercantil"   value={result.matricula}           mono />
                                    <InfoRow label="Tipo de Sociedad"      value={result.tipoSociedad}        />
                                    <InfoRow label="Organización Jurídica" value={result.organizacionJuridica}/>
                                    <InfoRow label="Tamaño Empresa"        value={result.tamanoEmpresa}       />
                                    <InfoRow label="Actividad Principal"   value={result.ciuuPrincipal}       />
                                    {result.ciuuSecundario && !result.ciuuSecundario.includes('No clasificada') && (
                                        <InfoRow label="Actividad Secundaria" value={result.ciuuSecundario} />
                                    )}
                                    {result.ciuu3 && !result.ciuu3.includes('No clasificada') && (
                                        <InfoRow label="Actividad Terciaria" value={result.ciuu3} />
                                    )}
                                    <InfoRow label="Fecha Matrícula"      value={result.fechaMatricula}      mono />
                                    <InfoRow label="Última Renovación"    value={result.fechaRenovacion}     mono />
                                    {result.ultimoAnoRenovado && result.ultimoAnoRenovado !== '0' && (
                                        <InfoRow label="Año Renovado" value={result.ultimoAnoRenovado} mono />
                                    )}
                                    {result.fechaCancelacion && result.fechaCancelacion !== '—' && (
                                        <InfoRow label="Fecha Cancelación" value={result.fechaCancelacion} mono />
                                    )}
                                    <InfoRow label="Tipo de Entidad" value={result.tipoRango} />
                                </div>
                            </div>

                            {/* Right column */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {result.representanteLegal && (
                                    <div style={{ ...CARD, padding: '16px' }}>
                                        <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Representante Legal</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: JA.GOLD_PALE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <User style={{ width: 16, height: 16, color: JA.GOLD }} />
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '13px', fontWeight: 800, color: JA.NAVY, margin: 0 }}>{result.representanteLegal}</p>
                                                {result.claseIdRL && <p style={{ fontSize: '10px', color: JA.GREY, margin: '2px 0 0' }}>{result.claseIdRL}</p>}
                                            </div>
                                        </div>
                                        {result.idRepresentante && (
                                            <div style={{ padding: '8px 12px', background: JA.BG, borderRadius: '2px', border: `1px solid ${JA.BORDER}` }}>
                                                <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', margin: '0 0 2px' }}>Identificación</p>
                                                <p style={{ fontSize: '13px', fontWeight: 800, color: JA.TEXT, margin: 0, fontFamily: 'monospace' }}>{result.idRepresentante}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {result.otrasMatriculas.length > 0 && (
                                    <div style={CARD}>
                                        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${JA.BG}` }}>
                                            <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                                                Otras Cámaras ({result.otrasMatriculas.length})
                                            </p>
                                        </div>
                                        <div style={{ padding: '8px' }}>
                                            {result.otrasMatriculas.map((m, i) => (
                                                <div key={i} style={{ padding: '8px 10px', borderRadius: '2px', marginBottom: '4px', background: JA.BG, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <p style={{ fontSize: '11px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>{m.camara}</p>
                                                        <p style={{ fontSize: '9px', color: JA.GREY_LT, margin: '2px 0 0' }}>Mat. {m.matricula} · Ren. {m.renovado}</p>
                                                    </div>
                                                    <span style={{ fontSize: '9px', fontWeight: 700, color: m.estado === 'ACTIVA' ? JA.GREEN : JA.GREY_LT, background: m.estado === 'ACTIVA' ? '#F0FDF4' : JA.BG, border: `1px solid ${m.estado === 'ACTIVA' ? JA.GREEN + '40' : JA.BORDER}`, padding: '2px 8px', borderRadius: '1px' }}>
                                                        {m.estado}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div style={{ ...CARD, padding: '14px 16px' }}>
                                    <button onClick={() => setShowCalc(!showCalc)}
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cálculo DV — Módulo 11</span>
                                        {showCalc ? <ChevronUp style={{ width: 14, height: 14, color: JA.GREY_LT }} /> : <ChevronDown style={{ width: 14, height: 14, color: JA.GREY_LT }} />}
                                    </button>
                                    {showCalc && (
                                        <div style={{ marginTop: '10px', padding: '10px', background: JA.NAVY, borderRadius: '2px', overflowX: 'auto' }}>
                                            <p style={{ fontSize: '8px', fontWeight: 700, color: JA.GOLD, margin: '0 0 6px', textTransform: 'uppercase' }}>Factores primos × dígitos (der→izq)</p>
                                            <code style={{ fontSize: '9px', color: '#D1D5DB', fontFamily: 'monospace', lineHeight: 2, display: 'block', whiteSpace: 'pre' }}>
                                                {(() => {
                                                    const d = result.base.replace(/\D/g, '').slice(-9).padStart(9, '0').split('').reverse()
                                                    const sum = d.reduce((acc, ch, i) => acc + parseInt(ch) * MULTIPLIERS[i], 0)
                                                    const rem = sum % 11
                                                    return d.map((ch, i) => `${ch} × ${String(MULTIPLIERS[i]).padStart(2)} = ${String(parseInt(ch)*MULTIPLIERS[i]).padStart(3)}`).join('  |  ')
                                                        + `\nSuma = ${sum}    Resto = ${rem}    DV = ${result.checkDigit}`
                                                })()}
                                            </code>
                                        </div>
                                    )}
                                </div>

                                <div style={{ padding: '10px 14px', background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock style={{ width: 11, height: 11, color: JA.GREY_LT, flexShrink: 0 }} />
                                    <p style={{ fontSize: '9px', color: JA.GREY_LT, margin: 0, lineHeight: 1.5 }}>
                                        Fuente: Registro Mercantil (datos.gov.co — RUES Confecámaras) · Actualizado cada 24h
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '14px' }}>
                            <div style={CARD}>
                                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '4px', background: '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {result.esJuridica ? <Building2 style={{ width: 20, height: 20, color: JA.NAVY }} /> : <User style={{ width: 20, height: 20, color: JA.NAVY }} />}
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '15px', fontWeight: 900, color: JA.NAVY, margin: 0 }}>{result.tipoRango}</p>
                                        {result.subtipo && <p style={{ fontSize: '11px', color: JA.GREY, margin: '2px 0 0' }}>{result.subtipo}</p>}
                                        <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: '4px 0 0' }}>Sin registro en Cámara de Comercio · DV calculado correctamente</p>
                                    </div>
                                </div>
                                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {[
                                        { label: 'NIT / RUT completo',     value: result.formatted,          mono: true,  big: true  },
                                        { label: 'Dígito de Verificación', value: String(result.checkDigit), mono: true,  big: true  },
                                        { label: 'Base numérica',          value: result.base,               mono: true,  big: false },
                                        { label: 'Tipo de contribuyente',  value: result.tipoRango,          mono: false, big: false },
                                        ...(result.subtipo ? [{ label: 'Clasificación DIAN', value: result.subtipo, mono: false, big: false }] : []),
                                    ].map(({ label, value, mono, big }) => (
                                        <div key={label} style={{ padding: '12px 14px', background: JA.BG, borderRadius: '2px', border: `1px solid ${JA.BORDER}` }}>
                                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 5px' }}>{label}</p>
                                            <p style={{ fontSize: big ? '18px' : '12px', fontWeight: 800, color: JA.NAVY, margin: 0, fontFamily: mono ? 'monospace' : 'inherit', letterSpacing: mono ? '0.05em' : 0 }}>{value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ margin: '0 20px 16px', padding: '10px 14px', background: JA.GOLD_PALE, border: `1px solid ${JA.GOLD}40`, borderRadius: '2px', display: 'flex', gap: '8px' }}>
                                    <span style={{ fontSize: '14px', color: JA.GOLD, flexShrink: 0, fontWeight: 900, lineHeight: 1 }}>ℹ</span>
                                    <p style={{ fontSize: '10px', color: JA.TEXT, margin: 0, lineHeight: 1.5 }}>
                                        {result.esJuridica
                                            ? 'Esta empresa no aparece en el Registro Mercantil público (RUES). Puede ser una entidad del Estado, cooperativa, o no tener matrícula mercantil vigente.'
                                            : 'Las personas naturales no aparecen en el Registro Mercantil. NIT y DV son correctos. Para nombre y datos del RUT, consulta en el portal DIAN con la cédula.'
                                        }
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ ...CARD, padding: '16px' }}>
                                    <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Verificar en fuentes oficiales</p>
                                    {[
                                        { label: 'DIAN — Consulta RUT',       url: 'https://muisca.dian.gov.co/WebRutMuisca/DefConsultaEstadoRUT.faces' },
                                        { label: 'RUES — Registro Mercantil', url: 'https://www.rues.org.co' },
                                        { label: 'Cámaras de Comercio',       url: 'https://confecamaras.org.co' },
                                    ].map(({ label, url }) => (
                                        <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '2px', border: `1px solid ${JA.BORDER}`, marginBottom: '8px', textDecoration: 'none', background: '#FFF' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT }}>{label}</span>
                                            <ExternalLink style={{ width: 11, height: 11, color: JA.GREY_LT }} />
                                        </a>
                                    ))}
                                </div>

                                <div style={{ ...CARD, padding: '14px 16px' }}>
                                    <button onClick={() => setShowCalc(!showCalc)}
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Verificar cálculo DV</span>
                                        {showCalc ? <ChevronUp style={{ width: 14, height: 14, color: JA.GREY_LT }} /> : <ChevronDown style={{ width: 14, height: 14, color: JA.GREY_LT }} />}
                                    </button>
                                    {showCalc && (
                                        <div style={{ marginTop: '10px', padding: '10px', background: JA.NAVY, borderRadius: '2px', overflowX: 'auto' }}>
                                            <p style={{ fontSize: '8px', fontWeight: 700, color: JA.GOLD, margin: '0 0 6px', textTransform: 'uppercase' }}>Módulo 11 — factores primos × dígitos (der→izq)</p>
                                            <code style={{ fontSize: '9px', color: '#D1D5DB', fontFamily: 'monospace', lineHeight: 2, display: 'block', whiteSpace: 'pre' }}>
                                                {(() => {
                                                    const d = result.base.replace(/\D/g, '').slice(-9).padStart(9, '0').split('').reverse()
                                                    const sum = d.reduce((acc, ch, i) => acc + parseInt(ch) * MULTIPLIERS[i], 0)
                                                    const rem = sum % 11
                                                    return d.map((ch, i) => `${ch} × ${String(MULTIPLIERS[i]).padStart(2)} = ${String(parseInt(ch)*MULTIPLIERS[i]).padStart(3)}`).join('  |  ')
                                                        + `\nSuma=${sum}  Resto=${rem}  DV=${result.checkDigit}`
                                                })()}
                                            </code>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

/* ──────────────────────────── RUES MODE ──────────────────────────── */
function RuesMode() {
    const [input,   setInput]   = useState('')
    const [result,  setResult]  = useState<NitResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState<string | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const search = useCallback(async (value: string) => {
        const cleaned = value.replace(/\D/g, '')
        if (cleaned.length < 5) { setResult(null); setError(null); return }
        setLoading(true)
        setError(null)
        try {
            const data = await callVerify(cleaned)
            setResult(data)
        } catch {
            setError('No se pudo consultar el NIT. Intenta de nuevo.')
            setResult(null)
        } finally {
            setLoading(false)
        }
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9\-]/g, '')
        setInput(val)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => search(val), 700)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (debounceRef.current) clearTimeout(debounceRef.current)
        search(input)
    }

    const found = result?.encontrado

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Search */}
            <div style={{ ...CARD, padding: '20px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
                    Buscar en Registro Mercantil RUES por NIT
                </p>
                <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: `2px solid ${found ? JA.GREEN : error ? JA.RED : JA.BORDER}`, borderRadius: '2px', background: '#FAFAFA', transition: 'border-color 0.2s' }}>
                        {loading
                            ? <div style={{ width: 18, height: 18, border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                            : <BookOpen style={{ width: 18, height: 18, color: JA.GREY_LT, flexShrink: 0 }} />
                        }
                        <input
                            type="text"
                            placeholder="Ingresa el NIT (con o sin dígito de verificación)"
                            value={input}
                            onChange={handleChange}
                            autoFocus
                            style={{ border: 'none', outline: 'none', fontSize: '18px', fontWeight: 700, color: JA.NAVY, background: 'none', flex: 1, fontFamily: 'monospace', letterSpacing: '0.05em' }}
                        />
                    </div>
                    <button type="submit" disabled={loading || input.replace(/\D/g, '').length < 5}
                        style={{ padding: '12px 20px', background: JA.NAVY, color: '#FFF', border: 'none', borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: input.replace(/\D/g, '').length < 5 ? 0.5 : 1 }}>
                        <Search style={{ width: 13, height: 13 }} /> Buscar
                    </button>
                </form>
                {error && (
                    <p style={{ fontSize: '10px', color: JA.RED, margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <AlertCircle style={{ width: 12, height: 12 }} /> {error}
                    </p>
                )}
            </div>

            {/* No found state */}
            {result && !found && (
                <div style={{ ...CARD, padding: '28px 24px', textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                        <BookOpen style={{ width: 24, height: 24, color: JA.GREY_LT }} />
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: JA.NAVY, margin: '0 0 6px' }}>
                        NIT {result.formatted} — Sin registro mercantil
                    </p>
                    <p style={{ fontSize: '11px', color: JA.GREY, margin: '0 0 18px', lineHeight: 1.6 }}>
                        No aparece en el Registro Mercantil (RUES). Puede ser entidad sin matrícula mercantil, cooperativa, entidad pública, o persona natural sin actividad comercial registrada.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {[
                            { label: 'Buscar en RUES',         url: `https://www.rues.org.co/buscar/RM/${result.base}` },
                            { label: 'DIAN — Consulta RUT',    url: 'https://muisca.dian.gov.co/WebRutMuisca/DefConsultaEstadoRUT.faces' },
                            { label: 'Confecámaras',           url: 'https://confecamaras.org.co' },
                        ].map(({ label, url }) => (
                            <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', textDecoration: 'none', fontSize: '11px', fontWeight: 600, color: JA.GREY, background: '#FFF' }}>
                                {label} <ExternalLink style={{ width: 10, height: 10 }} />
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* RUES record card */}
            {result && found && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Header strip */}
                    <div style={{ ...CARD, borderLeft: `5px solid ${JA.GOLD}`, padding: '20px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '4px', background: JA.GOLD_PALE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {result.esJuridica
                                        ? <Building2 style={{ width: 22, height: 22, color: JA.GOLD }} />
                                        : <User style={{ width: 22, height: 22, color: JA.GOLD }} />
                                    }
                                </div>
                                <div>
                                    <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Razón Social / Nombre</p>
                                    <h2 style={{ fontSize: '18px', fontWeight: 900, color: JA.NAVY, margin: '0 0 8px', lineHeight: 1.2 }}>{result.razonSocial}</h2>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <StatusBadge estado={result.estadoMatricula} />
                                        {result.categoriaMatricula && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', background: '#EEF2F8', color: JA.NAVY, borderRadius: '2px', fontSize: '10px', fontWeight: 700 }}>
                                                <Award style={{ width: 10, height: 10 }} /> {result.categoriaMatricula}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <div>
                                    <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', margin: '0 0 2px' }}>NIT</p>
                                    <p style={{ fontSize: '20px', fontWeight: 900, color: JA.NAVY, margin: 0, fontFamily: 'monospace', letterSpacing: '0.06em' }}>{result.formatted}</p>
                                </div>
                                <a href={`https://www.rues.org.co/buscar/RM/${result.base}`} target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', textDecoration: 'none', fontSize: '10px', fontWeight: 700, color: JA.TEAL, background: '#FFF' }}>
                                    <ExternalLink style={{ width: 10, height: 10 }} /> Ver en RUES
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Detail grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        {/* Left: registry data */}
                        <div style={{ ...CARD, padding: '0' }}>
                            <div style={{ padding: '12px 18px', background: JA.NAVY, borderRadius: '2px 2px 0 0' }}>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                                    Datos de Matrícula Mercantil
                                </p>
                            </div>
                            <div style={{ padding: '0 18px 12px' }}>
                                <InfoRow label="Número de Matrícula"     value={result.matricula}              mono highlight />
                                {result.inscripcionProponente && (
                                    <InfoRow label="Número de Inscripción"   value={result.inscripcionProponente}  mono />
                                )}
                                <InfoRow label="Estado Matrícula"        value={result.estadoMatricula}                   />
                                <InfoRow label="Cámara de Comercio"      value={result.camaraComercio}                    />
                                <InfoRow label="Categoría"               value={result.categoriaMatricula}                />
                                <InfoRow label="Persona Natural/Jurídica" value={result.organizacionJuridica}             />
                                <InfoRow label="Tipo de Sociedad"        value={result.tipoSociedad}                      />
                                <InfoRow label="Identificación (NIT)"    value={result.formatted}             mono        />
                                <InfoRow label="Fecha Matrícula"         value={result.fechaMatricula}        mono        />
                                <InfoRow label="Última Renovación"       value={result.fechaRenovacion}       mono        />
                                {result.ultimoAnoRenovado && result.ultimoAnoRenovado !== '0' && (
                                    <InfoRow label="Año Renovado" value={result.ultimoAnoRenovado} mono />
                                )}
                                {result.fechaCancelacion && result.fechaCancelacion !== '—' && (
                                    <InfoRow label="Fecha Cancelación" value={result.fechaCancelacion} mono />
                                )}
                                <InfoRow label="Tamaño Empresa"          value={result.tamanoEmpresa}                     />
                            </div>
                        </div>

                        {/* Right: location + activity */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ ...CARD, padding: '0' }}>
                                <div style={{ padding: '12px 18px', background: JA.TEAL, borderRadius: '2px 2px 0 0' }}>
                                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#FFF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <MapPin style={{ width: 12, height: 12 }} /> Ubicación
                                    </p>
                                </div>
                                <div style={{ padding: '0 18px 12px' }}>
                                    <InfoRow label="Ciudad / Municipio" value={result.municipio}   highlight />
                                    <InfoRow label="Departamento"        value={result.departamento}           />
                                    <InfoRow label="Dirección"           value={result.direccion}              />
                                    <InfoRow label="Teléfono"            value={result.telefono}    mono       />
                                    <InfoRow label="Email"               value={result.email}                  />
                                    <InfoRow label="Código Postal"       value={result.codigoPostal} mono      />
                                </div>
                            </div>

                            <div style={{ ...CARD, padding: '0' }}>
                                <div style={{ padding: '12px 18px', background: '#374151', borderRadius: '2px 2px 0 0' }}>
                                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#FFF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Briefcase style={{ width: 12, height: 12 }} /> Actividad Económica
                                    </p>
                                </div>
                                <div style={{ padding: '0 18px 12px' }}>
                                    <InfoRow label="CIUU Principal"    value={result.ciuuPrincipal}   highlight />
                                    {result.ciuuSecundario && !result.ciuuSecundario.includes('No clasificada') && (
                                        <InfoRow label="CIUU Secundario" value={result.ciuuSecundario} />
                                    )}
                                    {result.ciuu3 && !result.ciuu3.includes('No clasificada') && (
                                        <InfoRow label="CIUU Terciaria" value={result.ciuu3} />
                                    )}
                                    {result.ciuu4 && !result.ciuu4.includes('No clasificada') && (
                                        <InfoRow label="CIUU 4" value={result.ciuu4} />
                                    )}
                                    {result.representanteLegal && (
                                        <>
                                            <InfoRow label="Representante Legal" value={result.representanteLegal} highlight />
                                            <InfoRow label="Identificación RL"   value={result.idRepresentante}    mono />
                                            <InfoRow label="Clase ID RL"         value={result.claseIdRL}          />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Other chambers */}
                            {result.otrasMatriculas.length > 0 && (
                                <div style={CARD}>
                                    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${JA.BORDER}` }}>
                                        <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                                            Otras Cámaras ({result.otrasMatriculas.length})
                                        </p>
                                    </div>
                                    <div style={{ padding: '8px' }}>
                                        {result.otrasMatriculas.map((m, i) => (
                                            <div key={i} style={{ padding: '8px 10px', borderRadius: '2px', marginBottom: '4px', background: JA.BG, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <p style={{ fontSize: '11px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>{m.camara}</p>
                                                    <p style={{ fontSize: '9px', color: JA.GREY_LT, margin: '2px 0 0' }}>Mat. {m.matricula} · Ren. {m.renovado}</p>
                                                </div>
                                                <span style={{ fontSize: '9px', fontWeight: 700, color: m.estado === 'ACTIVA' ? JA.GREEN : JA.GREY_LT, background: m.estado === 'ACTIVA' ? '#F0FDF4' : JA.BG, border: `1px solid ${m.estado === 'ACTIVA' ? JA.GREEN + '40' : JA.BORDER}`, padding: '2px 8px', borderRadius: '1px' }}>
                                                    {m.estado}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Source note */}
                            <div style={{ padding: '10px 14px', background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock style={{ width: 11, height: 11, color: JA.GREY_LT, flexShrink: 0 }} />
                                <p style={{ fontSize: '9px', color: JA.GREY_LT, margin: 0, lineHeight: 1.5 }}>
                                    Fuente: RUES — Registro Mercantil (datos.gov.co · Confecámaras) · Actualizado cada 24h
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

/* ──────────────────────────── PAGE ROOT ──────────────────────────── */
export default function NitPage() {
    const [mode, setMode] = useState<'individual' | 'lote' | 'rues'>('individual')

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '32px', fontFamily: 'Inter, sans-serif' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Header */}
            <div style={{ borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '18px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 900, color: JA.NAVY, margin: 0, letterSpacing: '-0.02em' }}>
                    Verificador <span style={{ color: JA.GOLD }}>NIT en Vivo</span>
                </h1>
                <p style={{ fontSize: '11px', color: JA.GREY, margin: '4px 0 0' }}>
                    Validación DIAN · Registro Mercantil RUES · Actividad económica CIIU · Representante legal
                </p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '2px', background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '3px', padding: '3px', width: 'fit-content' }}>
                <button onClick={() => setMode('individual')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 18px', border: 'none', borderRadius: '2px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: mode === 'individual' ? '#FFF' : 'transparent', color: mode === 'individual' ? JA.NAVY : JA.GREY, boxShadow: mode === 'individual' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                    <Hash style={{ width: 13, height: 13 }} /> Individual
                </button>
                <button onClick={() => setMode('lote')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 18px', border: 'none', borderRadius: '2px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: mode === 'lote' ? '#FFF' : 'transparent', color: mode === 'lote' ? JA.NAVY : JA.GREY, boxShadow: mode === 'lote' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                    <Layers style={{ width: 13, height: 13 }} /> Verificación en Lote
                    <span style={{ fontSize: '9px', fontWeight: 700, background: JA.GOLD, color: '#FFF', padding: '1px 6px', borderRadius: '8px' }}>hasta 300</span>
                </button>
                <button onClick={() => setMode('rues')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 18px', border: 'none', borderRadius: '2px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: mode === 'rues' ? '#FFF' : 'transparent', color: mode === 'rues' ? JA.NAVY : JA.GREY, boxShadow: mode === 'rues' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                    <BookOpen style={{ width: 13, height: 13 }} /> Registro Mercantil
                    <span style={{ fontSize: '9px', fontWeight: 700, background: JA.TEAL, color: '#FFF', padding: '1px 6px', borderRadius: '8px' }}>RUES</span>
                </button>
            </div>

            {mode === 'individual' ? <IndividualMode /> : mode === 'lote' ? <LoteMode /> : <RuesMode />}
        </div>
    )
}
