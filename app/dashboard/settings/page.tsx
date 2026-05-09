'use client'

import { useState, useEffect } from 'react'
import {
    User, Shield, Database, Save, CheckCircle2, AlertCircle,
    Eye, EyeOff, ExternalLink, Calendar, FileText, Bell
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useClient } from '../ClientContext'
import Link from 'next/link'

const JA = {
    NAVY:    '#13213C', GOLD: '#B8960C', GOLD_PALE: '#F5E9C0',
    TEXT:    '#1C2B45', GREY: '#4B5563', GREY_LT: '#9CA3AF',
    BORDER:  '#E5E7EB', BG: '#F8FAFC', WHITE: '#FFFFFF',
    GREEN:   '#10B981', RED: '#EF4444', ORANGE: '#F59E0B', TEAL: '#0D9488',
} as const

const CARD: React.CSSProperties = {
    background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '2px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px',
}

const INPUT: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: '12px',
    fontFamily: 'Inter, sans-serif', color: '#1C2B45',
    background: '#F8FAFC', border: '1px solid #E5E7EB',
    borderRadius: '2px', outline: 'none', boxSizing: 'border-box',
}

const LABEL: React.CSSProperties = {
    display: 'block', fontSize: '10px', fontWeight: 700, color: '#4B5563',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px',
}

const BTN_PRIMARY: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '7px',
    padding: '9px 20px', fontSize: '11px', fontWeight: 700,
    fontFamily: 'Inter, sans-serif', background: JA.NAVY, color: '#FFF',
    border: 'none', borderRadius: '2px', cursor: 'pointer',
}

type MsgType = { type: 'ok' | 'err'; text: string } | null

/* ── Próximas fechas DIAN 2026 ─────────────────────────── */
const TODAY = new Date()
const DIAN_NOTIF = [
    { label: 'ReteFuente Abril',          fecha: '2026-05-13', tipo: 'retefuente' },
    { label: 'IVA Bimestre Mar–Abr',      fecha: '2026-05-19', tipo: 'iva' },
    { label: 'ReteFuente Mayo',           fecha: '2026-06-11', tipo: 'retefuente' },
    { label: 'IVA Bimestre May–Jun',      fecha: '2026-07-16', tipo: 'iva' },
    { label: 'Renta PJ año gravable 2025',fecha: '2026-08-10', tipo: 'renta' },
].map(d => ({
    ...d,
    dias: Math.ceil((new Date(d.fecha + 'T00:00:00').getTime() - TODAY.getTime()) / 86_400_000)
})).filter(d => d.dias > -1).slice(0, 5)

