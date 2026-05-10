'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, TrendingUp, ShoppingCart, Wallet, Package, FileText,
    Users, Receipt, Store, CreditCard, Percent, RotateCcw, DollarSign,
    Bell, Settings, FileSpreadsheet, FileCheck, Calculator, Search, ChevronDown
} from 'lucide-react'
import { useClient } from '@/app/dashboard/ClientContext'

const JA = {
    NAVY:    '#13213C',
    GOLD:    '#B8960C',
    TEXT:    '#1C2B45',
    GREY:    '#4B5563',
    BORDER:  '#E5E7EB',
    BG:      '#F8FAFC',
    GREY_LT: '#9CA3AF',
}

const MENU_CATEGORIES = [
    {
        name: 'Panel Principal',
        items: [
            { name: 'Resumen',       href: '/dashboard',           icon: LayoutDashboard, moduleKey: null },
            { name: 'Analytics',     href: '/dashboard/analytics', icon: TrendingUp,      moduleKey: 'analytics' },
            { name: 'Reportes',      href: '/dashboard/reports',   icon: FileText,        moduleKey: 'reports' },
        ]
    },
    {
        name: 'Operaciones',
        items: [
            { name: 'Ventas',        href: '/dashboard/sales',     icon: ShoppingCart,    moduleKey: 'sales' },
            { name: 'Ecommerce',     href: '/dashboard/ecommerce', icon: Store,           moduleKey: 'ecommerce' },
            { name: 'Cartera',       href: '/dashboard/portfolio', icon: Wallet,          moduleKey: 'portfolio' },
            { name: 'Inventario',    href: '/dashboard/inventory', icon: Package,         moduleKey: 'inventory' },
        ]
    },
    {
        name: 'Contabilidad y Utilidades',
        items: [
            { name: 'Siigo BI',      href: '/dashboard/siigo',          icon: FileSpreadsheet, moduleKey: 'siigo_bi' },
            { name: 'Conciliación',  href: '/dashboard/reconciliation', icon: FileCheck,       moduleKey: 'reconciliation' },
            { name: 'Impuestos',     href: '/dashboard/taxes',          icon: Receipt,         moduleKey: 'taxes' },
            { name: 'Nómina PILA',   href: '/dashboard/nomina',         icon: Calculator,      moduleKey: 'nomina' },
            { name: 'Verificar NIT', href: '/dashboard/nit',            icon: Search,          moduleKey: 'nit' },
        ]
    },
    {
        name: 'ML',
        isSub: true,
        items: [
            { name: 'Pagos ML',      href: '/dashboard/ml-pagos',        icon: CreditCard,  moduleKey: 'ml_pagos' },
            { name: 'Comisiones',    href: '/dashboard/ml-comisiones',   icon: Percent,     moduleKey: 'ml_comisiones' },
            { name: 'Devoluciones',  href: '/dashboard/ml-devoluciones', icon: RotateCcw,   moduleKey: 'ml_devoluciones' },
            { name: 'Costos',        href: '/dashboard/ml-costos',       icon: DollarSign,  moduleKey: 'ml_costos' },
            { name: 'Alertas',       href: '/dashboard/ml-alertas',      icon: Bell,        moduleKey: 'ml_alertas' },
        ]
    },
    {
        name: 'Administración',
        items: [
            { name: 'Equipo',        href: '/dashboard/team',          icon: Users,    moduleKey: 'team' },
            { name: 'Configuración', href: '/dashboard/configuracion', icon: Settings, moduleKey: 'configuracion' },
        ]
    }
]

