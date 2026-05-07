'use client'

import Link from 'next/link'
import { AlertTriangle, TrendingDown, TrendingUp, RotateCcw, Receipt, Bell, CheckCircle, XCircle, ExternalLink, Info, AlertCircle } from 'lucide-react'

const JA = {
    NAVY:    '#13213C',
    GOLD:    '#B8960C',
    TEXT:    '#1C2B45',
    GREY:    '#4B5563',
    GREY_LT: '#9CA3AF',
    BORDER:  '#E5E7EB',
    BG:      '#F8FAFC',
    GREEN:   '#10B981',
    RED:     '#EF4444',
    BLUE:    '#3B82F6'
}

const cardStyle = {
    background: '#FFFFFF',
    border: `1px solid ${JA.BORDER}`,
    borderRadius: '2px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    padding: '20px',
}

const IVA_ACUMULADO = 45800000
const IVA_UMBRAL = 92000000
const COMISIONES_PCT = 22.4
const DEVOLUCIONES_PCT = 8.5
const TENDENCIA_UTILIDAD = -12
const MES_DECLARACION = true

const RUTAS_ACCION: Record<string, string> = {
    'iva-umbral': '/dashboard/taxes',
    'comisiones-altas': '/dashboard/ml-comisiones',
    'devoluciones-altas': '/dashboard/ml-devoluciones',
    'utilidad-bajando': '/dashboard/ml-costos',
    'declaracion-impuestos': '/dashboard/taxes',
    'reputacion-ok': '/dashboard/ecommerce',
    'full-disponible': '/dashboard/ecommerce',
}

interface Alerta {
    id: string
    tipo: 'warning' | 'danger' | 'info' | 'success'
    titulo: string
    descripcion: string
    valor?: string
    activa: boolean
    accion?: string
}

const ALERTAS: Alerta[] = [
    {
        id: 'iva-umbral',
        tipo: 'warning',
        titulo: 'Umbral de Responsabilidad IVA',
        descripcion: `Tus ingresos acumulados son ${(IVA_ACUMULADO / 1000000).toFixed(1)}M COP. El umbral para ser responsable de IVA es aproximadamente ${(IVA_UMBRAL / 1000000).toFixed(0)}M COP.`,
        valor: `${((IVA_ACUMULADO / IVA_UMBRAL) * 100).toFixed(0)}% DEL TOPE`,
        activa: IVA_ACUMULADO > IVA_UMBRAL * 0.8,
        accion: 'GESTIONAR IMPUESTOS'
    },
    {
        id: 'comisiones-altas',
        tipo: 'danger',
        titulo: 'Exceso de Comisiones de Plataforma',
        descripcion: `Las comisiones de Mercado Libre representan el ${COMISIONES_PCT}% de tus ventas brutas. El estándar corporativo es mantener este indicador bajo el 20%.`,
        valor: `${COMISIONES_PCT}% COMISIÓN`,
        activa: COMISIONES_PCT > 20,
        accion: 'AUDITAR COMISIONES'
    },
    {
        id: 'devoluciones-altas',
        tipo: 'danger',
        titulo: 'Tasa de Devolución Crítica',
        descripcion: `Tu tasa de devoluciones es del ${DEVOLUCIONES_PCT}%. Existe riesgo inminente de penalización en el posicionamiento de tus publicaciones.`,
        valor: `${DEVOLUCIONES_PCT}% DEVOLUCIÓN`,
        activa: DEVOLUCIONES_PCT > 5,
        accion: 'REVISAR RECLAMOS'
    },
    {
        id: 'utilidad-bajando',
        tipo: 'warning',
        titulo: 'Contracción de Margen Neto',
        descripcion: `Tu utilidad real cayó un ${Math.abs(TENDENCIA_UTILIDAD)}% comparado con el mes anterior. Se requiere auditoría de costos unitarios.`,
        valor: `${TENDENCIA_UTILIDAD}% VS ANTERIOR`,
        activa: TENDENCIA_UTILIDAD < -5,
        accion: 'AUDITAR COSTOS'
    },
    {
        id: 'declaracion-impuestos',
        tipo: 'info',
        titulo: 'Vencimiento Tributario Próximo',
        descripcion: 'Según el calendario DIAN 2025, tienes obligaciones tributarias próximas de IVA y ReteFuente.',
        valor: 'VENCE: 15 MAR',
        activa: MES_DECLARACION,
        accion: 'VER CALENDARIO'
    },
    {
        id: 'reputacion-ok',
        tipo: 'success',
        titulo: 'Estado de Reputación: Óptimo',
        descripcion: 'Tu nivel de reputación corporativa en Mercado Libre se mantiene en verde. Continúa con los estándares actuales.',
        valor: 'NIVEL: VERDE',
        activa: true,
        accion: 'VER MÉTRICAS'
    },
]

