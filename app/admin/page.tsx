'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import {
    UserPlus, Building2, Shield, Users, Trash2, Edit2, X, Save,
    LayoutDashboard, ExternalLink, RefreshCw, Eye, EyeOff,
    CheckCircle2, XCircle, AlertTriangle, Link2, FileSpreadsheet,
    Loader2, Store, Crown, Info, ChevronDown, ChevronUp
} from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import Link from 'next/link'

/* ── Paleta J&A ────────────────────────────────────────── */
const JA = {
    NAVY:    '#13213C',
    NAVY_MID:'#1C3460',
    GOLD:    '#B8960C',
    GOLD_LT: '#D4A843',
    CREAM:   '#F4F4F0',
    WHITE:   '#FFFFFF',
    TEXT:    '#1C2B45',
    GREY:    '#6B7A8D',
    GREY_LT: '#A0AEBF',
    TEAL:    '#0F7B71',
    GREEN:   '#059669',
    RED:     '#DC2626',
    PURPLE:  '#7C3AED',
    AMBER:   '#D97706',
}

const card: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1.5px solid #E0DDD8',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(19,33,60,0.06)',
    padding: '22px',
}

const input = (focused: boolean): React.CSSProperties => ({
    width: '100%', padding: '10px 12px', fontSize: 12,
    fontFamily: 'Inter, sans-serif', color: JA.TEXT,
    background: '#F9F7F2', outline: 'none',
    border: `1.5px solid ${focused ? JA.GOLD : '#E0DDD8'}`,
    borderRadius: 10, transition: 'all 0.15s',
    boxShadow: focused ? `0 0 0 3px rgba(184,150,12,0.1)` : 'none',
})

const label: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: JA.GREY,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    marginBottom: 4, display: 'block',
    fontFamily: 'Inter, sans-serif',
}

interface Profile {
    id: string; role: string; full_name?: string | null;
    company_name?: string | null; google_sheet_url?: string | null;
    phone?: string | null; tenant_id?: string | null; created_at?: string;
    email?: string
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }> = {
    superadmin: { label: 'Superadmin', color: JA.GOLD,   bg: '#FEF3C7', icon: Crown },
    admin:      { label: 'Admin',      color: JA.TEAL,   bg: 'rgba(15,123,113,0.1)', icon: Shield },
    user:       { label: 'Usuario',    color: JA.GREY,   bg: '#F1F5F9', icon: Users },
    client:     { label: 'Cliente',    color: JA.NAVY,   bg: '#E0F2FE', icon: Building2 },
}

