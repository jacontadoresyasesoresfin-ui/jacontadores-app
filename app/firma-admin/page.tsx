'use client'

import { useEffect, useState, useCallback } from 'react'
import {
    Building2, Plus, Edit2, Eye, Trash2, X, Save,
    Loader2, Search, RefreshCw, CheckCircle2, XCircle,
    LayoutDashboard, AlertTriangle, Globe,
} from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import Link from 'next/link'

const JA = {
    NAVY: '#13213C', GOLD: '#B8960C', TEXT: '#1C2B45', GREY: '#4B5563',
    GREY_LT: '#9CA3AF', BORDER: '#E5E7EB', BG: '#F8FAFC',
    GREEN: '#10B981', RED: '#EF4444', BLUE: '#3B82F6',
}

const sty = {
    card: { background: '#FFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '24px' },
    input: { width: '100%', padding: '8px 12px', fontSize: '13px', color: JA.TEXT, background: '#FFF', outline: 'none', border: `1px solid ${JA.BORDER}`, borderRadius: '2px' },
    label: { fontSize: '11px', fontWeight: 600, color: JA.GREY, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px', display: 'block' },
    btn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, borderRadius: '2px', border: 'none', background: JA.NAVY, color: '#FFF', cursor: 'pointer' },
    btnSec: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, borderRadius: '2px', border: `1px solid ${JA.BORDER}`, background: '#FFF', color: JA.TEXT, cursor: 'pointer' },
    th: { textAlign: 'left' as const, padding: '12px 16px', borderBottom: `2px solid ${JA.BORDER}`, color: JA.GREY, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    td: { padding: '12px 16px', borderBottom: `1px solid ${JA.BORDER}`, color: JA.TEXT },
}

interface ClientProfile {
    id: string; role: string; full_name?: string | null;
    company_name?: string | null; google_sheet_url?: string | null;
    phone?: string | null; tenant_id?: string | null;
    email?: string; app_modules?: string[] | null; created_at?: string;
    siigo_url?: string | null; drive_invoices_url?: string | null;
}

interface TenantInfo {
    id: string; name: string; brand_name?: string | null;
    primary_color?: string | null; plan?: string | null;
    available_modules?: string[] | null; is_active?: boolean;
}

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

function Toast({ type, msg, onClose }: { type: 'success' | 'error'; msg: string; onClose: () => void }) {
    return (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderRadius: '2px', background: type === 'success' ? JA.GREEN : JA.RED, color: '#FFF', fontSize: '13px', fontWeight: 500, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            {msg}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', fontSize: '18px' }}>×</button>
        </div>
    )
}

export default function FirmaAdminPage() {
    return <AuthGuard><FirmaAdminContent /></AuthGuard>
}

function FirmaAdminContent() {
    const [tenant, setTenant] = useState<TenantInfo | null>(null)
    const [clients, setClients] = useState<ClientProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [unauthorized, setUnauthorized] = useState(false)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [showLink, setShowLink] = useState(false)
    const [editing, setEditing] = useState<ClientProfile | null>(null)
    const [deleting, setDeleting] = useState<ClientProfile | null>(null)

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg }); setTimeout(() => setToast(null), 4000)
    }

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams(window.location.search)
            const tenantParam = params.get('tenantId')
            const url = tenantParam ? `/api/firma/clients?tenantId=${tenantParam}` : '/api/firma/clients'
            const res = await fetch(url)

            if (res.status === 401) { setUnauthorized(true); return }
            if (res.status === 403) { setUnauthorized(true); return }
            if (!res.ok) { setUnauthorized(true); return }

            const { tenant: tenantData, clients: clientData } = await res.json()
            if (!tenantData) { setUnauthorized(true); return }

            setTenant(tenantData)
            setClients(clientData || [])
        } catch {
            setUnauthorized(true)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const filtered = clients.filter(c =>
        c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
    )

    const activeMods = tenant?.available_modules || ALL_MODS.map(m => m.id)

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12, color: JA.GREY }}>
            <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px' }}>Cargando panel...</span>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
    )

    if (unauthorized) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24 }}>
            <AlertTriangle style={{ width: 48, height: 48, color: JA.RED }} />
            <p style={{ fontSize: '14px', color: JA.GREY }}>Acceso solo para administradores de firma contable.</p>
            <Link href="/dashboard" style={{ ...sty.btn, textDecoration: 'none' }}>Ir al Dashboard</Link>
        </div>
    )

    const accentColor = tenant?.primary_color || JA.NAVY

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
            {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

            {/* Header con branding de la firma */}
            <div style={{ borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '24px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: 48, height: 48, background: accentColor, borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Globe style={{ width: 24, height: 24, color: '#FFF' }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: 700, color: JA.TEXT }}>{tenant?.brand_name || tenant?.name || 'Mi Firma'}</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                                <span style={{ fontSize: '12px', color: JA.GREY }}>Panel de Administración de Firma</span>
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', background: accentColor + '20', color: accentColor, borderRadius: '1px' }}>
                                    {(tenant?.plan || 'basic').toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={loadData} style={sty.btnSec}><RefreshCw style={{ width: 14, height: 14 }} /></button>
                        <Link href="/dashboard" style={{ ...sty.btn, background: accentColor, textDecoration: 'none' }}>
                            <LayoutDashboard style={{ width: 14, height: 14 }} /> Dashboard
                        </Link>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                {[
                    { label: 'Empresas Registradas', value: clients.length, color: accentColor },
                    { label: 'Módulos Disponibles', value: activeMods.length, color: JA.BLUE },
                    { label: 'Con Hoja de Datos', value: clients.filter(c => c.google_sheet_url).length, color: JA.GREEN },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{ ...sty.card, padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', fontWeight: 700, color }}>{value}</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Módulos disponibles en esta firma */}
            <div style={{ ...sty.card, marginBottom: '24px', padding: '16px 24px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                    Módulos habilitados para esta firma
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {ALL_MODS.map(mod => {
                        const active = activeMods.includes(mod.id)
                        return (
                            <span key={mod.id} style={{
                                fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '1px',
                                background: active ? accentColor + '15' : '#F1F5F9',
                                color: active ? accentColor : JA.GREY_LT,
                                border: `1px solid ${active ? accentColor + '40' : JA.BORDER}`,
                                display: 'flex', alignItems: 'center', gap: '4px',
                            }}>
                                {active ? <CheckCircle2 style={{ width: 10, height: 10 }} /> : <XCircle style={{ width: 10, height: 10 }} />}
                                {mod.name}
                            </span>
                        )
                    })}
                </div>
            </div>

            {/* Gestión de clientes */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: JA.TEXT }}>
                    Empresas Cliente
                    <span style={{ marginLeft: '10px', fontSize: '13px', fontWeight: 400, color: JA.GREY }}>({clients.length})</span>
                </h2>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: JA.GREY_LT }} />
                        <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...sty.input, paddingLeft: '32px', width: '180px' }} />
                    </div>
                    <button onClick={() => setShowLink(true)} style={{ ...sty.btnSec, fontSize: '12px' }} title="Vincular empresa ya registrada en el sistema">
                        <Search style={{ width: 13, height: 13 }} /> Vincular existente
                    </button>
                    <button onClick={() => setShowCreate(true)} style={{ ...sty.btn, background: accentColor }}>
                        <Plus style={{ width: 14, height: 14 }} /> Nueva Empresa
                    </button>
                </div>
            </div>

            {clients.length === 0 ? (
                <div style={{ ...sty.card, textAlign: 'center', padding: '48px' }}>
                    <Building2 style={{ width: 40, height: 40, margin: '0 auto 16px', color: JA.GREY_LT }} />
                    <p style={{ fontSize: '14px', fontWeight: 600, color: JA.GREY }}>No hay empresas vinculadas aún</p>
                    <p style={{ fontSize: '12px', color: JA.GREY_LT, marginTop: '4px', marginBottom: '20px' }}>
                        Crea una nueva empresa o vincula una ya existente por email
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button onClick={() => setShowLink(true)} style={sty.btnSec}>
                            <Search style={{ width: 14, height: 14 }} /> Vincular por email
                        </button>
                        <button onClick={() => setShowCreate(true)} style={{ ...sty.btn, background: accentColor }}>
                            <Plus style={{ width: 14, height: 14 }} /> Nueva Empresa
                        </button>
                    </div>
                </div>
            ) : (
                <div style={sty.card}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr>
                                <th style={sty.th}>Empresa</th>
                                <th style={sty.th}>Datos BI</th>
                                <th style={sty.th}>Módulos</th>
                                <th style={{ ...sty.th, textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(client => (
                                <tr key={client.id}>
                                    <td style={sty.td}>
                                        <div style={{ fontWeight: 600, color: client.company_name ? JA.TEXT : JA.RED }}>
                                            {client.company_name || '— Sin razón social —'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: JA.GREY_LT, marginTop: '2px' }}>{client.email}</div>
                                        {!client.company_name && (
                                            <div style={{ fontSize: '10px', color: JA.RED, marginTop: '2px' }}>
                                                Editar para completar datos
                                            </div>
                                        )}
                                    </td>
                                    <td style={sty.td}>
                                        {client.google_sheet_url ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: JA.GREEN }}>
                                                <CheckCircle2 style={{ width: 12, height: 12 }} /> Hoja configurada
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '12px', color: JA.GREY_LT }}>Sin hoja de datos</span>
                                        )}
                                    </td>
                                    <td style={sty.td}>
                                        <span style={{ fontSize: '12px', color: JA.GREY }}>
                                            {client.app_modules?.length ? `${client.app_modules.length} módulos` : 'Todos'}
                                        </span>
                                    </td>
                                    <td style={{ ...sty.td, textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => window.open(`/dashboard?clientId=${client.id}`, '_blank')}
                                                style={{ ...sty.btnSec, padding: '5px 10px', fontSize: '11px', gap: '4px' }}
                                                title="Ver dashboard del cliente">
                                                <Eye style={{ width: 13, height: 13 }} /> Ver
                                            </button>
                                            <button
                                                onClick={() => setEditing(client)}
                                                style={{ ...sty.btnSec, padding: '5px 10px', fontSize: '11px', gap: '4px' }}
                                                title="Editar datos">
                                                <Edit2 style={{ width: 13, height: 13 }} /> Editar
                                            </button>
                                            <button
                                                onClick={() => setDeleting(client)}
                                                style={{ ...sty.btnSec, padding: '5px 10px', fontSize: '11px', color: JA.RED, gap: '4px' }}
                                                title="Eliminar empresa">
                                                <Trash2 style={{ width: 13, height: 13 }} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}
            {showCreate && <CreateClientForFirmaModal tenantId={tenant!.id} availableMods={activeMods} onClose={() => setShowCreate(false)} onCreated={(msg) => { showToast('success', msg); loadData(); setShowCreate(false) }} onError={(msg) => showToast('error', msg)} />}
            {showLink && <LinkUserModal onClose={() => setShowLink(false)} onLinked={() => { showToast('success', 'Empresa vinculada correctamente'); loadData(); setShowLink(false) }} onError={(msg) => showToast('error', msg)} />}
            {editing && <EditClientForFirmaModal client={editing} availableMods={activeMods} onClose={() => setEditing(null)} onSaved={() => { showToast('success', 'Cambios guardados'); loadData(); setEditing(null) }} onError={(msg) => showToast('error', msg)} />}
            {deleting && (
                <ModalBase title="Eliminar empresa" onClose={() => setDeleting(null)}>
                    <p style={{ fontSize: '14px', color: JA.TEXT, marginBottom: '8px', textAlign: 'center' }}>
                        ¿Eliminar a <strong>{deleting.company_name || deleting.email}</strong>?
                    </p>
                    <p style={{ fontSize: '12px', color: JA.GREY_LT, textAlign: 'center', marginBottom: '24px' }}>
                        Esta acción eliminará el acceso del usuario al portal.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button onClick={() => setDeleting(null)} style={sty.btnSec}>Cancelar</button>
                        <button onClick={async () => {
                            await fetch('/api/admin/delete-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: deleting.id }) })
                            setDeleting(null); loadData()
                        }} style={{ ...sty.btn, background: JA.RED }}>
                            <Trash2 style={{ width: 14, height: 14 }} /> Eliminar
                        </button>
                    </div>
                </ModalBase>
            )}
        </div>
    )
}

function ModalBase({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(19,33,60,0.6)', backdropFilter: 'blur(2px)' }}>
            <div style={{ background: '#FFF', borderRadius: '4px', width: '100%', maxWidth: '540px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: JA.TEXT }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: 18, height: 18 }} /></button>
                </div>
                <div style={{ padding: '24px' }}>{children}</div>
            </div>
        </div>
    )
}

function LinkUserModal({ onClose, onLinked, onError }: { onClose: () => void; onLinked: () => void; onError: (msg: string) => void }) {
    const [email, setEmail] = useState('')
    const [companyName, setCompanyName] = useState('')
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMsg('')
        setSaving(true)
        try {
            const res = await fetch('/api/firma/link-user', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), company_name: companyName.trim() }),
            })
            const data = await res.json()
            if (!res.ok) { setErrorMsg(data?.error || 'Error al vincular'); return }
            onLinked()
        } catch (e) {
            setErrorMsg(e instanceof Error ? e.message : 'Error de conexión')
        } finally { setSaving(false) }
    }

    return (
        <ModalBase title="Vincular empresa existente" onClose={onClose}>
            <p style={{ fontSize: '12px', color: JA.GREY, marginBottom: '16px', lineHeight: 1.5 }}>
                Si ya creaste una empresa pero no aparece en la lista, búscala por email y vincúlala a tu firma.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {errorMsg && (
                    <div style={{ padding: '10px 14px', background: '#FEF2F2', border: `1px solid ${JA.RED}`, borderRadius: '2px', fontSize: '12px', color: JA.RED, fontWeight: 600 }}>
                        {errorMsg}
                    </div>
                )}
                <div>
                    <span style={sty.label}>Email del usuario *</span>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={sty.input} required placeholder="empresa@correo.com" />
                </div>
                <div>
                    <span style={sty.label}>Razón Social (si aún no tiene)</span>
                    <input value={companyName} onChange={e => setCompanyName(e.target.value)} style={sty.input} placeholder="Nombre de la empresa" />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} style={sty.btnSec}>Cancelar</button>
                    <button type="submit" disabled={saving} style={sty.btn}>
                        {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Search style={{ width: 14, height: 14 }} />}
                        {saving ? ' Buscando...' : ' Vincular empresa'}
                    </button>
                </div>
            </form>
        </ModalBase>
    )
}

