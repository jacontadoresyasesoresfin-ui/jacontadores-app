'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    Link2, CheckCircle2, XCircle, AlertTriangle, Save,
    FileSpreadsheet, RefreshCw, Info, ShoppingBag, Eye, EyeOff, Loader2
} from 'lucide-react'
import { useClient } from '../ClientContext'

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
    BORDER:  '#E5E7EB',
    BG:      '#F8FAFC',
}

const cardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    border: `1px solid ${JA.BORDER}`,
    borderRadius: '2px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    padding: '24px',
    marginBottom: '20px',
}

function Toast({ type, msg, onClose }: { type: 'success' | 'error' | 'info', msg: string, onClose: () => void }) {
    const colors = {
        success: { bg: JA.GREEN, text: '#FFFFFF' },
        error:   { bg: JA.RED,   text: '#FFFFFF' },
        info:    { bg: JA.NAVY,  text: '#FFFFFF' },
    }
    const c = colors[type]
    return (
        <div style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 18px', borderRadius: '2px',
            background: c.bg, color: c.text,
            fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
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
    const { activeProfile, profile: myProfile } = useClient()
    const [profile, setProfile]     = useState<{ id: string; google_sheet_url?: string | null; company_name?: string | null } | null>(null)
    const [sheetUrl, setSheetUrl]   = useState('')
    const [sheetFocused, setSheetFocused] = useState(false)
    const [saving, setSaving]       = useState(false)
    const [testing, setTesting]     = useState(false)
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; rows?: number; cols?: string[] } | null>(null)
    const [toast, setToast]         = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null)
    const [loading, setLoading]     = useState(true)

    const showToast = (type: 'success' | 'error' | 'info', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 5000)
    }

    const loadProfileData = useCallback(async () => {
        const targetId = activeProfile?.id || myProfile?.id
        if (!targetId) { setLoading(false); return }
        
        const { data } = await supabase
            .from('profiles')
            .select('id, google_sheet_url, company_name')
            .eq('id', targetId)
            .maybeSingle()
        
        setProfile(data)
        setSheetUrl(data?.google_sheet_url || '')
        setLoading(false)
    }, [supabase, activeProfile?.id, myProfile?.id])

    useEffect(() => { loadProfileData() }, [loadProfileData])

    /* ── Guardar URL del Sheet ────────────────────────────── */
    const handleSaveSheet = async () => {
        if (!profile) return
        setSaving(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ google_sheet_url: sheetUrl.trim() })
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
            let csvUrl = sheetUrl.trim()
            // Formato publicado: /d/e/2PACX-... (ya es exportable directamente)
            if (csvUrl.includes('/d/e/')) {
                // Si ya tiene output=csv lo usamos directo, sino lo agregamos
                if (!csvUrl.includes('output=csv')) {
                    csvUrl = csvUrl.replace(/\/pub.*$/, '/pub?output=csv')
                    if (!csvUrl.includes('pub?')) csvUrl += (csvUrl.includes('?') ? '&' : '?') + 'output=csv'
                }
            } else {
                // Formato edición: /d/SHEET_ID/edit → convertir a export
                const match = csvUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
                if (match) {
                    const gidMatch = csvUrl.match(/gid=([0-9]+)/)
                    csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gidMatch?.[1] ?? '0'}`
                }
            }

            const res = await fetch(`/api/sheets-proxy?url=${encodeURIComponent(csvUrl)}`)
            if (!res.ok) throw new Error(`HTTP ${res.status}: El Sheet no es accesible. Verifica que sea público.`)
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

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 32, color: JA.GREY, fontFamily: 'Inter, sans-serif' }}>
            <div style={{ width: 18, height: 18, border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            Sincronizando parámetros...
        </div>
    )

    return (
        <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}

            {/* Header */}
            <div style={{ borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>
                    Configuración de <span style={{ color: JA.GOLD }}>Fuentes de Datos</span>
                </h1>
                <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>
                    Gestiona los conectores de Google Sheets y parámetros de integración para <strong style={{ color: JA.TEXT }}>{profile?.company_name || 'Empresa'}</strong>.
                </p>
            </div>

            {/* ── Sección: Google Sheet ────────────────────────── */}
            <div style={{ ...cardStyle, borderLeft: `4px solid ${JA.GOLD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '2px', background: JA.NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileSpreadsheet style={{ width: '18px', height: '18px', color: 'white' }} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '14px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Conector Siigo ERP</h2>
                        <p style={{ fontSize: '11px', color: JA.GREY, margin: 0 }}>Sincronización vía Google Sheets CSV Export.</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>URL del Informe Google Sheets</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Link2 style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: JA.GREY }} />
                            <input
                                value={sheetUrl}
                                onChange={e => setSheetUrl(e.target.value)}
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                style={{
                                    width: '100%', padding: '10px 12px 10px 36px', fontSize: '13px',
                                    border: `1px solid ${JA.BORDER}`, borderRadius: '2px', outline: 'none',
                                    background: JA.BG, color: JA.TEXT
                                }}
                            />
                        </div>
                        <button onClick={handleTestSheet} disabled={testing}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px',
                                fontSize: '11px', fontWeight: 700, borderRadius: '2px', border: `1px solid ${JA.BORDER}`,
                                background: 'white', color: JA.TEXT, cursor: 'pointer', opacity: testing ? 0.6 : 1
                            }}>
                            {testing ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <RefreshCw style={{ width: 14, height: 14 }} />}
                            PROBAR
                        </button>
                        <button onClick={handleSaveSheet} disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px',
                                fontSize: '11px', fontWeight: 700, borderRadius: '2px', border: 'none',
                                background: JA.NAVY, color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1
                            }}>
                            {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 14, height: 14 }} />}
                            GUARDAR
                        </button>
                    </div>

                    {testResult && (
                        <div style={{
                            padding: '12px', borderRadius: '2px', marginTop: '8px',
                            background: testResult.ok ? JA.GREEN + '10' : JA.RED + '10',
                            border: `1px solid ${testResult.ok ? JA.GREEN + '30' : JA.RED + '30'}`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                {testResult.ok ? <CheckCircle2 style={{ width: 14, height: 14, color: JA.GREEN }} /> : <XCircle style={{ width: 14, height: 14, color: JA.RED }} />}
                                <span style={{ fontSize: '12px', fontWeight: 700, color: testResult.ok ? JA.GREEN : JA.RED }}>{testResult.msg}</span>
                            </div>
                            {testResult.ok && testResult.rows !== undefined && (
                                <p style={{ fontSize: '11px', color: JA.GREY, margin: 0, marginLeft: '22px' }}>
                                    Detectadas {testResult.rows} filas. Columnas: {testResult.cols?.join(', ')}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '20px', padding: '12px', background: JA.BG, borderRadius: '2px', border: `1px solid ${JA.BORDER}` }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: JA.TEXT, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Info style={{ width: '14px', height: '14px', color: JA.GOLD }} />
                        Requerimientos Técnicos
                    </p>
                    <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '11px', color: JA.GREY, lineHeight: '1.6' }}>
                        <li>El archivo debe ser una exportación de <strong>Siigo Nube</strong>.</li>
                        <li>Debe estar compartido como <strong>"Cualquier persona con el enlace puede leer"</strong>.</li>
                        <li>Asegúrese de no cambiar el orden de las columnas originales.</li>
                    </ol>
                </div>
            </div>

            {/* ── Sección: Ecommerce ────────────────────────── */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '2px', background: JA.GOLD + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShoppingBag style={{ width: '18px', height: '18px', color: JA.GOLD }} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '14px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Canales de Venta (Ecommerce)</h2>
                        <p style={{ fontSize: '11px', color: JA.GREY, margin: 0 }}>Conexión API para Marketplaces y Tiendas.</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                    {['Mercado Libre', 'Shopify', 'Dropi', 'Tienda Nube', 'WooCommerce'].map(p => (
                        <div key={p} style={{ 
                            padding: '12px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', 
                            textAlign: 'center', background: JA.BG
                        }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: JA.TEXT, margin: '0 0 4px' }}>{p}</p>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: JA.GOLD, textTransform: 'uppercase' }}>Inactivo</span>
                        </div>
                    ))}
                </div>
                
                <p style={{ fontSize: '10px', color: JA.GREY, marginTop: '16px', fontStyle: 'italic' }}>
                    * Las integraciones API requieren credenciales de desarrollador. Solicite la activación a su consultor J&A.
                </p>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </div>
    )
}
