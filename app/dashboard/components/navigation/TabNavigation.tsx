'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, TrendingUp, ShoppingCart, Wallet, Package, FileText,
    Users, Receipt, Store, CreditCard, Percent, RotateCcw, DollarSign,
    Bell, Settings, FileSpreadsheet, FileCheck, Calculator, Search, ChevronDown
} from 'lucide-react'
import { useClient } from '@/app/dashboard/ClientContext'

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
        name: 'Contabilidad',
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

    const visibleCategories = MENU_CATEGORIES.map(cat => ({
        ...cat,
        items: cat.items.filter(item => item.moduleKey === null || modules[item.moduleKey])
    })).filter(cat => cat.items.length > 0)

    return (
        <>
            {/* Inyectar estilos del mega menú una sola vez */}
            <style>{`
                .ja-nav {
                    background: #FFFFFF;
                    border-bottom: 1px solid #E5E7EB;
                    position: sticky;
                    top: 60px;
                    z-index: 200;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                }
                .ja-nav-inner {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 20px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                }
                .ja-nav-inner::-webkit-scrollbar { display: none; }
                .ja-nav-flex {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    height: 50px;
                    min-width: max-content;
                }

                /* ── Grupo de menú (hover/focus-within nativo) ─────────── */
                .ja-nav-group {
                    position: relative;
                    height: 100%;
                    display: flex;
                    align-items: center;
                }

                /* ── Botón del tab ────────────────────────────────────── */
                .ja-nav-btn {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    height: 100%;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 700;
                    color: #4B5563;
                    border-bottom: 2px solid transparent;
                    padding: 0 10px;
                    font-family: Inter, sans-serif;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    white-space: nowrap;
                    transition: color 0.15s, border-color 0.15s;
                    -webkit-user-select: none;
                    user-select: none;
                }
                .ja-nav-btn.active {
                    color: #13213C;
                    border-bottom-color: #B8960C;
                }
                .ja-nav-btn .ja-chevron {
                    width: 11px;
                    height: 11px;
                    color: #9CA3AF;
                    transition: transform 0.2s, color 0.15s;
                    flex-shrink: 0;
                }
                .ja-nav-btn.active .ja-chevron { color: #B8960C; }

                /* ── Dropdown ─────────────────────────────────────────── */
                .ja-dropdown {
                    position: absolute;
                    top: calc(100% + 0px);   /* sin gap → no se cierra al pasar */
                    left: 0;
                    min-width: 230px;
                    background: #FFFFFF;
                    border: 1px solid #E5E7EB;
                    border-top: 2px solid #B8960C;
                    border-radius: 0 0 4px 4px;
                    box-shadow: 0 12px 32px rgba(19,33,60,0.14);
                    padding: 6px 0;
                    z-index: 999;
                    /* Oculto por defecto */
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(-6px);
                    pointer-events: none;
                    transition: opacity 0.15s ease, transform 0.15s ease, visibility 0s linear 0.15s;
                }

                /* Activar con hover O focus-within (accesibilidad teclado) */
                .ja-nav-group:hover > .ja-dropdown,
                .ja-nav-group:focus-within > .ja-dropdown {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0);
                    pointer-events: auto;
                    transition: opacity 0.15s ease, transform 0.15s ease, visibility 0s linear 0s;
                }

                /* Rotar chevron cuando el grupo está activo */
                .ja-nav-group:hover .ja-chevron,
                .ja-nav-group:focus-within .ja-chevron {
                    transform: rotate(180deg);
                }

                /* ── Ítem del dropdown ────────────────────────────────── */
                .ja-dd-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 9px 16px;
                    font-size: 13px;
                    font-weight: 500;
                    color: #1C2B45;
                    text-decoration: none;
                    background: transparent;
                    border-left: 3px solid transparent;
                    transition: background 0.1s, border-color 0.1s;
                    font-family: Inter, sans-serif;
                }
                .ja-dd-item:hover {
                    background: #F8FAFC;
                    border-left-color: rgba(184,150,12,0.4);
                }
                .ja-dd-item.active {
                    font-weight: 700;
                    color: #13213C;
                    background: #F4F4F0;
                    border-left-color: #B8960C;
                }
                .ja-dd-item .dd-icon {
                    width: 15px;
                    height: 15px;
                    color: #B8960C;
                    flex-shrink: 0;
                }
            `}</style>

            <nav className="ja-nav">
                <div className="ja-nav-inner">
                    <div className="ja-nav-flex">
                        {visibleCategories.map((category) => {
                            const isActive = category.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))

                            return (
                                <div
                                    key={category.name}
                                    className="ja-nav-group"
                                    /* tabIndex permite focus-within por teclado */
                                    tabIndex={-1}
                                >
                                    {/* Botón del tab — aria para accesibilidad */}
                                    <button
                                        className={`ja-nav-btn${isActive ? ' active' : ''}`}
                                        aria-haspopup="true"
                                        aria-expanded="false"
                                        type="button"
                                    >
                                        {category.isSub
                                            ? <span style={{ color: '#B8960C' }}>ML</span>
                                            : category.name
                                        }
                                        <ChevronDown className="ja-chevron" />
                                    </button>

                                    {/* Dropdown — controlado 100% por CSS */}
                                    <div className="ja-dropdown" role="menu">
                                        {category.items.map(item => {
                                            const isItemActive = pathname === item.href || pathname.startsWith(item.href + '/')
                                            const Icon = item.icon
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={`ja-dd-item${isItemActive ? ' active' : ''}`}
                                                    role="menuitem"
                                                >
                                                    <Icon className="dd-icon" />
                                                    {item.name}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </nav>
        </>
    )
}