function Toast({ type, msg, onClose }: { type: 'success' | 'error' | 'info', msg: string, onClose: () => void }) {
    const bg = type === 'success' ? JA.GREEN : type === 'error' ? JA.RED : JA.NAVY
    return (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 12, background: bg, color: '#FFF', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
            {type === 'success' ? <CheckCircle2 style={{ width: 15, height: 15 }} /> : type === 'error' ? <XCircle style={{ width: 15, height: 15 }} /> : <Info style={{ width: 15, height: 15 }} />}
            {msg}
            <button onClick={onClose} style={{ marginLeft: 4, background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
    )
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  ENTRY POINT                                             ║
   ╚══════════════════════════════════════════════════════════╝ */
export default function AdminPage() {
    return (
        <AuthGuard childrenWithUser={(user) => <AdminContent user={user} />} />
    )
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  ADMIN CONTENT                                           ║
   ╚══════════════════════════════════════════════════════════╝ */
function AdminContent({ user }: { user: User }) {
    const supabase = useMemo(() => createClient(), [])
    const [clients, setClients]           = useState<Profile[]>([])
    const [collaborators, setCollaborators] = useState<Profile[]>([])
    const [loading, setLoading]           = useState(true)
    const [isNotAdmin, setIsNotAdmin]     = useState(false)
    const [toast, setToast]               = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null)
    const [tab, setTab]                   = useState<'clients' | 'collaborators'>('clients')

    // Modals
    const [showCreateClient, setShowCreateClient]   = useState(false)
    const [showCreateCollab, setShowCreateCollab]   = useState(false)
    const [editingClient, setEditingClient]         = useState<Profile | null>(null)
    const [deletingUser, setDeletingUser]           = useState<Profile | null>(null)

    const showToast = (type: 'success' | 'error' | 'info', msg: string) => {
        setToast({ type, msg }); setTimeout(() => setToast(null), 5000)
    }

    const fetchData = useCallback(async () => {
        setLoading(true)
        const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if (myProfile?.role !== 'superadmin') { setIsNotAdmin(true); setLoading(false); return }

        const { data: all } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        const profiles = all || []
        setClients(profiles.filter((p: Profile) => p.company_name && p.id !== user.id))
        setCollaborators(profiles.filter((p: Profile) => ['admin', 'user'].includes(p.role) && !p.company_name && p.id !== user.id))
        setLoading(false)
    }, [supabase, user.id])

    useEffect(() => { fetchData() }, [fetchData])

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 32, minHeight: '60vh', justifyContent: 'center', color: JA.GREY, fontFamily: 'Inter, sans-serif' }}>
            <div style={{ width: 20, height: 20, border: `2px solid ${JA.GOLD}30`, borderTopColor: JA.GOLD, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            Cargando panel administrativo...
        </div>
    )

    if (isNotAdmin) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, fontFamily: 'Inter, sans-serif' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle style={{ width: 28, height: 28, color: JA.RED }} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: JA.TEXT, margin: 0 }}>Acceso Restringido</h2>
            <p style={{ color: JA.GREY, fontSize: 13, margin: 0 }}>Solo los <strong>Superadmins</strong> pueden acceder al Panel Maestro</p>
            <Link href="/dashboard" style={{ padding: '9px 20px', borderRadius: 10, background: JA.NAVY, color: '#FFF', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
                Volver al Dashboard
            </Link>
        </div>
    )

    return (
        <div style={{ fontFamily: 'Inter, Montserrat, sans-serif' }}>
            {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}

            {/* ── Header ────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: JA.TEXT, fontFamily: 'Montserrat, sans-serif', letterSpacing: '-0.02em', margin: '0 0 4px' }}>
                        Panel <span style={{ color: JA.GOLD }}>Maestro</span>
                    </h1>
                    <p style={{ fontSize: 12, color: JA.GREY, margin: 0 }}>
                        {clients.length} empresas · {collaborators.length} colaboradores
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => fetchData()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 10, border: '1.5px solid #E0DDD8', background: '#FFF', color: JA.GREY, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                        <RefreshCw style={{ width: 13, height: 13 }} /> Actualizar
                    </button>
                    <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12, fontWeight: 700, borderRadius: 10, background: JA.NAVY, color: '#FFF', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
                        <LayoutDashboard style={{ width: 13, height: 13 }} /> Dashboard
                    </Link>
                </div>
            </div>

            {/* ── Stats strip ───────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Empresas Activas', value: clients.length, color: JA.NAVY, bg: '#E0F2FE', icon: Building2 },
                    { label: 'Colaboradores', value: collaborators.length, color: JA.TEAL, bg: 'rgba(15,123,113,0.1)', icon: Users },
                    { label: 'Con Sheets', value: clients.filter(c => c.google_sheet_url).length, color: JA.GOLD, bg: '#FEF3C7', icon: FileSpreadsheet },
                    { label: 'Admins', value: collaborators.filter(c => c.role === 'admin').length, color: JA.PURPLE, bg: 'rgba(124,58,237,0.1)', icon: Shield },
                ].map((s, i) => (
                    <div key={i} style={{ ...card, padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <s.icon style={{ width: 17, height: 17, color: s.color }} />
                        </div>
                        <div>
                            <p style={{ fontSize: 9, fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>{s.label}</p>
                            <p style={{ fontSize: 22, fontWeight: 900, color: s.color, margin: 0, fontVariantNumeric: 'tabular-nums', fontFamily: 'Inter, sans-serif' }}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Tabs ──────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: '#F9F7F2', border: '1px solid #E0DDD8', width: 'fit-content', marginBottom: 22 }}>
                {[
                    { id: 'clients' as const, label: `🏢 Empresas (${clients.length})` },
                    { id: 'collaborators' as const, label: `👥 Colaboradores (${collaborators.length})` },
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', borderRadius: 9, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: tab === t.id ? JA.NAVY : 'transparent', color: tab === t.id ? JA.GOLD_LT : JA.GREY, boxShadow: tab === t.id ? '0 2px 10px rgba(19,33,60,0.2)' : 'none' }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ══ TAB: Empresas ═══════════════════════════════ */}
            {tab === 'clients' && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h2 style={{ fontSize: 15, fontWeight: 800, color: JA.TEXT, margin: 0, fontFamily: 'Montserrat, sans-serif' }}>
                            Empresas Clientes
                        </h2>
                        <button onClick={() => setShowCreateClient(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 12, fontWeight: 800, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${JA.GOLD}, ${JA.GOLD_LT})`, color: JA.NAVY, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', boxShadow: '0 4px 12px rgba(184,150,12,0.3)' }}>
                            <Building2 style={{ width: 14, height: 14 }} /> Nueva Empresa
                        </button>
                    </div>

                    {clients.length === 0 ? (
                        <EmptyState icon={Building2} title="Sin empresas registradas" sub="Crea la primera empresa cliente para comenzar" action={{ label: 'Crear empresa', onClick: () => setShowCreateClient(true) }} />
                    ) : (
                        <div style={{ display: 'grid', gap: 14 }}>
                            {clients.map(client => (
                                <ClientCard key={client.id} client={client}
                                    onEdit={() => setEditingClient(client)}
                                    onDelete={() => setDeletingUser(client)}
                                    onViewDashboard={() => window.open(`/dashboard?clientId=${client.id}`, '_blank')}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══ TAB: Colaboradores ══════════════════════════ */}
            {tab === 'collaborators' && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h2 style={{ fontSize: 15, fontWeight: 800, color: JA.TEXT, margin: 0, fontFamily: 'Montserrat, sans-serif' }}>
                            Colaboradores del Portal
                        </h2>
                        <button onClick={() => setShowCreateCollab(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 12, fontWeight: 800, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${JA.NAVY}, ${JA.NAVY_MID})`, color: '#FFF', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', boxShadow: '0 4px 12px rgba(19,33,60,0.28)' }}>
                            <UserPlus style={{ width: 14, height: 14 }} /> Nuevo Colaborador
                        </button>
                    </div>

                    {collaborators.length === 0 ? (
                        <EmptyState icon={Users} title="Sin colaboradores" sub="Crea un admin o usuario para que gestione el portal" action={{ label: 'Crear colaborador', onClick: () => setShowCreateCollab(true) }} />
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                            {collaborators.map(c => (
                                <CollabCard key={c.id} collab={c} onDelete={() => setDeletingUser(c)} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══ MODALS ══════════════════════════════════════ */}
            {showCreateClient && (
                <CreateClientModal
                    onClose={() => setShowCreateClient(false)}
                    onCreated={(msg) => { showToast('success', msg); fetchData(); setShowCreateClient(false) }}
                    onError={(msg) => showToast('error', msg)}
                    supabase={supabase}
                />
            )}

            {showCreateCollab && (
                <CreateCollabModal
                    onClose={() => setShowCreateCollab(false)}
                    onCreated={(msg) => { showToast('success', msg); fetchData(); setShowCreateCollab(false) }}
                    onError={(msg) => showToast('error', msg)}
                    supabase={supabase}
                />
            )}

            {editingClient && (
                <EditClientModal
                    client={editingClient}
                    onClose={() => setEditingClient(null)}
                    onSaved={() => { showToast('success', '✅ Empresa actualizada'); fetchData(); setEditingClient(null) }}
                    onError={(msg) => showToast('error', msg)}
                    supabase={supabase}
                />
            )}

            {deletingUser && (
                <DeleteConfirmModal
                    name={deletingUser.company_name || deletingUser.full_name || deletingUser.email || 'Usuario'}
                    type={deletingUser.company_name ? 'empresa' : 'colaborador'}
                    onConfirm={async () => {
                        try {
                            const res = await fetch('/api/admin/delete-user', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: deletingUser.id }),
                            })
                            if (!res.ok) throw new Error(await res.text())
                            showToast('success', '✅ Usuario eliminado correctamente')
                            fetchData()
                        } catch (e) {
                            showToast('error', e instanceof Error ? e.message : 'Error al eliminar')
                        } finally {
                            setDeletingUser(null)
                        }
                    }}
                    onCancel={() => setDeletingUser(null)}
                />
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

/* ── ClientCard ─────────────────────────────────────────── */
function ClientCard({ client, onEdit, onDelete, onViewDashboard }: {
    client: Profile; onEdit: () => void; onDelete: () => void; onViewDashboard: () => void
}) {
    const rc = ROLE_CONFIG['client']
    const Icon = rc.icon
    return (
        <div className="card-hover" style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${JA.NAVY}, ${JA.NAVY_MID})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 style={{ width: 20, height: 20, color: JA.GOLD_LT }} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: JA.TEXT, margin: 0, fontFamily: 'Montserrat, sans-serif' }}>
                        {client.company_name || 'Sin nombre'}
                    </h3>
                    {client.google_sheet_url && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(5,150,105,0.1)', color: JA.GREEN, border: '1px solid rgba(5,150,105,0.2)' }}>
                            📊 SHEET
                        </span>
                    )}
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#E0F2FE', color: JA.NAVY }}>
                        {client.role?.toUpperCase() || 'CLIENTE'}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                    {client.phone && <span style={{ fontSize: 10, color: JA.GREY }}>📞 {client.phone}</span>}
                    <span style={{ fontSize: 10, color: JA.GREY_LT }}>
                        Desde {new Date(client.created_at || '').toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}
                    </span>
                    {client.google_sheet_url && (
                        <span style={{ fontSize: 10, color: JA.TEAL, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                            🔗 {client.google_sheet_url.replace('https://docs.google.com/spreadsheets/d/', 'Sheet/')}
                        </span>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={onViewDashboard} title="Ver Dashboard" style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid #E0DDD8', background: '#F9F7F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ExternalLink style={{ width: 14, height: 14, color: JA.GREY }} />
                </button>
                <button onClick={onEdit} title="Editar empresa" style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid #E0DDD8', background: '#F9F7F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Edit2 style={{ width: 14, height: 14, color: JA.NAVY }} />
                </button>
                <button onClick={onDelete} title="Eliminar" style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid rgba(220,38,38,0.2)', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 style={{ width: 14, height: 14, color: JA.RED }} />
                </button>
            </div>
        </div>
    )
}

/* ── CollabCard ─────────────────────────────────────────── */
function CollabCard({ collab, onDelete }: { collab: Profile; onDelete: () => void }) {
    const rc = ROLE_CONFIG[collab.role] || ROLE_CONFIG.user
    const Icon = rc.icon
    const initials = (collab.full_name || 'NN').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    return (
        <div className="card-hover" style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${JA.NAVY}, ${JA.NAVY_MID})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: JA.GOLD_LT, fontWeight: 800, fontSize: 14, fontFamily: 'Montserrat, sans-serif' }}>{initials}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: JA.TEXT, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{collab.full_name || 'Sin nombre'}</p>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: rc.bg, color: rc.color, flexShrink: 0 }}>{rc.label}</span>
                    </div>
                    {collab.phone && <p style={{ fontSize: 10, color: JA.GREY, margin: '2px 0 0' }}>📞 {collab.phone}</p>}
                    <p style={{ fontSize: 10, color: JA.GREY_LT, margin: '2px 0 0' }}>
                        Miembro desde {new Date(collab.created_at || '').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <button onClick={onDelete} style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid rgba(220,38,38,0.2)', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Trash2 style={{ width: 13, height: 13, color: JA.RED }} />
                </button>
            </div>
            <Icon style={{ display: 'none' }} />
        </div>
    )
}

/* ── Modal: Crear Empresa ───────────────────────────────── */
function CreateClientModal({ onClose, onCreated, onError, supabase }: {
    onClose: () => void; onCreated: (msg: string) => void; onError: (msg: string) => void; supabase: ReturnType<typeof createClient>
}) {
    const [form, setForm] = useState({ email: '', password: '', company_name: '', sheet_url: '', phone: '' })
    const [saving, setSaving] = useState(false)
    const [showPwd, setShowPwd] = useState(false)
    const [focused, setFocused] = useState<string | null>(null)

    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.email || !form.password || !form.company_name) { onError('Email, contraseña y nombre de empresa son requeridos'); return }
        setSaving(true)
        try {
            const res = await fetch('/api/admin/create-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al crear cliente')
            onCreated(`✅ Empresa "${form.company_name}" creada exitosamente`)
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Error desconocido')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title="Nueva Empresa Cliente" icon={Building2} color={JA.GOLD} onClose={onClose}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                    <span style={label}>Nombre de la Empresa *</span>
                    <input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Ej: Comercializadora XYZ S.A.S." style={input(focused === 'company_name')} onFocus={() => setFocused('company_name')} onBlur={() => setFocused(null)} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <span style={label}>Email del Cliente *</span>
                        <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="cliente@empresa.com" style={input(focused === 'email')} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} required />
                    </div>
                    <div>
                        <span style={label}>Contraseña *</span>
                        <div style={{ position: 'relative' }}>
                            <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mínimo 8 caracteres" style={{ ...input(focused === 'password'), paddingRight: 36 }} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} required />
                            <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                {showPwd ? <EyeOff style={{ width: 14, height: 14, color: JA.GREY }} /> : <Eye style={{ width: 14, height: 14, color: JA.GREY }} />}
                            </button>
                        </div>
                    </div>
                </div>
                <div>
                    <span style={label}>Teléfono / WhatsApp</span>
                    <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+57 300 000 0000" style={input(focused === 'phone')} onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)} />
                </div>
                <div>
                    <span style={label}>URL Google Sheet Siigo (opcional)</span>
                    <input value={form.sheet_url} onChange={e => set('sheet_url', e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." style={input(focused === 'sheet_url')} onFocus={() => setFocused('sheet_url')} onBlur={() => setFocused(null)} />
                    <p style={{ fontSize: 10, color: JA.GREY, marginTop: 4 }}>El Sheet debe ser público para que el cliente pueda ver sus gráficas.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button type="button" onClick={onClose} style={{ padding: '9px 18px', fontSize: 12, fontWeight: 600, borderRadius: 9, border: '1.5px solid #E0DDD8', background: '#FFF', color: JA.GREY, cursor: 'pointer' }}>Cancelar</button>
                    <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', fontSize: 12, fontWeight: 800, borderRadius: 9, border: 'none', background: `linear-gradient(135deg, ${JA.GOLD}, ${JA.GOLD_LT})`, color: JA.NAVY, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', opacity: saving ? 0.7 : 1 }}>
                        {saving ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <Building2 style={{ width: 13, height: 13 }} />}
                        {saving ? 'Creando...' : 'Crear Empresa'}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

/* ── Modal: Crear Colaborador ───────────────────────────── */
function CreateCollabModal({ onClose, onCreated, onError, supabase }: {
    onClose: () => void; onCreated: (msg: string) => void; onError: (msg: string) => void; supabase: ReturnType<typeof createClient>
}) {
    const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '', role: 'user' as 'admin' | 'user' })
    const [saving, setSaving] = useState(false)
    const [showPwd, setShowPwd] = useState(false)
    const [focused, setFocused] = useState<string | null>(null)

    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.email || !form.password || !form.full_name) { onError('Nombre, email y contraseña son requeridos'); return }
        setSaving(true)
        try {
            const res = await fetch('/api/admin/create-collaborator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al crear colaborador')
            onCreated(`✅ Colaborador "${form.full_name}" creado`)
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Error desconocido')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title="Nuevo Colaborador" icon={UserPlus} color={JA.NAVY} onClose={onClose}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                    <span style={label}>Nombre Completo *</span>
                    <input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Ej: Carlos Rodríguez" style={input(focused === 'full_name')} onFocus={() => setFocused('full_name')} onBlur={() => setFocused(null)} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <span style={label}>Email *</span>
                        <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="colaborador@jacontadores.com" style={input(focused === 'email')} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} required />
                    </div>
                    <div>
                        <span style={label}>Contraseña *</span>
                        <div style={{ position: 'relative' }}>
                            <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mínimo 8 caracteres" style={{ ...input(focused === 'password'), paddingRight: 36 }} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} required />
                            <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                {showPwd ? <EyeOff style={{ width: 14, height: 14, color: JA.GREY }} /> : <Eye style={{ width: 14, height: 14, color: JA.GREY }} />}
                            </button>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <span style={label}>Teléfono</span>
                        <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+57 300 000 0000" style={input(focused === 'phone')} onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)} />
                    </div>
                    <div>
                        <span style={label}>Rol *</span>
                        <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
                            style={{ ...input(focused === 'role'), appearance: 'none', cursor: 'pointer' }}
                            onFocus={() => setFocused('role')} onBlur={() => setFocused(null)}>
                            <option value="user">👤 Usuario — Solo lectura</option>
                            <option value="admin">🛡️ Admin — Gestión completa</option>
                        </select>
                    </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 9, background: '#F9F7F2', border: '1px solid #E0DDD8', fontSize: 11, color: JA.GREY }}>
                    <strong style={{ color: JA.TEXT }}>Admin:</strong> puede crear clientes, editar datos y gestionar el portal.<br />
                    <strong style={{ color: JA.TEXT }}>Usuario:</strong> solo puede ver el dashboard de sus clientes asignados.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} style={{ padding: '9px 18px', fontSize: 12, fontWeight: 600, borderRadius: 9, border: '1.5px solid #E0DDD8', background: '#FFF', color: JA.GREY, cursor: 'pointer' }}>Cancelar</button>
                    <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', fontSize: 12, fontWeight: 800, borderRadius: 9, border: 'none', background: `linear-gradient(135deg, ${JA.NAVY}, ${JA.NAVY_MID})`, color: '#FFF', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                        {saving ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <UserPlus style={{ width: 13, height: 13 }} />}
                        {saving ? 'Creando...' : 'Crear Colaborador'}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

