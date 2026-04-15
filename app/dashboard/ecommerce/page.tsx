'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, DollarSign, Package, TrendingUp, RefreshCw, Store, AlertCircle, ExternalLink } from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import { useClient } from '../ClientContext'

const PLATFORM_CONFIG: Record<string, {
    label: string
    color: string
    accent: string
    logo: string
}> = {
    mercadolibre: { label: 'Mercado Libre', color: 'bg-[#FFE600]/10', accent: '#FFE600', logo: '🛒' },
    dropi: { label: 'Dropi', color: 'bg-blue-500/10', accent: '#3B82F6', logo: '📦' },
    shopify: { label: 'Shopify', color: 'bg-[#96BF48]/10', accent: '#96BF48', logo: '🏪' },
    woocommerce: { label: 'WooCommerce', color: 'bg-purple-500/10', accent: '#9333EA', logo: '🔷' },
    tiendanube: { label: 'Tienda Nube', color: 'bg-sky-500/10', accent: '#0EA5E9', logo: '☁️' },
}

const STATUS_COLORS: Record<string, string> = {
    paid: 'bg-[#0ECB81]/10 text-[#0ECB81]',
    delivered: 'bg-[#0ECB81]/10 text-[#0ECB81]',
    entregado: 'bg-[#0ECB81]/10 text-[#0ECB81]',
    completed: 'bg-[#0ECB81]/10 text-[#0ECB81]',
    pending: 'bg-[#F0B90B]/10 text-[#F0B90B]',
    processing: 'bg-[#F0B90B]/10 text-[#F0B90B]',
    cancelled: 'bg-[#F6465D]/10 text-[#F6465D]',
    refunded: 'bg-[#F6465D]/10 text-[#F6465D]',
    default: 'bg-[#2B3139] text-[#848E9C]',
}

function statusColor(s: string) {
    return STATUS_COLORS[s?.toLowerCase()] || STATUS_COLORS.default
}

const COP = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

export default function EcommercePage() {
    return <AuthGuard childrenWithUser={(_u) => <EcommerceContent />} />
}

