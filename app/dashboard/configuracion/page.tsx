'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    Link2, CheckCircle2, XCircle, AlertTriangle, Save,
    FileSpreadsheet, RefreshCw, Info, ShoppingBag, Eye, EyeOff, Loader2
} from 'lucide-react'

/* ── Paleta J&A ────────────────────────────────────────── */
const JA = {
    NAVY:    '#13213C',
    GOLD:    '#B8960C',
    GOLD_LT: '#D4A843',
    CREAM:   '#F4F4F0',
    WHITE:   '#FFFFFF',
    TEXT:    '#1C2B45',
    GREY:    '#6B7A8D',
    TEAL:    '#0F7B71',
    GREEN:   '#059669',
    RED:     '#DC2626',
}

const card: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1.5px solid #E0DDD8',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(19,33,60,0.06)',
    padding: '22px',
    marginBottom: '20px',
}

function Toast({ type, msg, onClose }: { type: 'success' | 'error' | 'info', msg: string, onClose: () => void }) {
    const colors = {
        success: { bg: '#059669', text: '#FFFFFF' },
        error:   { bg: '#DC2626', text: '#FFFFFF' },
        info:    { bg: JA.NAVY,   text: '#FFFFFF' },
    }
    const c = colors[type]
    return (
        <div style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 18px', borderRadius: '12px',
            background: c.bg, color: c.text,
            fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            animation: 'slideDown 0.3s ease',
        }}>
            {type === 'success' ? <CheckCircle2 style={{ width: 16, height: 16 }} /> :
             type === 'error' ? <XCircle style={{ width: 16, height: 16 }} /> :
             <Info style={{ width: 16, height: 16 }} />}
            {msg}
            <button onClick={onClose} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
    )
}