/* ── Modal: Editar Empresa ──────────────────────────────── */
function EditClientModal({ client, onClose, onSaved, onError, supabase }: {
    client: Profile; onClose: () => void; onSaved: () => void; onError: (msg: string) => void; supabase: ReturnType<typeof createClient>
}) {
    const [form, setForm] = useState({ company_name: client.company_name || '', sheet_url: client.google_sheet_url || '', phone: client.phone || '' })
    const [saving, setSaving] = useState(false)
    const [focused, setFocused] = useState<string | null>(null)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

    const testSheet = async () => {
        if (!form.sheet_url) return
        setTesting(true); setTestResult(null)
        try {
            const url = form.sheet_url.replace(/\/edit.*$/, '/export?format=csv')
            const res = await fetch(`/api/sheets-proxy?url=${encodeURIComponent(url)}`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const text = await res.text()
            const rows = text.split('\n').filter(l => l.trim()).length - 1
            setTestResult({ ok: true, msg: `✅ OK — ${rows} filas` })
        } catch (e) {
            setTestResult({ ok: false, msg: `❌ ${e instanceof Error ? e.message : 'Error'}` })
        } finally {
            setTesting(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error } = await supabase.from('profiles').update({ company_name: form.company_name, google_sheet_url: form.sheet_url, phone: form.phone, updated_at: new Date().toISOString() }).eq('id', client.id)
            if (error) throw error
            onSaved()
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title={`Editar: ${client.company_name || 'Empresa'}`} icon={Edit2} color={JA.TEAL} onClose={onClose}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                    <span style={label}>Nombre de la Empresa</span>
                    <input value={form.company_name} onChange={e => set('company_name', e.target.value)} style={input(focused === 'company_name')} onFocus={() => setFocused('company_name')} onBlur={() => setFocused(null)} />
                </div>
                <div>
                    <span style={label}>Teléfono</span>
                    <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+57 300 000 0000" style={input(focused === 'phone')} onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)} />
                </div>
                <div>
                    <span style={label}>URL Google Sheet Siigo</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input value={form.sheet_url} onChange={e => set('sheet_url', e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." style={{ ...input(focused === 'sheet_url'), flex: 1 }} onFocus={() => setFocused('sheet_url')} onBlur={() => setFocused(null)} />
                        <button onClick={testSheet} disabled={testing} style={{ padding: '0 12px', borderRadius: 9, border: '1.5px solid #E0DDD8', background: '#F9F7F2', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: JA.TEXT, flexShrink: 0 }}>
                            {testing ? '...' : 'Probar'}
                        </button>
                    </div>
                    {testResult && <p style={{ fontSize: 11, marginTop: 4, color: testResult.ok ? JA.GREEN : JA.RED, fontWeight: 600 }}>{testResult.msg}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '9px 18px', fontSize: 12, fontWeight: 600, borderRadius: 9, border: '1.5px solid #E0DDD8', background: '#FFF', color: JA.GREY, cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', fontSize: 12, fontWeight: 800, borderRadius: 9, border: 'none', background: `linear-gradient(135deg, ${JA.TEAL}, #14B8A6)`, color: '#FFF', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                        {saving ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 13, height: 13 }} />}
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}

/* ── Modal: Confirmar Eliminación ───────────────────────── */
function DeleteConfirmModal({ name, type, onConfirm, onCancel }: { name: string; type: string; onConfirm: () => void; onCancel: () => void }) {
    const [deleting, setDeleting] = useState(false)
    return (
        <Modal title="Confirmar Eliminación" icon={Trash2} color={JA.RED} onClose={onCancel}>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <AlertTriangle style={{ width: 26, height: 26, color: JA.RED }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: JA.TEXT, margin: '0 0 8px' }}>¿Eliminar esta {type}?</p>
                <p style={{ fontSize: 13, color: JA.GREY, margin: '0 0 20px' }}>
                    <strong style={{ color: JA.TEXT }}>"{name}"</strong><br />Esta acción no se puede deshacer.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button onClick={onCancel} style={{ padding: '9px 20px', fontSize: 12, fontWeight: 600, borderRadius: 9, border: '1.5px solid #E0DDD8', background: '#FFF', color: JA.GREY, cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false) }} disabled={deleting}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', fontSize: 12, fontWeight: 800, borderRadius: 9, border: 'none', background: JA.RED, color: '#FFF', cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>
                        {deleting ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <Trash2 style={{ width: 13, height: 13 }} />}
                        {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}

/* ── Modal wrapper ──────────────────────────────────────── */
function Modal({ title, icon: Icon, color, onClose, children }: {
    title: string; icon: React.ComponentType<{ style?: React.CSSProperties }>; color: string; onClose: () => void; children: React.ReactNode
}) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(19,33,60,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
            <div style={{ position: 'relative', background: '#FFF', borderRadius: 20, boxShadow: '0 24px 64px rgba(19,33,60,0.25)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #E0DDD8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon style={{ width: 15, height: 15, color }} />
                        </div>
                        <h2 style={{ fontSize: 15, fontWeight: 800, color: JA.TEXT, margin: 0, fontFamily: 'Montserrat, sans-serif' }}>{title}</h2>
                    </div>
                    <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #E0DDD8', background: '#F9F7F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X style={{ width: 14, height: 14, color: JA.GREY }} />
                    </button>
                </div>
                <div style={{ padding: '20px 22px' }}>{children}</div>
            </div>
        </div>
    )
}

/* ── EmptyState ─────────────────────────────────────────── */
function EmptyState({ icon: Icon, title, sub, action }: { icon: React.ComponentType<{ style?: React.CSSProperties }>; title: string; sub: string; action?: { label: string; onClick: () => void } }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12, ...card, textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: '#F9F7F2', border: '1.5px solid #E0DDD8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon style={{ width: 26, height: 26, color: JA.GREY_LT }} />
            </div>
            <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: JA.TEXT, margin: '0 0 4px', fontFamily: 'Montserrat, sans-serif' }}>{title}</p>
                <p style={{ fontSize: 12, color: JA.GREY, margin: 0 }}>{sub}</p>
            </div>
            {action && (
                <button onClick={action.onClick} style={{ padding: '9px 20px', fontSize: 12, fontWeight: 700, borderRadius: 10, border: 'none', background: JA.NAVY, color: '#FFF', cursor: 'pointer', marginTop: 4 }}>
                    {action.label}
                </button>
            )}
        </div>
    )
}
