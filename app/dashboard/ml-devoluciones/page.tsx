'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, RotateCcw, DollarSign, TrendingDown, MessageSquare } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const COP = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

const TOOLTIP_STYLE = {
    contentStyle: { backgroundColor: '#141720', border: '1px solid #2B3139', borderRadius: '10px', color: '#EAECEF', fontSize: '12px' },
    cursor: { fill: 'rgba(255,255,255,0.03)' }
}

const DEVOLUCIONES = [
    { orden: '#2310450', producto: 'Auriculares Bluetooth Pro', motivo: 'No funciona correctamente', valorReembolsado: 185000, fecha: '2025-02-15', tipo: 'devolución', impactoUtilidad: -75000 },
    { orden: '#2320980', producto: 'Cable USB-C 2m', motivo: 'Descripción no corresponde', valorReembolsado: 42000, fecha: '2025-02-18', tipo: 'devolución', impactoUtilidad: -18000 },
    { orden: '#2325100', producto: 'Teclado Mecánico RGB', motivo: 'Producto dañado en envío', valorReembolsado: 320000, fecha: '2025-02-22', tipo: 'reclamo', impactoUtilidad: -120000 },
    { orden: '#2341200', producto: 'Webcam HD 1080p', motivo: 'Arrepentimiento de compra', valorReembolsado: 210000, fecha: '2025-02-28', tipo: 'devolución', impactoUtilidad: -85000 },
    { orden: '#2356700', producto: 'Hub USB 7 puertos', motivo: 'Producto llega tarde', valorReembolsado: 130000, fecha: '2025-03-03', tipo: 'reclamo', impactoUtilidad: -48000 },
    { orden: '#2371000', producto: 'Mouse Inalámbrico 2.4G', motivo: 'No funciona correctamente', valorReembolsado: 160000, fecha: '2025-03-07', tipo: 'devolución', impactoUtilidad: -65000 },
    { orden: '#2379100', producto: 'Auriculares Bluetooth Pro', motivo: 'Calidad inferior a lo esperado', valorReembolsado: 185000, fecha: '2025-03-09', tipo: 'devolución', impactoUtilidad: -75000 },
]

const MOTIVOS_STATS = [
    { motivo: 'No funciona correctamente', cantidad: 2, valor: 345000 },
    { motivo: 'Descripción no corresponde', cantidad: 1, valor: 42000 },
    { motivo: 'Producto dañado en envío', cantidad: 1, valor: 320000 },
    { motivo: 'Arrepentimiento de compra', cantidad: 1, valor: 210000 },
    { motivo: 'Producto llega tarde', cantidad: 1, valor: 130000 },
    { motivo: 'Calidad inferior', cantidad: 1, valor: 185000 },
]

const AXIS_STYLE = { fill: '#848E9C', fontSize: 11 }

