'use client'

import { useState } from 'react'
import { DollarSign, TrendingDown, TrendingUp, RefreshCw, CreditCard, ArrowDownCircle, ArrowUpCircle, AlertCircle, Filter, Info } from 'lucide-react'

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

const DEMO_MOVEMENTS = [
    { fecha: '2025-03-01', tipo: 'Pago recibido', orden: '#2381940', debito: 0, credito: 185000, saldo: 1850000, estado: 'acreditado' },
    { fecha: '2025-03-01', tipo: 'Comisión ML', orden: '#2381940', debito: 22200, credito: 0, saldo: 1827800, estado: 'debitado' },
    { fecha: '2025-03-02', tipo: 'Pago recibido', orden: '#2384120', debito: 0, credito: 320000, saldo: 2147800, estado: 'acreditado' },
    { fecha: '2025-03-02', tipo: 'Costo envío ML', orden: '#2384120', debito: 18000, credito: 0, saldo: 2129800, estado: 'debitado' },
    { fecha: '2025-03-03', tipo: 'Retención DIAN', orden: '#2384120', debito: 11200, credito: 0, saldo: 2118600, estado: 'debitado' },
    { fecha: '2025-03-04', tipo: 'Pago recibido', orden: '#2389500', debito: 0, credito: 450000, saldo: 2568600, estado: 'acreditado' },
    { fecha: '2025-03-05', tipo: 'Reembolso', orden: '#2379100', debito: 185000, credito: 0, saldo: 2383600, estado: 'debitado' },
    { fecha: '2025-03-05', tipo: 'Publicidad ML', orden: '—', debito: 35000, credito: 0, saldo: 2348600, estado: 'debitado' },
    { fecha: '2025-03-06', tipo: 'Pago recibido', orden: '#2391200', debito: 0, credito: 275000, saldo: 2623600, estado: 'acreditado' },
    { fecha: '2025-03-07', tipo: 'Liberación de fondos', orden: 'LOTE-0307', debito: 0, credito: 980000, saldo: 3603600, estado: 'liberado' },
    { fecha: '2025-03-08', tipo: 'Ajuste ML', orden: 'ADJ-004', debito: 0, credito: 15000, saldo: 3618600, estado: 'acreditado' },
    { fecha: '2025-03-09', tipo: 'Pago recibido', orden: '#2398540', debito: 0, credito: 510000, saldo: 4128600, estado: 'acreditado' },
    { fecha: '2025-03-09', tipo: 'Comisión ML', orden: '#2398540', debito: 61200, credito: 0, saldo: 4067400, estado: 'debitado' },
    { fecha: '2025-03-10', tipo: 'Costo envío ML', orden: '#2398540', debito: 19500, credito: 0, saldo: 4047900, estado: 'debitado' },
]