export default function ConfiguracionPage() {
    const supabase = useMemo(() => createClient(), [])
    const [profile, setProfile]     = useState<{ id: string; google_sheet_url?: string | null; company_name?: string | null } | null>(null)
    const [sheetUrl, setSheetUrl]   = useState('')
    const [sheetFocused, setSheetFocused] = useState(false)
    const [saving, setSaving]       = useState(false)
    const [testing, setTesting]     = useState(false)
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; rows?: number; cols?: string[] } | null>(null)
    const [toast, setToast]         = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null)
    const [loading, setLoading]     = useState(true)
    const [showPassword, setShowPassword] = useState(false)

    const showToast = (type: 'success' | 'error' | 'info', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 5000)
    }

    const loadProfile = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setLoading(false); return }
        const { data } = await supabase
            .from('profiles')
            .select('id, google_sheet_url, company_name')
            .eq('id', session.user.id)
            .maybeSingle()
        setProfile(data)
        setSheetUrl(data?.google_sheet_url || '')
        setLoading(false)
    }, [supabase])

    useEffect(() => { loadProfile() }, [loadProfile])

    /* ── Guardar URL del Sheet ────────────────────────────── */
    const handleSaveSheet = async () => {
        if (!profile) return
        setSaving(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ google_sheet_url: sheetUrl.trim(), updated_at: new Date().toISOString() })
                .eq('id', profile.id)
            if (error) throw error
            setProfile(p => p ? { ...p, google_sheet_url: sheetUrl.trim() } : p)
            showToast('success', '✅ URL del Sheet guardada correctamente')
            setTestResult(null)
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    /* ── Probar conexión al Sheet ─────────────────────────── */
    const handleTestSheet = async () => {
        if (!sheetUrl.trim()) { showToast('error', 'Ingresa primero la URL del Google Sheet'); return }
        setTesting(true)
        setTestResult(null)
        try {
            // Convertir a URL de exportación CSV si es necesario
            let csvUrl = sheetUrl.trim()
            const match = csvUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
            if (match) {
                const gidMatch = csvUrl.match(/gid=([0-9]+)/)
                csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gidMatch?.[1] ?? '0'}`
            }

            const res = await fetch(`/api/sheets-proxy?url=${encodeURIComponent(csvUrl)}`)
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
            const text = await res.text()
            if (!text || text.length < 5) throw new Error('El Sheet está vacío o no es público')

            const lines = text.split('\n').filter(l => l.trim())
            const headers = lines[0]?.split(',').map(h => h.replace(/"/g, '').trim()) || []

            setTestResult({
                ok: true,
                msg: `Conexión exitosa`,
                rows: lines.length - 1,
                cols: headers.slice(0, 8)
            })
        } catch (e) {
            setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Error de conexión' })
        } finally {
            setTesting(false)
        }
    }

    const convertUrl = (url: string) => {
        const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
        if (m) {
            const g = url.match(/gid=([0-9]+)/)
            return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${g?.[1] ?? '0'}`
        }
        return url
    }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 32, color: JA.GREY, fontFamily: 'Inter, sans-serif' }}>
            <div style={{ width: 18, height: 18, border: `2px solid ${JA.GOLD}20`, borderTopColor: JA.GOLD, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            Cargando configuración...
        </div>
    )

    return (
        <div style={{ maxWidth: 720, fontFamily: 'Inter, Montserrat, sans-serif' }}>
            {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}

            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: JA.TEXT, fontFamily: 'Montserrat, sans-serif', letterSpacing: '-0.02em', margin: '0 0 4px' }}>
                    Configuración del <span style={{ color: JA.GOLD }}>Portal</span>
                </h1>
                <p style={{ fontSize: 12, color: JA.GREY, margin: 0 }}>
                    Gestiona tu Google Sheet de Siigo y las integraciones de tu empresa
                </p>
            </div>

            {/* ── Sección: Google Sheet ────────────────────────── */}
            <div style={{ ...card, borderLeft: `4px solid ${JA.GOLD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: JA.NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileSpreadsheet style={{ width: 17, height: 17, color: JA.GOLD_LT }} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: 14, fontWeight: 800, color: JA.TEXT, margin: 0, fontFamily: 'Montserrat, sans-serif' }}>
                            Informe Siigo — Google Sheets
                        </h2>
                        <p style={{ fontSize: 11, color: JA.GREY, margin: 0 }}>
                            URL del Google Sheet público con tus datos contables
                        </p>
                    </div>
                </div>

                {profile?.company_name && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: JA.TEAL, marginBottom: 12, padding: '4px 10px', background: 'rgba(15,123,113,0.08)', borderRadius: 6, width: 'fit-content' }}>
                        🏢 {profile.company_name}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        URL del Google Sheet de Siigo
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                            <Link2 style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: sheetFocused ? JA.GOLD : JA.GREY }} />
                            <input
                                value={sheetUrl}
                                onChange={e => setSheetUrl(e.target.value)}
                                onFocus={() => setSheetFocused(true)}
                                onBlur={() => setSheetFocused(false)}
                                placeholder="https://docs.google.com/spreadsheets/d/SHEET_ID/edit"
                                style={{
                                    width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                                    fontSize: 12, fontFamily: 'Inter, sans-serif', color: JA.TEXT,
                                    background: '#F9F7F2', border: `1.5px solid ${sheetFocused ? JA.GOLD : '#E0DDD8'}`,
                                    borderRadius: 10, outline: 'none',
                                    boxShadow: sheetFocused ? `0 0 0 3px rgba(184,150,12,0.1)` : 'none',
                                    transition: 'all 0.15s',
                                }}
                            />
                        </div>
                        <button onClick={handleTestSheet} disabled={testing}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
                                fontSize: 12, fontWeight: 700, borderRadius: 10, border: `1.5px solid #E0DDD8`,
                                background: '#F9F7F2', color: JA.TEXT, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                                opacity: testing ? 0.7 : 1,
                            }}>
                            {testing ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <RefreshCw style={{ width: 13, height: 13 }} />}
                            Probar
                        </button>
                        <button onClick={handleSaveSheet} disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
                                fontSize: 12, fontWeight: 700, borderRadius: 10, border: 'none',
                                background: `linear-gradient(135deg, ${JA.NAVY}, #1C3460)`,
                                color: '#FFFFFF', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                                boxShadow: '0 3px 10px rgba(19,33,60,0.25)',
                                opacity: saving ? 0.7 : 1,
                            }}>
                            {saving ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 13, height: 13 }} />}
                            Guardar
                        </button>
                    </div>

                    {/* Resultado del test */}
                    {testResult && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px',
                            borderRadius: 10, marginTop: 4,
                            background: testResult.ok ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.06)',
                            border: `1px solid ${testResult.ok ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.2)'}`,
                        }}>
                            {testResult.ok
                                ? <CheckCircle2 style={{ width: 14, height: 14, color: JA.GREEN, flexShrink: 0, marginTop: 1 }} />
                                : <XCircle style={{ width: 14, height: 14, color: JA.RED, flexShrink: 0, marginTop: 1 }} />}
                            <div>
                                <p style={{ fontSize: 12, fontWeight: 700, color: testResult.ok ? JA.GREEN : JA.RED, margin: '0 0 2px' }}>
                                    {testResult.ok ? `✅ ${testResult.msg} — ${testResult.rows?.toLocaleString()} filas detectadas` : `❌ ${testResult.msg}`}
                                </p>
                                {testResult.ok && testResult.cols && (
                                    <p style={{ fontSize: 10, color: JA.GREY, margin: 0 }}>
                                        Columnas: <strong style={{ color: JA.TEXT }}>{testResult.cols.join(' · ')}</strong>
                                    </p>
                                )}
                                {!testResult.ok && (
                                    <p style={{ fontSize: 10, color: JA.GREY, margin: '4px 0 0', lineHeight: 1.5 }}>
                                        Verifica: (1) El Sheet es público, (2) La URL es correcta, (3) El Sheet tiene datos
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Instrucciones */}
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F9F7F2', border: '1px solid #E0DDD8', marginTop: 4 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: JA.TEXT, margin: '0 0 6px' }}>
                            <Info style={{ width: 11, height: 11, display: 'inline', marginRight: 4, color: JA.GOLD }} />
                            Cómo obtener la URL del Sheet de Siigo
                        </p>
                        <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: JA.GREY, lineHeight: 1.8 }}>
                            <li>En Siigo, exporta el informe (Libro Mayor, Diario, Ventas o Cartera) como <strong style={{ color: JA.TEXT }}>Google Sheets</strong></li>
                            <li>Abre el Sheet → <strong style={{ color: JA.TEXT }}>Compartir</strong> → <em>"Cualquier persona con el enlace puede ver"</em></li>
                            <li>Copia la URL de la barra de direcciones y pégala aquí</li>
                            <li>Haz clic en <strong style={{ color: JA.NAVY }}>"Probar"</strong> para verificar y luego <strong style={{ color: JA.NAVY }}>"Guardar"</strong></li>
                        </ol>
                    </div>
                </div>

                {profile?.google_sheet_url && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 style={{ width: 13, height: 13, color: JA.GREEN }} />
                        <span style={{ fontSize: 11, color: JA.GREEN, fontWeight: 600 }}>Sheet configurado</span>
                        <span style={{ fontSize: 10, color: JA.GREY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                            {profile.google_sheet_url}
                        </span>
                        <a href={`/dashboard/siigo`} style={{ fontSize: 11, color: JA.GOLD, fontWeight: 700, textDecoration: 'none', marginLeft: 'auto', flexShrink: 0 }}>
                            Ir a Siigo BI →
                        </a>
                    </div>
                )}
            </div>

            {/* ── Sección: Integraciones Ecommerce ─────────────── */}
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShoppingBag style={{ width: 17, height: 17, color: JA.GOLD }} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: 14, fontWeight: 800, color: JA.TEXT, margin: 0, fontFamily: 'Montserrat, sans-serif' }}>
                            Integraciones Ecommerce
                        </h2>
                        <p style={{ fontSize: 11, color: JA.GREY, margin: 0 }}>
                            Mercado Libre · Shopify · TiendaNube · Dropi · WooCommerce
                        </p>
                    </div>
                </div>

                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10
                }}>
                    {[
                        { key: 'mercadolibre', label: 'Mercado Libre', emoji: '🛒', color: '#FFE600', textColor: '#333' },
                        { key: 'shopify',      label: 'Shopify',       emoji: '🏪', color: '#96BF48', textColor: '#FFF' },
                        { key: 'tiendanube',   label: 'Tienda Nube',   emoji: '☁️', color: '#0EA5E9', textColor: '#FFF' },
                        { key: 'dropi',        label: 'Dropi',         emoji: '📦', color: '#3B82F6', textColor: '#FFF' },
                        { key: 'woocommerce',  label: 'WooCommerce',   emoji: '🔷', color: '#9333EA', textColor: '#FFF' },
                    ].map(p => (
                        <div key={p.key} style={{
                            padding: '12px 14px', borderRadius: 12,
                            background: '#F9F7F2', border: '1.5px solid #E0DDD8',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                            cursor: 'default',
                        }}>
                            <span style={{ fontSize: 22 }}>{p.emoji}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: JA.TEXT, textAlign: 'center' }}>{p.label}</span>
                            <span style={{ fontSize: 9, fontWeight: 600, color: JA.GREY, padding: '2px 8px', borderRadius: 8, background: '#EDEAE4' }}>
                                Configurar en Admin →
                            </span>
                        </div>
                    ))}
                </div>

                <p style={{ fontSize: 11, color: JA.GREY, marginTop: 12, padding: '10px 12px', background: '#F9F7F2', borderRadius: 8, border: '1px solid #E0DDD8' }}>
                    <AlertTriangle style={{ width: 11, height: 11, display: 'inline', color: JA.GOLD, marginRight: 4 }} />
                    Las integraciones de Ecommerce se configuran desde el <strong style={{ color: JA.TEXT }}>Panel Maestro → Admin</strong> para cada empresa cliente.
                </p>
            </div>

            {/* ── Sección: Info del Sistema ─────────────────────── */}
            <div style={card}>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: JA.TEXT, margin: '0 0 14px', fontFamily: 'Montserrat, sans-serif' }}>
                    Información del Sistema
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                        { label: 'Portal BI', value: 'J&A Contadores v2.0' },
                        { label: 'Base de datos', value: 'Supabase PostgreSQL' },
                        { label: 'Analítica',  value: 'Google Sheets + Power BI' },
                        { label: 'Soporte',    value: 'info@jacontadores.com' },
                    ].map((item, i) => (
                        <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: '#F9F7F2', border: '1px solid #EDEAE4' }}>
                            <p style={{ fontSize: 9, fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }}>{item.label}</p>
                            <p style={{ fontSize: 12, fontWeight: 600, color: JA.TEXT, margin: 0 }}>{item.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes slideDown { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </div>
    )
}
