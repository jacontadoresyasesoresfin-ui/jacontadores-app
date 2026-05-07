'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import {
    UserPlus, Building2, Shield, Users, Trash2, Edit2, X, Save,
    LayoutDashboard, RefreshCw, Eye, EyeOff,
    CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet,
    Loader2, ChevronRight, Search
} from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import Link from 'next/link'

/* ── Corporate Palette ────────────────────────────────── */
const JA = {
    NAVY:    '#13213C',
    NAVY_MID:'#1C3460',
    GOLD:    '#B8960C',
    GOLD_LT: '#D4A843',
    WHITE:   '#FFFFFF',
    TEXT:    '#1C2B45',
    GREY:    '#4B5563',
    GREY_LT: '#9CA3AF',
    BORDER:  '#E5E7EB',
    BG:      '#F8FAFC',
    GREEN:   '#10B981',
    RED:     '#EF4444',
}

const styles = {
    card: {
        background: '#FFFFFF',
        border: `1px solid ${JA.BORDER}`,
        borderRadius: '2px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        padding: '24px',
    },
    input: (focused: boolean) => ({
        width: '100%',
        padding: '8px 12px',
        fontSize: '13px',
        fontFamily: 'Inter, sans-serif',
        color: JA.TEXT,
        background: '#FFFFFF',
        outline: 'none',
        border: `1px solid ${focused ? JA.NAVY : JA.BORDER}`,
        borderRadius: '2px',
        transition: 'all 0.1s',
    }),
    label: {
        fontSize: '11px',
        fontWeight: 600,
        color: JA.GREY,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        marginBottom: '6px',
        display: 'block',
    },
    buttonPrimary: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: 600,
        borderRadius: '2px',
        border: 'none',
        background: JA.NAVY,
        color: '#FFFFFF',
        cursor: 'pointer',
        transition: 'background 0.2s',
    },
    buttonSecondary: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: 600,
        borderRadius: '2px',
        border: `1px solid ${JA.BORDER}`,
        background: '#FFFFFF',
        color: JA.TEXT,
        cursor: 'pointer',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
        fontSize: '13px',
    },
    th: {
        textAlign: 'left' as const,
        padding: '12px 16px',
        borderBottom: `2px solid ${JA.BORDER}`,
        color: JA.GREY,
        fontWeight: 600,
        fontSize: '11px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    },
    td: {
        padding: '12px 16px',
        borderBottom: `1px solid ${JA.BORDER}`,
        color: JA.TEXT,
    }
}

interface Profile {
    id: string; role: string; full_name?: string | null;
    company_name?: string | null; google_sheet_url?: string | null;
    phone?: string | null; tenant_id?: string | null; created_at?: string;
    email?: string; app_modules?: string[] | null;
}

function Toast({ type, msg, onClose }: { type: 'success' | 'error' | 'info', msg: string, onClose: () => void }) {
    const bg = type === 'success' ? JA.GREEN : type === 'error' ? JA.RED : JA.NAVY
    return (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderRadius: '2px', background: bg, color: '#FFF', fontSize: '13px', fontWeight: 500, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            {msg}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', fontSize: '18px', padding: 0 }}>×</button>
        </div>
    )
}

export default function AdminPage() {
    return (
        <AuthGuard childrenWithUser={(user) => <AdminContent user={user} />} />
    )
}

