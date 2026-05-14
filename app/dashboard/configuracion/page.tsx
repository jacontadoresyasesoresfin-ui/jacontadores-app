'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    Link2, CheckCircle2, XCircle, AlertTriangle, Save,
    FileSpreadsheet, RefreshCw, Info, ShoppingBag, Loader2,
    Database, FolderOpen
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

interface ProfileConfig {
    id: string
    company_name?: string | null
    google_sheet_url?: string | null
    siigo_url?: string | null
    drive_invoices_url?: string | null
    reconciliation_sheet_url?: string | null
    phone?: string | null
}

function UrlField({
    label, icon: Icon, value, onChange, placeholder, hint
}: {
    label: string
    icon: React.ComponentType<{ style?: React.CSSProperties }>
    value: string
    onChange: (v: string) => void
    placeholder: string
    hint?: string
}) {
    const [focused, setFocused] = useState(false)
    return (
        <div>
            <label style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                {label}
            </label>
            <div style={{ position: 'relative' }}>
                <Icon style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: focused ? JA.GOLD : JA.GREY }} />
                <input
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={placeholder}
                    style={{
                        width: '100%', padding: '10px 12px 10px 36px', fontSize: '13px',
                        border: `1px solid ${focused ? JA.GOLD : JA.BORDER}`,
                        borderRadius: '2px', outline: 'none',
                        background: JA.BG, color: JA.TEXT,
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                    }}
                />
            </div>
            {hint && <p style={{ fontSize: '10px', color: JA.GREY, marginTop: '4px' }}>{hint}</p>}
        </div>
    )
}

