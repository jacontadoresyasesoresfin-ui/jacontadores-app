'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, TrendingUp, ShoppingCart, Wallet, Package, FileText,
    Users, Receipt, Store, CreditCard, Percent, RotateCcw, DollarSign,
    Bell, Settings, FileSpreadsheet, FileCheck, Calculator, Search,
    ChevronDown, BarChart3, PieChart, BookOpen, ShieldCheck, Zap,
    ArrowRight
} from 'lucide-react'
import { useClient } from '@/app/dashboard/ClientContext'

/* ─── Definición del menú con descripciones cortas ──────────────────────── */
const MENU_CATEGORIES = [
    {
        name: 'Panel Principal',
        color: '#13213C',
        badge: null,
        items: [
            {
                name: 'Resumen',
                desc: 'Vista general de métricas y KPIs',
                href: '/dashboard',
                icon: LayoutDashboard,
                moduleKey: null,
            },
            {
                name: 'Analytics',
                desc: 'Análisis avanzado y tendencias',
                href: '/dashboard/analytics',
                icon: TrendingUp,
                moduleKey: 'analytics',
            },
            {
                name: 'Reportes',
                desc: 'Informes exportables y periódicos',
                href: '/dashboard/reports',
                icon: FileText,
                moduleKey: 'reports',
            },
        ],
    },
    {
        name: 'Operaciones',
        color: '#0F7B71',
        badge: null,
        items: [
            {
                name: 'Ventas',
                desc: 'Gestión de órdenes y facturación',
                href: '/dashboard/sales',
                icon: ShoppingCart,
                moduleKey: 'sales',
            },
            {
                name: 'Ecommerce',
                desc: 'Tienda online y catálogo digital',
                href: '/dashboard/ecommerce',
                icon: Store,
                moduleKey: 'ecommerce',
            },
            {
                name: 'Cartera',
                desc: 'Cuentas por cobrar y clientes',
                href: '/dashboard/portfolio',
                icon: Wallet,
                moduleKey: 'portfolio',
            },
            {
                name: 'Inventario',
                desc: 'Control de stock y movimientos',
                href: '/dashboard/inventory',
                icon: Package,
                moduleKey: 'inventory',
            },
        ],
    },
    {
        name: 'Contabilidad',
        color: '#7C3AED',
        badge: null,
        items: [
            {
                name: 'Siigo BI',
                desc: 'Integración y análisis Siigo',
                href: '/dashboard/siigo',
                icon: FileSpreadsheet,
                moduleKey: 'siigo_bi',
            },
            {
                name: 'Conciliación',
                desc: 'Conciliación bancaria y Drive PDF',
                href: '/dashboard/reconciliation',
                icon: FileCheck,
                moduleKey: 'reconciliation',
            },
            {
                name: 'Impuestos',
                desc: 'Declaraciones y obligaciones tributarias',
                href: '/dashboard/taxes',
                icon: Receipt,
                moduleKey: 'taxes',
            },
            {
                name: 'Nómina PILA',
                desc: 'Liquidación y aportes de nómina',
                href: '/dashboard/nomina',
                icon: Calculator,
                moduleKey: 'nomina',
            },
            {
                name: 'Verificar NIT',
                desc: 'Consulta RUES y Cámara de Comercio',
                href: '/dashboard/nit',
                icon: Search,
                moduleKey: 'nit',
            },
            {
                name: 'Causación',
                desc: 'Automatización de causación de facturas',
                href: '/dashboard/causacion',
                icon: FileCheck,
                moduleKey: 'causacion',
            },
            {
                name: 'DIAN Auto',
                desc: 'Descarga automática y monitoreo cron',
                href: '/dashboard/causacion/automatizacion',
                icon: Zap,
                moduleKey: 'causacion',
            },
        ],
    },
    {
        name: 'MercadoLibre',
        color: '#B8960C',
        badge: 'ML',
        isSub: true,
        items: [
            {
                name: 'Pagos ML',
                desc: 'Liquidación de pagos recibidos',
                href: '/dashboard/ml-pagos',
                icon: CreditCard,
                moduleKey: 'ml_pagos',
            },
            {
                name: 'Comisiones',
                desc: 'Análisis de comisiones por venta',
                href: '/dashboard/ml-comisiones',
                icon: Percent,
                moduleKey: 'ml_comisiones',
            },
            {
                name: 'Devoluciones',
                desc: 'Gestión de reclamos y reembolsos',
                href: '/dashboard/ml-devoluciones',
                icon: RotateCcw,
                moduleKey: 'ml_devoluciones',
            },
            {
                name: 'Costos',
                desc: 'Estructura de costos y márgenes',
                href: '/dashboard/ml-costos',
                icon: DollarSign,
                moduleKey: 'ml_costos',
            },
            {
                name: 'Alertas ML',
                desc: 'Notificaciones y avisos críticos',
                href: '/dashboard/ml-alertas',
                icon: Bell,
                moduleKey: 'ml_alertas',
            },
        ],
    },
    {
        name: 'Administración',
        color: '#4B5563',
        badge: null,
        items: [
            {
                name: 'Equipo',
                desc: 'Usuarios, roles y permisos',
                href: '/dashboard/team',
                icon: Users,
                moduleKey: 'team',
            },
            {
                name: 'Configuración',
                desc: 'Ajustes generales de la cuenta',
                href: '/dashboard/configuracion',
                icon: Settings,
                moduleKey: 'configuracion',
            },
        ],
    },
]