const TIPO_CONFIG = {
    danger: { color: JA.RED, icon: XCircle, bg: JA.RED + '08', border: JA.RED + '20' },
    warning: { color: JA.GOLD, icon: AlertTriangle, bg: JA.GOLD + '08', border: JA.GOLD + '20' },
    info: { color: JA.BLUE, icon: Bell, bg: JA.BLUE + '08', border: JA.BLUE + '20' },
    success: { color: JA.GREEN, icon: CheckCircle, bg: JA.GREEN + '08', border: JA.GREEN + '20' },
}

const KPI_ALERTAS = [
    { label: 'Alertas Críticas', value: ALERTAS.filter(a => a.tipo === 'danger' && a.activa).length, color: JA.RED, icon: XCircle },
    { label: 'Advertencias', value: ALERTAS.filter(a => a.tipo === 'warning' && a.activa).length, color: JA.GOLD, icon: AlertTriangle },
    { label: 'Informativas', value: ALERTAS.filter(a => a.tipo === 'info' && a.activa).length, color: JA.BLUE, icon: Bell },
    { label: 'Estado Salud', value: ALERTAS.filter(a => a.tipo === 'success' && a.activa).length, color: JA.GREEN, icon: CheckCircle },
]

const COP_M = (n: number) => `$${(n / 1000000).toFixed(1)}M`

