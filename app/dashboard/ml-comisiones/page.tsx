'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { Percent, DollarSign, Package, Megaphone, Warehouse, MoreHorizontal, TrendingDown } from 'lucide-react'

const COP = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`
const PCT = (n: number) => `${n.toFixed(1)}%`

const TOOLTIP_STYLE = {
    contentStyle: { backgroundColor: '#141720', border: '1px solid #2B3139', borderRadius: '10px', color: '#EAECEF', fontSize: '12px' },
    cursor: { fill: 'rgba(255,255,255,0.03)' }
}

// Datos de demostración de comisiones
const COMISIONES_PRODUCTO = [
    { producto: 'Auriculares Bluetooth Pro', ventas: 1850000, comisionVenta: 222000, envio: 90000, publicidad: 45000, total: 357000, pct: 19.3 },
    { producto: 'Teclado Mecánico RGB', ventas: 2400000, comisionVenta: 288000, envio: 120000, publicidad: 60000, total: 468000, pct: 19.5 },
    { producto: 'Mouse Inalámbrico 2.4G', ventas: 960000, comisionVenta: 115200, envio: 48000, publicidad: 24000, total: 187200, pct: 19.5 },
    { producto: 'Webcam HD 1080p', ventas: 1680000, comisionVenta: 201600, envio: 84000, publicidad: 42000, total: 327600, pct: 19.5 },
    { producto: 'Cable USB-C 2m', ventas: 420000, comisionVenta: 50400, envio: 21000, publicidad: 0, total: 71400, pct: 17.0 },
    { producto: 'Hub USB 7 puertos', ventas: 780000, comisionVenta: 93600, envio: 39000, publicidad: 15000, total: 147600, pct: 18.9 },
]

const COMISIONES_MES = [
    { mes: 'Oct', comision: 820000, envio: 210000, publicidad: 95000, full: 45000 },
    { mes: 'Nov', comision: 950000, envio: 245000, publicidad: 110000, full: 52000 },
    { mes: 'Dic', comision: 1320000, envio: 340000, publicidad: 155000, full: 72000 },
    { mes: 'Ene', comision: 875000, envio: 225000, publicidad: 105000, full: 49000 },
    { mes: 'Feb', comision: 920000, envio: 238000, publicidad: 112000, full: 53000 },
    { mes: 'Mar', comision: 1050000, envio: 270000, publicidad: 130000, full: 61000 },
]

const TIPO_CARGO = [
    { tipo: 'Comisión por venta', icon: DollarSign, color: '#F0B90B', total: 1569600, pct: 12.0 },
    { tipo: 'Cargo por envío ML', icon: Package, color: '#0ECB81', total: 402000, pct: 3.1 },
    { tipo: 'Publicidad ML', icon: Megaphone, color: '#5B8DEF', total: 186000, pct: 1.4 },
    { tipo: 'Almacenamiento Full', icon: Warehouse, color: '#9B59B6', total: 61000, pct: 0.5 },
    { tipo: 'Otros cargos', icon: MoreHorizontal, color: '#F6465D', total: 23400, pct: 0.2 },
]

const PIE_DATA = TIPO_CARGO.map(t => ({ name: t.tipo, value: t.total }))
const PIE_COLORS = ['#F0B90B', '#0ECB81', '#5B8DEF', '#9B59B6', '#F6465D']
const AXIS_STYLE = { fill: '#848E9C', fontSize: 11 }

export default function ComisionesPage() {
    const [vista, setVista] = useState<'producto' | 'mes'>('mes')

    const totalComisiones = TIPO_CARGO.reduce((s, t) => s + t.total, 0)
    const totalVentas = COMISIONES_PRODUCTO.reduce((s, p) => s + p.ventas, 0)
    const pctTotal = ((totalComisiones / totalVentas) * 100).toFixed(1)

    return (
        <div className="space-y-6 pb-10 font-sans animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[#EAECEF]">
                    Comisiones <span className="text-[#FFE600]">Mercado Libre</span>
                </h1>
                <p className="text-[#848E9C] text-sm mt-1">
                    Desglose de lo que cobra ML — período actual
                </p>
            </div>

            {/* KPIs globales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Comisiones', value: COP(totalComisiones), color: '#F6465D', icon: TrendingDown },
                    { label: 'Comisión / Ventas', value: PCT(parseFloat(pctTotal)), color: '#F0B90B', icon: Percent },
                    { label: 'Comisión por Venta', value: COP(TIPO_CARGO[0].total), color: '#F0B90B', icon: DollarSign },
                    { label: 'Envíos Pagados', value: COP(TIPO_CARGO[1].total), color: '#0ECB81', icon: Package },
                ].map((kpi, i) => (
                    <Card key={i} className="bg-[#1E2329] border-[#2B3139]">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                                <p className="text-[#848E9C] text-[10px] uppercase font-bold tracking-wider">{kpi.label}</p>
                            </div>
                            <p className="font-black text-lg" style={{ color: kpi.color }}>{kpi.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tipos de cargo + Pie */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                <Card className="lg:col-span-3 bg-[#1E2329] border-[#2B3139]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[#EAECEF] text-sm">Tipos de Cargo Mercado Libre</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {TIPO_CARGO.map((t, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-[#0B0E11]/50 rounded-xl border border-[#2B3139]">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${t.color}15` }}>
                                    <t.icon className="w-5 h-5" style={{ color: t.color }} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[#EAECEF] text-sm font-medium">{t.tipo}</p>
                                    <div className="w-full bg-[#2B3139] rounded-full h-1.5 mt-1.5">
                                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${(t.total / totalComisiones) * 100}%`, backgroundColor: t.color }} />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold" style={{ color: t.color }}>{COP(t.total)}</p>
                                    <p className="text-[#848E9C] text-[10px]">{PCT(t.pct)} de ventas</p>
                                </div>
                            </div>
                        ))}
                        <div className="flex justify-between p-3 bg-[#F6465D]/5 border border-[#F6465D]/20 rounded-xl">
                            <span className="text-[#EAECEF] font-bold text-sm">TOTAL ML cobra este mes</span>
                            <span className="text-[#F6465D] font-black text-sm">{COP(totalComisiones)}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 bg-[#1E2329] border-[#2B3139]">
                    <CardHeader className="pb-1">
                        <CardTitle className="text-[#EAECEF] text-sm">Distribución de Cargos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie data={PIE_DATA} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>
                                    {PIE_DATA.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                                </Pie>
                                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [COP(v as number), '']} />
                                <Legend wrapperStyle={{ fontSize: '10px' }} formatter={(v) => <span style={{ color: '#EAECEF' }}>{v}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Evolución mensual */}
            <Card className="bg-[#1E2329] border-[#2B3139]">
                <CardHeader className="pb-1 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-[#EAECEF] text-sm">Evolución de Comisiones</CardTitle>
                        <p className="text-[#848E9C] text-[10px] mt-0.5">Últimos 6 meses · COP</p>
                    </div>
                    <div className="flex gap-2">
                        {(['mes', 'producto'] as const).map(v => (
                            <button key={v} onClick={() => setVista(v)}
                                className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${vista === v ? 'bg-[#F0B90B] text-[#0B0E11]' : 'bg-[#2B3139] text-[#848E9C]'}`}>
                                {v === 'mes' ? 'Por Mes' : 'Por Producto'}
                            </button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent>
                    {vista === 'mes' ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={COMISIONES_MES} barGap={3} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" vertical={false} />
                                <XAxis dataKey="mes" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`} width={48} />
                                <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown, name: unknown) => [COP(v as number), String(name)]} />
                                <Legend wrapperStyle={{ fontSize: '10px' }} formatter={(v) => <span style={{ color: '#EAECEF' }}>{v}</span>} />
                                <Bar dataKey="comision" name="Comisión Venta" fill="#F0B90B" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                <Bar dataKey="envio" name="Envíos" fill="#0ECB81" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                <Bar dataKey="publicidad" name="Publicidad" fill="#5B8DEF" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                <Bar dataKey="full" name="Full ML" fill="#9B59B6" radius={[4, 4, 0, 0]} maxBarSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-[#2B3139]">
                                        {['Producto', 'Ventas', 'Comisión Venta', 'Costo Envío', 'Publicidad', 'Total ML', '% Ventas'].map(h => (
                                            <th key={h} className="text-left px-3 py-2 text-[#848E9C] uppercase font-bold tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#2B3139]/60">
                                    {COMISIONES_PRODUCTO.map((p, i) => (
                                        <tr key={i} className="hover:bg-[#2B3139]/20 transition-colors">
                                            <td className="px-3 py-2.5 text-[#EAECEF] font-medium max-w-[180px] truncate">{p.producto}</td>
                                            <td className="px-3 py-2.5 text-[#848E9C] font-mono">{COP(p.ventas)}</td>
                                            <td className="px-3 py-2.5 text-[#F0B90B] font-mono">{COP(p.comisionVenta)}</td>
                                            <td className="px-3 py-2.5 text-[#0ECB81] font-mono">{COP(p.envio)}</td>
                                            <td className="px-3 py-2.5 text-[#5B8DEF] font-mono">{COP(p.publicidad)}</td>
                                            <td className="px-3 py-2.5 text-[#F6465D] font-bold font-mono">{COP(p.total)}</td>
                                            <td className="px-3 py-2.5">
                                                <Badge className={`${p.pct > 20 ? 'bg-[#F6465D]/10 text-[#F6465D]' : 'bg-[#F0B90B]/10 text-[#F0B90B]'}`}>
                                                    {PCT(p.pct)}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
