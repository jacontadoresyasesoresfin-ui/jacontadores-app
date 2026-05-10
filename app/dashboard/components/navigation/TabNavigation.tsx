'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, TrendingUp, ShoppingCart, Wallet, Package, FileText,
    Users, Receipt, Store, CreditCard, Percent, RotateCcw, DollarSign,
    Bell, Settings, FileSpreadsheet, FileCheck, Calculator, Search
} from 'lucide-react'
import { useClient } from '@/app/dashboard/ClientContext'

const JA = {
    NAVY:    '#13213C',
    GOLD:    '#B8960C',
    TEXT:    '#1C2B45',
    GREY:    '#4B5563',
    BORDER:  '#E5E7EB',
    BG:      '#F8FAFC',
}

const tabs = [
    { name: 'Resumen',      href: '/dashboard',                 icon: LayoutDashboard, moduleKey: null        },
    { name: 'Analytics',    href: '/dashboard/analytics',       icon: TrendingUp,      moduleKey: 'analytics' },
    { name: 'Siigo BI',     href: '/dashboard/siigo',           icon: FileSpreadsheet, moduleKey: 'siigo_bi'  },
    { name: 'Conciliación', href: '/dashboard/reconciliation',  icon: FileCheck,       moduleKey: 'reconciliation' },
    { name: 'Ventas',       href: '/dashboard/sales',           icon: ShoppingCart,    moduleKey: 'sales'     },
    { name: 'Ecommerce',    href: '/dashboard/ecommerce',       icon: Store,           moduleKey: 'ecommerce' },
    { name: 'Cartera',      href: '/dashboard/portfolio',       icon: Wallet,          moduleKey: 'portfolio' },
    { name: 'Inventario',   href: '/dashboard/inventory',       icon: Package,         moduleKey: 'inventory' },
    { name: 'Reportes',     href: '/dashboard/reports',         icon: FileText,        moduleKey: 'reports'   },
    { name: 'Equipo',       href: '/dashboard/team',            icon: Users,           moduleKey: 'team'      },
    { name: 'Impuestos',    href: '/dashboard/taxes',           icon: Receipt,         moduleKey: 'taxes'     },
    { name: 'Configuración',href: '/dashboard/configuracion',   icon: Settings,        moduleKey: 'configuracion' },
    { name: 'Nómina PILA', href: '/dashboard/nomina',          icon: Calculator,      moduleKey: 'nomina'        },
    { name: 'Verificar NIT',href: '/dashboard/nit',            icon: Search,          moduleKey: 'nit'           },
]

const mlTabs = [
    { name: 'Pagos ML',     href: '/dashboard/ml-pagos',        icon: CreditCard,  moduleKey: 'ml_pagos'        },
    { name: 'Comisiones',   href: '/dashboard/ml-comisiones',   icon: Percent,     moduleKey: 'ml_comisiones'   },
    { name: 'Devoluciones', href: '/dashboard/ml-devoluciones', icon: RotateCcw,   moduleKey: 'ml_devoluciones' },
    { name: 'Costos',       href: '/dashboard/ml-costos',       icon: DollarSign,  moduleKey: 'ml_costos'       },
    { name: 'Alertas',      href: '/dashboard/ml-alertas',      icon: Bell,        moduleKey: 'ml_alertas'      },
]

export default function TabNavigation() {
    const pathname = usePathname()
    const { modules } = useClient()

    const visibleTabs  = tabs.filter(t => t.moduleKey === null || modules[t.moduleKey])
    const visibleMlTabs = mlTabs.filter(t => modules[t.moduleKey])
    const hasMlVisible = visibleMlTabs.length > 0

    return (
        <nav style={{
            background: '#FFFFFF',
            borderBottom: `1px solid ${JA.BORDER}`,
            position: 'sticky',
            top: '60px',
            zIndex: 40,
        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 24px' }}>

                {/* Main Modules */}
                <div style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                }}>
                    {visibleTabs.map((tab) => {
                        const isActive = pathname === tab.href
                        const Icon = tab.icon
                        return (
                            <Link key={tab.href} href={tab.href}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '14px 16px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    textDecoration: 'none',
                                    color: isActive ? JA.NAVY : JA.GREY,
                                    borderBottom: `2px solid ${isActive ? JA.GOLD : 'transparent'}`,
                                    background: isActive ? JA.BG : 'transparent',
                                    transition: 'all 0.1s',
                                }}>
                                <Icon style={{ width: '14px', height: '14px' }} />
                                <span>{tab.name}</span>
                            </Link>
                        )
                    })}
                </div>

                {/* Mercado Libre Sub-nav */}
                {hasMlVisible && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 0',
                        borderTop: `1px solid ${JA.BORDER}`,
                    }}>
                        <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: JA.GOLD,
                            marginRight: '8px'
                        }}>
                            Integración Mercado Libre
                        </span>
                        {visibleMlTabs.map((tab) => {
                            const isActive = pathname === tab.href
                            const Icon = tab.icon
                            return (
                                <Link key={tab.href} href={tab.href}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 8px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        color: isActive ? JA.NAVY : JA.GREY,
                                        background: isActive ? '#F1F5F9' : 'transparent',
                                        borderRadius: '2px',
                                    }}>
                                    <Icon style={{ width: '12px', height: '12px' }} />
                                    <span>{tab.name}</span>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        </nav>
    )
}
