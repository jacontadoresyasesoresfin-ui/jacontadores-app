'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ShoppingCart, DollarSign, Package, TrendingUp, RefreshCw, Store, AlertCircle, Eye, Info } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import { useClient } from '../ClientContext'

const JA = {
    NAVY:    '#13213C',
    GOLD:    '#B8960C',
    TEXT:    '#1C2B45',
    GREY:    '#4B5563',
    BORDER:  '#E5E7EB',
    BG:      '#F8FAFC',
    GREEN:   '#10B981',
    RED:     '#EF4444'
}

const cardStyle = {
    background: '#FFFFFF',
    border: `1px solid ${JA.BORDER}`,
    borderRadius: '2px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    padding: '20px',
}

const PLATFORM_CONFIG: Record<string, {
    label: string
    color: string
    accent: string
    logo: string
}> = {
    mercadolibre: { label: 'Mercado Libre', color: JA.NAVY, accent: '#FFE600', logo: '🛒' },
    dropi: { label: 'Dropi', color: JA.NAVY, accent: '#3B82F6', logo: '📦' },
    shopify: { label: 'Shopify', color: JA.NAVY, accent: '#96BF48', logo: '🏪' },
    woocommerce: { label: 'WooCommerce', color: JA.NAVY, accent: '#9333EA', logo: '🔷' },
    tiendanube: { label: 'Tienda Nube', color: JA.NAVY, accent: '#0EA5E9', logo: '☁️' },
}

const COP = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

export default function EcommercePage() {
    return <AuthGuard childrenWithUser={(_u) => <EcommerceContent />} />
}

