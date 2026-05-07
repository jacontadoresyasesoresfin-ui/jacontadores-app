'use client'

import { useState } from 'react'
import { Download, FileText, TrendingUp, DollarSign, ShoppingCart, Users, Eye, Loader2 } from 'lucide-react'
import { useClient } from '../ClientContext'
import { printSalesReport, printFinancialReport, printClientsReport, printTaxReport } from '@/lib/report-generator'

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

export default function ReportsPage() {
    const { data: clientData, clientName, loading } = useClient()
    const [selectedPeriod, setSelectedPeriod] = useState('month')
    const [printing, setPrinting] = useState<number | null>(null)

    if (loading || !clientData) {
        return (
            <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '12px', color: JA.GREY, fontSize: '14px' }}>
                <div style={{ width: '16px', height: '16px', border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Configurando centro de reportes...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    const handlePrint = (id: number, autoprint: boolean) => {
        setPrinting(id)
        setTimeout(() => {
            const name = clientName || 'Mi Empresa'
            if (id === 1) printSalesReport(clientData, name, selectedPeriod, autoprint)
            else if (id === 2) printFinancialReport(clientData, name, autoprint)
            else if (id === 3) printClientsReport(clientData, name, autoprint)
            else if (id === 4) printTaxReport(clientData, name, autoprint)
            setPrinting(null)
        }, 100)
    }

    const reports = [
        {
            id: 1, title: 'Reporte de Ventas',
            description: 'Análisis detallado de ventas, historial y top clientes por período operativo.',
            icon: ShoppingCart, color: JA.NAVY,
            dataPoints: `${clientData.metrics.productsSold.value} facturas`
        },
        {
            id: 2, title: 'Estado Financiero',
            description: 'Resumen consolidado de cartera, liquidez y proyecciones de flujo de caja.',
            icon: DollarSign, color: JA.NAVY,
            dataPoints: `Salud: ${clientData.portfolio.current.percent}%`
        },
        {
            id: 3, title: 'Análisis de Clientes',
            description: 'Segmentación estratégica y comportamiento de cuentas clave por volumen.',
            icon: Users, color: JA.NAVY,
            dataPoints: `${clientData.recurringCustomers.length} recurrentes`
        },
        {
            id: 4, title: 'Informe Tributario',
            description: 'Estimaciones de IVA, retenciones y renta anual según normativa vigente DIAN.',
            icon: TrendingUp, color: JA.GOLD,
            dataPoints: 'Carga Est. Calculada'
        },
    ]

    const periods = [
        { id: 'week', label: 'Semana' },
        { id: 'month', label: 'Mensual' },
        { id: 'year', label: 'Anual' },
    ]

    const kpis = [
        { label: 'Facturación', value: clientData.metrics.sales.value, color: JA.NAVY, icon: DollarSign },
        { label: 'Docs Emitidos', value: clientData.metrics.productsSold.value, color: JA.NAVY, icon: FileText },
        { label: 'Nuevos Clientes', value: clientData.metrics.newClients.value, color: JA.NAVY, icon: Users },
        { label: 'Cartera Crítica', value: clientData.portfolio.overdue.value, color: JA.RED, icon: TrendingUp },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Centro de Reportes <span style={{ color: JA.GOLD }}>Corporativos</span></h1>
                    <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Generación de informes de auditoría y estados financieros certificados</p>
                </div>

                <div style={{ display: 'flex', background: JA.BG, border: `1px solid ${JA.BORDER}`, padding: '4px', borderRadius: '2px' }}>
                    {periods.map(p => (
                        <button key={p.id} onClick={() => setSelectedPeriod(p.id)}
                            style={{
                                border: 'none',
                                padding: '4px 12px',
                                fontSize: '10px',
                                fontWeight: 700,
                                borderRadius: '1px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: selectedPeriod === p.id ? JA.NAVY : 'transparent',
                                color: selectedPeriod === p.id ? 'white' : JA.GREY
                            }}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPIs del período */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {kpis.map((kpi, i) => (
                    <div key={i} style={{ ...cardStyle, borderLeft: `4px solid ${kpi.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>{kpi.label}</p>
                            <kpi.icon style={{ width: '12px', height: '12px', color: kpi.color }} />
                        </div>
                        <p style={{ fontSize: '16px', fontWeight: 700, color: JA.TEXT, margin: 0, fontFamily: 'monospace' }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Cards de reportes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                {reports.map((report) => {
                    const Icon = report.icon
                    const isPrinting = printing === report.id
                    return (
                        <div key={report.id} style={cardStyle}>
                            <div style={{ display: 'flex', gap: '20px' }}>
                                <div style={{ width: '40px', height: '40px', background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Icon style={{ width: '20px', height: '20px', color: report.color }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: JA.TEXT, margin: '0 0 4px 0' }}>{report.title}</h3>
                                    <p style={{ fontSize: '11px', color: JA.GREY, margin: '0 0 12px 0', lineHeight: 1.5 }}>{report.description}</p>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', background: JA.BG, color: JA.NAVY, borderRadius: '1px' }}>{report.dataPoints}</span>
                                        <span style={{ fontSize: '9px', color: JA.GREY_LT, alignSelf: 'center' }}>Ref: {new Date().toLocaleDateString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button onClick={() => handlePrint(report.id, false)} disabled={isPrinting}
                                            style={{
                                                flex: 1, border: 'none', background: JA.NAVY, color: 'white',
                                                padding: '8px', borderRadius: '2px', fontSize: '11px', fontWeight: 700,
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                            }}>
                                            {isPrinting ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
                                            VISTA PREVIA
                                        </button>
                                        <button onClick={() => handlePrint(report.id, true)} disabled={isPrinting}
                                            style={{
                                                flex: 1, border: `1px solid ${JA.BORDER}`, background: 'white', color: JA.TEXT,
                                                padding: '8px', borderRadius: '2px', fontSize: '11px', fontWeight: 700,
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                            }}>
                                            <Download style={{ width: '14px', height: '14px' }} />
                                            PDF
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Actividad */}
            <div style={cardStyle}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '20px' }}>Historial de Transacciones Corporativas</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {clientData.recentActivity.length > 0 ? clientData.recentActivity.map((activity, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '4px', height: '24px', background: JA.NAVY }} />
                                <div>
                                    <p style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT, margin: 0 }}>{activity.text}</p>
                                    <p style={{ fontSize: '10px', color: JA.GREY, margin: 0 }}>{activity.client}</p>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: JA.NAVY, margin: 0, fontFamily: 'monospace' }}>{activity.amount}</p>
                                <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0 }}>{activity.time}</p>
                            </div>
                        </div>
                    )) : (
                        <div style={{ textAlign: 'center', padding: '32px', color: JA.GREY_LT, fontSize: '12px' }}>Sin registros operativos recientes</div>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