const TIPO_COLOR: Record<string, string> = { iva: JA.GOLD, retefuente: JA.NAVY, renta: '#0D9488' }

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'perfil' | 'seguridad' | 'notificaciones' | 'integraciones'>('perfil')
    const { profile } = useClient()
    const supabase = createClient()

    /* ── Perfil ─────────────────────────────────────────── */
    const [fullName,    setFullName]    = useState('')
    const [companyName, setCompanyName] = useState('')
    const [phone,       setPhone]       = useState('')
    const [savingP,     setSavingP]     = useState(false)
    const [msgP,        setMsgP]        = useState<MsgType>(null)

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name     || '')
            setCompanyName(profile.company_name || '')
            setPhone(profile.phone            || '')
        }
    }, [profile])

    const saveProfile = async () => {
        if (!profile?.id) return
        setSavingP(true); setMsgP(null)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName, company_name: companyName, phone, updated_at: new Date().toISOString() })
                .eq('id', profile.id)
            if (error) throw error
            setMsgP({ type: 'ok', text: 'Perfil actualizado correctamente.' })
        } catch (err: any) {
            setMsgP({ type: 'err', text: err.message || 'Error al guardar.' })
        } finally {
            setSavingP(false)
        }
    }

    /* ── Seguridad ─────────────────────────────────────── */
    const [newPwd,    setNewPwd]    = useState('')
    const [confPwd,   setConfPwd]   = useState('')
    const [showPwd,   setShowPwd]   = useState(false)
    const [savingS,   setSavingS]   = useState(false)
    const [msgS,      setMsgS]      = useState<MsgType>(null)

    const changePassword = async () => {
        if (newPwd.length < 8)    { setMsgS({ type: 'err', text: 'Mínimo 8 caracteres.' }); return }
        if (newPwd !== confPwd)   { setMsgS({ type: 'err', text: 'Las contraseñas no coinciden.' }); return }
        setSavingS(true); setMsgS(null)
        try {
            const { error } = await supabase.auth.updateUser({ password: newPwd })
            if (error) throw error
            setMsgS({ type: 'ok', text: 'Contraseña actualizada exitosamente.' })
            setNewPwd(''); setConfPwd('')
        } catch (err: any) {
            setMsgS({ type: 'err', text: err.message || 'Error al cambiar contraseña.' })
        } finally {
            setSavingS(false)
        }
    }

    /* ── Sub-componentes ───────────────────────────────── */
    const Msg = ({ msg }: { msg: MsgType }) => msg ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '2px', marginTop: '14px', background: msg.type === 'ok' ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${msg.type === 'ok' ? '#BBF7D0' : '#FECACA'}` }}>
            {msg.type === 'ok'
                ? <CheckCircle2 style={{ width: 14, height: 14, color: JA.GREEN, flexShrink: 0 }} />
                : <AlertCircle  style={{ width: 14, height: 14, color: JA.RED,   flexShrink: 0 }} />}
            <span style={{ fontSize: '12px', fontWeight: 600, color: msg.type === 'ok' ? JA.GREEN : JA.RED }}>{msg.text}</span>
        </div>
    ) : null

    const TABS = [
        { id: 'perfil'          as const, label: 'Perfil',         Icon: User      },
        { id: 'seguridad'       as const, label: 'Seguridad',      Icon: Shield    },
        { id: 'notificaciones'  as const, label: 'Notificaciones', Icon: Bell      },
        { id: 'integraciones'   as const, label: 'Integraciones',  Icon: Database  },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px', fontFamily: 'Inter, sans-serif' }}>

            {/* ── Header ─────────────────────────────────── */}
            <div style={{ borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '18px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 900, color: JA.NAVY, margin: 0, letterSpacing: '-0.02em' }}>
                    Configuración de <span style={{ color: JA.GOLD }}>Cuenta</span>
                </h1>
                <p style={{ fontSize: '11px', color: JA.GREY, margin: '4px 0 0' }}>
                    Administra tu perfil, seguridad e integraciones del sistema
                </p>
            </div>

            {/* ── Tabs ───────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '4px', background: JA.BG, padding: '4px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', width: 'fit-content', flexWrap: 'wrap' }}>
                {TABS.map(({ id, label, Icon }) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', border: 'none', borderRadius: '1px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif', background: activeTab === id ? JA.NAVY : 'transparent', color: activeTab === id ? '#FFF' : JA.GREY }}>
                        <Icon style={{ width: 13, height: 13 }} />
                        {label}
                    </button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════
                TAB: PERFIL
            ══════════════════════════════════════════════ */}
            {activeTab === 'perfil' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={CARD}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY, margin: '0 0 20px' }}>Información Personal</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={LABEL}>Nombre Completo</label>
                                <input style={INPUT} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ej: María Alexandra Pérez" />
                            </div>
                            <div>
                                <label style={LABEL}>Razón Social / Empresa</label>
                                <input style={INPUT} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ej: Mi Empresa S.A.S" />
                            </div>
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={LABEL}>Teléfono / WhatsApp</label>
                            <input style={INPUT} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+57 300 000 0000" />
                        </div>
                        <button onClick={saveProfile} disabled={savingP} style={{ ...BTN_PRIMARY, opacity: savingP ? 0.7 : 1 }}>
                            <Save style={{ width: 13, height: 13 }} />
                            {savingP ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                        <Msg msg={msgP} />
                    </div>

                    {/* Info de cuenta */}
                    <div style={CARD}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY, margin: '0 0 16px' }}>Información de Cuenta</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[
                                { label: 'Rol del sistema',    value: profile?.role === 'superadmin' ? 'Super Administrador' : profile?.role === 'admin' ? 'Administrador' : 'Usuario' },
                                { label: 'ID de usuario',      value: profile?.id?.slice(0, 18) + '...' || '—' },
                                { label: 'Tenant asignado',    value: profile?.tenant_id?.slice(0, 18) + '...' || 'Sin tenant' },
                                { label: 'Miembro desde',      value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                            ].map((row, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: i % 2 === 0 ? JA.BG : '#FFF', borderRadius: '2px' }}>
                                    <span style={{ fontSize: '11px', color: JA.GREY }}>{row.label}</span>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT, fontFamily: 'monospace' }}>{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                TAB: SEGURIDAD
            ══════════════════════════════════════════════ */}
            {activeTab === 'seguridad' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={CARD}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY, margin: '0 0 6px' }}>Cambiar Contraseña</h3>
                        <p style={{ fontSize: '11px', color: JA.GREY_LT, margin: '0 0 20px' }}>Mínimo 8 caracteres. Usa una combinación de letras, números y símbolos.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                            <div>
                                <label style={LABEL}>Nueva Contraseña</label>
                                <div style={{ position: 'relative' }}>
                                    <input type={showPwd ? 'text' : 'password'} style={{ ...INPUT, paddingRight: '40px' }}
                                        value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="••••••••" />
                                    <button onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: JA.GREY_LT, padding: 0 }}>
                                        {showPwd ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label style={LABEL}>Confirmar Contraseña</label>
                                <input type={showPwd ? 'text' : 'password'} style={INPUT}
                                    value={confPwd} onChange={e => setConfPwd(e.target.value)} placeholder="••••••••" />
                                {confPwd && newPwd !== confPwd && (
                                    <p style={{ fontSize: '10px', color: JA.RED, margin: '4px 0 0' }}>Las contraseñas no coinciden</p>
                                )}
                            </div>
                        </div>
                        <button onClick={changePassword} disabled={savingS || !newPwd || !confPwd} style={{ ...BTN_PRIMARY, opacity: savingS || !newPwd ? 0.7 : 1 }}>
                            <Shield style={{ width: 13, height: 13 }} />
                            {savingS ? 'Actualizando...' : 'Cambiar Contraseña'}
                        </button>
                        <Msg msg={msgS} />
                    </div>

                    <div style={CARD}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY, margin: '0 0 14px' }}>Sesión Activa</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                                { label: 'Autenticación',        value: 'Supabase Auth — JWT' },
                                { label: 'Tipo de sesión',       value: 'Web browser — HttpOnly cookie' },
                                { label: 'Política de acceso',   value: 'Row Level Security (RLS) habilitado' },
                            ].map((row, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: JA.BG, borderRadius: '2px' }}>
                                    <span style={{ fontSize: '11px', color: JA.GREY }}>{row.label}</span>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT }}>{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                TAB: NOTIFICACIONES
            ══════════════════════════════════════════════ */}
            {activeTab === 'notificaciones' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={CARD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <div style={{ width: 30, height: 30, background: JA.NAVY, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Calendar style={{ width: 14, height: 14, color: JA.GOLD }} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Alertas Tributarias DIAN 2026</h3>
                                <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>Próximas obligaciones fiscales activas en el panel</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {DIAN_NOTIF.map((d, i) => {
                                const urg    = d.dias <= 5 ? JA.RED : d.dias <= 20 ? JA.ORANGE : JA.GREY
                                const bgCard = d.dias <= 5 ? '#FEF2F2' : d.dias <= 20 ? '#FFFBEB' : JA.BG
                                const tc     = TIPO_COLOR[d.tipo] || JA.GREY
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: bgCard, borderRadius: '2px', border: `1px solid ${d.dias <= 5 ? '#FECACA' : JA.BORDER}` }}>
                                        <div style={{ width: 40, height: 38, background: tc, borderRadius: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span style={{ fontSize: '12px', fontWeight: 900, color: '#FFF', lineHeight: 1 }}>{d.dias}</span>
                                            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.75)' }}>días</span>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '12px', fontWeight: 700, color: JA.TEXT, margin: '0 0 2px' }}>{d.label}</p>
                                            <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>
                                                Fecha límite: {new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <span style={{ fontSize: '9px', fontWeight: 800, color: urg, textTransform: 'uppercase', flexShrink: 0 }}>
                                            {d.dias === 0 ? 'HOY' : d.dias <= 1 ? 'MAÑANA' : `${d.dias}d`}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div style={CARD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                            <Bell style={{ width: 14, height: 14, color: JA.GOLD }} />
                            <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Notificaciones por Email</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[
                                { label: 'Alertas de vencimiento DIAN',    sub: '7 días antes de cada obligación fiscal',   enabled: true  },
                                { label: 'Reporte mensual de ventas',       sub: 'Resumen automático cada primer día del mes', enabled: true  },
                                { label: 'Alertas de cartera vencida',      sub: 'Cuando supere el 20% del total',            enabled: false },
                                { label: 'Nuevos clientes detectados',      sub: 'Al identificar nuevos NIT en el Sheet',      enabled: false },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: JA.BG, borderRadius: '2px', border: `1px solid ${JA.BORDER}` }}>
                                    <div>
                                        <p style={{ fontSize: '12px', fontWeight: 600, color: JA.TEXT, margin: '0 0 2px' }}>{item.label}</p>
                                        <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>{item.sub}</p>
                                    </div>
                                    <div style={{ width: 36, height: 20, borderRadius: '10px', background: item.enabled ? JA.NAVY : JA.BORDER, position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#FFF', position: 'absolute', top: 3, left: item.enabled ? 18 : 4, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p style={{ fontSize: '10px', color: JA.GREY_LT, marginTop: '12px', margin: '12px 0 0' }}>
                            La activación de notificaciones por email requiere configuración SMTP. Contacta al administrador.
                        </p>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                TAB: INTEGRACIONES
            ══════════════════════════════════════════════ */}
            {activeTab === 'integraciones' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Google Sheets */}
                    <div style={CARD}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                                <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY, margin: '0 0 3px' }}>Google Sheets — Datos de Facturación</h3>
                                <p style={{ fontSize: '11px', color: JA.GREY_LT, margin: 0 }}>Fuente principal de datos: ventas, clientes, productos</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, color: profile?.google_sheet_url ? JA.GREEN : JA.ORANGE, background: profile?.google_sheet_url ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${profile?.google_sheet_url ? '#BBF7D0' : '#FDE68A'}`, padding: '4px 10px', borderRadius: '2px' }}>
                                {profile?.google_sheet_url ? <CheckCircle2 style={{ width: 11, height: 11 }} /> : <AlertCircle style={{ width: 11, height: 11 }} />}
                                {profile?.google_sheet_url ? 'CONECTADO' : 'SIN CONFIGURAR'}
                            </div>
                        </div>
                        {profile?.google_sheet_url ? (
                            <div style={{ padding: '10px 12px', background: JA.BG, borderRadius: '2px', marginBottom: '14px', fontFamily: 'monospace', fontSize: '11px', color: JA.GREY, wordBreak: 'break-all' }}>
                                {profile.google_sheet_url.slice(0, 80)}...
                            </div>
                        ) : (
                            <div style={{ padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '2px', marginBottom: '14px', fontSize: '11px', color: '#92400E' }}>
                                No hay un Google Sheet configurado. El dashboard no puede cargar datos de facturación.
                            </div>
                        )}
                        <Link href="/dashboard/configuracion"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 18px', fontSize: '11px', fontWeight: 700, background: JA.NAVY, color: '#FFF', borderRadius: '2px', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
                            <ExternalLink style={{ width: 12, height: 12 }} />
                            Gestionar Sheet
                        </Link>
                    </div>

                    {/* Siigo */}
                    <div style={CARD}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div>
                                <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY, margin: '0 0 3px' }}>Siigo — Software Contable</h3>
                                <p style={{ fontSize: '11px', color: JA.GREY_LT, margin: 0 }}>Importa Libro Diario, Mayor, Ventas o Cartera desde Siigo</p>
                            </div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: JA.TEAL || '#0D9488', background: '#F0FDFA', border: '1px solid #CCFBF1', padding: '4px 10px', borderRadius: '2px' }}>
                                VÍA SHEET
                            </div>
                        </div>
                        <p style={{ fontSize: '11px', color: JA.GREY, margin: '0 0 14px', lineHeight: 1.6 }}>
                            Exporta cualquier informe de Siigo como CSV → súbelo a un Google Sheet público → pégalo en el módulo Siigo BI del dashboard.
                        </p>
                        <Link href="/dashboard/siigo"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 18px', fontSize: '11px', fontWeight: 700, background: '#FFF', color: JA.NAVY, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
                            <FileText style={{ width: 12, height: 12 }} />
                            Ir a Siigo BI
                        </Link>
                    </div>

                    {/* Conciliación DIAN */}
                    <div style={CARD}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div>
                                <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY, margin: '0 0 3px' }}>Conciliación DIAN — PDFs y Sheets</h3>
                                <p style={{ fontSize: '11px', color: JA.GREY_LT, margin: 0 }}>Cruza facturas electrónicas por CUFE, NIT y valor</p>
                            </div>
                        </div>
                        <p style={{ fontSize: '11px', color: JA.GREY, margin: '0 0 14px', lineHeight: 1.6 }}>
                            Conecta tu carpeta de Drive con PDFs de facturas DIAN o un reporte MUISCA en Sheet. El sistema detecta CUFE automáticamente.
                        </p>
                        <Link href="/dashboard/reconciliation"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 18px', fontSize: '11px', fontWeight: 700, background: '#FFF', color: JA.NAVY, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
                            <ExternalLink style={{ width: 12, height: 12 }} />
                            Ir a Conciliación
                        </Link>
                    </div>

                    {/* Módulos activos */}
                    {profile?.app_modules && profile.app_modules.length > 0 && (
                        <div style={CARD}>
                            <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY, margin: '0 0 14px' }}>Módulos Habilitados</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {profile.app_modules.map((mod, i) => (
                                    <span key={i} style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '1px', background: JA.NAVY, color: '#FFF', fontFamily: 'Inter, sans-serif' }}>
                                        {mod.replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
