'use client'

import { useState } from 'react'
import { Download, FileText, TrendingUp, DollarSign, ShoppingCart, Users, Eye, Loader2 } from 'lucide-react'
import { useClient } from '../ClientContext'
import { printSalesReport, printFinancialReport, printClientsReport, printTaxReport } from '@/lib/report-generator'

const TEAL = '#14B8A6'
const NAVY = '#0B2447'
const GOLD = '#D4A843'
const GREEN = '#10B981'
const RED = '#EF4444'

const card = {
    background: '#FFFFFF',
    border: '1.5px solid #E2E8F0',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
    padding: '20px',
}

export default function ReportsPage() {
    const { data: clientData, clientName, loading } = useClient()
    const [selectedPeriod, setSelectedPeriod] = useState('month')
    const [printing, setPrinting] = useState<number | null>(null)

    if (loading || !clientData) {
        return (
            <div className="p-8 flex items-center gap-3 text-slate-600">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: `${TEAL}40`, borderTopColor: TEAL }} />
                Cargando Reportes...
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
            description: 'Análisis detallado de ventas, historial y top clientes por período',
            icon: ShoppingCart, color: TEAL, bgColor: '#CCFBF1',
            lastGenerated: new Date().toLocaleDateString(),
            dataPoints: `${clientData.metrics.productsSold.value} facturas · ${clientData.metrics.newClients.value} clientes`
        },
        {
            id: 2, title: 'Estado Financiero',
            description: 'Resumen de cartera, métricas financieras y proyección de ingresos',
            icon: DollarSign, color: NAVY, bgColor: '#E0F2FE',
            lastGenerated: new Date().toLocaleDateString(),
            dataPoints: `Cartera: ${clientData.portfolio.total} · ${clientData.portfolio.current.percent}% al día`
        },
        {
            id: 3, title: 'Análisis de Clientes',
            description: 'Segmentación, recurrencia y comportamiento de clientes por facturación',
            icon: Users, color: GREEN, bgColor: '#D1FAE5',
            lastGenerated: new Date().toLocaleDateString(),
            dataPoints: `${clientData.recurringCustomers.length} clientes analizados`
        },
        {
            id: 4, title: 'Informe Tributario',
            description: 'Estimación de IVA, retenciones y renta anual según Ley Colombiana',
            icon: TrendingUp, color: GOLD, bgColor: '#FEF3C7',
            lastGenerated: new Date().toLocaleDateString(),
            dataPoints: `IVA: ${(clientData.taxData.totalIVACobrado / 1_000_000).toFixed(1)}M · Renta est.`
        },
    ]

    const periods = [
        { id: 'week', label: 'Esta Semana' },
        { id: 'month', label: 'Este Mes' },
        { id: 'year', label: 'Este Año' },
    ]

    // Métricas clave
    const kpis = [
        { label: 'Ventas Totales', value: clientData.metrics.sales.value, color: TEAL, bgColor: '#CCFBF1', icon: DollarSign },
        { label: 'Facturas Generadas', value: clientData.metrics.productsSold.value, color: NAVY, bgColor: '#E0F2FE', icon: FileText },
        { label: 'Clientes Activos', value: clientData.metrics.newClients.value, color: GREEN, bgColor: '#D1FAE5', icon: Users },
        { label: 'Cartera Vencida', value: clientData.portfolio.overdue.value, color: RED, bgColor: '#FEE2E2', icon: TrendingUp },
    ]

    return (
        <div className="space-y-6 pb-10" style={{ fontFamily: 'var(--font-inter)' }}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800" style={{ fontFamily: 'var(--font-outfit)' }}>
                        Centro de <span style={{ color: TEAL }}>Reportes</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Genera informes financieros completos en PDF — datos reales del cliente</p>
                </div>

                {/* Selector de período */}
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
                    {periods.map(p => (
                        <button key={p.id} onClick={() => setSelectedPeriod(p.id)}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all"
                            style={selectedPeriod === p.id
                                ? { background: NAVY, color: 'white', boxShadow: '0 2px 8px rgba(11,36,71,0.3)' }
                                : { color: '#64748B' }}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPIs del período */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, i) => (
                    <div key={i} style={card} className="hover:-translate-y-0.5 transition-transform">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{kpi.label}</p>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: kpi.bgColor }}>
                                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                            </div>
                        </div>
                        <p className="font-black text-xl font-mono" style={{ color: kpi.color }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Cards de reportes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {reports.map((report) => {
                    const Icon = report.icon
                    const isPrinting = printing === report.id
                    return (
                        <div key={report.id} style={card}
                            className="group hover:-translate-y-1 transition-all duration-200 hover:shadow-lg">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 duration-300"
                                    style={{ background: report.bgColor }}>
                                    <Icon className="w-6 h-6" style={{ color: report.color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-slate-800 text-base mb-1">{report.title}</h3>
                                    <p className="text-slate-500 text-xs leading-relaxed mb-3">{report.description}</p>
                                    <div className="flex items-center gap-2 flex-wrap mb-4">
                                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                                            style={{ background: '#F1F5F9', color: '#64748B' }}>
                                            📊 {report.dataPoints}
                                        </span>
                                        <span className="text-[9px] text-slate-400">
                                            Generado: {report.lastGenerated}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handlePrint(report.id, false)}
                                            disabled={isPrinting}
                                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                                            style={{ background: report.color, color: 'white', boxShadow: `0 4px 12px ${report.color}40` }}>
                                            {isPrinting ? (
                                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</>
                                            ) : (
                                                <><Eye className="w-3.5 h-3.5" /> Vista Previa</>
                                            )}
                                        </button>
                                        <button onClick={() => handlePrint(report.id, true)}
                                            disabled={isPrinting}
                                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all hover:bg-slate-100 active:scale-95 disabled:opacity-50"
                                            style={{ background: '#F8FAFC', color: '#64748B', border: '1.5px solid #E2E8F0' }}>
                                            <Download className="w-3.5 h-3.5" /> Imprimir PDF
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Últimas transacciones */}
            <div style={card}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 text-sm">Actividad Reciente del Cliente</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: '#CCFBF1', color: '#0F766E' }}>
                        Últimas {clientData.recentActivity.length} transacciones
                    </span>
                </div>
                <div className="space-y-2">
                    {clientData.recentActivity.length > 0 ? clientData.recentActivity.map((activity, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors"
                            style={{ border: '1px solid #F1F5F9' }}>
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: `${TEAL}15` }}>
                                    <div className="w-2 h-2 rounded-full" style={{ background: TEAL }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-slate-700 text-sm font-semibold truncate">{activity.text}</p>
                                    <p className="text-slate-400 text-xs truncate">{activity.client}</p>
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                                <p className="font-black text-sm font-mono" style={{ color: TEAL }}>{activity.amount}</p>
                                <p className="text-slate-400 text-xs">{activity.time}</p>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-8 text-slate-400 text-sm">Sin actividad reciente registrada</div>
                    )}
                </div>
            </div>
        </div>
    )
}
