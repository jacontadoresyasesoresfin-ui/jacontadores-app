'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Phone, Shield, Users as UsersIcon, RefreshCw, Crown, User } from 'lucide-react'

const TEAL = '#14B8A6'
const NAVY = '#0B2447'
const GOLD = '#D4A843'
const GREEN = '#10B981'

const card = {
    background: '#FFFFFF',
    border: '1.5px solid #E2E8F0',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
    padding: '20px',
}

interface Collaborator {
    id: string
    full_name: string | null
    avatar_url: string | null
    role: string
    phone: string | null
    tenant_id: string | null
    created_at: string
    tenant_name?: string
}

export default function TeamPage() {
    const [collaborators, setCollaborators] = useState<Collaborator[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedRole, setSelectedRole] = useState('all')
    const supabase = useMemo(() => createClient(), [])

    const fetchCollaborators = async () => {
        setLoading(true)
        try {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role, phone, tenant_id, created_at')
                .in('role', ['admin', 'user'])
                .order('created_at', { ascending: false })

            if (error) throw error

            if (!profiles || profiles.length === 0) { setCollaborators([]); setLoading(false); return }

            const tenantIds = [...new Set(profiles.map(p => p.tenant_id).filter(Boolean))] as string[]
            const tenantMap: Record<string, string> = {}
            if (tenantIds.length > 0) {
                const { data: tenants } = await supabase.from('tenants').select('id, name').in('id', tenantIds)
                tenants?.forEach(t => { tenantMap[t.id] = t.name })
            }

            setCollaborators(profiles.map(p => ({
                ...p,
                tenant_name: p.tenant_id ? tenantMap[p.tenant_id] : undefined
            })))
        } catch (err) {
            console.error('Error cargando colaboradores:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchCollaborators() }, [])

    const roleConfig: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
        superadmin: { label: 'Superadmin', color: GOLD, bg: '#FEF3C7', icon: Crown },
        admin: { label: 'Administrador', color: TEAL, bg: '#CCFBF1', icon: Shield },
        user: { label: 'Usuario', color: '#64748B', bg: '#F1F5F9', icon: User },
    }

    const filteredMembers = selectedRole === 'all' ? collaborators : collaborators.filter(m => m.role === selectedRole)

    const stats = [
        { label: 'Total Colaboradores', value: collaborators.length, color: NAVY, bg: '#E0F2FE', icon: UsersIcon },
        { label: 'Administradores', value: collaborators.filter(m => m.role === 'admin').length, color: TEAL, bg: '#CCFBF1', icon: Shield },
        { label: 'Usuarios Estándar', value: collaborators.filter(m => m.role === 'user').length, color: '#64748B', bg: '#F1F5F9', icon: User },
    ]

    if (loading) {
        return (
            <div className="p-8 flex items-center gap-3 text-slate-600">
                <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: `${TEAL}40`, borderTopColor: TEAL }} />
                Cargando Equipo...
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-10" style={{ fontFamily: 'var(--font-inter)' }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-800" style={{ fontFamily: 'var(--font-outfit)' }}>
                        Equipo <span style={{ color: TEAL }}>J&A Contadores</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Colaboradores internos y gestión de roles</p>
                </div>
                <button onClick={fetchCollaborators}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all hover:bg-slate-50"
                    style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}>
                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {stats.map((s, i) => (
                    <div key={i} style={card} className="hover:-translate-y-0.5 transition-transform">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                                <s.icon className="w-5 h-5" style={{ color: s.color }} />
                            </div>
                            <div>
                                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{s.label}</p>
                                <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div style={card}>
                <div className="flex items-center gap-2 mb-5 flex-wrap">
                    <span className="text-slate-500 text-sm font-medium">Filtrar por rol:</span>
                    {['all', 'admin', 'user'].map(rol => (
                        <button key={rol} onClick={() => setSelectedRole(rol)}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl transition-all"
                            style={selectedRole === rol
                                ? { background: NAVY, color: 'white', boxShadow: '0 4px 12px rgba(11,36,71,0.2)' }
                                : { background: '#F8FAFC', color: '#64748B', border: '1.5px solid #E2E8F0' }}>
                            {rol === 'all' ? 'Todos' : rol === 'admin' ? 'Administradores' : 'Usuarios'}
                        </button>
                    ))}
                </div>

                {filteredMembers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
                            <UsersIcon className="w-7 h-7 text-slate-300" />
                        </div>
                        <p className="text-slate-500 text-sm font-medium">No hay colaboradores con este rol</p>
                        <p className="text-slate-400 text-xs mt-1">Crea colaboradores desde el Panel Maestro</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredMembers.map((member) => {
                            const rc = roleConfig[member.role] || roleConfig.user
                            const initials = (member.full_name || 'NN').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                            const Icon = rc.icon

                            return (
                                <div key={member.id} className="group hover:-translate-y-1 transition-all duration-200"
                                    style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '14px', padding: '16px' }}>
                                    <div className="flex items-center gap-3 mb-3">
                                        {/* Avatar */}
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black text-white shadow-md flex-shrink-0 group-hover:scale-105 transition-transform"
                                            style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})` }}>
                                            {initials}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-black text-slate-800 text-sm truncate">{member.full_name || 'Sin nombre'}</p>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md"
                                                    style={{ background: rc.bg, color: rc.color }}>
                                                    {rc.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        {member.phone && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Phone className="w-3 h-3 flex-shrink-0" style={{ color: TEAL }} />
                                                <span>{member.phone}</span>
                                            </div>
                                        )}
                                        {member.tenant_name && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Shield className="w-3 h-3 flex-shrink-0" style={{ color: NAVY }} />
                                                <span>{member.tenant_name}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <Icon className="w-3 h-3 flex-shrink-0" />
                                            <span>Miembro desde {new Date(member.created_at).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