export default function AlertasPage() {
    const alertasActivas = ALERTAS.filter(a => a.activa)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Centro de <span style={{ color: JA.GOLD }}>Control de Riesgos</span></h1>
                    <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Monitoreo preventivo de métricas de cumplimiento y rentabilidad operativa.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{
                        padding: '8px 16px', fontSize: '11px', fontWeight: 700, border: `1px solid ${JA.BORDER}`,
                        background: 'white', color: JA.TEXT, borderRadius: '2px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        <Info style={{ width: '14px', height: '14px', color: JA.GOLD }} />
                        REPORTE DE INCIDENCIAS
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {KPI_ALERTAS.map((kpi, i) => (
                    <div key={i} style={{ ...cardStyle, borderLeft: `4px solid ${kpi.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', margin: 0 }}>{kpi.label}</p>
                            <kpi.icon style={{ width: '12px', height: '12px', color: kpi.color }} />
                        </div>
                        <p style={{ fontSize: '24px', fontWeight: 800, color: JA.TEXT, margin: 0, fontFamily: 'monospace' }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* IVA Barometer */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Receipt style={{ width: '16px', height: '16px', color: JA.GOLD }} /> BARÓMETRO DE RESPONSABILIDAD TRIBUTARIA
                    </h3>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '8px' }}>
                    <span style={{ color: JA.GREY }}>Acumulado Ventas 2025: <strong style={{ color: JA.NAVY }}>{COP_M(IVA_ACUMULADO)}</strong></span>
                    <span style={{ color: JA.GREY }}>Límite de Régimen: <strong style={{ color: JA.GOLD }}>{COP_M(IVA_UMBRAL)}</strong></span>
                </div>
                <div style={{ width: '100%', background: JA.BG, height: '12px', borderRadius: '1px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{
                        width: `${Math.min((IVA_ACUMULADO / IVA_UMBRAL) * 100, 100)}%`,
                        background: IVA_ACUMULADO > IVA_UMBRAL * 0.85 ? JA.RED : IVA_ACUMULADO > IVA_UMBRAL * 0.7 ? JA.GOLD : JA.GREEN,
                        height: '100%',
                        transition: 'width 1s ease-in-out'
                    }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY_LT }}>$0</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: JA.GOLD }}>ADVERTENCIA (70%)</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: JA.RED }}>TOPE CRÍTICO</span>
                </div>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {[
                    { label: 'Margen de Intermediación', value: `${COMISIONES_PCT}%`, color: COMISIONES_PCT > 20 ? JA.RED : JA.GREEN, icon: TrendingDown, target: 'MÁX 20%' },
                    { label: 'Incidencia de Retorno', value: `${DEVOLUCIONES_PCT}%`, color: DEVOLUCIONES_PCT > 5 ? JA.RED : JA.GREEN, icon: RotateCcw, target: 'LÍMITE 10%' },
                    { label: 'Evolución de Rentabilidad', value: `${TENDENCIA_UTILIDAD}%`, color: TENDENCIA_UTILIDAD < 0 ? JA.RED : JA.GREEN, icon: TrendingUp, target: 'VS MES ANT.' },
                ].map((metric, i) => (
                    <div key={i} style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <metric.icon style={{ width: '14px', height: '14px', color: metric.color }} />
                            <span style={{ fontSize: '9px', fontWeight: 800, color: JA.GREY_LT, textTransform: 'uppercase' }}>{metric.target}</span>
                        </div>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: JA.GREY, margin: 0, textTransform: 'uppercase' }}>{metric.label}</p>
                        <p style={{ fontSize: '24px', fontWeight: 800, color: metric.color, margin: '4px 0', fontFamily: 'monospace' }}>{metric.value}</p>
                    </div>
                ))}
            </div>

            {/* Active Alerts List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 800, color: JA.NAVY, margin: '8px 0' }}>EVENTOS DE GESTIÓN ACTIVA ({alertasActivas.length})</h2>
                {alertasActivas.map((alerta) => {
                    const cfg = TIPO_CONFIG[alerta.tipo]
                    const Icon = cfg.icon
                    const ruta = RUTAS_ACCION[alerta.id]
                    return (
                        <div key={alerta.id} style={{ 
                            padding: '16px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '2px',
                            display: 'flex', gap: '16px', alignItems: 'flex-start'
                        }}>
                            <div style={{ width: '32px', height: '32px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '1px', border: `1px solid ${cfg.border}`, flexShrink: 0 }}>
                                <Icon style={{ width: '18px', height: '18px', color: cfg.color }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <p style={{ fontSize: '13px', fontWeight: 800, color: JA.TEXT, margin: 0 }}>{alerta.titulo.toUpperCase()}</p>
                                    {alerta.valor && (
                                        <span style={{ fontSize: '10px', fontWeight: 900, color: cfg.color, fontFamily: 'monospace', padding: '2px 8px', background: 'white', borderRadius: '1px', border: `1px solid ${cfg.border}` }}>
                                            {alerta.valor}
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: '11px', color: JA.GREY, lineHeight: '1.5', margin: 0 }}>{alerta.descripcion}</p>
                                {alerta.accion && ruta && (
                                    <Link href={ruta} style={{ 
                                        display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px',
                                        fontSize: '11px', fontWeight: 700, color: cfg.color, textDecoration: 'none'
                                    }}>
                                        <ExternalLink style={{ width: '12px', height: '12px' }} />
                                        {alerta.accion}
                                    </Link>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
