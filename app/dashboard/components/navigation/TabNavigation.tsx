'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
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
      GREY_LT: '#F9FAFB',
}

const MENU_CATEGORIES = [
    {
        name: 'Panel Principal',
        items: [
            { name: 'Resumen',      href: '/dashboard',           icon: LayoutDashboard, moduleKey: null },
            { name: 'Analytics',    href: '/dashboard/analytics', icon: TrendingUp,      moduleKey: 'analytics' },
            { name: 'Reportes',     href: '/dashboard/reports',   icon: FileText,        moduleKey: 'reports' },
        ]
    },
    {
        name: 'Operaciones',
        items: [
            { name: 'Ventas',       href: '/dashboard/sales',     icon: ShoppingCart,    moduleKey: 'sales' },
            { name: 'Ecommerce',    href: '/dashboard/ecommerce', icon: Store,           moduleKey: 'ecommerce' },
            { name: 'Cartera',      href: '/dashboard/portfolio', icon: Wallet,          moduleKey: 'portfolio' },
            { name: 'Inventario',   href: '/dashboard/inventory', icon: Package,         moduleKey: 'inventory' },
        ]
    },
    {
        name: 'Contabilidad y Utilidades',
        items: [
            { name: 'Siigo BI',     href: '/dashboard/siigo',          icon: FileSpreadsheet, moduleKey: 'siigo_bi' },
            { name: 'Conciliación', href: '/dashboard/reconciliation', icon: FileCheck,       moduleKey: 'reconciliation' },
            { name: 'Impuestos',    href: '/dashboard/taxes',          icon: Receipt,         moduleKey: 'taxes' },
            { name: 'Nómina PILA',  href: '/dashboard/nomina',         icon: Calculator,      moduleKey: 'nomina' },
            { name: 'Verificar NIT',href: '/dashboard/nit',            icon: Search,          moduleKey: 'nit' },
        ]
    },
    {
        name: 'Mercado Libre',
        isSub: true,
        items: [
            { name: 'Pagos ML',     href: '/dashboard/ml-pagos',        icon: CreditCard,  moduleKey: 'ml_pagos' },
            { name: 'Comisiones',   href: '/dashboard/ml-comisiones',   icon: Percent,     moduleKey: 'ml_comisiones' },
            { name: 'Devoluciones', href: '/dashboard/ml-devoluciones', icon: RotateCcw,   moduleKey: 'ml_devoluciones' },
            { name: 'Costos',       href: '/dashboard/ml-costos',       icon: DollarSign,  moduleKey: 'ml_costos' },
            { name: 'Alertas',      href: '/dashboard/ml-alertas',      icon: Bell,        moduleKey: 'ml_alertas' },
        ]
    },
    {
        name: 'Administración',
        items: [
            { name: 'Equipo',       href: '/dashboard/team',          icon: Users,    moduleKey: 'team' },
            { name: 'Configuración',href: '/dashboard/configuracion', icon: Settings, moduleKey: 'configuracion' },
        ]
    }
]

export default function TabNavigation() {
    const pathname = usePathname()
    const { modules } = useClient()
    const [openCategory, setOpenCategory] = useState<string | null>(null)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleMouseEnter = (catName: string) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setOpenCategory(catName)
    }

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setOpenCategory(null)
        }, 150)
    }

    // Filter categories based on available modules
    const visibleCategories = MENU_CATEGORIES.map(cat => ({
        ...cat,
        items: cat.items.filter(item => item.moduleKey === null || modules[item.moduleKey])
    })).filter(cat => cat.items.length > 0)

    return (
        <nav style={{
            background: '#FFFFFF',
            borderBottom: `1px solid ${JA.BORDER}`,
            position: 'sticky',
            top: '60px',
            zIndex: 40,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        }}>
            <style>{`
                .tab-nav-container {
                    max-width: 1400px; 
                    margin: 0 auto; 
                    padding: 0 24px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none; /* Firefox */
                }
                .tab-nav-container::-webkit-scrollbar {
                    display: none; /* Safari and Chrome */
                }
                .tab-nav-flex {
                    display: flex;
                    align-items: center;
                    gap: 24px;
                    height: 54px;
                    min-width: max-content;
                }
                @media (max-width: 768px) {
                    .tab-nav-container {
                        padding: 0 16px;
                    }
                    .tab-nav-flex {
                        gap: 16px;
                    }
                }
            `}</style>
            <div className="tab-nav-container">
                <div className="tab-nav-flex">
                    {visibleCategories.map((category) => {
                        const isActiveCategory = category.items.some(item => pathname === item.href)
                        const isOpen = openCategory === category.name

                        return (
                            <div 
                                key={category.name}
                                onMouseEnter={() => handleMouseEnter(category.name)}
                                onMouseLeave={handleMouseLeave}
                                style={{ height: '100%', position: 'relative', display: 'flex', alignItems: 'center' }}
                            >
                                <button style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    height: '100%',
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: isActiveCategory ? JA.NAVY : JA.GREY,
                                    borderBottom: `2px solid ${isActiveCategory ? JA.GOLD : 'transparent'}`,
                                    transition: 'all 0.2s',
                                    padding: '0 4px',
                                    fontFamily: 'Inter, sans-serif',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    {category.isSub && <span style={{ color: JA.GOLD }}>ML</span>}
                                    {!category.isSub && category.name}
                                    <ChevronDown style={{ 
                                        width: '12px', height: '12px', 
                                        transform: isOpen ? 'rotate(180deg)' : 'none', 
                                        transition: 'transform 0.2s',
                                        color: isActiveCategory ? JA.GOLD : JA.GREY_LT
                                    }} />
                                </button>

                                {/* Dropdown Menu */}
                                {isOpen && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        minWidth: '220px',
                                        background: '#FFFFFF',
                                        border: `1px solid ${JA.BORDER}`,
                                        borderRadius: '0 0 4px 4px',
                                        boxShadow: '0 10px 25px rgba(19,33,60,0.1)',
                                        padding: '8px 0',
                                        zIndex: 50,
                                        animation: 'fadeIn 0.15s ease-out'
                                    }}>
                                        {category.items.map(item => {
                                            const isActive = pathname === item.href
                                            const Icon = item.icon
                                            return (
                                                <Link 
                                                    key={item.href} 
                                                    href={item.href}
                                                    onClick={() => setOpenCategory(null)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        padding: '10px 16px',
                                                        fontSize: '13px',
                                                        fontWeight: isActive ? 700 : 500,
                                                        color: isActive ? JA.NAVY : JA.TEXT,
                                                        textDecoration: 'none',
                                                        background: isActive ? JA.BG : 'transparent',
                                                        transition: 'background 0.1s',
                                                    }}
                                                    onMouseOver={(e) => {
                                                        if (!isActive) e.currentTarget.style.background = '#F8FAFC'
                                                    }}
                                                    onMouseOut={(e) => {
                                                        if (!isActive) e.currentTarget.style.background = 'transparent'
                                                    }}
                                                >
                                                    <Icon style={{ width: '16px', height: '16px', color: isActive ? JA.GOLD : JA.GREY_LT }} />
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
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </nav>
    )
}

