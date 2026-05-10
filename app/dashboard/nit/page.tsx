'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, CheckCircle, XCircle, Building2, User, RefreshCw, Copy, ExternalLink, ChevronDown, ChevronUp, Clock, Info } from 'lucide-react'

const JA = {
    NAVY:    '#13213C', GOLD:    '#B8960C', GOLD_PALE: '#F5E9C0',
    TEXT:    '#1C2B45', GREY:    '#4B5563', GREY_LT: '#9CA3AF',
    BORDER:  '#E5E7EB', BG:      '#F8FAFC',
    GREEN:   '#10B981', RED:     '#EF4444', ORANGE: '#F59E0B', TEAL: '#0D9488',
} as const

const CARD: React.CSSProperties = {
    background: '#FFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

const MULTIPLIERS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]

function calcCheckDigit(base: string): number {
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
    representanteLegal: string | null
    idRepresentante: string | null
    claseIdRL: string | null
    digitoVerificacion: string | null
    otrasMatriculas: { camara: string; matricula: string; estado: string; renovado: string }[]
}

const KNOWN_NITS = [
    { label: 'DIAN',             nit: '800197268-4' },
    { label: 'Bancolombia',      nit: '890903938-8' },
    { label: 'Grupo Éxito',      nit: '860002137-4' },
    { label: 'EPM',              nit: '890904996-1' },
    { label: 'Ecopetrol',        nit: '899999068-1' },
    { label: 'Davivienda',       nit: '860034313-7' },
    { label: 'Claro Colombia',   nit: '800153993-6' },
    { label: 'Colpatria',        nit: '860007538-1' },
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

export default function NitPage() {
    const [input,      setInput]      = useState('')
    const [result,     setResult]     = useState<NitResult | null>(null)
    const [loading,    setLoading]    = useState(false)
    const [copied,     setCopied]     = useState(false)
    const [showCalc,   setShowCalc]   = useState(false)
    const [autoCalc,   setAutoCalc]   = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const verify = useCallback(async (value: string) => {
        const cleaned = value.replace(/\D/g, '')
        if (cleaned.length < 2) { setResult(null); return }

        setLoading(true)
        try {
            const res  = await fetch(`/api/nit-verify?nit=${cleaned}`)
            const data: NitResult = await res.json()
            setResult(data)
        } catch {
            /* fallback offline: DV local solamente */
            const base     = cleaned.slice(0, -1)
            const given    = parseInt(cleaned.slice(-1))
            const expected = calcCheckDigit(base)
            const n        = parseInt(base)
            const esJur    = (n >= 800_000_000 && n <= 999_999_999)
            setResult({
                valid: given === expected, nit: cleaned, base,
                checkDigit: expected, providedDigit: given,
                formatted: base + '-' + given,
                tipoRango: esJur ? 'Persona Jurídica' : 'Persona Natural',
                subtipo: '', esJuridica: esJur,
                encontrado: false,
                razonSocial: null, estadoMatricula: null, organizacionJuridica: null,
                tipoSociedad: null, categoriaMatricula: null, camaraComercio: null,
                matricula: null, fechaMatricula: null, fechaRenovacion: null,
                ultimoAnoRenovado: null, fechaVigencia: null, fechaCancelacion: null,
                ciuuPrincipal: null, ciuuSecundario: null, ciuu3: null,
                representanteLegal: null, idRepresentante: null, claseIdRL: null,
                digitoVerificacion: String(expected), otrasMatriculas: [],
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
                // Sin guión: calcular DV automáticamente y completar el campo
                const dv   = calcCheckDigit(cleaned)
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
        const digit    = calcCheckDigit(cleaned)
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '32px', fontFamily: 'Inter, sans-serif' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* ── Header ── */}
            <div style={{ borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '18px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 900, color: JA.NAVY, margin: 0, letterSpacing: '-0.02em' }}>
                    Verificador <span style={{ color: JA.GOLD }}>NIT en Vivo</span>
                </h1>
                <p style={{ fontSize: '11px', color: JA.GREY, margin: '4px 0 0' }}>
                    Validación DIAN · Registro Mercantil RUES · Actividad económica CIIU · Representante legal
                </p>
            </div>

            {/* ── Search box ── */}
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
                    Escribe solo la base → el dígito de verificación se calcula automáticamente · Escribe con guión (ej: 900123456-<strong>7</strong>) para validar un DV conocido
                </p>
            </div>

            {/* ── Examples ── */}
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

            {/* ── Result ── */}
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
                        /* ── Full company data ── */
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '14px' }}>

                            {/* Main card */}
                            <div style={CARD}>
                                {/* Company name + status */}
                                <div style={{ padding: '20px', borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: '4px', background: '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {isNatPerson
                                                ? <User      style={{ width: 20, height: 20, color: JA.NAVY }} />
                                                : <Building2 style={{ width: 20, height: 20, color: JA.NAVY }} />
                                            }
                                        </div>
                                        <div>
                                            <h2 style={{ fontSize: '16px', fontWeight: 900, color: JA.NAVY, margin: '0 0 4px', lineHeight: 1.2 }}>
                                                {result.razonSocial}
                                            </h2>
                                            <p style={{ fontSize: '11px', color: JA.GREY, margin: '0 0 8px' }}>
                                                {result.organizacionJuridica} · {result.categoriaMatricula}
                                            </p>
                                            <StatusBadge estado={result.estadoMatricula} />
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', margin: '0 0 2px' }}>NIT</p>
                                        <p style={{ fontSize: '16px', fontWeight: 900, color: JA.NAVY, margin: 0, fontFamily: 'monospace' }}>{result.formatted}</p>
                                    </div>
                                </div>

                                {/* Info rows */}
                                <div style={{ padding: '0 20px 8px' }}>
                                    <InfoRow label="Cámara de Comercio"   value={result.camaraComercio}     highlight />
                                    <InfoRow label="Matrícula Mercantil"  value={result.matricula}          mono />
                                    <InfoRow label="Tipo de Sociedad"     value={result.tipoSociedad}       />
                                    <InfoRow label="Organización Jurídica"value={result.organizacionJuridica}/>
                                    <InfoRow label="Actividad Principal"  value={result.ciuuPrincipal}      />
                                    {result.ciuuSecundario && !result.ciuuSecundario.includes('No clasificada') && (
                                        <InfoRow label="Actividad Secundaria" value={result.ciuuSecundario} />
                                    )}
                                    {result.ciuu3 && !result.ciuu3.includes('No clasificada') && (
                                        <InfoRow label="Actividad Terciaria" value={result.ciuu3} />
                                    )}
                                    <InfoRow label="Fecha Matrícula"      value={result.fechaMatricula}     mono />
                                    <InfoRow label="Última Renovación"    value={result.fechaRenovacion}    mono />
                                    {result.ultimoAnoRenovado && result.ultimoAnoRenovado !== '0' && (
                                        <InfoRow label="Año Renovado"     value={result.ultimoAnoRenovado}  mono />
                                    )}
                                    {result.fechaCancelacion && result.fechaCancelacion !== '—' && (
                                        <InfoRow label="Fecha Cancelación" value={result.fechaCancelacion}  mono />
                                    )}
                                    <InfoRow label="Tipo de Entidad"      value={result.tipoRango}          />
                                </div>
                            </div>

                            {/* Right column: Rep legal + otras matrículas */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                                {/* Representante legal */}
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

                                {/* Otras matrículas */}
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

                                {/* Check digit detail */}
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
                                                        + `\nSuma = ${result.base.replace(/\D/g,'').slice(-9).padStart(9,'0').split('').reverse().reduce((a,c,i)=>a+parseInt(c)*MULTIPLIERS[i],0)}`
                                                        + `    Resto = ${result.base.replace(/\D/g,'').slice(-9).padStart(9,'0').split('').reverse().reduce((a,c,i)=>a+parseInt(c)*MULTIPLIERS[i],0) % 11}`
                                                        + `    DV = ${result.checkDigit}`
                                                })()}
                                            </code>
                                        </div>
                                    )}
                                </div>

                                {/* Source */}
                                <div style={{ padding: '10px 14px', background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock style={{ width: 11, height: 11, color: JA.GREY_LT, flexShrink: 0 }} />
                                    <p style={{ fontSize: '9px', color: JA.GREY_LT, margin: 0, lineHeight: 1.5 }}>
                                        Fuente: Registro Mercantil (datos.gov.co — RUES Confecámaras) · Actualizado cada 24h
                                    </p>
                                </div>
                            </div>
                        </div>

                    ) : (
                        /* ── No en RUES: mostrar todo lo que se puede calcular localmente ── */
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '14px' }}>

                            {/* Datos calculados localmente */}
                            <div style={CARD}>
                                {/* Header tipo persona */}
                                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '4px', background: '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {result.esJuridica
                                            ? <Building2 style={{ width: 20, height: 20, color: JA.NAVY }} />
                                            : <User      style={{ width: 20, height: 20, color: JA.NAVY }} />
                                        }
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '15px', fontWeight: 900, color: JA.NAVY, margin: 0 }}>{result.tipoRango}</p>
                                        {result.subtipo && <p style={{ fontSize: '11px', color: JA.GREY, margin: '2px 0 0' }}>{result.subtipo}</p>}
                                        <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: '4px 0 0' }}>
                                            Sin registro en Cámara de Comercio · El DV fue calculado correctamente
                                        </p>
                                    </div>
                                </div>

                                {/* Datos clave para contabilidad */}
                                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {[
                                        { label: 'NIT / RUT completo',        value: result.formatted,          mono: true,  big: true  },
                                        { label: 'Dígito de Verificación',    value: String(result.checkDigit), mono: true,  big: true  },
                                        { label: 'Base numérica',             value: result.base,               mono: true,  big: false },
                                        { label: 'Tipo de contribuyente',     value: result.tipoRango,          mono: false, big: false },
                                        ...(result.subtipo ? [{ label: 'Clasificación DIAN', value: result.subtipo, mono: false, big: false }] : []),
                                    ].map(({ label, value, mono, big }) => (
                                        <div key={label} style={{ padding: '12px 14px', background: JA.BG, borderRadius: '2px', border: `1px solid ${JA.BORDER}` }}>
                                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 5px' }}>{label}</p>
                                            <p style={{ fontSize: big ? '18px' : '12px', fontWeight: 800, color: JA.NAVY, margin: 0, fontFamily: mono ? 'monospace' : 'inherit', letterSpacing: mono ? '0.05em' : 0 }}>{value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Aviso */}
                                <div style={{ margin: '0 20px 16px', padding: '10px 14px', background: JA.GOLD_PALE, border: `1px solid ${JA.GOLD}40`, borderRadius: '2px', display: 'flex', gap: '8px' }}>
                                    <span style={{ fontSize: '14px', color: JA.GOLD, flexShrink: 0, fontWeight: 900, lineHeight: 1 }}>ℹ</span>
                                    <p style={{ fontSize: '10px', color: JA.TEXT, margin: 0, lineHeight: 1.5 }}>
                                        {result.esJuridica
                                            ? 'Esta empresa no aparece en el Registro Mercantil público (RUES). Puede ser una entidad del Estado, cooperativa, o no tener matrícula mercantil vigente. Verifícala directamente en la DIAN o en el RUES.'
                                            : 'Las personas naturales no aparecen en el Registro Mercantil. El NIT y el DV son correctos. Para nombre y datos del RUT, consulta en el portal de la DIAN con la cédula del contribuyente.'
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Fuentes oficiales */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ ...CARD, padding: '16px' }}>
                                    <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY_LT, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Verificar en fuentes oficiales</p>
                                    {[
                                        { label: 'DIAN — Consulta RUT',        url: 'https://muisca.dian.gov.co/WebRutMuisca/DefConsultaEstadoRUT.faces' },
                                        { label: 'RUES — Registro Mercantil',  url: 'https://www.rues.org.co' },
                                        { label: 'Cámaras de Comercio',        url: 'https://confecamaras.org.co' },
                                    ].map(({ label, url }) => (
                                        <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '2px', border: `1px solid ${JA.BORDER}`, marginBottom: '8px', textDecoration: 'none', background: '#FFF' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT }}>{label}</span>
                                            <ExternalLink style={{ width: 11, height: 11, color: JA.GREY_LT }} />
                                        </a>
                                    ))}
                                </div>

                                {/* Cálculo DV */}
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