export default function MercadoPagoPage() {
    const [filter, setFilter] = useState<string>('todos')

    const saldoActual = DEMO_MOVEMENTS[DEMO_MOVEMENTS.length - 1].saldo
    const totalCreditos = DEMO_MOVEMENTS.reduce((s, m) => s + m.credito, 0)
    const totalDebitos = DEMO_MOVEMENTS.reduce((s, m) => s + m.debito, 0)
    const totalRetenciones = DEMO_MOVEMENTS.filter(m => m.tipo === 'Retención DIAN').reduce((s, m) => s + m.debito, 0)
    const totalLiberaciones = DEMO_MOVEMENTS.filter(m => m.tipo === 'Liberación de fondos').reduce((s, m) => s + m.credito, 0)

    const FILTROS = ['todos', 'Pago recibido', 'Comisión ML', 'Retención DIAN', 'Reembolso', 'Liberación de fondos', 'Costo envío ML']
    const movFiltrados = filter === 'todos' ? DEMO_MOVEMENTS : DEMO_MOVEMENTS.filter(m => m.tipo === filter)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Pagos <span style={{ color: JA.GOLD }}>Mercado Pago</span></h1>
                    <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Auditoría financiera y control de dispersión de fondos en tiempo real.</p>
                </div>
                <button style={{
                    padding: '8px 16px', fontSize: '11px', fontWeight: 700, border: `1px solid ${JA.BORDER}`,
                    background: 'white', color: JA.TEXT, borderRadius: '2px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <RefreshCw style={{ width: '14px', height: '14px', color: JA.GOLD }} />
                    SINCRONIZAR CUENTA
                </button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                {[
                    { label: 'Saldo Disponible', value: COP(saldoActual), icon: CreditCard, color: JA.NAVY },
                    { label: 'Ingresos (Mes)', value: COP(totalCreditos), icon: ArrowUpCircle, color: JA.GREEN },
                    { label: 'Débitos / Cargos', value: COP(totalDebitos), icon: ArrowDownCircle, color: JA.RED },
                    { label: 'Retenciones DIAN', value: COP(totalRetenciones), icon: AlertCircle, color: JA.RED },
                    { label: 'Liberado Est.', value: COP(totalLiberaciones), icon: TrendingUp, color: JA.GOLD },
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

            {/* Financial Analysis */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '20px' }}>Resumen de Liquidación</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                            { label: 'Ventas Brutas Mercado Libre', value: totalCreditos, color: JA.TEXT },
                            { label: 'Cargos por Servicio y Envío', value: -totalDebitos + totalRetenciones, color: JA.RED },
                            { label: 'Carga Impositiva (Retenciones)', value: -totalRetenciones, color: JA.RED },
                            { label: 'Remanente Neto Estimado', value: totalCreditos - totalDebitos, color: JA.GREEN, bold: true },
                        ].map((row, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: i < 3 ? `1px solid ${JA.BG}` : 'none', paddingBottom: '8px' }}>
                                <span style={{ fontSize: '11px', color: JA.GREY }}>{row.label}</span>
                                <span style={{ fontSize: '12px', fontWeight: row.bold ? 700 : 500, color: row.color, fontFamily: 'monospace' }}>{COP(row.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ ...cardStyle, background: JA.NAVY, border: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'white', margin: 0 }}>Estado de Conciliación</h3>
                        <CheckCircle style={{ width: '16px', height: '16px', color: JA.GOLD }} />
                    </div>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{ width: '80px', height: '80px', border: `4px solid ${JA.GOLD}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>100%</span>
                        </div>
                        <div>
                            <p style={{ color: 'white', fontSize: '12px', fontWeight: 600, margin: 0 }}>Cuentas Sincronizadas</p>
                            <p style={{ color: JA.GREY_LT, fontSize: '11px', marginTop: '4px', margin: 0 }}>Todos los movimientos de Mercado Pago han sido conciliados con el registro de ventas de este mes.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Movements Table */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Historial Operativo (Dispersión)</h3>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {FILTROS.map(f => (
                            <button key={f} onClick={() => setFilter(f)} style={{
                                padding: '4px 10px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                                background: filter === f ? JA.NAVY : JA.BG,
                                color: filter === f ? 'white' : JA.GREY,
                                border: `1px solid ${JA.BORDER}`, borderRadius: '1px'
                            }}>
                                {f.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ background: JA.BG, textAlign: 'left', borderBottom: `2px solid ${JA.BORDER}` }}>
                                <th style={{ padding: '12px' }}>FECHA</th>
                                <th style={{ padding: '12px' }}>TIPO DE OPERACIÓN</th>
                                <th style={{ padding: '12px' }}>REF. ORDEN</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>DÉBITO (-)</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>CRÉDITO (+)</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>SALDO ACUM.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movFiltrados.map((mov, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${JA.BG}` }}>
                                    <td style={{ padding: '12px', color: JA.GREY }}>{mov.fecha}</td>
                                    <td style={{ padding: '12px', fontWeight: 600, color: JA.TEXT }}>{mov.tipo}</td>
                                    <td style={{ padding: '12px', fontFamily: 'monospace', color: JA.NAVY }}>{mov.orden}</td>
                                    <td style={{ padding: '12px', textAlign: 'right', color: JA.RED, fontWeight: 500 }}>{mov.debito > 0 ? COP(mov.debito) : '—'}</td>
                                    <td style={{ padding: '12px', textAlign: 'right', color: JA.GREEN, fontWeight: 500 }}>{mov.credito > 0 ? COP(mov.credito) : '—'}</td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: JA.TEXT }}>{COP(mov.saldo)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Notice */}
            <div style={{ ...cardStyle, background: JA.BG, display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Info style={{ width: '16px', height: '16px', color: JA.GREY }} />
                <p style={{ fontSize: '10px', color: JA.GREY, margin: 0, fontStyle: 'italic' }}>
                    * Los movimientos de "Comisión ML" y "Costo Envío" son liquidados automáticamente por la plataforma. 
                    Las retenciones DIAN son calculadas según la normativa vigente en Colombia para medios de pago electrónicos.
                </p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

function CheckCircle({ className, style }: any) {
    return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