export default function TabNavigation() {
    const pathname = usePathname()
    const { modules } = useClient()
    const [openMenu, setOpenMenu] = useState<string | null>(null)
    const navRef = useRef<HTMLElement>(null)

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) {
                setOpenMenu(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Close on route change
    useEffect(() => { setOpenMenu(null) }, [pathname])

    const visibleCategories = MENU_CATEGORIES.map(cat => ({
        ...cat,
        items: cat.items.filter(item => item.moduleKey === null || modules[item.moduleKey])
    })).filter(cat => cat.items.length > 0)

    return (
        <nav ref={navRef} style={{
            background: '#FFFFFF',
            borderBottom: `1px solid ${JA.BORDER}`,
            position: 'sticky',
            top: '60px',
            zIndex: 200,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
            <div style={{
                maxWidth: '1400px',
                margin: '0 auto',
                padding: '0 20px',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
            } as React.CSSProperties}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    height: '50px',
                    minWidth: 'max-content',
                }}>
                    {visibleCategories.map((category) => {
                        const isActive = category.items.some(item => pathname === item.href)
                        const isOpen = openMenu === category.name

                        return (
                            <div
                                key={category.name}
                                style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}
                                /* Desktop: hover */
                                onMouseEnter={() => setOpenMenu(category.name)}
                                onMouseLeave={() => setOpenMenu(null)}
                            >
                                {/* Tab button */}
                                <button
                                    /* Mobile: tap toggles */
                                    onClick={() => setOpenMenu(isOpen ? null : category.name)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        height: '100%',
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: isActive ? JA.NAVY : JA.GREY,
                                        borderBottom: `2px solid ${isActive ? JA.GOLD : 'transparent'}`,
                                        padding: '0 10px',
                                        fontFamily: 'Inter, sans-serif',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                        whiteSpace: 'nowrap',
                                        transition: 'color 0.15s, border-color 0.15s',
                                    }}
                                >
                                    {category.isSub
                                        ? <span style={{ color: JA.GOLD }}>ML</span>
                                        : category.name
                                    }
                                    <ChevronDown style={{
                                        width: 11,
                                        height: 11,
                                        color: isActive ? JA.GOLD : JA.GREY_LT,
                                        transform: isOpen ? 'rotate(180deg)' : 'none',
                                        transition: 'transform 0.2s',
                                        flexShrink: 0,
                                    }} />
                                </button>

                                {/* Dropdown panel */}
                                {isOpen && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        minWidth: '230px',
                                        background: '#FFFFFF',
                                        border: `1px solid ${JA.BORDER}`,
                                        borderTop: `2px solid ${JA.GOLD}`,
                                        borderRadius: '0 0 4px 4px',
                                        boxShadow: '0 12px 32px rgba(19,33,60,0.14)',
                                        padding: '6px 0',
                                        zIndex: 999,
                                        animation: 'ddSlide 0.15s ease-out',
                                    }}>
                                        <style>{`
                                            @keyframes ddSlide {
                                                from { opacity: 0; transform: translateY(-6px); }
                                                to   { opacity: 1; transform: translateY(0); }
                                            }
                                        `}</style>
                                        {category.items.map(item => {
                                            const isItemActive = pathname === item.href
                                            const Icon = item.icon
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setOpenMenu(null)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        padding: '9px 16px',
                                                        fontSize: '13px',
                                                        fontWeight: isItemActive ? 700 : 500,
                                                        color: isItemActive ? JA.NAVY : JA.TEXT,
                                                        textDecoration: 'none',
                                                        background: isItemActive ? '#F4F4F0' : 'transparent',
                                                        borderLeft: isItemActive ? `3px solid ${JA.GOLD}` : '3px solid transparent',
                                                        transition: 'background 0.1s',
                                                        fontFamily: 'Inter, sans-serif',
                                                    }}
                                                    onMouseEnter={e => {
                                                        if (!isItemActive) {
                                                            e.currentTarget.style.background = JA.BG
                                                        }
                                                    }}
                                                    onMouseLeave={e => {
                                                        if (!isItemActive) {
                                                            e.currentTarget.style.background = 'transparent'
                                                        }
                                                    }}
                                                >
                                                    <Icon style={{ width: 15, height: 15, color: JA.GOLD, flexShrink: 0 }} />
                                                    {item.name}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </nav>
    )
}
