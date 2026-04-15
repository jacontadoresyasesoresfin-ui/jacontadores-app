'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, TrendingDown, TrendingUp, RefreshCw, CreditCard, ArrowDownCircle, ArrowUpCircle, AlertCircle } from 'lucide-react'

const COP = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

// Datos de demostración de movimientos Mercado Pago
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

const TIPO_COLOR: Record<string, string> = {
    'Pago recibido': 'bg-[#0ECB81]/10 text-[#0ECB81]',
    'Liberación de fondos': 'bg-[#0ECB81]/10 text-[#0ECB81]',
    'Ajuste ML': 'bg-[#5B8DEF]/10 text-[#5B8DEF]',
    'Comisión ML': 'bg-[#F0B90B]/10 text-[#F0B90B]',
    'Costo envío ML': 'bg-[#F0B90B]/10 text-[#F0B90B]',
    'Publicidad ML': 'bg-[#F0B90B]/10 text-[#F0B90B]',
    'Retención DIAN': 'bg-[#F6465D]/10 text-[#F6465D]',
    'Reembolso': 'bg-[#F6465D]/10 text-[#F6465D]',
}

export default function MercadoPagoPage() {
    const [filter, setFilter] = useState<string>('todos')

    const totalCreditos = DEMO_MOVEMENTS.reduce((s, m) => s + m.credito, 0)
    const totalDebitos = DEMO_MOVEMENTS.reduce((s, m) => s + m.debito, 0)
    const saldoActual = DEMO_MOVEMENTS[DEMO_MOVEMENTS.length - 1].saldo
    const totalRetenciones = DEMO_MOVEMENTS.filter(m => m.tipo === 'Retención DIAN').reduce((s, m) => s + m.debito, 0)
    const totalReembolsos = DEMO_MOVEMENTS.filter(m => m.tipo === 'Reembolso').reduce((s, m) => s + m.debito, 0)
    const totalLiberaciones = DEMO_MOVEMENTS.filter(m => m.tipo === 'Liberación de fondos').reduce((s, m) => s + m.credito, 0)

    const FILTROS = ['todos', 'Pago recibido', 'Comisión ML', 'Retención DIAN', 'Reembolso', 'Liberación de fondos', 'Costo envío ML']

    const movFiltrados = filter === 'todos' ? DEMO_MOVEMENTS : DEMO_MOVEMENTS.filter(m => m.tipo === filter)

    return (
        <div className="space-y-6 pb-10 font-sans animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#EAECEF]">
                        Pagos <span className="text-[#FFE600]">Mercado Pago</span>
                    </h1>
                    <p className="text-[#848E9C] text-sm mt-1">Movimientos financieros reales de tu cuenta</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-[#2B3139] rounded-lg text-[#EAECEF] text-sm hover:bg-[#3B4149] transition-colors">
                    <RefreshCw className="w-4 h-4 text-[#F0B90B]" />
                    Sincronizar ahora
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                    { label: 'Saldo Actual', value: COP(saldoActual), icon: CreditCard, color: '#F0B90B' },
                    { label: 'Total Cobrado', value: COP(totalCreditos), icon: ArrowUpCircle, color: '#0ECB81' },
                    { label: 'Total Debitado', value: COP(totalDebitos), icon: ArrowDownCircle, color: '#F6465D' },
                    { label: 'Retenciones DIAN', value: COP(totalRetenciones), icon: AlertCircle, color: '#F6465D' },
                    { label: 'Fondos Liberados', value: COP(totalLiberaciones), icon: TrendingUp, color: '#5B8DEF' },
                ].map((kpi, i) => (
                    <Card key={i} className="bg-[#1E2329] border-[#2B3139] hover:border-[#3B4149] transition-colors">
                        <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex items-center gap-2 mb-2">
                                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                                <p className="text-[#848E9C] text-[10px] uppercase font-bold tracking-wider">{kpi.label}</p>
                            </div>
                            <p className="font-bold text-base" style={{ color: kpi.color }}>{kpi.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Resumen de Retenciones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-[#1E2329] border-[#2B3139] border-l-4 border-l-[#F6465D]">
                    <CardContent className="pt-5 space-y-2">
                        <p className="text-[#848E9C] text-xs uppercase font-bold">Retenciones del período</p>
                        <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                                <span className="text-[#848E9C]">Retención DIAN</span>
                                <span className="text-[#F6465D] font-bold">{COP(totalRetenciones)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#848E9C]">Reembolsos emitidos</span>
                                <span className="text-[#F6465D] font-bold">{COP(totalReembolsos)}</span>
                            </div>
                            <div className="flex justify-between border-t border-[#2B3139] pt-1">
                                <span className="text-[#EAECEF] font-bold">Total retenciones</span>
                                <span className="text-[#F6465D] font-bold">{COP(totalRetenciones + totalReembolsos)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-[#1E2329] border-[#2B3139] border-l-4 border-l-[#0ECB81] md:col-span-2">
                    <CardContent className="pt-5 space-y-2">
                        <p className="text-[#848E9C] text-xs uppercase font-bold">Flujo de dinero</p>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-2 bg-[#0B0E11]/60 rounded-lg">
                                <p className="text-[#848E9C] text-[10px] uppercase font-bold mb-1">Ingresos brutos</p>
                                <p className="text-[#0ECB81] font-bold">{COP(totalCreditos)}</p>
                            </div>
                            <div className="text-center p-2 bg-[#0B0E11]/60 rounded-lg">
                                <p className="text-[#848E9C] text-[10px] uppercase font-bold mb-1">Cargos ML</p>
                                <p className="text-[#F6465D] font-bold">{COP(totalDebitos)}</p>
                            </div>
                            <div className="text-center p-2 bg-[#0B0E11]/60 rounded-lg">
                                <p className="text-[#848E9C] text-[10px] uppercase font-bold mb-1">Neto recibido</p>
                                <p className="text-[#F0B90B] font-bold">{COP(totalCreditos - totalDebitos)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla de movimientos */}
            <Card className="bg-[#1E2329] border-[#2B3139]">
                <CardHeader className="border-b border-[#2B3139]">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <CardTitle className="text-[#EAECEF] flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-[#F0B90B]" />
                            Movimientos del Período
                            <Badge className="bg-[#F0B90B]/10 text-[#F0B90B] ml-2">{movFiltrados.length}</Badge>
                        </CardTitle>
                        {/* Filtros */}
                        <div className="flex flex-wrap gap-1.5">
                            {FILTROS.map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all ${filter === f
                                        ? 'bg-[#F0B90B] text-[#0B0E11]'
                                        : 'bg-[#2B3139] text-[#848E9C] hover:bg-[#3B4149]'}`}
                                >
                                    {f === 'todos' ? 'Todos' : f}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#2B3139] bg-[#2B3139]/30">
                                    {['Fecha', 'Tipo de Movimiento', 'Orden', 'Débito', 'Crédito', 'Saldo'].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-[#848E9C] text-[10px] uppercase font-bold tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {movFiltrados.map((mov, i) => (
                                    <tr key={i} className="border-b border-[#2B3139]/50 hover:bg-[#2B3139]/20 transition-colors">
                                        <td className="px-4 py-3 text-[#848E9C] text-xs">{mov.fecha}</td>
                                        <td className="px-4 py-3">
                                            <Badge className={`${TIPO_COLOR[mov.tipo] || 'bg-[#2B3139] text-[#848E9C]'} text-xs`}>
                                                {mov.tipo}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-[#848E9C] text-xs font-mono">{mov.orden}</td>
                                        <td className="px-4 py-3 text-right font-mono text-sm">
                                            {mov.debito > 0
                                                ? <span className="flex items-center gap-1 text-[#F6465D]"><TrendingDown className="w-3 h-3" />{COP(mov.debito)}</span>
                                                : <span className="text-[#2B3139]">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-sm">
                                            {mov.credito > 0
                                                ? <span className="flex items-center gap-1 text-[#0ECB81]"><TrendingUp className="w-3 h-3" />{COP(mov.credito)}</span>
                                                : <span className="text-[#2B3139]">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-[#F0B90B] font-mono text-sm">{COP(mov.saldo)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-[#F0B90B]/30 bg-[#2B3139]/20">
                                    <td colSpan={3} className="px-4 py-3 font-bold text-[#EAECEF] text-xs uppercase">TOTALES DEL PERÍODO</td>
                                    <td className="px-4 py-3 text-right font-bold text-[#F6465D] font-mono">{COP(movFiltrados.reduce((s, m) => s + m.debito, 0))}</td>
                                    <td className="px-4 py-3 text-right font-bold text-[#0ECB81] font-mono">{COP(movFiltrados.reduce((s, m) => s + m.credito, 0))}</td>
                                    <td className="px-4 py-3 text-right font-bold text-[#F0B90B] font-mono">{COP(saldoActual)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
