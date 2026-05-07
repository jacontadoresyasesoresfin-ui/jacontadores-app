'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react'
import { fetchClientData, ClientData } from '@/lib/data-service'
import { createClient } from '@/utils/supabase/client'

export interface Profile {
    id: string
    role: 'superadmin' | 'admin' | 'user'
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

// Default: if modules_enabled is null/empty, all modules are visible
export const DEFAULT_MODULES: Record<string, boolean> = {
    analytics: true, siigo_bi: true, reconciliation: true,
    sales: true, ecommerce: true, portfolio: true,
    inventory: true, reports: true, team: true,
    taxes: true, configuracion: true, ml_pagos: true,
    ml_comisiones: true, ml_devoluciones: true, ml_costos: true, ml_alertas: true,
}

export function getModules(profile: Profile | null): Record<string, boolean> {
    if (!profile) return DEFAULT_MODULES
    // Superadmin sees everything always
    if (profile.role === 'superadmin') return DEFAULT_MODULES
    
    // Check if app_modules array exists
    if (profile.app_modules && Array.isArray(profile.app_modules)) {
        const mods: Record<string, boolean> = {};
        for (const key of Object.keys(DEFAULT_MODULES)) {
            mods[key] = false;
        }
        for (const mod of profile.app_modules) {
            mods[mod] = true;
        }
        return mods;
    }
    
    // Fallback to older modules_enabled map
    if (!profile.modules_enabled || Object.keys(profile.modules_enabled).length === 0) return DEFAULT_MODULES
    return { ...DEFAULT_MODULES, ...profile.modules_enabled }
}

interface ClientContextType {
    clientName: string
    sheetUrl: string
    data: ClientData | null
    loading: boolean
    profile: Profile | null
    activeProfile: Profile | null
    allProfiles: Profile[]
    switchClient: (profile: Profile | null) => void
    isSimulating: boolean
    modules: Record<string, boolean>
}

const ClientContext = createContext<ClientContextType | undefined>(undefined)

export function ClientProvider({ children }: { children: ReactNode }) {
    const [myProfile, setMyProfile] = useState<Profile | null>(null)
    const [simulatedProfile, setSimulatedProfile] = useState<Profile | null>(null)
    const [allProfiles, setAllProfiles] = useState<Profile[]>([])
    const [data, setData] = useState<ClientData | null>(null)
    const [loading, setLoading] = useState(true)
    const supabase = useMemo(() => createClient(), [])

    const activeProfile = simulatedProfile || myProfile

    const loadDataForProfile = async (profile: Profile) => {
        if (!profile?.google_sheet_url) {
            setData(null)
            return
        }
        try {
            const clientData = await fetchClientData(
                profile.company_name || 'Mi Empresa',
                profile.google_sheet_url
            )
            setData(clientData)
        } catch (error) {
            console.error("Error fetching sheet data:", error)
        }
    }

    const switchClient = (profile: Profile | null) => {
        setSimulatedProfile(profile)
    }

    useEffect(() => {
        async function loadInitialData() {
            setLoading(true)
            try {
                const { data: authData, error: authError } = await supabase.auth.getUser()

                if (authError) {
                    console.warn("Error al obtener el usuario de Auth:", authError)
                    setLoading(false)
                    return
                }

                const user = authData?.user
                if (!user) {
                    setLoading(false)
                    return
                }

                // 1. Cargar perfil propio
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle()

                if (profileError) {
                    console.error("Error al cargar perfil:", profileError)
                    setMyProfile({ id: user.id, company_name: 'Mi Empresa', role: 'user' })
                    setLoading(false)
                    return
                }

                const finalProfile = profileData || { id: user.id, company_name: 'Configuración pendiente', role: 'user' }
                setMyProfile(finalProfile)

                let profileToLoad = finalProfile

                // 2. Si es superadmin, cargar todos los perfiles para el selector
                if (finalProfile.role === 'superadmin') {
                    const { data: allData } = await supabase
                        .from('profiles')
                        .select('*')
                    
                    const profiles = (allData as Profile[]) || []
                    setAllProfiles(profiles)

                    // Revisar si viene ?clientId=... por la URL (ej: desde el Panel Maestro)
                    const searchParams = new URLSearchParams(window.location.search)
                    const clientId = searchParams.get('clientId')
                    
                    if (clientId) {
                        const clientProf = profiles.find(p => p.id === clientId)
                        if (clientProf) {
                            setSimulatedProfile(clientProf)
                            profileToLoad = clientProf
                        }
                    }
                }

                // 3. Cargar datos iniciales
                await loadDataForProfile(profileToLoad)

            } catch (error: unknown) {
                // Capturar todos los detalles posibles del error
                const errRecord = error as Record<string, unknown>
                const errorDetails = {
                    message: error instanceof Error ? error.message : "Error desconocido",
                    code: errRecord?.code,
                    details: errRecord?.details,
                    hint: errRecord?.hint,
                    stack: errRecord?.stack,
                    name: errRecord?.name,
                    fullError: error
                }

                console.error("Error crítico detallado en ClientContext:", JSON.stringify(errorDetails, Object.getOwnPropertyNames(errorDetails), 2))

                // Inspección profunda si el error parece vacío
                if (error && typeof error === 'object' && Object.keys(error).length === 0) {
                    console.error("Error detectado con propiedades no enumerables:", error);
                    console.error("Verifique: 1. Conectividad con Supabase, 2. Políticas RLS en 'profiles', 3. Sesión del usuario");
                }
            } finally {
                setLoading(false)
            }
        }

        loadInitialData()
    }, [supabase])

    // Efecto para recargar datos cuando cambie el perfil simulado
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
            switchClient,
            isSimulating: !!simulatedProfile,
            modules: getModules(activeProfile as Profile | null),
        }}>
            {children}
        </ClientContext.Provider>
    )
}

export function useClient() {
    const context = useContext(ClientContext)
    if (context === undefined) {
        throw new Error('useClient must be used within a ClientProvider')
    }
    return context
}