export default function DevolucionesPage() {
    const [filtro, setFiltro] = useState<'todos' | 'devolución' | 'reclamo'>('todos')

    const devolucionesFiltradas = filtro === 'todos' ? DEVOLUCIONES : DEVOLUCIONES.filter(d => d.tipo === filtro)

    const totalDevuelto = DEVOLUCIONES.reduce((s, d) => s + d.valorReembolsado, 0)
    const impactoTotal = DEVOLUCIONES.reduce((s, d) => s + d.impactoUtilidad, 0)
    const cantDevoluaciones = DEVOLUCIONES.filter(d => d.tipo === 'devolución').length
    const cantReclamos = DEVOLUCIONES.filter(d => d.tipo === 'reclamo').length
    const tasaDev = ((DEVOLUCIONES.length / 48) * 100).toFixed(1)

    return (
        <div className="space-y-6 pb-10 font-sans animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[#EAECEF]">
                    Devoluciones y <span className="text-[#F6465D]">Reclamos</span>
                </h1>
                <p className="text-[#848E9C] text-sm mt-1">Impacto financiero y análisis de devoluciones · Período actual</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Devoluciones', value: cantDevoluaciones, suffix: 'unidades', color: '#F0B90B', icon: RotateCcw },
                    { label: 'Reclamos activos', value: cantReclamos, suffix: 'unidades', color: '#F6465D', icon: MessageSquare },
                    { label: 'Dinero devuelto', value: COP(totalDevuelto), suffix: '', color: '#F6465D', icon: DollarSign },
                    { label: 'Impacto utilidad', value: COP(Math.abs(impactoTotal)), suffix: 'pérdida', color: '#F6465D', icon: TrendingDown },
                ].map((kpi, i) => (
                    <Card key={i} className="bg-[#1E2329] border-[#2B3139]">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                                <p className="text-[#848E9C] text-[10px] uppercase font-bold tracking-wider">{kpi.label}</p>
                            </div>
                            <p className="font-black text-xl" style={{ color: kpi.color }}>{kpi.value}</p>
                            {kpi.suffix && <p className="text-[#848E9C] text-xs">{kpi.suffix}</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Alerta de tasa */}
            {parseFloat(tasaDev) > 5 && (
                <div className="flex items-center gap-3 p-4 bg-[#F6465D]/10 border border-[#F6465D]/30 rounded-xl text-[#F6465D]">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <div>
                        <p className="font-bold">⚠ Alta tasa de devoluciones: {tasaDev}%</p>
                        <p className="text-sm opacity-80">Mercado Libre puede suspender publicaciones si supera el 10%. Revisa la calidad del producto y descripción.</p>
                    </div>
                </div>
            )}

            {/* Gráficas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Card className="bg-[#1E2329] border-[#2B3139]">
                    <CardHeader className="pb-1">
                        <CardTitle className="text-[#EAECEF] text-sm">Motivos de Devolución</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={MOTIVOS_STATS} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barSize={10}>
                                <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                                <YAxis type="category" dataKey="motivo" tick={{ ...AXIS_STYLE, fontSize: 9 }} axisLine={false} tickLine={false} width={130} />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [COP(v as number), 'Valor devuelto']} />
                                <Bar dataKey="valor" fill="#F6465D" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-[#1E2329] border-[#2B3139]">
                    <CardHeader className="pb-1">
                        <CardTitle className="text-[#EAECEF] text-sm">Impacto Financiero</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-2">
                        <div className="p-4 bg-[#0B0E11]/60 rounded-xl space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-[#848E9C]">Dinero devuelto a compradores</span>
                                <span className="text-[#F6465D] font-bold">{COP(totalDevuelto)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-[#848E9C]">Comisiones no recuperadas</span>
                                <span className="text-[#F6465D] font-bold">{COP(Math.round(totalDevuelto * 0.12))}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-[#848E9C]">Costos de envío no recuperados</span>
                                <span className="text-[#F6465D] font-bold">{COP(Math.round(totalDevuelto * 0.06))}</span>
                            </div>
                            <div className="border-t border-[#2B3139] pt-2 flex justify-between">
                                <span className="text-[#EAECEF] font-bold">Pérdida total estimada</span>
                                <span className="text-[#F6465D] font-black">{COP(Math.abs(impactoTotal))}</span>
                            </div>
                        </div>
                        <div className="p-3 bg-[#F0B90B]/5 border border-[#F0B90B]/20 rounded-lg text-[10px] text-[#848E9C]">
                            <p className="text-[#F0B90B] font-bold mb-1">💡 Sugerencia</p>
                            <p>Mejora las fotos y descripción de &quot;Auriculares Bluetooth Pro&quot; — tiene 2 devoluciones por insatisfacción. Revisa la calidad antes del envío.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla de devoluciones */}
            <Card className="bg-[#1E2329] border-[#2B3139]">
                <CardHeader className="border-b border-[#2B3139]">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <CardTitle className="text-[#EAECEF] flex items-center gap-2">
                            <RotateCcw className="w-5 h-5 text-[#F6465D]" />
                            Detalle de Devoluciones y Reclamos
                        </CardTitle>
                        <div className="flex gap-2">
                            {(['todos', 'devolución', 'reclamo'] as const).map(f => (
                                <button key={f} onClick={() => setFiltro(f)}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all capitalize ${filtro === f ? 'bg-[#F6465D] text-white' : 'bg-[#2B3139] text-[#848E9C] hover:bg-[#3B4149]'}`}>
                                    {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
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
                                    {['Orden', 'Producto', 'Motivo', 'Tipo', 'Valor Reembolsado', 'Impacto Utilidad', 'Fecha'].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-[#848E9C] text-[10px] uppercase font-bold tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {devolucionesFiltradas.map((d, i) => (
                                    <tr key={i} className="border-b border-[#2B3139]/50 hover:bg-[#2B3139]/20 transition-colors">
                                        <td className="px-4 py-3 text-[#848E9C] text-xs font-mono">{d.orden}</td>
                                        <td className="px-4 py-3 text-[#EAECEF] text-xs font-medium max-w-[160px] truncate">{d.producto}</td>
                                        <td className="px-4 py-3 text-[#848E9C] text-xs max-w-[180px] truncate">{d.motivo}</td>
                                        <td className="px-4 py-3">
                                            <Badge className={d.tipo === 'reclamo' ? 'bg-[#F6465D]/10 text-[#F6465D]' : 'bg-[#F0B90B]/10 text-[#F0B90B]'}>
                                                {d.tipo}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-[#F6465D] font-mono text-xs">{COP(d.valorReembolsado)}</td>
                                        <td className="px-4 py-3 text-right font-bold text-[#F6465D] font-mono text-xs">{COP(Math.abs(d.impactoUtilidad))}</td>
                                        <td className="px-4 py-3 text-[#848E9C] text-xs">{d.fecha}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
