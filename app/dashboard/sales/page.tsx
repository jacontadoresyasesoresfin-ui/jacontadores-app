'use client'

import { ShoppingCart, TrendingUp, DollarSign, Users, Award, Package } from 'lucide-react'
import { useClient } from '../ClientContext'

const JA = {
    NAVY:    '#13213C',
    GOLD:    '#B8960C',
    TEXT:    '#1C2B45',
    GREY:    '#4B5563',
    GREY_LT: '#9CA3AF',
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

const COP = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

export default function SalesPage() {
    const { data: clientData, loading } = useClient()

    if (loading || !clientData) {
        return (
            <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '12px', color: JA.GREY, fontSize: '14px' }}>
                <div style={{ width: '16px', height: '16px', border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Analizando volumen de ventas...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    const rawSales = clientData.metrics.sales.rawValue
    const totalInvoices = clientData.metrics.productsSold.rawValue || 1
    const avgTicket = rawSales / totalInvoices

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            
            {/* ── Header ── */}
            <div style={{ borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>
                    Ventas y <span style={{ color: JA.GOLD }}>Comercial</span>
                </h1>
                <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Desglose detallado de facturación, clientes recurrentes y productos estrella.</p>
            </div>

            {/* ── KPIs Principales ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {[
                    { label: 'Ventas Totales', value: clientData.metrics.sales.value, icon: DollarSign, color: JA.NAVY, sub: 'Ingresos brutos acumulados' },
                    { label: 'Órdenes / Facturas', value: clientData.metrics.productsSold.value, icon: ShoppingCart, color: JA.NAVY, sub: 'Documentos procesados' },
                    { label: 'Ticket Promedio', value: COP(avgTicket), icon: TrendingUp, color: JA.GOLD, sub: 'Promedio por transacción' },
                ].map((kpi, i) => (
                    <div key={i} style={{ ...cardStyle, borderLeft: `4px solid ${kpi.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>{kpi.label}</p>
                            <kpi.icon style={{ width: '14px', height: '14px', color: kpi.color }} />
                        </div>
                        <p style={{ fontSize: '22px', fontWeight: 700, color: JA.TEXT, margin: 0, fontFamily: 'monospace' }}>{kpi.value}</p>
                        <p style={{ fontSize: '10px', color: JA.GREY_LT, marginTop: '4px', margin: 0 }}>{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Detalle Operativo ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                
                {/* Clientes Recurrentes */}
                <div style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        <Users style={{ width: '16px', height: '16px', color: JA.NAVY }} />
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Fidelización: Clientes Recurrentes</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {clientData.recurringCustomers.length > 0 ? (
                            clientData.recurringCustomers.map((customer, i) => (
                                <div key={i} style={{ 
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px',
                                    background: i % 2 === 0 ? JA.BG : 'transparent', borderBottom: `1px solid ${JA.BORDER}`
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '28px', height: '28px', background: JA.NAVY + '10', borderRadius: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Award style={{ width: '14px', height: '14px', color: JA.NAVY }} />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '12px', fontWeight: 600, color: JA.TEXT, margin: 0 }}>{customer.name}</p>
                                            <p style={{ fontSize: '10px', color: JA.GREY, margin: 0 }}>{customer.count} transacciones</p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>{COP(customer.total)}</p>
                                        <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GOLD, margin: 0 }}>VIP ACUMULADO</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center', color: JA.GREY_LT, fontSize: '12px' }}>No hay datos de frecuencia suficientes.</div>
                        )}
                    </div>
                </div>

                {/* Productos más Vendidos */}
                <div style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        <Package style={{ width: '16px', height: '16px', color: JA.NAVY }} />
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Top Artículos y Servicios</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {clientData.topProducts.length > 0 ? (
                            clientData.topProducts.map((product, i) => (
                                <div key={i} style={{ 
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px',
                                    background: i % 2 === 0 ? JA.BG : 'transparent', borderBottom: `1px solid ${JA.BORDER}`
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '28px', height: '28px', background: JA.GOLD + '10', borderRadius: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <ShoppingCart style={{ width: '14px', height: '14px', color: JA.GOLD }} />
                                        </div>
                                        <div style={{ maxWidth: '200px' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 600, color: JA.TEXT, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</p>
                                            <p style={{ fontSize: '10px', color: JA.GREY, margin: 0 }}>{product.count} unidades vendidas</p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>{COP(product.total)}</p>
                                        <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY_LT, margin: 0 }}>VENTA BRUTA</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center', color: JA.GREY_LT, fontSize: '12px' }}>No se encontraron detalles de productos.</div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}