/* Iconos decorativos por categoría (panel lateral del mega menú) */
const CAT_ICONS: Record<string, React.ElementType> = {
    'Panel Principal': BarChart3,
    'Operaciones':     Zap,
    'Contabilidad':    BookOpen,
    'MercadoLibre':    PieChart,
    'Administración':  ShieldCheck,
}

export default function TabNavigation() {
    const pathname = usePathname()
    const { modules } = useClient()

    const visibleCategories = MENU_CATEGORIES.map(cat => ({
        ...cat,
        items: cat.items.filter(item => item.moduleKey === null || modules[item.moduleKey]),
    })).filter(cat => cat.items.length > 0)

    return (
        <>
            <style>{`
                /* ══════════════════════════════════════════════
                   J&A Mega Menu — CSS-native, zero React state
                   ══════════════════════════════════════════════ */

                .ja-nav {
                    background: #FFFFFF;
                    border-bottom: 1px solid #E5E7EB;
                    position: sticky;
                    top: 60px;
                    z-index: 9000;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                }

                /* ─ Barra de tabs ─────────────────────────── */
                .ja-nav-scroller {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 20px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                }
                .ja-nav-scroller::-webkit-scrollbar { display: none; }

                .ja-nav-row {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    height: 50px;
                    min-width: max-content;
                }

                /* ─ Grupo (wrapper hover) ──────────────────── */
                .ja-mg {
                    position: static;   /* el dropdown sale del nav, no del grupo */
                    height: 100%;
                    display: flex;
                    align-items: center;
                }

                /* ─ Botón de pestaña ───────────────────────── */
                .ja-tab {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    height: 100%;
                    padding: 0 12px;
                    border: none;
                    border-bottom: 2px solid transparent;
                    background: transparent;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 700;
                    color: #6B7280;
                    font-family: Inter, sans-serif;
                    text-transform: uppercase;
                    letter-spacing: 0.07em;
                    white-space: nowrap;
                    transition: color 0.15s, border-color 0.15s, background 0.15s;
                    border-radius: 0;
                    user-select: none;
                    position: relative;
                }
                .ja-tab:hover,
                .ja-mg:hover .ja-tab,
                .ja-mg:focus-within .ja-tab {
                    color: #13213C;
                    background: #F9FAFB;
                }
                .ja-tab.is-active {
                    color: #13213C;
                    border-bottom-color: #B8960C;
                    font-weight: 800;
                }
                .ja-tab .caret {
                    width: 12px;
                    height: 12px;
                    color: #9CA3AF;
                    flex-shrink: 0;
                    transition: transform 0.2s ease, color 0.15s;
                }
                .ja-tab.is-active .caret { color: #B8960C; }
                .ja-mg:hover .caret,
                .ja-mg:focus-within .caret {
                    transform: rotate(180deg);
                    color: #B8960C !important;
                }

                /* ─ Panel mega-menú ────────────────────────── */
                .ja-panel {
                    /* Fijado al nav, no al grupo */
                    position: fixed;
                    top: 110px;          /* TopBar(60px) + TabNav(50px) */
                    left: 0;
                    right: 0;
                    z-index: 9999;

                    background: #FFFFFF;
                    border-top: 2px solid #B8960C;
                    border-bottom: 1px solid #E5E7EB;
                    box-shadow: 0 16px 48px rgba(19,33,60,0.18), 0 4px 16px rgba(0,0,0,0.08);

                    /* Oculto */
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(-8px);
                    pointer-events: none;
                    transition:
                        opacity   0.18s ease,
                        transform 0.18s ease,
                        visibility 0s linear 0.18s;
                }
                .ja-mg:hover > .ja-panel,
                .ja-mg:focus-within > .ja-panel {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0);
                    pointer-events: auto;
                    transition:
                        opacity   0.18s ease,
                        transform 0.18s ease,
                        visibility 0s linear 0s;
                }

                /* ─ Interior del panel ─────────────────────── */
                .ja-panel-inner {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 20px;
                    display: flex;
                    align-items: stretch;
                    min-height: 0;
                }

                /* Franja lateral con nombre de categoría */
                .ja-panel-side {
                    width: 200px;
                    flex-shrink: 0;
                    padding: 20px 16px;
                    border-right: 1px solid #F0F0EC;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-start;
                    gap: 8px;
                    background: #FAFAF8;
                }
                .ja-panel-cat-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 4px;
                }
                .ja-panel-cat-name {
                    font-size: 13px;
                    font-weight: 800;
                    color: #13213C;
                    font-family: Inter, sans-serif;
                    letter-spacing: 0.02em;
                }
                .ja-panel-cat-sub {
                    font-size: 11px;
                    color: #9CA3AF;
                    font-family: Inter, sans-serif;
                    line-height: 1.4;
                }

                /* Grid de módulos */
                .ja-panel-grid {
                    flex: 1;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 4px;
                    padding: 12px 16px;
                    align-content: start;
                }

                /* Tarjeta de módulo */
                .ja-mod-card {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 12px 14px;
                    border-radius: 6px;
                    text-decoration: none;
                    border: 1px solid transparent;
                    transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
                    position: relative;
                    overflow: hidden;
                }
                .ja-mod-card:hover {
                    background: #F4F4F0;
                    border-color: rgba(184,150,12,0.25);
                    box-shadow: 0 2px 8px rgba(19,33,60,0.06);
                }
                .ja-mod-card.is-active {
                    background: #FFF8E7;
                    border-color: rgba(184,150,12,0.45);
                    box-shadow: 0 2px 8px rgba(184,150,12,0.1);
                }
                .ja-mod-card.is-active::before {
                    content: '';
                    position: absolute;
                    left: 0; top: 0; bottom: 0;
                    width: 3px;
                    background: #B8960C;
                    border-radius: 0 2px 2px 0;
                }
                .ja-mod-icon-wrap {
                    width: 34px;
                    height: 34px;
                    border-radius: 8px;
                    background: #F0EFE9;
                    border: 1px solid #E5E2D8;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    transition: background 0.12s, border-color 0.12s;
                }
                .ja-mod-card:hover .ja-mod-icon-wrap {
                    background: #FFFBEB;
                    border-color: rgba(184,150,12,0.4);
                }
                .ja-mod-card.is-active .ja-mod-icon-wrap {
                    background: rgba(184,150,12,0.12);
                    border-color: rgba(184,150,12,0.5);
                }
                .ja-mod-icon {
                    width: 16px;
                    height: 16px;
                    color: #B8960C;
                }
                .ja-mod-card.is-active .ja-mod-icon { color: #9A7D0A; }
                .ja-mod-text { flex: 1; min-width: 0; }
                .ja-mod-name {
                    font-size: 13px;
                    font-weight: 700;
                    color: #13213C;
                    font-family: Inter, sans-serif;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .ja-mod-name .arrow-icon {
                    width: 11px;
                    height: 11px;
                    color: #B8960C;
                    opacity: 0;
                    transform: translateX(-4px);
                    transition: opacity 0.15s, transform 0.15s;
                    flex-shrink: 0;
                }
                .ja-mod-card:hover .arrow-icon {
                    opacity: 1;
                    transform: translateX(0);
                }
                .ja-mod-desc {
                    font-size: 11px;
                    color: #9CA3AF;
                    font-family: Inter, sans-serif;
                    margin-top: 2px;
                    line-height: 1.35;
                    white-space: normal;
                }
                .ja-mod-card.is-active .ja-mod-name { color: #9A7D0A; }
                .ja-mod-card.is-active .ja-mod-desc { color: #B8960C; }

                /* ─ Separador nav ──────────────────────────── */
                .ja-nav-sep {
                    width: 1px;
                    height: 20px;
                    background: #E5E7EB;
                    margin: 0 4px;
                    flex-shrink: 0;
                }

                /* ─ Badge ML ───────────────────────────────── */
                .ja-ml-badge {
                    font-size: 9px;
                    font-weight: 800;
                    color: #FFFFFF;
                    background: #B8960C;
                    padding: 1px 5px;
                    border-radius: 3px;
                    letter-spacing: 0.04em;
                }
            `}</style>

            <nav className="ja-nav" aria-label="Navegación principal">
                <div className="ja-nav-scroller">
                    <div className="ja-nav-row" role="menubar">
                        {visibleCategories.map((category, idx) => {
                            const isActive = category.items.some(
                                item => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                            )
                            const CatIcon = CAT_ICONS[category.name] ?? LayoutDashboard

                            return (
                                <div key={category.name} className="ja-mg" role="none">
                                    {/* ─ Botón de pestaña ─ */}
                                    <button
                                        type="button"
                                        className={`ja-tab${isActive ? ' is-active' : ''}`}
                                        aria-haspopup="true"
                                        aria-label={`Menú ${category.name}`}
                                    >
                                        {category.badge
                                            ? <span className="ja-ml-badge">{category.badge}</span>
                                            : category.name
                                        }
                                        <ChevronDown className="caret" aria-hidden="true" />
                                    </button>

                                    {/* ─ Panel mega menú ─ */}
                                    <div className="ja-panel" role="menu" aria-label={category.name}>
                                        <div className="ja-panel-inner">
                                            {/* Franja lateral */}
                                            <div className="ja-panel-side">
                                                <div
                                                    className="ja-panel-cat-icon"
                                                    style={{ background: `${category.color}18` }}
                                                >
                                                    <CatIcon
                                                        style={{ width: 18, height: 18, color: category.color }}
                                                        aria-hidden="true"
                                                    />
                                                </div>
                                                <span className="ja-panel-cat-name">{category.name}</span>
                                                <span className="ja-panel-cat-sub">
                                                    {category.items.length} módulo{category.items.length !== 1 ? 's' : ''} disponible{category.items.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>

                                            {/* Grid de módulos */}
                                            <div className="ja-panel-grid">
                                                {category.items.map(item => {
                                                    const isItemActive =
                                                        pathname === item.href ||
                                                        (item.href !== '/dashboard' && pathname.startsWith(item.href))
                                                    const Icon = item.icon
                                                    return (
                                                        <Link
                                                            key={item.href}
                                                            href={item.href}
                                                            className={`ja-mod-card${isItemActive ? ' is-active' : ''}`}
                                                            role="menuitem"
                                                        >
                                                            <div className="ja-mod-icon-wrap">
                                                                <Icon className="ja-mod-icon" aria-hidden="true" />
                                                            </div>
                                                            <div className="ja-mod-text">
                                                                <div className="ja-mod-name">
                                                                    {item.name}
                                                                    <ArrowRight className="arrow-icon" aria-hidden="true" />
                                                                </div>
                                                                <div className="ja-mod-desc">{item.desc}</div>
                                                            </div>
                                                        </Link>
                                                    )
                                                })}
                                            </div>
                                        </div>
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
