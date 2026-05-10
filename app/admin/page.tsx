'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import {
    UserPlus, Building2, Shield, Users, Trash2, Edit2, X, Save,
    LayoutDashboard, RefreshCw, Eye,
    CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet,
    Loader2, Search, Briefcase, Plus, Globe,
} from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import Link from 'next/link'

const JA = {
    NAVY: '#13213C', NAVY_MID: '#1C3460', GOLD: '#B8960C', GOLD_LT: '#D4A843',
    WHITE: '#FFFFFF', TEXT: '#1C2B45', GREY: '#4B5563', GREY_LT: '#9CA3AF',
    BORDER: '#E5E7EB', BG: '#F8FAFC', GREEN: '#10B981', RED: '#EF4444',
    BLUE: '#3B82F6', PURPLE: '#8B5CF6',
}

const styles = {
    card: {
        background: '#FFFFFF', border: `1px solid ${JA.BORDER}`,
        borderRadius: '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '24px',
    },
    input: (focused = false) => ({
        width: '100%', padding: '8px 12px', fontSize: '13px',
        fontFamily: 'Inter, sans-serif', color: JA.TEXT, background: '#FFFFFF',
        outline: 'none', border: `1px solid ${focused ? JA.NAVY : JA.BORDER}`,
        borderRadius: '2px', transition: 'all 0.1s',
    }),
    label: {
        fontSize: '11px', fontWeight: 600, color: JA.GREY,
        textTransform: 'uppercase' as const, letterSpacing: '0.05em',
        marginBottom: '6px', display: 'block',
    },
    buttonPrimary: {
        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
        fontSize: '13px', fontWeight: 600, borderRadius: '2px', border: 'none',
        background: JA.NAVY, color: '#FFFFFF', cursor: 'pointer',
    },
    buttonSecondary: {
        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
        fontSize: '13px', fontWeight: 600, borderRadius: '2px',
        border: `1px solid ${JA.BORDER}`, background: '#FFFFFF', color: JA.TEXT, cursor: 'pointer',
    },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
    th: {
        textAlign: 'left' as const, padding: '12px 16px', borderBottom: `2px solid ${JA.BORDER}`,
        color: JA.GREY, fontWeight: 600, fontSize: '11px',
        textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    },
    td: { padding: '12px 16px', borderBottom: `1px solid ${JA.BORDER}`, color: JA.TEXT },
}

interface Profile {
    id: string; role: string; full_name?: string | null;
    company_name?: string | null; google_sheet_url?: string | null;
    phone?: string | null; tenant_id?: string | null; created_at?: string;
    email?: string; app_modules?: string[] | null;
}

interface Tenant {
    id: string; name: string; brand_name?: string | null;
    primary_color?: string | null; accent_color?: string | null;
    plan?: string | null; available_modules?: string[] | null;
    is_active?: boolean; created_at?: string;
    _client_count?: number;
}

type TabType = 'firmas' | 'clients' | 'collaborators'

function Toast({ type, msg, onClose }: { type: 'success' | 'error' | 'info', msg: string, onClose: () => void }) {
    const bg = type === 'success' ? JA.GREEN : type === 'error' ? JA.RED : JA.NAVY
    return (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderRadius: '2px', background: bg, color: '#FFF', fontSize: '13px', fontWeight: 500, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            {msg}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', fontSize: '18px', padding: 0 }}>×</button>
        </div>
    )
}

export default function AdminPage() {
    return <AuthGuard childrenWithUser={(user) => <AdminContent user={user} />} />
}