function EcommerceContent() {
    const { profile: myProfile, activeProfile } = useClient()
    const targetProfile = activeProfile || myProfile
    const supabase = useMemo(() => createClient(), [])
    const [integrations, setIntegrations] = useState<Record<string, { enabled?: boolean }>>({})
    const [activeTab, setActiveTab] = useState<string>('')
    const [platformData, setPlatformData] = useState<Record<string, Record<string, unknown> | undefined>>({})
    const [loading, setLoading] = useState<Record<string, boolean>>({})
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        async function load() {
            if (!targetProfile?.id) return
            const { data } = await supabase
                .from('profiles')
                .select('ecommerce_integrations')
                .eq('id', targetProfile.id)
                .maybeSingle()

            const intg = data?.ecommerce_integrations || {}
            setIntegrations(intg)
            const enabled = Object.entries(intg).filter(([, v]) => (v as Record<string, unknown>)?.enabled).map(([k]) => k)
            if (enabled.length > 0 && !activeTab) setActiveTab(enabled[0])
        }
        load()
    }, [targetProfile?.id, supabase])

    const enabledPlatforms = Object.entries(integrations)
        .filter(([, v]) => (v as Record<string, unknown>)?.enabled)
        .map(([k]) => k)

    const fetchPlatformData = async (platform: string) => {
        if (platformData[platform]) return
        setLoading(prev => ({ ...prev, [platform]: true }))
        setErrors(prev => ({ ...prev, [platform]: '' }))
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch('/api/ecommerce', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ platform })
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
            setPlatformData(prev => ({ ...prev, [platform]: json }))
        } catch (e: unknown) {
            setErrors(prev => ({ ...prev, [platform]: e instanceof Error ? e.message : 'Error desconocido' }))
        } finally {
            setLoading(prev => ({ ...prev, [platform]: false }))
        }
    }

    useEffect(() => {
        if (activeTab) fetchPlatformData(activeTab)
    }, [activeTab])

    if (enabledPlatforms.length === 0) {
        return (
            <div style={{ padding: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '2px', background: JA.BG, border: `1px solid ${JA.BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Store style={{ width: '32px', height: '32px', color: JA.BORDER }} />
                </div>
                <div style={{ maxWidth: '400px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: JA.TEXT, marginBottom: '8px' }}>Módulo de Integración Desactivado</h2>
                    <p style={{ fontSize: '12px', color: JA.GREY, lineHeight: 1.6 }}>
                        No se detectaron canales de venta activos para este perfil. Contacte a su consultor JA para habilitar la sincronización con Mercado Libre, Shopify o Dropi.
                    </p>
                </div>
            </div>
        )
    }

    const current: any = platformData[activeTab]
    const cfg = PLATFORM_CONFIG[activeTab]
    const isLoading = loading[activeTab]
    const err = errors[activeTab]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Ecommerce <span style={{ color: JA.GOLD }}>Hub</span></h1>
                    <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Consolidado operativo de canales de venta digital y marketplaces.</p>
                </div>
                <button 
                    onClick={() => { setPlatformData(prev => ({ ...prev, [activeTab]: undefined })); fetchPlatformData(activeTab); }}
                    disabled={isLoading}
                    style={{
                        padding: '8px 16px', fontSize: '11px', fontWeight: 700, border: `1px solid ${JA.BORDER}`,
                        background: 'white', color: JA.TEXT, borderRadius: '2px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                    <RefreshCw style={{ width: '14px', height: '14px', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
                    SINCRONIZAR
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', background: JA.BG, padding: '4px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px' }}>
                {enabledPlatforms.map(p => (
                    <button key={p} onClick={() => setActiveTab(p)}
                        style={{
                            flex: 1, padding: '8px 16px', border: 'none', borderRadius: '1px', fontSize: '11px', fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.2s',
                            background: activeTab === p ? JA.NAVY : 'transparent',
                            color: activeTab === p ? 'white' : JA.GREY
                        }}>
                        {PLATFORM_CONFIG[p]?.label || p}
                    </button>
                ))}
            </div>

            {/* Error State */}
            {err && (
                <div style={{ ...cardStyle, background: JA.RED + '05', border: `1px solid ${JA.RED}20`, display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <AlertCircle style={{ width: '18px', height: '18px', color: JA.RED }} />
                    <div>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: JA.RED, margin: 0 }}>Fallo de Conexión: {cfg?.label}</p>
                        <p style={{ fontSize: '11px', color: JA.RED, opacity: 0.8, margin: 0 }}>{err}</p>
                    </div>
                </div>
            )}

            {/* Content */}
            {isLoading ? (
                <div style={{ padding: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: JA.GREY, fontSize: '14px' }}>
                    <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                    Conectando con la API de {cfg?.label}...
                </div>
            ) : current && (
                <>
                    {/* Metrics Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                        {[
                            { label: 'Órdenes Recientes', value: current.metrics?.recentOrders ?? current.metrics?.totalOrders ?? '0', icon: ShoppingCart, color: JA.NAVY },
                            { label: 'Ingresos Brutos', value: `COP ${COP(current.metrics?.totalRevenue || 0)}`, icon: DollarSign, color: JA.GREEN },
                            { label: 'Catálogo Activo', value: current.metrics?.activeListings ?? current.metrics?.activeProducts ?? '0', icon: Package, color: JA.GOLD },
                            { label: 'Ratio Conversión', value: current.metrics?.completedOrders ?? '100%', icon: TrendingUp, color: JA.NAVY },
                        ].map((kpi, i) => (
                            <div key={i} style={{ ...cardStyle, borderLeft: `4px solid ${kpi.color}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>{kpi.label}</p>
                                    <kpi.icon style={{ width: '12px', height: '12px', color: kpi.color }} />
                                </div>
                                <p style={{ fontSize: '16px', fontWeight: 700, color: JA.TEXT, margin: 0, fontFamily: 'monospace' }}>{kpi.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Orders Table */}
                    {current.recentOrders?.length > 0 && (
                        <div style={cardStyle}>
                            <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '20px' }}>Historial de Órdenes Recientes</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <thead>
                                        <tr style={{ background: JA.BG, textAlign: 'left', borderBottom: `2px solid ${JA.BORDER}` }}>
                                            <th style={{ padding: '12px' }}>ID OPERACIÓN</th>
                                            <th style={{ padding: '12px' }}>FECHA</th>
                                            <th style={{ padding: '12px' }}>CLIENTE</th>
                                            <th style={{ padding: '12px', textAlign: 'right' }}>VALOR</th>
                                            <th style={{ padding: '12px', textAlign: 'center' }}>ESTADO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {current.recentOrders.map((order: any, i: number) => (
                                            <tr key={i} style={{ borderBottom: `1px solid ${JA.BG}` }}>
                                                <td style={{ padding: '12px', fontFamily: 'monospace', color: JA.GREY }}>#{order.id}</td>
                                                <td style={{ padding: '12px', color: JA.TEXT }}>{order.date}</td>
                                                <td style={{ padding: '12px', fontWeight: 600, color: JA.TEXT }}>{order.buyer}</td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: JA.NAVY }}>{order.currency} {COP(order.amount)}</td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <span style={{ 
                                                        padding: '2px 8px', fontSize: '9px', fontWeight: 700, borderRadius: '1px',
                                                        background: order.status?.toLowerCase().includes('paid') || order.status?.toLowerCase().includes('delivered') ? JA.GREEN + '15' : JA.GOLD + '15',
                                                        color: order.status?.toLowerCase().includes('paid') || order.status?.toLowerCase().includes('delivered') ? JA.GREEN : JA.GOLD,
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Context Notice */}
            <div style={{ ...cardStyle, background: JA.BG, display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Info style={{ width: '16px', height: '16px', color: JA.GREY }} />
                <p style={{ fontSize: '10px', color: JA.GREY, margin: 0, fontStyle: 'italic' }}>
                    Los datos presentados son extraídos directamente de las APIs oficiales de las plataformas conectadas. 
                    La latencia de actualización depende de los tiempos de respuesta de cada marketplace (promedio 5-10 min).
                </p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

