'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react'
import { fetchClientData, ClientData } from '@/lib/data-service'
import { createClient } from '@/utils/supabase/client'

export interface Tenant {
    id: string
    name: string
    brand_name?: string | null
    primary_color?: string | null
    accent_color?: string | null
    plan?: string | null
    available_modules?: string[] | null
    is_active?: boolean
}

export interface Profile {
    id: string
    role: 'superadmin' | 'firma_admin' | 'admin' | 'user'
    company_name?: string | null
    full_name?: string | null
    google_sheet_url?: string | null
    phone?: string | null
    tenant_id?: string | null
    ecommerce_integrations?: Record<string, unknown> | null
    modules_enabled?: Record<string, boolean> | null
    reconciliation_sheet_url?: string | null
    app_modules?: string[] | null
    created_at?: string
    updated_at?: string
}

export const ALL_MODULES = [
    'analytics', 'siigo_bi', 'reconciliation', 'sales', 'ecommerce',
    'portfolio', 'inventory', 'reports', 'team', 'taxes', 'configuracion',
    'nomina', 'nit',
    'ml_pagos', 'ml_comisiones', 'ml_devoluciones', 'ml_costos', 'ml_alertas',
]

export const DEFAULT_MODULES: Record<string, boolean> = {
    analytics: true, siigo_bi: true, reconciliation: true,
    sales: true, ecommerce: true, portfolio: true,
    inventory: true, reports: true, team: true,
    taxes: true, configuracion: true, nomina: true, nit: true,
    ml_pagos: true, ml_comisiones: true, ml_devoluciones: true, ml_costos: true, ml_alertas: true,
}

export function getModules(profile: Profile | null, tenant?: Tenant | null): Record<string, boolean> {
    if (!profile) return DEFAULT_MODULES
    if (profile.role === 'superadmin') return DEFAULT_MODULES
    if (profile.role === 'firma_admin') return DEFAULT_MODULES

    // Build base from tenant's available modules (if firm restricts modules)
    const tenantModules = tenant?.available_modules
    const base: Record<string, boolean> = {}
    for (const key of Object.keys(DEFAULT_MODULES)) {
        base[key] = tenantModules ? tenantModules.includes(key) : true
    }

    if (profile.app_modules && Array.isArray(profile.app_modules)) {
        const mods: Record<string, boolean> = { ...base }
        for (const key of Object.keys(base)) mods[key] = false
        for (const mod of profile.app_modules) {
            if (base[mod] !== false) mods[mod] = true
        }
        return mods
    }

    if (!profile.modules_enabled || Object.keys(profile.modules_enabled).length === 0) return base
    return { ...base, ...profile.modules_enabled }
}

interface ClientContextType {
    clientName: string
    sheetUrl: string
    data: ClientData | null
    loading: boolean
    profile: Profile | null
    activeProfile: Profile | null
    allProfiles: Profile[]
    tenant: Tenant | null
    switchClient: (profile: Profile | null) => void
    isSimulating: boolean
    modules: Record<string, boolean>
}

const ClientContext = createContext<ClientContextType | undefined>(undefined)

export function ClientProvider({ children }: { children: ReactNode }) {
    const [myProfile, setMyProfile] = useState<Profile | null>(null)
    const [simulatedProfile, setSimulatedProfile] = useState<Profile | null>(null)
    const [allProfiles, setAllProfiles] = useState<Profile[]>([])
    const [tenant, setTenant] = useState<Tenant | null>(null)
    const [data, setData] = useState<ClientData | null>(null)
    const [loading, setLoading] = useState(true)
    const supabase = useMemo(() => createClient(), [])

    const activeProfile = simulatedProfile || myProfile

    const loadDataForProfile = async (profile: Profile) => {
        setData(null)
        if (!profile?.google_sheet_url) return
        try {
            const clientData = await fetchClientData(
                profile.company_name || 'Mi Empresa',
                profile.google_sheet_url
            )
            setData(clientData)
        } catch (error) {
            console.error('Error fetching sheet data:', error)
            setData(null)
        }
    }

    const switchClient = (profile: Profile | null) => setSimulatedProfile(profile)

    useEffect(() => {
        async function loadInitialData() {
            setLoading(true)
            try {
                const { data: authData, error: authError } = await supabase.auth.getUser()
                if (authError) { setLoading(false); return }
                const user = authData?.user
                if (!user) { setLoading(false); return }

                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle()

                if (profileError) {
                    console.error('Error al cargar perfil:', profileError)
                    setMyProfile({ id: user.id, company_name: 'Mi Empresa', role: 'user' })
                    setLoading(false)
                    return
                }

                const finalProfile = profileData || { id: user.id, company_name: 'Configuración pendiente', role: 'user' }
                setMyProfile(finalProfile)

                // Cargar datos del tenant si el perfil tiene tenant_id
                if (finalProfile.tenant_id) {
                    const { data: tenantData } = await supabase
                        .from('tenants')
                        .select('*')
                        .eq('id', finalProfile.tenant_id)
                        .maybeSingle()
                    if (tenantData) setTenant(tenantData)
                }

                let profileToLoad = finalProfile

                if (finalProfile.role === 'superadmin') {
                    // Superadmin carga todos los perfiles
                    const { data: allData } = await supabase.from('profiles').select('*')
                    const profiles = (allData as Profile[]) || []
                    setAllProfiles(profiles)

                    const searchParams = new URLSearchParams(window.location.search)
                    const clientId = searchParams.get('clientId')
                    if (clientId) {
                        const clientProf = profiles.find(p => p.id === clientId)
                        if (clientProf) { setSimulatedProfile(clientProf); profileToLoad = clientProf }
                    }

                } else if (finalProfile.role === 'firma_admin' && finalProfile.tenant_id) {
                    // Firma admin carga solo los clientes de su tenant
                    const { data: tenantClients } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('tenant_id', finalProfile.tenant_id)
                        .neq('id', finalProfile.id)
                    setAllProfiles((tenantClients as Profile[]) || [])

                    const searchParams = new URLSearchParams(window.location.search)
                    const clientId = searchParams.get('clientId')
                    if (clientId) {
                        const clientProf = (tenantClients as Profile[])?.find(p => p.id === clientId)
                        if (clientProf) { setSimulatedProfile(clientProf); profileToLoad = clientProf }
                    }
                }

                await loadDataForProfile(profileToLoad)

            } catch (error: unknown) {
                const errRecord = error as Record<string, unknown>
                console.error('Error crítico en ClientContext:', {
                    message: error instanceof Error ? error.message : 'Error desconocido',
                    code: errRecord?.code, details: errRecord?.details,
                })
            } finally {
                setLoading(false)
            }
        }

        loadInitialData()
    }, [supabase])

    useEffect(() => {
        if (simulatedProfile) {
            setLoading(true)
            loadDataForProfile(simulatedProfile).finally(() => setLoading(false))
        }
    }, [simulatedProfile])

    return (
        <ClientContext.Provider value={{
            clientName: activeProfile?.company_name || '',
            sheetUrl: activeProfile?.google_sheet_url || '',
            data,
            loading,
            profile: myProfile,
            activeProfile: activeProfile as Profile | null,
            allProfiles,
            tenant,
            switchClient,
            isSimulating: !!simulatedProfile,
            modules: getModules(activeProfile as Profile | null, tenant),
        }}>
            {children}
        </ClientContext.Provider>
    )
}

export function useClient() {
    const context = useContext(ClientContext)
    if (context === undefined) throw new Error('useClient must be used within a ClientProvider')
    return context
}
