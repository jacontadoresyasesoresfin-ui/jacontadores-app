'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, TrendingUp, ShoppingCart, Wallet, Package, FileText,
    Users, Receipt, Store, CreditCard, Percent, RotateCcw, DollarSign,
    Bell, Settings, FileSpreadsheet, FileCheck
} from 'lucide-react'

/*
 * Paleta exacta de jacontadores.com
 * Navy: #13213C  |  Gold: #B8960C  |  Cream: #F4F4F0
 */
const NAVY = '#13213C'
const GOLD = '#B8960C'
const GOLD_LT = '#D4A843'

const tabs = [
    { name: 'Resumen', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Analytics', href: '/dashboard/analytics', icon: TrendingUp },
    { name: 'Siigo BI', href: '/dashboard/siigo', icon: FileSpreadsheet, badge: 'NEW' },
    { name: 'Conciliación', href: '/dashboard/reconciliation', icon: FileCheck, badge: 'DIAN' },
    { name: 'Ventas', href: '/dashboard/sales', icon: ShoppingCart },
    { name: 'Ecommerce', href: '/dashboard/ecommerce', icon: Store },
    { name: 'Cartera', href: '/dashboard/portfolio', icon: Wallet },
    { name: 'Inventario', href: '/dashboard/inventory', icon: Package },
    { name: 'Reportes', href: '/dashboard/reports', icon: FileText },
    { name: 'Equipo', href: '/dashboard/team', icon: Users },
    { name: 'Impuestos', href: '/dashboard/taxes', icon: Receipt },
    { name: 'Configuración', href: '/dashboard/configuracion', icon: Settings },
]

const mlTabs = [
    { name: 'Pagos ML', href: '/dashboard/ml-pagos', icon: CreditCard, color: '#0F7B71' },
    { name: 'Comisiones', href: '/dashboard/ml-comisiones', icon: Percent, color: NAVY },
    { name: 'Devoluciones', href: '/dashboard/ml-devoluciones', icon: RotateCcw, color: '#DC2626', badge: '7' },
    { name: 'Costos', href: '/dashboard/ml-costos', icon: DollarSign, color: '#059669' },
    { name: 'Alertas', href: '/dashboard/ml-alertas', icon: Bell, color: '#DC2626', badge: '3' },
]

export default function TabNavigation() {
    const pathname = usePathname()

    return (
        <nav style={{
            background: '#FFFFFF',
            borderBottom: '1.5px solid #E0DDD8',
            boxShadow: '0 1px 8px rgba(19,33,60,0.06)',
            position: 'sticky',
            top: '60px',
            zIndex: 40,
        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>

                {/* Fila 1 — Módulos principales */}
                <div style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: '2px',
                    overflowX: 'auto',
                    borderBottom: '1px solid #F0EDE8',
                    scrollbarWidth: 'none',
                }}>
                    {tabs.map((tab) => {
                        const isActive = pathname === tab.href
                        const Icon = tab.icon
                        return (
                            <Link key={tab.href} href={tab.href}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '11px 12px',
                                    fontSize: '11px',
                                    fontWeight: isActive ? 700 : 500,
                                    fontFamily: 'Inter, sans-serif',
                                    whiteSpace: 'nowrap',
                                    textDecoration: 'none',
                                    color: isActive ? NAVY : '#6B7A8D',
                                    borderBottom: isActive ? `2.5px solid ${GOLD}` : '2.5px solid transparent',
                                    background: isActive ? 'rgba(184,150,12,0.06)' : 'transparent',
                                    transition: 'all 0.15s ease',
                                    flexShrink: 0,
                                }}
                                onMouseEnter={e => {
                                    if (!isActive) {
                                        const el = e.currentTarget as HTMLAnchorElement
                                        el.style.color = NAVY
                                        el.style.background = '#F9F7F2'
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (!isActive) {
                                        const el = e.currentTarget as HTMLAnchorElement
                                        el.style.color = '#6B7A8D'
                                        el.style.background = 'transparent'
                                    }
                                }}>
                                <Icon style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                                <span>{tab.name}</span>
                                {'badge' in tab && tab.badge && (
                                    <span style={{
                                        padding: '1px 5px',
                                        fontSize: '8px',
                                        fontWeight: 800,
                                        borderRadius: '10px',
                                        background: isActive ? NAVY : GOLD,
                                        color: isActive ? GOLD_LT : NAVY,
                                        letterSpacing: '0.04em',
                                    }}>
                                        {tab.badge}
                                    </span>
                                )}
                            </Link>
                        )
                    })}
                </div>

                {/* Fila 2 — Mercado Libre */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 0',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                }}>
                    <span style={{
                        fontSize: '8px',
                        fontWeight: 800,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: GOLD,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        background: 'rgba(184,150,12,0.08)',
                        border: `1px solid rgba(184,150,12,0.2)`,
                        flexShrink: 0,
                        fontFamily: 'Montserrat, Inter, sans-serif',
                    }}>
                        Mercado Libre
                    </span>
                    {mlTabs.map((tab) => {
                        const isActive = pathname === tab.href
                        const Icon = tab.icon
                        return (
                            <Link key={tab.href} href={tab.href}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: isActive ? 700 : 500,
                                    fontFamily: 'Inter, sans-serif',
                                    borderRadius: '8px',
                                    whiteSpace: 'nowrap',
                                    textDecoration: 'none',
                                    flexShrink: 0,
                                    transition: 'all 0.15s ease',
                                    color: isActive ? '#FFFFFF' : '#6B7A8D',
                                    background: isActive ? tab.color : 'transparent',
                                    marginLeft: '1px',
                                }}
                                onMouseEnter={e => {
                                    if (!isActive) {
                                        const el = e.currentTarget as HTMLAnchorElement
                                        el.style.background = '#F4F4F0'
                                        el.style.color = NAVY
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (!isActive) {
                                        const el = e.currentTarget as HTMLAnchorElement
                                        el.style.background = 'transparent'
                                        el.style.color = '#6B7A8D'
                                    }
                                }}>
                                <Icon style={{ width: '12px', height: '12px', color: isActive ? 'white' : tab.color, flexShrink: 0 }} />
                                <span>{tab.name}</span>
                                {'badge' in tab && tab.badge && (
                                    <span style={{
                                        padding: '1px 5px',
                                        fontSize: '8px',
                                        fontWeight: 800,
                                        borderRadius: '10px',
                                        background: isActive ? 'rgba(255,255,255,0.25)' : '#FEE2E2',
                                        color: isActive ? 'white' : '#DC2626',
                                    }}>
                                        {tab.badge}
                                    </span>
                                )}
                            </Link>
                        )
                    })}
                </div>
            </div>
        </nav>
    )
}