function EcommerceContent() {
    const { profile } = useClient()
    const supabase = useMemo(() => createClient(), [])
    const [integrations, setIntegrations] = useState<Record<string, { enabled?: boolean }>>({})
    const [activeTab, setActiveTab] = useState<string>('')
    const [platformData, setPlatformData] = useState<Record<string, Record<string, unknown> | undefined>>({})
    const [loading, setLoading] = useState<Record<string, boolean>>({})
    const [errors, setErrors] = useState<Record<string, string>>({})

    // Load integrations from profile
    useEffect(() => {
        async function load() {
            if (!profile?.id) return
            const { data } = await supabase
                .from('profiles')
                .select('ecommerce_integrations')
                .eq('id', profile.id)
                .maybeSingle()

            const intg = data?.ecommerce_integrations || {}
            setIntegrations(intg)
            const enabled = Object.entries(intg).filter(([, v]) => (v as Record<string, unknown>)?.enabled).map(([k]) => k)
            if (enabled.length > 0 && !activeTab) setActiveTab(enabled[0])
        }
        load()
    }, [profile?.id, supabase])

    const enabledPlatforms = Object.entries(integrations)
        .filter(([, v]) => (v as Record<string, unknown>)?.enabled)
        .map(([k]) => k)

    const fetchPlatformData = async (platform: string) => {
        if (platformData[platform]) return // already loaded
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

    // Auto-fetch when tab changes
    useEffect(() => {
        if (activeTab) fetchPlatformData(activeTab)
    }, [activeTab])

    if (enabledPlatforms.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
                <div className="w-20 h-20 bg-[#2B3139] rounded-full flex items-center justify-center mb-6">
                    <Store className="w-10 h-10 text-[#848E9C]" />
                </div>
                <h2 className="text-2xl font-bold text-[#EAECEF] mb-2">Sin integraciones activas</h2>
                <p className="text-[#848E9C] max-w-md">
                    Tu cuenta no tiene plataformas ecommerce conectadas. Contacta al administrador para activar
                    Mercado Libre, Dropi, Shopify u otras integraciones.
                </p>
            </div>
        )
    }

    const current: any = platformData[activeTab]
    const cfg = PLATFORM_CONFIG[activeTab]
    const isLoading = loading[activeTab]
    const err = errors[activeTab]

    return (
        <div className="min-h-screen p-8 space-y-8 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-[#EAECEF]">
                        Ecommerce <span className="text-[#F0B90B]">Hub</span>
                    </h1>
                    <p className="text-[#848E9C] mt-1">Métricas en tiempo real de tus plataformas de venta</p>
                </div>
                <Button
                    variant="outline"
                    className="border-[#2B3139] text-[#EAECEF] hover:bg-[#2B3139]"
                    onClick={() => {
                        setPlatformData(prev => ({ ...prev, [activeTab]: undefined }))
                        fetchPlatformData(activeTab)
                    }}
                    disabled={isLoading}
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Actualizar
                </Button>
            </div>

            {/* Platform Tabs */}
            <div className="flex gap-2 border-b border-[#2B3139] overflow-x-auto">
                {enabledPlatforms.map(p => {
                    const c = PLATFORM_CONFIG[p]
                    return (
                        <button
                            key={p}
                            onClick={() => setActiveTab(p)}
                            className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === p
                                    ? 'border-[#F0B90B] text-[#F0B90B]'
                                    : 'border-transparent text-[#848E9C] hover:text-[#EAECEF]'
                                }`}
                        >
                            <span>{c?.logo}</span>
                            {c?.label || p}
                        </button>
                    )
                })}
            </div>

            {/* Error */}
            {err && (
                <div className="flex items-center gap-3 p-4 bg-[#F6465D]/10 border border-[#F6465D]/30 rounded-xl text-[#F6465D]">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <div>
                        <p className="font-semibold">Error al conectar con {cfg?.label}</p>
                        <p className="text-sm opacity-80">{err}</p>
                    </div>
                </div>
            )}

            {/* Loading skeleton */}
            {isLoading && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-28 bg-[#1E2329] rounded-xl border border-[#2B3139]" />
                    ))}
                </div>
            )}

            {/* Metrics */}
            {current && !isLoading && (
                <>
                    {/* Seller info (ML only) */}
                    {current.seller && (
                        <div className={`flex items-center gap-4 p-4 ${cfg?.color} rounded-xl border border-[#2B3139]`}>
                            <span className="text-4xl">{cfg?.logo}</span>
                            <div>
                                <p className="font-bold text-[#EAECEF] text-lg">{current.seller.nickname}</p>
                                <div className="flex gap-3 mt-1">
                                    <Badge className="bg-[#F0B90B]/10 text-[#F0B90B] capitalize">
                                        {current.seller.reputation?.replace(/_/g, ' ')}
                                    </Badge>
                                    <span className="text-[#848E9C] text-sm">{current.seller.transactions?.toLocaleString()} transacciones</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Órdenes Recientes', value: current.metrics?.recentOrders ?? current.metrics?.totalOrders ?? '—', icon: ShoppingCart, color: '#F0B90B' },
                            { label: 'Ingresos Totales', value: `COP ${COP(current.metrics?.totalRevenue || 0)}`, icon: DollarSign, color: '#0ECB81' },
                            { label: 'Publicaciones / Productos', value: current.metrics?.activeListings ?? current.metrics?.activeProducts ?? '—', icon: Package, color: '#5B8DEF' },
                            { label: 'Órdenes Completadas', value: current.metrics?.completedOrders ?? current.metrics?.deliveredOrders ?? '—', icon: TrendingUp, color: '#9333EA' },
                        ].map((kpi, i) => (
                            <Card key={i} className="bg-[#1E2329] border-[#2B3139]">
                                <CardContent className="p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                                            <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
                                        </div>
                                        <p className="text-[#848E9C] text-xs uppercase font-bold tracking-wider">{kpi.label}</p>
                                    </div>
                                    <p className="text-2xl font-black text-[#EAECEF]">{kpi.value}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Recent Orders Table */}
                    {current.recentOrders?.length > 0 && (
                        <Card className="bg-[#1E2329] border-[#2B3139]">
                            <CardHeader>
                                <CardTitle className="text-[#EAECEF] flex items-center gap-2">
                                    <ShoppingCart className="w-5 h-5 text-[#F0B90B]" />
                                    Órdenes Recientes
                                    <Badge className="ml-2 bg-[#F0B90B]/10 text-[#F0B90B]">{current.recentOrders.length}</Badge>
                                </CardTitle>
                                <CardDescription className="text-[#848E9C]">Últimas órdenes registradas en {cfg?.label}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-[#2B3139] bg-[#2B3139]/30">
                                                <th className="text-left p-3 text-[#848E9C] text-xs uppercase font-bold">ID</th>
                                                <th className="text-left p-3 text-[#848E9C] text-xs uppercase font-bold">Fecha</th>
                                                <th className="text-left p-3 text-[#848E9C] text-xs uppercase font-bold">Cliente</th>
                                                <th className="text-right p-3 text-[#848E9C] text-xs uppercase font-bold">Monto</th>
                                                <th className="text-center p-3 text-[#848E9C] text-xs uppercase font-bold">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(current.recentOrders as Array<{ id: string; date: string; buyer: string; currency: string; amount: number; status: string }>).map((order, i: number) => (
                                                <tr key={i} className="border-b border-[#2B3139]/50 hover:bg-[#2B3139]/20 transition-colors">
                                                    <td className="p-3 text-[#848E9C] text-xs font-mono">#{order.id}</td>
                                                    <td className="p-3 text-[#EAECEF] text-sm">{order.date}</td>
                                                    <td className="p-3 font-semibold text-[#EAECEF] text-sm truncate max-w-[160px]">{order.buyer}</td>
                                                    <td className="p-3 text-right font-bold text-[#0ECB81] text-sm">
                                                        {order.currency} {COP(order.amount)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <Badge className={`${statusColor(order.status)} text-xs capitalize`}>
                                                            {order.status}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    )
}
