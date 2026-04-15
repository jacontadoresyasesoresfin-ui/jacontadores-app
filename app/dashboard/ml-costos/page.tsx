'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Package, Plus, Save, Trash2, DollarSign, TrendingUp, Percent } from 'lucide-react'

const COP = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`
const PCT = (n: number) => `${n.toFixed(1)}%`

interface CostoProducto {
    id: number
    nombre: string
    sku: string
    costoCompra: number
    costoEmpaque: number
    otrosCostos: number
    precioVenta: number
    comisionML: number
    costoEnvio: number
}

const PRODUCTOS_INICIALES: CostoProducto[] = [
    { id: 1, nombre: 'Auriculares Bluetooth Pro', sku: 'ABP-001', costoCompra: 75000, costoEmpaque: 5000, otrosCostos: 3000, precioVenta: 185000, comisionML: 22200, costoEnvio: 18000 },
    { id: 2, nombre: 'Teclado Mecánico RGB', sku: 'TMR-002', costoCompra: 130000, costoEmpaque: 8000, otrosCostos: 5000, precioVenta: 320000, comisionML: 38400, costoEnvio: 25000 },
    { id: 3, nombre: 'Mouse Inalámbrico 2.4G', sku: 'MI-003', costoCompra: 42000, costoEmpaque: 4000, otrosCostos: 2000, precioVenta: 96000, comisionML: 11520, costoEnvio: 12000 },
    { id: 4, nombre: 'Webcam HD 1080p', sku: 'WHD-004', costoCompra: 90000, costoEmpaque: 6000, otrosCostos: 4000, precioVenta: 210000, comisionML: 25200, costoEnvio: 20000 },
    { id: 5, nombre: 'Cable USB-C 2m', sku: 'UC-005', costoCompra: 12000, costoEmpaque: 2000, otrosCostos: 1000, precioVenta: 42000, comisionML: 5040, costoEnvio: 8000 },
    { id: 6, nombre: 'Hub USB 7 puertos', sku: 'HUB-006', costoCompra: 55000, costoEmpaque: 5000, otrosCostos: 3000, precioVenta: 130000, comisionML: 15600, costoEnvio: 15000 },
]

function calcularUtilidad(p: CostoProducto) {
    const costoTotal = p.costoCompra + p.costoEmpaque + p.otrosCostos
    const utilidad = p.precioVenta - p.comisionML - p.costoEnvio - costoTotal
    const margen = (utilidad / p.precioVenta) * 100
    return { costoTotal, utilidad, margen }
}

export default function CostosProductoPage() {
    const [productos, setProductos] = useState<CostoProducto[]>(PRODUCTOS_INICIALES)
    const [editando, setEditando] = useState<number | null>(null)
    const [formData, setFormData] = useState<Partial<CostoProducto>>({})
    const [guardado, setGuardado] = useState(false)

    const handleEdit = (p: CostoProducto) => {
        setEditando(p.id)
        setFormData({ ...p })
    }

    const handleSave = () => {
        if (editando && formData) {
            setProductos(prev => prev.map(p => p.id === editando ? { ...p, ...formData } as CostoProducto : p))
            setEditando(null)
            setFormData({})
            setGuardado(true)
            setTimeout(() => setGuardado(false), 2000)
        }
    }

    const handleNew = () => {
        const newId = Math.max(...productos.map(p => p.id)) + 1
        const newProd: CostoProducto = { id: newId, nombre: 'Nuevo Producto', sku: `SKU-${newId}`, costoCompra: 0, costoEmpaque: 0, otrosCostos: 0, precioVenta: 0, comisionML: 0, costoEnvio: 0 }
        setProductos(prev => [...prev, newProd])
        handleEdit(newProd)
    }

    const handleDelete = (id: number) => {
        setProductos(prev => prev.filter(p => p.id !== id))
    }

    const stats = productos.map(p => calcularUtilidad(p))
    const mejorProducto = productos[stats.indexOf(stats.reduce((best, s) => s.margen > best.margen ? s : best, stats[0]))]
    const peorProducto = productos[stats.indexOf(stats.reduce((worst, s) => s.margen < worst.margen ? s : worst, stats[0]))]

    return (
        <div className="space-y-6 pb-10 font-sans animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#EAECEF]">
                        Costos del <span className="text-[#F0B90B]">Producto</span>
                    </h1>
                    <p className="text-[#848E9C] text-sm mt-1">Ingresa los costos reales para calcular tu utilidad verdadera</p>
                </div>
                <div className="flex gap-2">
                    {guardado && <span className="px-3 py-2 bg-[#0ECB81]/10 text-[#0ECB81] text-sm rounded-lg">✓ Guardado</span>}
                    <Button onClick={handleNew} className="bg-[#F0B90B] hover:bg-[#F0B90B]/80 text-[#0B0E11] font-bold">
                        <Plus className="w-4 h-4 mr-2" /> Agregar Producto
                    </Button>
                </div>
            </div>

            {/* Resumen rápido */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-[#1E2329] border-[#2B3139] border-l-4 border-l-[#0ECB81]">
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-[#0ECB81]" /><p className="text-[#848E9C] text-xs uppercase font-bold">Mayor Margen</p></div>
                        <p className="text-[#EAECEF] font-bold text-sm">{mejorProducto?.nombre}</p>
                        <p className="text-[#0ECB81] font-black">{mejorProducto ? PCT(calcularUtilidad(mejorProducto).margen) : '—'}</p>
                    </CardContent>
                </Card>
                <Card className="bg-[#1E2329] border-[#2B3139] border-l-4 border-l-[#F6465D]">
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-[#F6465D]" /><p className="text-[#848E9C] text-xs uppercase font-bold">Menor Margen</p></div>
                        <p className="text-[#EAECEF] font-bold text-sm">{peorProducto?.nombre}</p>
                        <p className={`font-black ${calcularUtilidad(peorProducto).margen < 0 ? 'text-[#F6465D]' : 'text-[#F0B90B]'}`}>
                            {peorProducto ? PCT(calcularUtilidad(peorProducto).margen) : '—'}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-[#1E2329] border-[#2B3139] border-l-4 border-l-[#F0B90B]">
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 mb-1"><Percent className="w-4 h-4 text-[#F0B90B]" /><p className="text-[#848E9C] text-xs uppercase font-bold">Margen Promedio</p></div>
                        <p className="text-[#F0B90B] font-black text-xl">
                            {PCT(stats.reduce((s, v) => s + v.margen, 0) / stats.length)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla de productos con costos */}
            <Card className="bg-[#1E2329] border-[#2B3139]">
                <CardHeader className="border-b border-[#2B3139]">
                    <CardTitle className="text-[#EAECEF] flex items-center gap-2">
                        <Package className="w-5 h-5 text-[#F0B90B]" />
                        Estructura de Costos por Producto
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-[#2B3139] bg-[#2B3139]/30">
                                    {['Producto', 'SKU', 'Costo Compra', 'Empaque', 'Otros', 'Precio Venta', 'Comisión ML', 'Costo Envío', 'Utilidad', 'Margen', 'Acciones'].map(h => (
                                        <th key={h} className="text-left px-3 py-3 text-[#848E9C] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {productos.map((p) => {
                                    const { utilidad, margen } = calcularUtilidad(p)
                                    const isEditing = editando === p.id
                                    return (
                                        <tr key={p.id} className={`border-b border-[#2B3139]/50 transition-colors ${isEditing ? 'bg-[#F0B90B]/5' : 'hover:bg-[#2B3139]/20'}`}>
                                            <td className="px-3 py-2.5">
                                                {isEditing ? <input value={formData.nombre || ''} onChange={e => setFormData(f => ({ ...f, nombre: e.target.value }))} className="bg-[#0B0E11] border border-[#F0B90B]/30 rounded px-2 py-1 text-[#EAECEF] w-full" /> : <span className="text-[#EAECEF] font-medium">{p.nombre}</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-[#848E9C] font-mono">{p.sku}</td>
                                            {(['costoCompra', 'costoEmpaque', 'otrosCostos', 'precioVenta', 'comisionML', 'costoEnvio'] as (keyof CostoProducto)[]).map(field => (
                                                <td key={field} className="px-3 py-2.5">
                                                    {isEditing ? (
                                                        <input type="number" value={(formData[field] as number) || 0} onChange={e => setFormData(f => ({ ...f, [field]: Number(e.target.value) }))}
                                                            className="bg-[#0B0E11] border border-[#F0B90B]/30 rounded px-2 py-1 text-[#EAECEF] w-24 font-mono" />
                                                    ) : <span className="font-mono text-[#848E9C]">{COP(p[field] as number)}</span>}
                                                </td>
                                            ))}
                                            <td className="px-3 py-2.5 font-bold font-mono" style={{ color: utilidad >= 0 ? '#0ECB81' : '#F6465D' }}>{COP(utilidad)}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${margen < 0 ? 'bg-[#F6465D]/10 text-[#F6465D]' : margen < 15 ? 'bg-[#F0B90B]/10 text-[#F0B90B]' : 'bg-[#0ECB81]/10 text-[#0ECB81]'}`}>
                                                    {PCT(margen)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex gap-1">
                                                    {isEditing ? (
                                                        <button onClick={handleSave} className="p-1.5 bg-[#0ECB81]/10 text-[#0ECB81] rounded hover:bg-[#0ECB81]/20 transition-colors">
                                                            <Save className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => handleEdit(p)} className="p-1.5 bg-[#F0B90B]/10 text-[#F0B90B] rounded hover:bg-[#F0B90B]/20 transition-colors">
                                                            <DollarSign className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleDelete(p.id)} className="p-1.5 bg-[#F6465D]/10 text-[#F6465D] rounded hover:bg-[#F6465D]/20 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Fórmula explicativa */}
            <Card className="bg-[#1E2329] border-[#2B3139] border-l-4 border-l-[#F0B90B]">
                <CardContent className="pt-5">
                    <p className="text-[#848E9C] text-xs uppercase font-bold mb-3">Fórmula de Utilidad Real</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        {[
                            { label: 'Precio Venta', color: '#0ECB81' },
                            { label: '−', color: '#848E9C' },
                            { label: 'Comisión ML', color: '#F6465D' },
                            { label: '−', color: '#848E9C' },
                            { label: 'Costo Envío', color: '#F6465D' },
                            { label: '−', color: '#848E9C' },
                            { label: 'Costo Producto', color: '#F6465D' },
                            { label: '−', color: '#848E9C' },
                            { label: 'Devoluciones', color: '#F6465D' },
                            { label: '=', color: '#848E9C' },
                            { label: 'UTILIDAD REAL', color: '#F0B90B' },
                        ].map((item, i) => (
                            <span key={i} className={`font-bold ${item.label === '=' || item.label === '−' ? 'text-[#848E9C]' : 'px-2 py-1 rounded bg-[#0B0E11]/60'}`} style={{ color: item.color }}>
                                {item.label}
                            </span>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
