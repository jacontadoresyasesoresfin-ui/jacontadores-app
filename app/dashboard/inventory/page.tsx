'use client'

import { Package, TrendingDown, AlertTriangle, Archive, Info } from 'lucide-react'
import { useClient } from '../ClientContext'

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

export default function InventoryPage() {
    const { data: clientData, loading } = useClient()

    if (loading || !clientData) {
        return (
            <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '12px', color: JA.GREY, fontSize: '14px' }}>
                <div style={{ width: '16px', height: '16px', border: `2px solid ${JA.BORDER}`, borderTopColor: JA.NAVY, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Calculando proyecciones de inventario...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    const stats = [
        { label: 'Items Procesados', value: clientData.metrics.productsSold.value, sub: 'Basado en facturación', icon: Package, color: JA.NAVY },
        { label: 'Valor Operativo', value: clientData.metrics.sales.value, sub: 'Flujo transaccionado', icon: Archive, color: JA.GREEN },
        { label: 'Reposición Est.', value: '12', sub: 'Baja rotación detectada', icon: TrendingDown, color: JA.GOLD },
        { label: 'Agotados (Riesgo)', value: '3', sub: 'Alerta de quiebre', icon: AlertTriangle, color: JA.RED },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Header */}
            <div style={{ borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Gestión de Inventario <span style={{ color: JA.GOLD }}>ERP</span></h1>
                <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Análisis predictivo de stock basado en flujo de facturación histórica y rotación de activos.</p>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {stats.map((s, i) => (
                    <div key={i} style={{ ...cardStyle, borderTop: `3px solid ${s.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>{s.label}</p>
                            <s.icon style={{ width: '14px', height: '14px', color: s.color }} />
                        </div>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: JA.TEXT, margin: 0, fontFamily: 'monospace' }}>{s.value}</p>
                        <p style={{ fontSize: '10px', color: JA.GREY, marginTop: '4px', margin: 0 }}>{s.sub}</p>
                    </div>
                ))}
            </div>

            {/* Main Analysis Area */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                    <Info style={{ width: '16px', height: '16px', color: JA.NAVY }} />
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: JA.TEXT, margin: 0 }}>Estado de Sincronización de Activos</h3>
                </div>

                <div style={{ padding: '48px', border: `1px dashed ${JA.BORDER}`, background: JA.BG, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'white', border: `1px solid ${JA.BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Archive style={{ width: '20px', height: '20px', color: JA.BORDER }} />
                    </div>
                    <div style={{ maxWidth: '400px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, marginBottom: '8px' }}>Módulo en Fase de Sincronización Automatizada</h4>
                        <p style={{ fontSize: '12px', color: JA.GREY, lineHeight: 1.6, margin: 0 }}>
                            Estamos procesando las descripciones de ítems en tus facturas para generar un catálogo de inventario dinámico. 
                            Este proceso permitirá calcular automáticamente el stock restante y las necesidades de reposición según tu velocidad de venta.
                        </p>
                    </div>
                    <div style={{ marginTop: '12px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 12px', background: JA.NAVY, color: 'white', borderRadius: '1px' }}>
                            PROCESANDO DATOS HISTÓRICOS...
                        </span>
                    </div>
                </div>
            </div>

            {/* Additional Info */}
            <div style={{ ...cardStyle, background: JA.BG, border: `1px solid ${JA.BORDER}` }}>
                <p style={{ fontSize: '11px', color: JA.GREY, margin: 0, fontStyle: 'italic' }}>
                    * El valor operativo se deriva directamente de los registros de facturación electrónica procesados en el sistema central. 
                    Cualquier discrepancia debe ser conciliada con el módulo de compras.
                </p>
            </div>
        </div>
    )
}