function AdminContent({ user }: { user: User }) {
    const supabase = useMemo(() => createClient(), [])
    const [clients, setClients] = useState<Profile[]>([])
    const [collaborators, setCollaborators] = useState<Profile[]>([])
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [loading, setLoading] = useState(true)
    const [isNotAdmin, setIsNotAdmin] = useState<{role?: string, err?: string|null} | false>(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null)
    const [tab, setTab] = useState<TabType>('firmas')
    const [searchQuery, setSearchQuery] = useState('')
    const [showCreateClient, setShowCreateClient] = useState(false)
    const [showCreateCollab, setShowCreateCollab] = useState(false)
    const [showCreateTenant, setShowCreateTenant] = useState(false)
    const [editingClient, setEditingClient] = useState<Profile | null>(null)
    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
    const [deletingUser, setDeletingUser] = useState<Profile | null>(null)

    const showToast = (type: 'success' | 'error' | 'info', msg: string) => {
        setToast({ type, msg }); setTimeout(() => setToast(null), 5000)
    }

    const fetchData = useCallback(async () => {
        setLoading(true)
        const { data: myProfile, error: profileErr } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if (myProfile?.role !== 'superadmin') { setIsNotAdmin({ role: myProfile?.role, err: profileErr?.message || null }); setLoading(false); return }

        const [{ data: all }, { data: tenantsData }] = await Promise.all([
            supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            supabase.from('tenants').select('*').order('created_at', { ascending: false }),
        ])
        const profiles = all || []
        setClients(profiles.filter((p: Profile) => p.company_name && p.id !== user.id))
        setCollaborators(profiles.filter((p: Profile) => ['admin', 'user'].includes(p.role) && !p.company_name && p.id !== user.id))

        const allTenants: Tenant[] = tenantsData || []
        const tenantsWithCount = allTenants.map(t => ({
            ...t,
            _client_count: profiles.filter((p: Profile) => p.tenant_id === t.id && p.role !== 'firma_admin').length,
        }))
        setTenants(tenantsWithCount)
        setLoading(false)
    }, [supabase, user.id])

    useEffect(() => { fetchData() }, [fetchData])

    const filteredClients = useMemo(() =>
        clients.filter(c =>
            c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchQuery.toLowerCase())
        ), [clients, searchQuery])

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
                <p style={{ color: JA.GREY, fontSize: '14px' }}>Este panel es exclusivo para administración central.</p>
                
                {/* Debug Info */}
                <div style={{ marginTop: '24px', padding: '16px', background: '#FEE2E2', borderRadius: '4px', textAlign: 'left', fontSize: '12px', color: '#991B1B', border: '1px solid #F87171', maxWidth: '400px', width: '100%' }}>
                    <p><strong>Debug Info:</strong></p>
                    <p>User ID: {user?.id}</p>
                    <p>User Email: {user?.email}</p>
                    <p>Fetched Role: {isNotAdmin.role || 'null'}</p>
                    <p>Fetch Error: {isNotAdmin.err || 'none'}</p>
                </div>
            </div>
            <Link href="/dashboard" style={{ ...styles.buttonPrimary, textDecoration: 'none' }}>Regresar al Portal</Link>
        </div>
    )

    const tabStyle = (t: TabType) => ({
        padding: '12px 24px', fontSize: '14px', fontWeight: 600 as const,
        border: 'none', background: 'none', cursor: 'pointer',
        color: tab === t ? JA.NAVY : JA.GREY_LT,
        borderBottom: `2px solid ${tab === t ? JA.GOLD : 'transparent'}`,
        marginBottom: '-1px', display: 'flex', alignItems: 'center', gap: '8px',
    })

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
            {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}

            {/* Header */}
            <div style={{ borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '24px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: JA.TEXT, marginBottom: '4px' }}>Panel de Control Global</h1>
                    <p style={{ fontSize: '14px', color: JA.GREY }}>Desarrollador · Firmas Contables · Empresas-Cliente</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={fetchData} style={styles.buttonSecondary}>
                        <RefreshCw style={{ width: 14, height: 14 }} /> Sincronizar
                    </button>
                    <Link href="/dashboard" style={{ ...styles.buttonPrimary, textDecoration: 'none' }}>
                        <LayoutDashboard style={{ width: 14, height: 14 }} /> Dashboard
                    </Link>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                {[
                    { label: 'Firmas Contables', value: tenants.length, icon: Briefcase, color: JA.PURPLE, sub: `${tenants.filter(t => t.is_active).length} activas` },
                    { label: 'Empresas Cliente', value: clients.length, icon: Building2, color: JA.NAVY, sub: `en ${tenants.length} firmas` },
                    { label: 'Equipo Interno', value: collaborators.length, icon: Users, color: JA.GREEN, sub: 'colaboradores' },
                ].map(({ label, value, icon: Icon, color, sub }) => (
                    <div key={label} style={{ ...styles.card, padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: 44, height: 44, borderRadius: '2px', background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon style={{ width: 20, height: 20, color }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '26px', fontWeight: 700, color: JA.TEXT, lineHeight: 1 }}>{value}</div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                            <div style={{ fontSize: '10px', color: JA.GREY_LT }}>{sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${JA.BORDER}`, marginBottom: '24px' }}>
                <button onClick={() => setTab('firmas')} style={tabStyle('firmas')}>
                    <Briefcase style={{ width: 14, height: 14 }} /> Firmas Contables ({tenants.length})
                </button>
                <button onClick={() => setTab('clients')} style={tabStyle('clients')}>
                    <Building2 style={{ width: 14, height: 14 }} /> Empresas Cliente ({clients.length})
                </button>
                <button onClick={() => setTab('collaborators')} style={tabStyle('collaborators')}>
                    <Users style={{ width: 14, height: 14 }} /> Equipo ({collaborators.length})
                </button>
            </div>

            {/* ── Tab: Firmas Contables ── */}
            {tab === 'firmas' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: JA.TEXT }}>Firmas Contables</h3>
                            <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '2px' }}>Capa 2 de la plataforma — cada firma gestiona sus propias empresas-cliente</p>
                        </div>
                        <button onClick={() => setShowCreateTenant(true)} style={{ ...styles.buttonPrimary, background: JA.PURPLE }}>
                            <Plus style={{ width: 14, height: 14 }} /> Nueva Firma Contable
                        </button>
                    </div>

                    {tenants.length === 0 ? (
                        <div style={{ ...styles.card, textAlign: 'center', padding: '48px', color: JA.GREY }}>
                            <Briefcase style={{ width: 40, height: 40, margin: '0 auto 16px', opacity: 0.3 }} />
                            <p style={{ fontSize: '14px', fontWeight: 600 }}>No hay firmas registradas aún</p>
                            <p style={{ fontSize: '12px', marginTop: '8px' }}>Crea la primera firma contable para comenzar a comercializar la plataforma</p>
                        </div>
                    ) : (
                        <div style={styles.card}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Firma</th>
                                        <th style={styles.th}>Plan</th>
                                        <th style={styles.th}>Módulos</th>
                                        <th style={styles.th}>Clientes</th>
                                        <th style={styles.th}>Estado</th>
                                        <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tenants.map(tenant => (
                                        <tr key={tenant.id}>
                                            <td style={styles.td}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ width: 8, height: 32, borderRadius: '1px', background: tenant.primary_color || JA.NAVY, flexShrink: 0 }} />
                                                    <div>
                                                        <div style={{ fontWeight: 700 }}>{tenant.name}</div>
                                                        <div style={{ fontSize: '11px', color: JA.GREY_LT }}>{tenant.brand_name && tenant.brand_name !== tenant.name ? `Marca: ${tenant.brand_name}` : 'Sin nombre de marca'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={styles.td}>
                                                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '1px', background: tenant.plan === 'enterprise' ? JA.GOLD + '20' : tenant.plan === 'pro' ? JA.BLUE + '15' : '#F1F5F9', color: tenant.plan === 'enterprise' ? JA.GOLD : tenant.plan === 'pro' ? JA.BLUE : JA.GREY }}>
                                                    {(tenant.plan || 'basic').toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={styles.td}>
                                                <span style={{ fontSize: '12px', color: JA.GREY }}>{tenant.available_modules?.length || 0} módulos</span>
                                            </td>
                                            <td style={styles.td}>
                                                <span style={{ fontSize: '14px', fontWeight: 700, color: JA.NAVY }}>{tenant._client_count || 0}</span>
                                            </td>
                                            <td style={styles.td}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: tenant.is_active ? JA.GREEN : JA.RED }}>
                                                    {tenant.is_active ? <CheckCircle2 style={{ width: 14, height: 14 }} /> : <XCircle style={{ width: 14, height: 14 }} />}
                                                    {tenant.is_active ? 'Activa' : 'Suspendida'}
                                                </span>
                                            </td>
                                            <td style={{ ...styles.td, textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => setEditingTenant(tenant)} style={{ ...styles.buttonSecondary, padding: '4px 8px' }} title="Configurar firma">
                                                        <Edit2 style={{ width: 14, height: 14 }} />
                                                    </button>
                                                    <button
                                                        onClick={() => window.open(`/firma-admin?tenantId=${tenant.id}`, '_blank')}
                                                        style={{ ...styles.buttonSecondary, padding: '4px 8px' }} title="Ver panel de firma">
                                                        <Eye style={{ width: 14, height: 14 }} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: Empresas Cliente ── */}
            {tab === 'clients' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: JA.GREY_LT }} />
                            <input type="text" placeholder="Buscar empresa o correo..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ ...styles.input(false), paddingLeft: '40px' }} />
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
                                    <th style={styles.th}>Firma Contable</th>
                                    <th style={styles.th}>Módulos</th>
                                    <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.map(client => {
                                    const firma = tenants.find(t => t.id === client.tenant_id)
                                    return (
                                        <tr key={client.id}>
                                            <td style={styles.td}>
                                                <div style={{ fontWeight: 600 }}>{client.company_name}</div>
                                                <div style={{ fontSize: '11px', color: JA.GREY_LT }}>{client.email}</div>
                                            </td>
                                            <td style={styles.td}>
                                                {firma ? (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: firma.primary_color || JA.NAVY }} />
                                                        {firma.name}
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '11px', color: JA.GREY_LT }}>Sin firma asignada</span>
                                                )}
                                            </td>
                                            <td style={styles.td}>
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                    {client.app_modules?.slice(0, 3).map(m => (
                                                        <span key={m} style={{ fontSize: '9px', background: '#F1F5F9', padding: '2px 6px', borderRadius: '1px', color: JA.NAVY, fontWeight: 600 }}>{m}</span>
                                                    ))}
                                                    {(client.app_modules?.length || 0) > 3 && <span style={{ fontSize: '9px', color: JA.GREY_LT }}>+{client.app_modules!.length - 3}</span>}
                                                </div>
                                            </td>
                                            <td style={{ ...styles.td, textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => window.open(`/dashboard?clientId=${client.id}`, '_blank')} style={{ ...styles.buttonSecondary, padding: '4px 8px' }} title="Simular Acceso"><Eye style={{ width: 14, height: 14 }} /></button>
                                                    <button onClick={() => setEditingClient(client)} style={{ ...styles.buttonSecondary, padding: '4px 8px' }} title="Editar"><Edit2 style={{ width: 14, height: 14 }} /></button>
                                                    <button onClick={() => setDeletingUser(client)} style={{ ...styles.buttonSecondary, padding: '4px 8px', color: JA.RED, borderColor: JA.RED + '20' }} title="Eliminar"><Trash2 style={{ width: 14, height: 14 }} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Tab: Equipo ── */}
            {tab === 'collaborators' && (
                <div style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Equipo Interno</h3>
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
                                        <span style={{ fontSize: '11px', padding: '2px 8px', background: c.role === 'admin' ? JA.NAVY : '#F1F5F9', color: c.role === 'admin' ? '#FFF' : JA.TEXT, fontWeight: 600 }}>
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
            {showCreateTenant && (
                <CreateTenantModal
                    onClose={() => setShowCreateTenant(false)}
                    onCreated={(msg) => { showToast('success', msg); fetchData(); setShowCreateTenant(false) }}
                    onError={(msg) => showToast('error', msg)}
                />
            )}
            {editingTenant && (
                <EditTenantModal
                    tenant={editingTenant}
                    onClose={() => setEditingTenant(null)}
                    onSaved={() => { showToast('success', 'Firma actualizada'); fetchData(); setEditingTenant(null) }}
                    onError={(msg) => showToast('error', msg)}
                />
            )}
            {showCreateClient && (
                <CreateClientModal
                    tenants={tenants}
                    onClose={() => setShowCreateClient(false)}
                    onCreated={(msg) => { showToast('success', msg); fetchData(); setShowCreateClient(false) }}
                    onError={(msg) => showToast('error', msg)}
                />
            )}
            {editingClient && (
                <EditClientModal
                    client={editingClient}
                    tenants={tenants}
                    onClose={() => setEditingClient(null)}
                    onSaved={() => { showToast('success', 'Configuración actualizada'); fetchData(); setEditingClient(null) }}
                    onError={(msg) => showToast('error', msg)}
                    supabase={supabase}
                />
            )}
            {showCreateCollab && (
                <CreateCollabModal
                    onClose={() => setShowCreateCollab(false)}
                    onCreated={(msg) => { showToast('success', msg); fetchData(); setShowCreateCollab(false) }}
                    onError={(msg) => showToast('error', msg)}
                />
            )}
            {deletingUser && (
                <DeleteConfirmModal
                    name={deletingUser.company_name || deletingUser.full_name || deletingUser.email || 'Registro'}
                    onConfirm={async () => {
                        try {
                            const res = await fetch('/api/admin/delete-user', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: deletingUser.id }),
                            })
                            if (!res.ok) throw new Error(await res.text())
                            showToast('success', 'Registro eliminado')
                            fetchData()
                        } catch (e) {
                            showToast('error', e instanceof Error ? e.message : 'Error al eliminar')
                        } finally { setDeletingUser(null) }
                    }}
                    onCancel={() => setDeletingUser(null)}
                />
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

/* ── Modal base ─────────────────────────────────────────── */
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(19,33,60,0.6)', backdropFilter: 'blur(2px)' }}>
            <div style={{ background: '#FFF', borderRadius: '4px', width: '100%', maxWidth: wide ? '640px' : '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ padding: '16px 24px', borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#FFF', zIndex: 1 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: JA.TEXT }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X style={{ width: 18, height: 18 }} /></button>
                </div>
                <div style={{ padding: '24px' }}>{children}</div>
            </div>
        </div>
    )
}

/* ── Crear Firma Contable ─────────────────────────────── */
const ALL_MODS = [
    { id: 'analytics', name: 'Analytics' },
    { id: 'siigo_bi', name: 'Siigo BI' },
    { id: 'reconciliation', name: 'Conciliación' },
    { id: 'sales', name: 'Ventas' },
    { id: 'ecommerce', name: 'E-commerce' },
    { id: 'portfolio', name: 'Cartera' },
    { id: 'inventory', name: 'Inventario' },
    { id: 'reports', name: 'Reportes' },
    { id: 'team', name: 'Equipo' },
    { id: 'taxes', name: 'Impuestos' },
    { id: 'configuracion', name: 'Configuración' },
    { id: 'nomina', name: 'Nómina PILA' },
    { id: 'nit', name: 'Verificar NIT' },
    { id: 'ml_pagos', name: 'ML Pagos' },
    { id: 'ml_comisiones', name: 'ML Comisiones' },
    { id: 'ml_devoluciones', name: 'ML Devoluciones' },
    { id: 'ml_costos', name: 'ML Costos' },
    { id: 'ml_alertas', name: 'ML Alertas' },
]

function CreateTenantModal({ onClose, onCreated, onError }: { onClose: () => void; onCreated: (msg: string) => void; onError: (msg: string) => void }) {
    const [form, setForm] = useState({
        name: '', brand_name: '', primary_color: '#13213C', accent_color: '#B8960C', plan: 'basic',
        admin_email: '', admin_password: '', admin_full_name: '',
        available_modules: ALL_MODS.slice(0, 8).map(m => m.id),
    })
    const [saving, setSaving] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const res = await fetch('/api/admin/create-tenant', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al crear firma')
            onCreated(`Firma "${form.name}" creada con admin ${form.admin_email}`)
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Error desconocido')
        } finally { setSaving(false) }
    }

    const toggleMod = (id: string) => setForm(prev => ({
        ...prev,
        available_modules: prev.available_modules.includes(id)
            ? prev.available_modules.filter(m => m !== id)
            : [...prev.available_modules, id],
    }))

    return (
        <Modal title="Nueva Firma Contable" onClose={onClose} wide>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Datos de la firma */}
                <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: JA.PURPLE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', paddingBottom: '6px', borderBottom: `1px solid ${JA.BORDER}` }}>
                        Identidad de la Firma
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <span style={styles.label}>Nombre Legal *</span>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={styles.input()} placeholder="García & Asociados S.A.S." required />
                        </div>
                        <div>
                            <span style={styles.label}>Nombre Comercial (White-Label)</span>
                            <input value={form.brand_name} onChange={e => setForm({ ...form, brand_name: e.target.value })} style={styles.input()} placeholder="Igual al legal si no aplica" />
                        </div>
                        <div>
                            <span style={styles.label}>Color Primario</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input type="color" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} style={{ width: 40, height: 36, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', cursor: 'pointer', padding: '2px' }} />
                                <input value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} style={{ ...styles.input(), flex: 1 }} placeholder="#13213C" />
                            </div>
                        </div>
                        <div>
                            <span style={styles.label}>Plan</span>
                            <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} style={styles.input()}>
                                <option value="basic">Basic</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Admin de la firma */}
                <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: JA.NAVY, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', paddingBottom: '6px', borderBottom: `1px solid ${JA.BORDER}` }}>
                        Administrador de la Firma
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <span style={styles.label}>Nombre Completo</span>
                            <input value={form.admin_full_name} onChange={e => setForm({ ...form, admin_full_name: e.target.value })} style={styles.input()} placeholder="Carlos García" />
                        </div>
                        <div>
                            <span style={styles.label}>Email *</span>
                            <input type="email" value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} style={styles.input()} required />
                        </div>
                        <div>
                            <span style={styles.label}>Password Temporal *</span>
                            <input type="password" value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })} style={styles.input()} required minLength={8} />
                        </div>
                    </div>
                </div>

                {/* Módulos disponibles */}
                <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', paddingBottom: '6px', borderBottom: `1px solid ${JA.BORDER}` }}>
                        Módulos Disponibles para esta Firma
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '12px', background: '#F8FAFC', border: `1px solid ${JA.BORDER}` }}>
                        {ALL_MODS.map(mod => (
                            <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', padding: '4px' }}>
                                <input type="checkbox" checked={form.available_modules.includes(mod.id)} onChange={() => toggleMod(mod.id)} />
                                {mod.name}
                            </label>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} style={styles.buttonSecondary}>Cancelar</button>
                    <button type="submit" disabled={saving} style={{ ...styles.buttonPrimary, background: JA.PURPLE }}>
                        {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Plus style={{ width: 14, height: 14 }} />}
                        Crear Firma
                    </button>
                </div>
            </form>
        </Modal>
    )
}

/* ── Editar Firma ───────────────────────────────────────── */
function EditTenantModal({ tenant, onClose, onSaved, onError }: { tenant: Tenant; onClose: () => void; onSaved: () => void; onError: (msg: string) => void }) {
    const [form, setForm] = useState({
        name: tenant.name, brand_name: tenant.brand_name || '',
        primary_color: tenant.primary_color || '#13213C',
        plan: tenant.plan || 'basic', is_active: tenant.is_active !== false,
        available_modules: tenant.available_modules || [],
    })
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/admin/update-tenant', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenant.id, ...form }),
            })
            if (!res.ok) throw new Error('Error al actualizar')
            onSaved()
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Error al guardar')
        } finally { setSaving(false) }
    }

    const toggleMod = (id: string) => setForm(prev => ({
        ...prev,
        available_modules: prev.available_modules.includes(id)
            ? prev.available_modules.filter(m => m !== id)
            : [...prev.available_modules, id],
    }))

    return (
        <Modal title={`Configurar Firma: ${tenant.name}`} onClose={onClose} wide>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <span style={styles.label}>Nombre Legal</span>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={styles.input()} />
                    </div>
                    <div>
                        <span style={styles.label}>Nombre Comercial</span>
                        <input value={form.brand_name} onChange={e => setForm({ ...form, brand_name: e.target.value })} style={styles.input()} />
                    </div>
                    <div>
                        <span style={styles.label}>Color Primario</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input type="color" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} style={{ width: 40, height: 36, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', cursor: 'pointer', padding: '2px' }} />
                            <input value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} style={{ ...styles.input(), flex: 1 }} />
                        </div>
                    </div>
                    <div>
                        <span style={styles.label}>Plan</span>
                        <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} style={styles.input()}>
                            <option value="basic">Basic</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                    </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                    Firma activa (los clientes pueden acceder)
                </label>
                <div>
                    <span style={styles.label}>Módulos disponibles</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '12px', background: '#F8FAFC', border: `1px solid ${JA.BORDER}` }}>
                        {ALL_MODS.map(mod => (
                            <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', padding: '4px' }}>
                                <input type="checkbox" checked={form.available_modules.includes(mod.id)} onChange={() => toggleMod(mod.id)} />
                                {mod.name}
                            </label>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={styles.buttonSecondary}>Cerrar</button>
                    <button onClick={handleSave} disabled={saving} style={styles.buttonPrimary}>
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}

/* ── Crear Empresa Cliente ──────────────────────────────── */
function CreateClientModal({ tenants, onClose, onCreated, onError }: { tenants: Tenant[]; onClose: () => void; onCreated: (msg: string) => void; onError: (msg: string) => void }) {
    const [form, setForm] = useState({ email: '', password: '', company_name: '', sheet_url: '', phone: '', tenant_id: '' })
    const [saving, setSaving] = useState(false)

    const selectedTenant = tenants.find(t => t.id === form.tenant_id)
    const availableMods = selectedTenant?.available_modules || ALL_MODS.map(m => m.id)
    const [selectedMods, setSelectedMods] = useState<string[]>([])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const res = await fetch('/api/admin/create-client', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, app_modules: selectedMods.length > 0 ? selectedMods : availableMods }),
            })
            if (!res.ok) throw new Error('Error al registrar empresa')
            onCreated(`Empresa ${form.company_name} registrada exitosamente`)
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Error desconocido')
        } finally { setSaving(false) }
    }

    return (
        <Modal title="Registrar Empresa Cliente" onClose={onClose} wide>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <span style={styles.label}>Razón Social *</span>
                    <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} style={styles.input()} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <span style={styles.label}>Email *</span>
                        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={styles.input()} required />
                    </div>
                    <div>
                        <span style={styles.label}>Password Temporal *</span>
                        <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={styles.input()} required />
                    </div>
                </div>
                <div>
                    <span style={styles.label}>Asignar a Firma Contable</span>
                    <select value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })} style={styles.input()}>
                        <option value="">Sin firma asignada (directo)</option>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div>
                    <span style={styles.label}>URL Google Sheets</span>
                    <input value={form.sheet_url} onChange={e => setForm({ ...form, sheet_url: e.target.value })} style={styles.input()} placeholder="https://docs.google.com/..." />
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} style={styles.buttonSecondary}>Cancelar</button>
                    <button type="submit" disabled={saving} style={styles.buttonPrimary}>
                        {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: 14, height: 14 }} />}
                        Registrar
                    </button>
                </div>
            </form>
        </Modal>
    )
}

/* ── Editar Cliente ─────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditClientModal({ client, tenants, onClose, onSaved, onError, supabase }: { client: Profile; tenants: Tenant[]; onClose: () => void; onSaved: () => void; onError: (msg: string) => void; supabase: any }) {
    const [form, setForm] = useState({
        company_name: client.company_name || '',
        sheet_url: client.google_sheet_url || '',
        phone: client.phone || '',
        tenant_id: client.tenant_id || '',
        app_modules: (() => {
            const existing = client.app_modules || []
            if (existing.length === 0) return ALL_MODS.map(m => m.id)
            const NEW_MODS = ['nomina', 'nit', 'ml_pagos', 'ml_comisiones', 'ml_devoluciones', 'ml_costos', 'ml_alertas']
            const isLegacy = !existing.some(m => NEW_MODS.includes(m))
            return isLegacy ? [...existing, ...NEW_MODS] : existing
        })(),
    })
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error } = await supabase.from('profiles').update({
                company_name: form.company_name, google_sheet_url: form.sheet_url,
                phone: form.phone, tenant_id: form.tenant_id || null,
                app_modules: form.app_modules, updated_at: new Date().toISOString(),
            }).eq('id', client.id)
            if (error) throw error
            onSaved()
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Error al guardar')
        } finally { setSaving(false) }
    }

    const toggleMod = (id: string) => setForm(prev => ({
        ...prev,
        app_modules: prev.app_modules.includes(id)
            ? prev.app_modules.filter(m => m !== id)
            : [...prev.app_modules, id],
    }))

    return (
        <Modal title="Configuración de Empresa" onClose={onClose} wide>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <span style={styles.label}>Razón Social</span>
                    <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} style={styles.input()} />
                </div>
                <div>
                    <span style={styles.label}>Firma Contable</span>
                    <select value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })} style={styles.input()}>
                        <option value="">Sin firma asignada</option>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div>
                    <span style={styles.label}>URL Google Sheets</span>
                    <input value={form.sheet_url} onChange={e => setForm({ ...form, sheet_url: e.target.value })} style={styles.input()} />
                </div>
                <div>
                    <span style={styles.label}>Módulos autorizados</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '12px', background: '#F8FAFC', border: `1px solid ${JA.BORDER}` }}>
                        {ALL_MODS.map(mod => (
                            <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', padding: '4px' }}>
                                <input type="checkbox" checked={form.app_modules.includes(mod.id)} onChange={() => toggleMod(mod.id)} />
                                {mod.name}
                            </label>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={styles.buttonSecondary}>Cerrar</button>
                    <button onClick={handleSave} disabled={saving} style={styles.buttonPrimary}>
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}

/* ── Colaborador ────────────────────────────────────────── */
function CreateCollabModal({ onClose, onCreated, onError }: { onClose: () => void; onCreated: (msg: string) => void; onError: (msg: string) => void }) {
    const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '', role: 'user' as 'admin' | 'user' })
    const [saving, setSaving] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const res = await fetch('/api/admin/create-collaborator', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            if (!res.ok) throw new Error('Error al registrar colaborador')
            onCreated(`Colaborador ${form.full_name} registrado`)
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Error al registrar')
        } finally { setSaving(false) }
    }

    return (
        <Modal title="Registro de Colaborador" onClose={onClose}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <span style={styles.label}>Nombre Completo *</span>
                    <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} style={styles.input()} required />
                </div>
                <div>
                    <span style={styles.label}>Email *</span>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={styles.input()} required />
                </div>
                <div>
                    <span style={styles.label}>Password Temporal *</span>
                    <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={styles.input()} required />
                </div>
                <div>
                    <span style={styles.label}>Nivel de Privilegios *</span>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'user' })} style={styles.input()}>
                        <option value="user">Usuario (Lectura)</option>
                        <option value="admin">Administrador (Gestión)</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
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
                    ¿Desea eliminar a <strong>{name}</strong>? Esta acción es irreversible.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button onClick={onCancel} style={styles.buttonSecondary}>Cancelar</button>
                    <button onClick={onConfirm} style={{ ...styles.buttonPrimary, background: JA.RED }}>Confirmar Eliminación</button>
                </div>
            </div>
        </Modal>
    )
}