export default function ConfiguracionPage() {
    const supabase = useMemo(() => createClient(), [])
    const { activeProfile, profile: myProfile } = useClient()
    const [profileData, setProfileData] = useState<ProfileConfig | null>(null)
    const [form, setForm] = useState({
        company_name: '',
        google_sheet_url: '',
        siigo_url: '',
        drive_invoices_url: '',
        reconciliation_sheet_url: '',
        phone: '',
    })
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; rows?: number; cols?: string[] } | null>(null)
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null)
    const [loading, setLoading] = useState(true)
    const [lastSaved, setLastSaved] = useState<string | null>(null)

    const showToast = (type: 'success' | 'error' | 'info', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 5000)
    }

    const loadProfileData = useCallback(async () => {
        const targetId = activeProfile?.id || myProfile?.id
        if (!targetId) { setLoading(false); return }

        const { data } = await supabase
            .from('profiles')
            .select('id, company_name, google_sheet_url, siigo_url, drive_invoices_url, reconciliation_sheet_url, phone')
            .eq('id', targetId)
            .maybeSingle()

        if (data) {
            setProfileData(data)
            setForm({
                company_name: data.company_name || '',
                google_sheet_url: data.google_sheet_url || '',
                siigo_url: data.siigo_url || '',
                drive_invoices_url: data.drive_invoices_url || '',
                reconciliation_sheet_url: data.reconciliation_sheet_url || '',
                phone: data.phone || '',
            })
        }
        setLoading(false)
    }, [supabase, activeProfile?.id, myProfile?.id])

    useEffect(() => { loadProfileData() }, [loadProfileData])

    /* ── Guardar todas las URLs de configuración ──────────── */
    const handleSave = async () => {
        if (!profileData) return
        setSaving(true)
        try {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetId: profileData.id,
                    company_name: form.company_name,
                    google_sheet_url: form.google_sheet_url,
                    siigo_url: form.siigo_url,
                    drive_invoices_url: form.drive_invoices_url,
                    reconciliation_sheet_url: form.reconciliation_sheet_url,
                    phone: form.phone,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al guardar')

            setProfileData(prev => prev ? { ...prev, ...form } : prev)
            const now = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
            setLastSaved(now)
            setTestResult(null)
            showToast('success', 'Configuración guardada en base de datos')
        } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    /* ── Probar conexión al Sheet de Siigo ────────────────── */
    const handleTestSheet = async () => {
        const url = form.google_sheet_url.trim()
        if (!url) { showToast('error', 'Ingresa primero la URL del Google Sheet'); return }
        setTesting(true)
        setTestResult(null)
        try {
            let csvUrl = url
            if (csvUrl.includes('/d/e/')) {
                // Extraer el ID 2PACX-... y reconstruir la URL correcta con /pub?output=csv en el PATH
                const eMatch = csvUrl.match(/\/d\/e\/([^/?#]+)/)
                csvUrl = eMatch
                    ? `https://docs.google.com/spreadsheets/d/e/${eMatch[1]}/pub?output=csv`
                    : csvUrl + (csvUrl.includes('?') ? '&' : '?') + 'output=csv'
            } else {
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
                msg: 'Conexión exitosa',
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
            Cargando configuración desde base de datos...
        </div>
    )

    return (
        <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}

            {/* Header */}
            <div style={{ borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>
                            Configuración de <span style={{ color: JA.GOLD }}>Fuentes de Datos</span>
                        </h1>
                        <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>
                            Datos guardados en base de datos —{' '}
                            <strong style={{ color: JA.TEXT }}>{profileData?.company_name || 'Empresa'}</strong>.
                            Solo debes configurarlos una vez.
                        </p>
                    </div>
                    {lastSaved && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: JA.GREEN }}>
                            <CheckCircle2 style={{ width: 13, height: 13 }} />
                            Guardado hoy a las {lastSaved}
                        </div>
                    )}
                </div>

                {/* Indicador de datos en BD */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                    {[
                        { label: 'Siigo Sheet', saved: !!profileData?.google_sheet_url },
                        { label: 'Siigo URL', saved: !!profileData?.siigo_url },
                        { label: 'Drive Facturas', saved: !!profileData?.drive_invoices_url },
                        { label: 'Sheet Conciliación', saved: !!profileData?.reconciliation_sheet_url },
                    ].map(({ label, saved }) => (
                        <span key={label} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: '10px', fontWeight: 700, padding: '3px 8px',
                            borderRadius: '2px',
                            background: saved ? JA.GREEN + '15' : JA.BORDER,
                            color: saved ? JA.GREEN : JA.GREY,
                            border: `1px solid ${saved ? JA.GREEN + '40' : JA.BORDER}`,
                        }}>
                            {saved ? <CheckCircle2 style={{ width: 9, height: 9 }} /> : <XCircle style={{ width: 9, height: 9 }} />}
                            {label}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── Sección: Integraciones de Datos ─────────────── */}
            <div style={{ ...cardStyle, borderLeft: `4px solid ${JA.GOLD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '2px', background: JA.NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Database style={{ width: '18px', height: '18px', color: 'white' }} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '14px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Fuentes de Datos</h2>
                        <p style={{ fontSize: '11px', color: JA.GREY, margin: 0 }}>
                            Estas URLs se guardan en la base de datos y se cargan automáticamente en cada módulo.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Siigo Sheet */}
                    <div style={{ background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <FileSpreadsheet style={{ width: '14px', height: '14px', color: JA.GOLD }} />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: JA.TEXT }}>Google Sheet — Informe Siigo</span>
                            {profileData?.google_sheet_url && (
                                <span style={{ fontSize: '9px', fontWeight: 700, color: JA.GREEN, background: JA.GREEN + '15', padding: '2px 6px', borderRadius: '2px' }}>
                                    GUARDADO
                                </span>
                            )}
                        </div>
                        <UrlField
                            label="URL del Sheet de Siigo (Libro Mayor / Ventas)"
                            icon={Link2}
                            value={form.google_sheet_url}
                            onChange={v => setForm(f => ({ ...f, google_sheet_url: v }))}
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            hint="Debe estar compartido como público. El módulo Siigo BI lo carga automáticamente."
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                            <button onClick={handleTestSheet} disabled={testing}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                                    fontSize: '11px', fontWeight: 700, borderRadius: '2px', border: `1px solid ${JA.BORDER}`,
                                    background: 'white', color: JA.TEXT, cursor: 'pointer', opacity: testing ? 0.6 : 1
                                }}>
                                {testing ? <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} /> : <RefreshCw style={{ width: 12, height: 12 }} />}
                                Probar conexión
                            </button>
                        </div>
                        {testResult && (
                            <div style={{
                                padding: '10px 12px', borderRadius: '2px', marginTop: '10px',
                                background: testResult.ok ? JA.GREEN + '10' : JA.RED + '10',
                                border: `1px solid ${testResult.ok ? JA.GREEN + '30' : JA.RED + '30'}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {testResult.ok ? <CheckCircle2 style={{ width: 13, height: 13, color: JA.GREEN }} /> : <XCircle style={{ width: 13, height: 13, color: JA.RED }} />}
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: testResult.ok ? JA.GREEN : JA.RED }}>{testResult.msg}</span>
                                </div>
                                {testResult.ok && testResult.rows !== undefined && (
                                    <p style={{ fontSize: '11px', color: JA.GREY, margin: '4px 0 0 21px' }}>
                                        {testResult.rows} filas detectadas · Columnas: {testResult.cols?.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Siigo URL */}
                    <div style={{ background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <Link2 style={{ width: '14px', height: '14px', color: JA.NAVY }} />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: JA.TEXT }}>URL Siigo Nube</span>
                            {profileData?.siigo_url && (
                                <span style={{ fontSize: '9px', fontWeight: 700, color: JA.GREEN, background: JA.GREEN + '15', padding: '2px 6px', borderRadius: '2px' }}>
                                    GUARDADO
                                </span>
                            )}
                        </div>
                        <UrlField
                            label="URL de acceso a Siigo Nube"
                            icon={Link2}
                            value={form.siigo_url}
                            onChange={v => setForm(f => ({ ...f, siigo_url: v }))}
                            placeholder="https://siigonube.siigo.com/..."
                            hint="Enlace rápido al portal de Siigo. Aparece como acceso directo en el dashboard."
                        />
                    </div>

                    {/* Drive Facturas */}
                    <div style={{ background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <FolderOpen style={{ width: '14px', height: '14px', color: JA.GOLD }} />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: JA.TEXT }}>Carpeta Drive — Facturas Proveedores</span>
                            {profileData?.drive_invoices_url && (
                                <span style={{ fontSize: '9px', fontWeight: 700, color: JA.GREEN, background: JA.GREEN + '15', padding: '2px 6px', borderRadius: '2px' }}>
                                    GUARDADO
                                </span>
                            )}
                        </div>
                        <UrlField
                            label="URL de carpeta Google Drive con facturas PDF"
                            icon={Link2}
                            value={form.drive_invoices_url}
                            onChange={v => setForm(f => ({ ...f, drive_invoices_url: v }))}
                            placeholder="https://drive.google.com/drive/folders/..."
                            hint="El módulo de Causación usa esta carpeta para sincronizar facturas de proveedores masivamente."
                        />
                    </div>

                    {/* Conciliación Sheet */}
                    <div style={{ background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <FileSpreadsheet style={{ width: '14px', height: '14px', color: JA.TEAL }} />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: JA.TEXT }}>Google Sheet — Conciliación Bancaria</span>
                            {profileData?.reconciliation_sheet_url && (
                                <span style={{ fontSize: '9px', fontWeight: 700, color: JA.GREEN, background: JA.GREEN + '15', padding: '2px 6px', borderRadius: '2px' }}>
                                    GUARDADO
                                </span>
                            )}
                        </div>
                        <UrlField
                            label="URL del Sheet de conciliación bancaria"
                            icon={Link2}
                            value={form.reconciliation_sheet_url}
                            onChange={v => setForm(f => ({ ...f, reconciliation_sheet_url: v }))}
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            hint="Usado por el módulo de Conciliación para cargar movimientos bancarios automáticamente."
                        />
                    </div>

                </div>

                {/* Botón guardar global */}
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
                    <p style={{ fontSize: '11px', color: JA.GREY, margin: 0 }}>
                        Los cambios se guardan en la base de datos y se cargan automáticamente en cada sesión.
                    </p>
                    <button onClick={handleSave} disabled={saving}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px',
                            fontSize: '12px', fontWeight: 700, borderRadius: '2px', border: 'none',
                            background: JA.NAVY, color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1,
                            flexShrink: 0,
                        }}>
                        {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 14, height: 14 }} />}
                        {saving ? 'Guardando...' : 'Guardar Todo'}
                    </button>
                </div>
            </div>

            {/* ── Info técnica ────────────────────────────────── */}
            <div style={{ ...cardStyle, borderLeft: `4px solid ${JA.TEAL}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Info style={{ width: '16px', height: '16px', color: JA.TEAL }} />
                    <h2 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Requisitos técnicos</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {[
                        { title: 'Google Sheets', items: ['Archivo → Compartir → Cualquier persona con el enlace puede leer', 'Exportación de Siigo Nube: Libro Diario, Mayor o Ventas', 'No cambiar el orden de columnas originales'] },
                        { title: 'Google Drive', items: ['Carpeta compartida con cuenta de servicio Google', 'Solo archivos PDF de facturas electrónicas DIAN', 'El adminstrador debe configurar GOOGLE_SERVICE_ACCOUNT_KEY en el servidor'] },
                    ].map(({ title, items }) => (
                        <div key={title}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: JA.TEXT, margin: '0 0 6px' }}>{title}</p>
                            <ol style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: JA.GREY, lineHeight: '1.7' }}>
                                {items.map((item, i) => <li key={i}>{item}</li>)}
                            </ol>
                        </div>
                    ))}
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
