'use client'

import { useState } from 'react'
import { Package, Plus, Save, Trash2, DollarSign, TrendingUp, Percent, Calculator, Info, Edit3 } from 'lucide-react'

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

const inputStyle = {
    background: JA.BG,
    border: `1px solid ${JA.BORDER}`,
    borderRadius: '1px',
    padding: '4px 8px',
    fontSize: '11px',
    color: JA.TEXT,
    width: '100%',
    fontFamily: 'monospace',
    outline: 'none'
}

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Estructura de <span style={{ color: JA.GOLD }}>Costos Unitarios</span></h1>
                    <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Cálculo técnico de margen de contribución y punto de equilibrio por SKU.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {guardado && <span style={{ fontSize: '11px', fontWeight: 700, color: JA.GREEN }}>✓ DATOS ACTUALIZADOS</span>}
                    <button onClick={handleNew} style={{
                        padding: '8px 16px', fontSize: '11px', fontWeight: 700, background: JA.NAVY, color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        <Plus style={{ width: '14px', height: '14px' }} /> REGISTRAR PRODUCTO
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {[
                    { label: 'Mayor Eficiencia (Margen)', value: mejorProducto ? PCT(calcularUtilidad(mejorProducto).margen) : '0%', color: JA.GREEN, sub: mejorProducto?.nombre },
                    { label: 'Menor Eficiencia (Margen)', value: peorProducto ? PCT(calcularUtilidad(peorProducto).margen) : '0%', color: JA.RED, sub: peorProducto?.nombre },
                    { label: 'Promedio Portafolio', value: PCT(stats.reduce((s, v) => s + v.margen, 0) / stats.length), color: JA.GOLD, sub: 'Margen Global Est.' },
                ].map((kpi, i) => (
                    <div key={i} style={{ ...cardStyle, borderLeft: `4px solid ${kpi.color}` }}>
                        <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>{kpi.label}</p>
                        <p style={{ fontSize: '20px', fontWeight: 800, color: JA.TEXT, margin: '4px 0', fontFamily: 'monospace' }}>{kpi.value}</p>
                        <p style={{ fontSize: '10px', color: JA.GREY_LT, margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* Main Editor Table */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Matriz de Rentabilidad Directa</h3>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: JA.GREY, fontStyle: 'italic' }}>* Todos los valores en COP</span>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ background: JA.BG, textAlign: 'left', borderBottom: `2px solid ${JA.BORDER}` }}>
                                <th style={{ padding: '12px' }}>PRODUCTO / SKU</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>COSTO COMPRA</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>EMPAQUE</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>OTROS</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>PRECIO VENTA</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>COMISIÓN ML</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>ENVÍO</th>
                                <th style={{ padding: '12px', textAlign: 'right' }}>UTILIDAD</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>% MARGEN</th>
                                <th style={{ padding: '12px', textAlign: 'center' }}>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productos.map((p) => {
                                const { utilidad, margen } = calcularUtilidad(p)
                                const isEditing = editando === p.id
                                return (
                                    <tr key={p.id} style={{ borderBottom: `1px solid ${JA.BG}`, background: isEditing ? JA.BG : 'transparent' }}>
                                        <td style={{ padding: '12px' }}>
                                            {isEditing ? (
                                                <input value={formData.nombre || ''} onChange={e => setFormData(f => ({ ...f, nombre: e.target.value }))} style={{ ...inputStyle, fontFamily: 'sans-serif', fontWeight: 600 }} />
                                            ) : (
                                                <div>
                                                    <div style={{ fontWeight: 700, color: JA.TEXT }}>{p.nombre}</div>
                                                    <div style={{ fontSize: '9px', color: JA.GREY_LT, fontFamily: 'monospace' }}>{p.sku}</div>
                                                </div>
                                            )}
                                        </td>
                                        {(['costoCompra', 'costoEmpaque', 'otrosCostos', 'precioVenta', 'comisionML', 'costoEnvio'] as (keyof CostoProducto)[]).map(field => (
                                            <td key={field} style={{ padding: '12px', textAlign: 'right' }}>
                                                {isEditing ? (
                                                    <input type="number" value={(formData[field] as number) || 0} onChange={e => setFormData(f => ({ ...f, [field]: Number(e.target.value) }))} style={{ ...inputStyle, textAlign: 'right' }} />
                                                ) : (
                                                    <span style={{ fontFamily: 'monospace', color: JA.GREY }}>{COP(p[field] as number)}</span>
                                                )}
                                            </td>
                                        ))}
                                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: utilidad >= 0 ? JA.GREEN : JA.RED, fontFamily: 'monospace' }}>
                                            {COP(utilidad)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span style={{ 
                                                padding: '2px 8px', borderRadius: '1px', fontSize: '10px', fontWeight: 800,
                                                background: margen < 10 ? JA.RED + '15' : margen < 20 ? JA.GOLD + '15' : JA.GREEN + '15',
                                                color: margen < 10 ? JA.RED : margen < 20 ? JA.GOLD : JA.GREEN
                                            }}>
                                                {PCT(margen)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                {isEditing ? (
                                                    <button onClick={handleSave} style={{ background: JA.NAVY, color: 'white', border: 'none', padding: '4px', cursor: 'pointer', borderRadius: '1px' }}><Save style={{ width: '14px', height: '14px' }} /></button>
                                                ) : (
                                                    <button onClick={() => handleEdit(p)} style={{ background: JA.BG, color: JA.NAVY, border: `1px solid ${JA.BORDER}`, padding: '4px', cursor: 'pointer', borderRadius: '1px' }}><Edit3 style={{ width: '14px', height: '14px' }} /></button>
                                                )}
                                                <button onClick={() => handleDelete(p.id)} style={{ background: JA.BG, color: JA.RED, border: `1px solid ${JA.BORDER}`, padding: '4px', cursor: 'pointer', borderRadius: '1px' }}><Trash2 style={{ width: '14px', height: '14px' }} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Formula Legend */}
            <div style={{ ...cardStyle, background: JA.NAVY, border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Calculator style={{ width: '18px', height: '18px', color: JA.GOLD }} />
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'white', margin: 0 }}>Algoritmo de Cálculo de Rentabilidad Real</h3>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {[
                        { label: 'Precio Bruto', color: JA.GREEN },
                        { label: '-', color: 'white' },
                        { label: 'Costo Adquisición', color: JA.RED },
                        { label: '-', color: 'white' },
                        { label: 'Empaque/Insumos', color: JA.RED },
                        { label: '-', color: 'white' },
                        { label: 'Comisiones ML', color: JA.RED },
                        { label: '-', color: 'white' },
                        { label: 'Envío/Flete', color: JA.RED },
                        { label: '=', color: JA.GOLD },
                        { label: 'UTILIDAD NETA', color: JA.GOLD, bold: true },
                    ].map((step, i) => (
                        <div key={i} style={{ 
                            padding: step.label.length > 1 ? '6px 12px' : '0', 
                            background: step.label.length > 1 ? 'rgba(255,255,255,0.05)' : 'transparent',
                            color: step.color, fontSize: '11px', fontWeight: step.bold ? 800 : 600,
                            borderRadius: '1px', border: step.label.length > 1 ? `1px solid rgba(255,255,255,0.1)` : 'none'
                        }}>
                            {step.label.toUpperCase()}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ ...cardStyle, background: JA.BG, display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Info style={{ width: '16px', height: '16px', color: JA.GREY }} />
                <p style={{ fontSize: '10px', color: JA.GREY, margin: 0, fontStyle: 'italic' }}>
                    * El cálculo del margen no contempla costos fijos (arriendos, salarios) ni impuestos sobre la renta. 
                    Se recomienda un margen superior al 15% para absorber devoluciones y garantías no previstas.
                </p>
            </div>
        </div>
    )
}