function AdminContent({ user }: { user: User }) {
    const supabase = useMemo(() => createClient(), [])
    const [clients, setClients]           = useState<Profile[]>([])
    const [collaborators, setCollaborators] = useState<Profile[]>([])
    const [loading, setLoading]           = useState(true)
    const [isNotAdmin, setIsNotAdmin]     = useState(false)
    const [toast, setToast]               = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null)
    const [tab, setTab]                   = useState<'clients' | 'collaborators'>('clients')
    const [searchQuery, setSearchQuery]   = useState('')

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

    const filteredClients = useMemo(() => {
        return clients.filter(c => 
            (c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
             c.email?.toLowerCase().includes(searchQuery.toLowerCase()))
        )
    }, [clients, searchQuery])

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 32, minHeight: '60vh', justifyContent: 'center', color: JA.GREY }}>
            <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Cargando sistema administrativo...</span>
        </div>
    )

    if (isNotAdmin) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24 }}>
            <AlertTriangle style={{ width: 48, height: 48, color: JA.RED }} />
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: JA.TEXT, marginBottom: '8px' }}>Acceso No Autorizado</h2>
                <p style={{ color: JA.GREY, fontSize: '14px' }}>Este panel es exclusivo para personal de administración central.</p>
            </div>
            <Link href="/dashboard" style={{ ...styles.buttonPrimary, textDecoration: 'none' }}>
                Regresar al Portal
            </Link>
        </div>
    )

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
            {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}

            {/* Header */}
            <div style={{ borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '24px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: JA.TEXT, marginBottom: '4px' }}>Administración Central</h1>
                    <p style={{ fontSize: '14px', color: JA.GREY }}>Gestión de identidades corporativas y acceso a módulos.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={fetchData} style={styles.buttonSecondary}>
                        <RefreshCw style={{ width: 14, height: 14 }} /> Sincronizar
                    </button>
                    <Link href="/dashboard" style={{ ...styles.buttonPrimary, textDecoration: 'none' }}>
                        <LayoutDashboard style={{ width: 14, height: 14 }} /> Dashboard Principal
                    </Link>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${JA.BORDER}`, marginBottom: '24px' }}>
                <button 
                    onClick={() => setTab('clients')}
                    style={{ 
                        padding: '12px 24px', 
                        fontSize: '14px', 
                        fontWeight: 600, 
                        border: 'none', 
                        background: 'none', 
                        cursor: 'pointer',
                        color: tab === 'clients' ? JA.NAVY : JA.GREY_LT,
                        borderBottom: `2px solid ${tab === 'clients' ? JA.NAVY : 'transparent'}`,
                        marginBottom: '-1px'
                    }}
                >
                    Empresas Clientes ({clients.length})
                </button>
                <button 
                    onClick={() => setTab('collaborators')}
                    style={{ 
                        padding: '12px 24px', 
                        fontSize: '14px', 
                        fontWeight: 600, 
                        border: 'none', 
                        background: 'none', 
                        cursor: 'pointer',
                        color: tab === 'collaborators' ? JA.NAVY : JA.GREY_LT,
                        borderBottom: `2px solid ${tab === 'collaborators' ? JA.NAVY : 'transparent'}`,
                        marginBottom: '-1px'
                    }}
                >
                    Equipo de Trabajo ({collaborators.length})
                </button>
            </div>

            {/* Content Area */}
            {tab === 'clients' ? (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: JA.GREY_LT }} />
                            <input 
                                type="text" 
                                placeholder="Buscar empresa o correo..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ ...styles.input(false), paddingLeft: '40px' }}
                            />
                        </div>
                        <button onClick={() => setShowCreateClient(true)} style={styles.buttonPrimary}>
                            <Building2 style={{ width: 14, height: 14 }} /> Registrar Empresa
                        </button>
                    </div>

                    <div style={styles.card}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Empresa</th>
                                    <th style={styles.th}>ID / Email</th>
                                    <th style={styles.th}>Estado Módulos</th>
                                    <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.map(client => (
                                    <tr key={client.id}>
                                        <td style={styles.td}>
                                            <div style={{ fontWeight: 600 }}>{client.company_name}</div>
                                            <div style={{ fontSize: '11px', color: JA.GREY_LT }}>Registrado: {new Date(client.created_at || '').toLocaleDateString()}</div>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{ fontSize: '12px' }}>{client.email}</div>
                                            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: JA.GREY_LT }}>{client.id}</div>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {client.app_modules?.slice(0, 3).map(m => (
                                                    <span key={m} style={{ fontSize: '9px', background: '#F1F5F9', padding: '2px 6px', borderRadius: '1px', color: JA.NAVY, fontWeight: 600 }}>{m}</span>
                                                ))}
                                                {(client.app_modules?.length || 0) > 3 && (
                                                    <span style={{ fontSize: '9px', color: JA.GREY_LT }}>+{client.app_modules!.length - 3}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ ...styles.td, textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => window.open(`/dashboard?clientId=${client.id}`, '_blank')} style={{ ...styles.buttonSecondary, padding: '4px 8px' }} title="Simular Acceso">
                                                    <Eye style={{ width: 14, height: 14 }} />
                                                </button>
                                                <button onClick={() => setEditingClient(client)} style={{ ...styles.buttonSecondary, padding: '4px 8px' }} title="Editar Configuración">
                                                    <Edit2 style={{ width: 14, height: 14 }} />
                                                </button>
                                                <button onClick={() => setDeletingUser(client)} style={{ ...styles.buttonSecondary, padding: '4px 8px', color: JA.RED, borderColor: JA.RED + '20' }} title="Eliminar">
                                                    <Trash2 style={{ width: 14, height: 14 }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Gestión de Colaboradores</h3>
                        <button onClick={() => setShowCreateCollab(true)} style={styles.buttonPrimary}>
                            <UserPlus style={{ width: 14, height: 14 }} /> Nuevo Colaborador
                        </button>
                    </div>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Nombre</th>
                                <th style={styles.th}>Rol</th>
                                <th style={styles.th}>Email</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {collaborators.map(c => (
                                <tr key={c.id}>
                                    <td style={styles.td}>{c.full_name}</td>
                                    <td style={styles.td}>
                                        <span style={{ 
                                            fontSize: '11px', 
                                            padding: '2px 8px', 
                                            background: c.role === 'admin' ? JA.NAVY : '#F1F5F9',
                                            color: c.role === 'admin' ? '#FFF' : JA.TEXT,
                                            fontWeight: 600
                                        }}>
                                            {c.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={styles.td}>{c.email}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>
                                        <button onClick={() => setDeletingUser(c)} style={{ ...styles.buttonSecondary, padding: '4px 8px', color: JA.RED }}>
                                            <Trash2 style={{ width: 14, height: 14 }} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}
            {showCreateClient && (
                <CreateClientModal
                    onClose={() => setShowCreateClient(false)}
                    onCreated={(msg) => { showToast('success', msg); fetchData(); setShowCreateClient(false) }}
                    onError={(msg) => showToast('error', msg)}
                />
            )}

            {editingClient && (
                <EditClientModal
                    client={editingClient}
                    onClose={() => setEditingClient(null)}
                    onSaved={() => { showToast('success', 'Configuración actualizada'); fetchData(); setEditingClient(null) }}
                    onError={(msg) => showToast('error', msg)}
                    supabase={supabase}
                />
            )}

            {deletingUser && (
                <DeleteConfirmModal
                    name={deletingUser.company_name || deletingUser.full_name || deletingUser.email || 'Registro'}
                    onConfirm={async () => {
                        try {
                            const res = await fetch('/api/admin/delete-user', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: deletingUser.id }),
                            })
                            if (!res.ok) throw new Error(await res.text())
                            showToast('success', 'Registro eliminado correctamente')
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

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

/* ── UI Components ────────────────────────────────────── */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(19,33,60,0.6)', backdropFilter: 'blur(2px)' }}>
            <div style={{ background: '#FFF', borderRadius: '4px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: JA.TEXT }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X style={{ width: 18, height: 18 }} /></button>
                </div>
                <div style={{ padding: '24px' }}>{children}</div>
            </div>
        </div>
    )
}

function CreateClientModal({ onClose, onCreated, onError }: { onClose: () => void; onCreated: (msg: string) => void; onError: (msg: string) => void }) {
    const [form, setForm] = useState({ email: '', password: '', company_name: '', sheet_url: '', phone: '' })
    const [saving, setSaving] = useState(false)
    const [focused, setFocused] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const res = await fetch('/api/admin/create-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            if (!res.ok) throw new Error('Error al registrar empresa')
            onCreated(`Empresa ${form.company_name} registrada exitosamente`)
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Error desconocido')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title="Registro de Nueva Empresa" onClose={onClose}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <span style={styles.label}>Razón Social / Empresa *</span>
                    <input value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} style={styles.input(focused === 'name')} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <span style={styles.label}>Email Corporativo *</span>
                        <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={styles.input(focused === 'email')} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} required />
                    </div>
                    <div>
                        <span style={styles.label}>Password Temporal *</span>
                        <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} style={styles.input(focused === 'pwd')} onFocus={() => setFocused('pwd')} onBlur={() => setFocused(null)} required />
                    </div>
                </div>
                <div>
                    <span style={styles.label}>URL Repositorio (Google Sheets)</span>
                    <input value={form.sheet_url} onChange={e => setForm({...form, sheet_url: e.target.value})} style={styles.input(focused === 'sheet')} onFocus={() => setFocused('sheet')} onBlur={() => setFocused(null)} placeholder="https://docs.google.com/..." />
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button type="button" onClick={onClose} style={styles.buttonSecondary}>Cancelar</button>
                    <button type="submit" disabled={saving} style={styles.buttonPrimary}>
                        {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 14, height: 14 }} />}
                        Confirmar Registro
                    </button>
                </div>
            </form>
        </Modal>
    )
}

function EditClientModal({ client, onClose, onSaved, onError, supabase }: { client: Profile; onClose: () => void; onSaved: () => void; onError: (msg: string) => void; supabase: any }) {
    const defaultModules = ['dashboard', 'portfolio', 'reconciliation', 'taxes', 'reports', 'ecommerce', 'inventory', 'sales', 'siigo'];
    const [form, setForm] = useState({ 
        company_name: client.company_name || '', 
        sheet_url: client.google_sheet_url || '', 
        phone: client.phone || '',
        app_modules: client.app_modules || defaultModules
    })
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error } = await supabase.from('profiles').update({ 
                company_name: form.company_name, 
                google_sheet_url: form.sheet_url, 
                phone: form.phone, 
                app_modules: form.app_modules,
                updated_at: new Date().toISOString() 
            }).eq('id', client.id)
            if (error) throw error
            onSaved()
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title="Configuración de Cuenta" onClose={onClose}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <span style={styles.label}>Razón Social</span>
                    <input value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} style={styles.input(false)} />
                </div>
                <div>
                    <span style={styles.label}>URL Google Sheets (Repositorio)</span>
                    <input value={form.sheet_url} onChange={e => setForm({...form, sheet_url: e.target.value})} style={styles.input(false)} />
                </div>
                <div>
                    <span style={styles.label}>Módulos Autorizados</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', background: '#F8FAFC', border: `1px solid ${JA.BORDER}` }}>
                        {[
                            { id: 'dashboard', name: 'Dashboard' },
                            { id: 'portfolio', name: 'Portafolio' },
                            { id: 'reconciliation', name: 'Conciliación' },
                            { id: 'taxes', name: 'Impuestos' },
                            { id: 'reports', name: 'Reportes' },
                            { id: 'ecommerce', name: 'E-commerce' },
                            { id: 'inventory', name: 'Inventario' },
                            { id: 'sales', name: 'Ventas' },
                            { id: 'siigo', name: 'Siigo Sync' },
                        ].map(mod => (
                            <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox" 
                                    checked={form.app_modules.includes(mod.id)} 
                                    onChange={(e) => {
                                        const active = e.target.checked;
                                        setForm(prev => ({
                                            ...prev,
                                            app_modules: active 
                                                ? [...prev.app_modules, mod.id] 
                                                : prev.app_modules.filter(m => m !== mod.id)
                                        }));
                                    }}
                                />
                                {mod.name}
                            </label>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button onClick={onClose} style={styles.buttonSecondary}>Cerrar</button>
                    <button onClick={handleSave} disabled={saving} style={styles.buttonPrimary}>
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}

function CreateCollabModal({ onClose, onCreated, onError }: { onClose: () => void; onCreated: (msg: string) => void; onError: (msg: string) => void }) {
    const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '', role: 'user' as 'admin' | 'user' })
    const [saving, setSaving] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const res = await fetch('/api/admin/create-collaborator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            if (!res.ok) throw new Error('Error al registrar colaborador')
            onCreated(`Colaborador ${form.full_name} registrado`)
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Error al registrar')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title="Registro de Colaborador" onClose={onClose}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <span style={styles.label}>Nombre Completo *</span>
                    <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} style={styles.input(false)} required />
                </div>
                <div>
                    <span style={styles.label}>Email Institucional *</span>
                    <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={styles.input(false)} required />
                </div>
                <div>
                    <span style={styles.label}>Password Temporal *</span>
                    <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} style={styles.input(false)} required />
                </div>
                <div>
                    <span style={styles.label}>Nivel de Privilegios *</span>
                    <select value={form.role} onChange={e => setForm({...form, role: e.target.value as 'admin' | 'user'})} style={styles.input(false)}>
                        <option value="user">Usuario (Lectura)</option>
                        <option value="admin">Administrador (Gestión)</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button type="button" onClick={onClose} style={styles.buttonSecondary}>Cancelar</button>
                    <button type="submit" disabled={saving} style={styles.buttonPrimary}>Registrar</button>
                </div>
            </form>
        </Modal>
    )
}

function DeleteConfirmModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
    return (
        <Modal title="Confirmación de Eliminación" onClose={onCancel}>
            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: JA.TEXT, marginBottom: '24px' }}>
                    ¿Está seguro que desea eliminar a <strong>{name}</strong>? Esta acción no se puede deshacer y revocará todo acceso de forma inmediata.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button onClick={onCancel} style={styles.buttonSecondary}>Cancelar</button>
                    <button onClick={onConfirm} style={{ ...styles.buttonPrimary, background: JA.RED }}>Confirmar Eliminación</button>
                </div>
            </div>
        </Modal>
    )
}

