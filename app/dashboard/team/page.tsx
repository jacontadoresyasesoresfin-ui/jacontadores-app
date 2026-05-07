'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Phone, Shield, Users as UsersIcon, RefreshCw, Crown, User, Mail } from 'lucide-react'

const JA = {
    NAVY:    '#13213C',
    GOLD:    '#B8960C',
    TEXT:    '#1C2B45',
    GREY:    '#4B5563',
    GREY_LT: '#9CA3AF',
    BORDER:  '#E5E7EB',
    BG:      '#F8FAFC',
    GREEN:   '#10B981',
    RED:     '#EF4444',
    BLUE:    '#3B82F6'
}

const cardStyle = {
    background: '#FFFFFF',
    border: `1px solid ${JA.BORDER}`,
    borderRadius: '2px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
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

    const roleConfig: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }> = {
        superadmin: { label: 'SUPERADMIN', color: JA.GOLD, bg: JA.GOLD + '15', icon: Crown },
        admin: { label: 'ADMINISTRADOR', color: JA.BLUE, bg: JA.BLUE + '15', icon: Shield },
        user: { label: 'COLABORADOR', color: JA.GREY, bg: JA.BG, icon: User },
    }

    const filteredMembers = selectedRole === 'all' ? collaborators : collaborators.filter(m => m.role === selectedRole)

    const stats = [
        { label: 'Total Colaboradores', value: collaborators.length, color: JA.NAVY, bg: JA.NAVY + '10', icon: UsersIcon },
        { label: 'Administradores', value: collaborators.filter(m => m.role === 'admin').length, color: JA.BLUE, bg: JA.BLUE + '10', icon: Shield },
        { label: 'Usuarios Estándar', value: collaborators.filter(m => m.role === 'user').length, color: JA.GREY, bg: JA.BG, icon: User },
    ]

    if (loading) {
        return (
            <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '12px', color: JA.GREY, fontSize: '14px' }}>
                <div style={{ width: '16px', height: '16px', border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Sincronizando Nómina de Colaboradores...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Gestión de <span style={{ color: JA.GOLD }}>Capital Humano</span></h1>
                    <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Directorio técnico de consultores y niveles de acceso corporativo.</p>
                </div>
                <button onClick={fetchCollaborators}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', 
                        background: '#FFFFFF', border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
                        fontSize: '11px', fontWeight: 700, color: JA.TEXT, cursor: 'pointer'
                    }}>
                    <RefreshCw style={{ width: '12px', height: '12px' }} /> ACTUALIZAR REGISTROS
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                {stats.map((s, i) => (
                    <div key={i} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '40px', height: '40px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '1px' }}>
                            <s.icon style={{ width: '18px', height: '18px', color: s.color }} />
                        </div>
                        <div>
                            <p style={{ fontSize: '9px', fontWeight: 800, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>{s.label}</p>
                            <p style={{ fontSize: '22px', fontWeight: 800, color: s.color, margin: 0, fontFamily: 'monospace' }}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: JA.GREY, textTransform: 'uppercase' }}>Filtrar por Jerarquía:</span>
                    {['all', 'admin', 'user'].map(rol => (
                        <button key={rol} onClick={() => setSelectedRole(rol)}
                            style={{ 
                                padding: '6px 12px', fontSize: '10px', fontWeight: 800, borderRadius: '1px',
                                cursor: 'pointer', transition: 'all 0.15s',
                                background: selectedRole === rol ? JA.NAVY : JA.BG,
                                color: selectedRole === rol ? '#FFFFFF' : JA.GREY,
                                border: `1px solid ${selectedRole === rol ? JA.NAVY : JA.BORDER}`
                            }}>
                            {rol === 'all' ? 'TODOS' : rol === 'admin' ? 'ADMINISTRADORES' : 'USUARIOS'}
                        </button>
                    ))}
                </div>

                {filteredMembers.length === 0 ? (
                    <div style={{ padding: '64px', textAlign: 'center', border: `1px dashed ${JA.BORDER}`, borderRadius: '2px', background: JA.BG }}>
                        <UsersIcon style={{ width: '32px', height: '32px', color: JA.GREY_LT, marginBottom: '12px' }} />
                        <p style={{ fontSize: '13px', fontWeight: 700, color: JA.GREY, margin: 0 }}>No se encontraron registros de personal</p>
                        <p style={{ fontSize: '11px', color: JA.GREY_LT, marginTop: '4px' }}>Verifique la configuración en el Panel Maestro de Supabase.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                        {filteredMembers.map((member) => {
                            const rc = roleConfig[member.role] || roleConfig.user
                            const initials = (member.full_name || 'NN').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                            const Icon = rc.icon

                            return (
                                <div key={member.id} style={{ ...cardStyle, padding: '16px', background: JA.BG, border: `1px solid ${JA.BORDER}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                                        {/* Avatar */}
                                        <div style={{ 
                                            width: '48px', height: '48px', background: JA.NAVY, display: 'flex', 
                                            alignItems: 'center', justifyContent: 'center', fontSize: '14px', 
                                            fontWeight: 800, color: '#FFFFFF', borderRadius: '1px'
                                        }}>
                                            {initials}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{ fontSize: '14px', fontWeight: 800, color: JA.TEXT, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {member.full_name || 'Sin nombre'}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                <span style={{ fontSize: '8px', fontWeight: 900, borderRadius: '1px', background: rc.bg, color: rc.color, border: `1px solid ${rc.color}30`, padding: '1px 5px' }}>
                                                    {rc.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: `1px solid ${JA.BORDER}`, paddingTop: '12px' }}>
                                        {member.phone && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: JA.GREY }}>
                                                <Phone style={{ width: '12px', height: '12px', color: JA.BLUE }} />
                                                <span style={{ fontFamily: 'monospace' }}>{member.phone}</span>
                                            </div>
                                        )}
                                        {member.tenant_name && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: JA.GREY }}>
                                                <Shield style={{ width: '12px', height: '12px', color: JA.NAVY }} />
                                                <span style={{ fontWeight: 700 }}>{member.tenant_name}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: JA.GREY_LT }}>
                                            <Icon style={{ width: '12px', height: '12px' }} />
                                            <span>Incorporado en {new Date(member.created_at).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</span>
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