function CreateClientForFirmaModal({ tenantId, availableMods, onClose, onCreated, onError }: { tenantId: string; availableMods: string[]; onClose: () => void; onCreated: (msg: string) => void; onError: (msg: string) => void }) {
    const [form, setForm] = useState({ email: '', password: '', company_name: '', sheet_url: '', siigo_url: '', drive_invoices_url: '' })
    const [selectedMods, setSelectedMods] = useState<string[]>(availableMods)
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMsg('')
        setSaving(true)
        try {
            const res = await fetch('/api/admin/create-client', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: form.email,
                    password: form.password,
                    company_name: form.company_name,
                    sheet_url: form.sheet_url,
                    siigo_url: form.siigo_url,
                    drive_invoices_url: form.drive_invoices_url,
                    tenant_id: tenantId,
                    app_modules: selectedMods,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErrorMsg(data?.error || 'Error al registrar la empresa')
                return
            }
            onCreated(`Empresa "${form.company_name}" registrada exitosamente`)
        } catch (e) {
            setErrorMsg(e instanceof Error ? e.message : 'Error de conexión')
        } finally { setSaving(false) }
    }

    const toggleMod = (id: string) => setSelectedMods(prev =>
        prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )

    return (
        <ModalBase title="Nueva Empresa Cliente" onClose={onClose}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {errorMsg && (
                    <div style={{ padding: '10px 14px', background: '#FEF2F2', border: `1px solid ${JA.RED}`, borderRadius: '2px', fontSize: '12px', color: JA.RED, fontWeight: 600 }}>
                        {errorMsg}
                    </div>
                )}

                <div>
                    <span style={sty.label}>Razón Social *</span>
                    <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} style={sty.input} required placeholder="Nombre de la empresa" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                        <span style={sty.label}>Email *</span>
                        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={sty.input} required placeholder="empresa@correo.com" />
                    </div>
                    <div>
                        <span style={sty.label}>Contraseña * (mín. 6 caracteres)</span>
                        <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={sty.input} required minLength={6} />
                    </div>
                </div>
                <div>
                    <span style={sty.label}>Google Sheets (datos BI)</span>
                    <input value={form.sheet_url} onChange={e => setForm({ ...form, sheet_url: e.target.value })} style={sty.input} placeholder="https://docs.google.com/spreadsheets/..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                        <span style={sty.label}>URL Siigo</span>
                        <input value={form.siigo_url} onChange={e => setForm({ ...form, siigo_url: e.target.value })} style={sty.input} placeholder="https://..." />
                    </div>
                    <div>
                        <span style={sty.label}>Drive Facturas</span>
                        <input value={form.drive_invoices_url} onChange={e => setForm({ ...form, drive_invoices_url: e.target.value })} style={sty.input} placeholder="https://drive.google.com/..." />
                    </div>
                </div>
                <div>
                    <span style={sty.label}>Módulos a activar</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', padding: '10px', background: JA.BG, border: `1px solid ${JA.BORDER}` }}>
                        {ALL_MODS.filter(m => availableMods.includes(m.id)).map(mod => (
                            <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={selectedMods.includes(mod.id)} onChange={() => toggleMod(mod.id)} />
                                {mod.name}
                            </label>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={onClose} style={sty.btnSec}>Cancelar</button>
                    <button type="submit" disabled={saving} style={sty.btn}>
                        {saving ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Registrando...</> : <><Save style={{ width: 14, height: 14 }} /> Registrar Empresa</>}
                    </button>
                </div>
            </form>
        </ModalBase>
    )
}

function EditClientForFirmaModal({ client, availableMods, onClose, onSaved, onError }: { client: ClientProfile; availableMods: string[]; onClose: () => void; onSaved: () => void; onError: (msg: string) => void }) {
    const [form, setForm] = useState({
        company_name: client.company_name || '',
        sheet_url: client.google_sheet_url || '',
        siigo_url: client.siigo_url || '',
        drive_invoices_url: client.drive_invoices_url || '',
        app_modules: (() => {
            const existing = client.app_modules || []
            if (existing.length === 0) return availableMods
            const NEW_MODS = ['nomina', 'nit', 'ml_pagos', 'ml_comisiones', 'ml_devoluciones', 'ml_costos', 'ml_alertas']
            const isLegacy = !existing.some(m => NEW_MODS.includes(m))
            return isLegacy ? [...existing, ...NEW_MODS.filter(m => availableMods.includes(m))] : existing
        })(),
    })
    const [saving, setSaving] = useState(false)

    const toggleMod = (id: string) => setForm(prev => ({
        ...prev,
        app_modules: prev.app_modules.includes(id)
            ? prev.app_modules.filter(m => m !== id)
            : [...prev.app_modules, id],
    }))

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/firma/update-client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: client.id,
                    company_name: form.company_name,
                    google_sheet_url: form.sheet_url,
                    siigo_url: form.siigo_url,
                    drive_invoices_url: form.drive_invoices_url,
                    app_modules: form.app_modules,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Error al guardar')
            onSaved()
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Error al guardar')
        } finally { setSaving(false) }
    }

    return (
        <ModalBase title={`Editar: ${client.company_name}`} onClose={onClose}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                    <span style={sty.label}>Razón Social</span>
                    <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} style={sty.input} />
                </div>
                <div>
                    <span style={sty.label}>URL Google Sheets (datos BI)</span>
                    <input value={form.sheet_url} onChange={e => setForm({ ...form, sheet_url: e.target.value })} style={sty.input} placeholder="https://docs.google.com/..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                        <span style={sty.label}>URL Siigo</span>
                        <input value={form.siigo_url} onChange={e => setForm({ ...form, siigo_url: e.target.value })} style={sty.input} placeholder="https://..." />
                    </div>
                    <div>
                        <span style={sty.label}>Drive Facturas</span>
                        <input value={form.drive_invoices_url} onChange={e => setForm({ ...form, drive_invoices_url: e.target.value })} style={sty.input} placeholder="https://drive.google.com/..." />
                    </div>
                </div>
                <div>
                    <span style={sty.label}>Módulos</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', padding: '10px', background: JA.BG, border: `1px solid ${JA.BORDER}` }}>
                        {ALL_MODS.filter(m => availableMods.includes(m.id)).map(mod => (
                            <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={form.app_modules.includes(mod.id)} onChange={() => toggleMod(mod.id)} />
                                {mod.name}
                            </label>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={sty.btnSec}>Cerrar</button>
                    <button onClick={handleSave} disabled={saving} style={sty.btn}>
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </ModalBase>
    )
}
