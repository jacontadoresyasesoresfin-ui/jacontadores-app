'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, TrendingDown, TrendingUp, RotateCcw, Receipt, Bell, CheckCircle, XCircle, ExternalLink } from 'lucide-react'

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
        titulo: 'Estás acercándote al umbral de responsabilidad IVA',
        descripcion: `Tus ingresos acumulados son ${(IVA_ACUMULADO / 1000000).toFixed(1)}M COP. El umbral para ser responsable de IVA es aproximadamente ${(IVA_UMBRAL / 1000000).toFixed(0)}M COP. Tienes margen pero debes monitorearlo mensualmente.`,
        valor: `${((IVA_ACUMULADO / IVA_UMBRAL) * 100).toFixed(0)}% del umbral`,
        activa: IVA_ACUMULADO > IVA_UMBRAL * 0.8,
        accion: 'Ver módulo Impuestos'
    },
    {
        id: 'comisiones-altas',
        tipo: 'danger',
        titulo: 'Tus comisiones superan el 20% de las ventas',
        descripcion: `Las comisiones de Mercado Libre representan el ${COMISIONES_PCT}% de tus ventas brutas. Lo ideal es mantenerlas bajo el 20%. Considera optimizar tu precio de venta o activar publicidad más eficiente.`,
        valor: `${COMISIONES_PCT}% de comisión total`,
        activa: COMISIONES_PCT > 20,
        accion: 'Ver módulo de Comisiones'
    },
    {
        id: 'devoluciones-altas',
        tipo: 'danger',
        titulo: 'Tienes un porcentaje alto de devoluciones',
        descripcion: `Tu tasa de devoluciones es del ${DEVOLUCIONES_PCT}%. Mercado Libre puede suspender publicaciones si supera el 10%. Revisa los motivos más frecuentes en el módulo de Devoluciones.`,
        valor: `${DEVOLUCIONES_PCT}% tasa de devolución`,
        activa: DEVOLUCIONES_PCT > 5,
        accion: 'Ver Devoluciones y Reclamos'
    },
    {
        id: 'utilidad-bajando',
        tipo: 'warning',
        titulo: 'Tus utilidades están bajando este mes',
        descripcion: `Tu utilidad real cayó un ${Math.abs(TENDENCIA_UTILIDAD)}% comparado con el mes anterior. Esto puede deberse a mayor competencia, aumento de costos o más devoluciones. Revisa tu estructura de costos.`,
        valor: `${TENDENCIA_UTILIDAD}% vs mes anterior`,
        activa: TENDENCIA_UTILIDAD < -5,
        accion: 'Ver Costos del Producto'
    },
    {
        id: 'declaracion-impuestos',
        tipo: 'info',
        titulo: 'Debes declarar impuestos este mes',
        descripcion: 'Según el calendario DIAN 2025, tienes obligaciones tributarias próximas. Revisa el módulo de Impuestos para ver el detalle del IVA, ReteFuente y ReteICA acumulados.',
        valor: 'Vence el 15 de marzo',
        activa: MES_DECLARACION,
        accion: 'Ver Módulo Impuestos'
    },
    {
        id: 'reputacion-ok',
        tipo: 'success',
        titulo: 'Tu reputación en Mercado Libre es positiva',
        descripcion: 'Tu nivel de reputación está en verde. Mantén tiempos de envío cortos y responde rápido los reclamos para conservarlo.',
        valor: 'Nivel: Verde',
        activa: true,
        accion: 'Ver Ecommerce Hub'
    },
    {
        id: 'full-disponible',
        tipo: 'info',
        titulo: 'Considera activar Mercado Libre Full',
        descripcion: 'Tus productos más vendidos (Auriculares Bluetooth y Teclado Mecánico) tienen alta demanda. Activar Full puede reducir tiempos de entrega y mejorar tu reputación.',
        valor: 'Potencial +35% ventas',
        activa: true,
        accion: 'Ver Ecommerce Hub'
    },
]

const TIPO_CONFIG = {
    danger: { bg: 'bg-[#F6465D]/10', border: 'border-[#F6465D]/30', icon: XCircle, iconColor: 'text-[#F6465D]', badge: 'bg-[#F6465D] text-white' },
    warning: { bg: 'bg-[#F0B90B]/10', border: 'border-[#F0B90B]/30', icon: AlertTriangle, iconColor: 'text-[#F0B90B]', badge: 'bg-[#F0B90B] text-[#0B0E11]' },
    info: { bg: 'bg-[#5B8DEF]/10', border: 'border-[#5B8DEF]/30', icon: Bell, iconColor: 'text-[#5B8DEF]', badge: 'bg-[#5B8DEF] text-white' },
    success: { bg: 'bg-[#0ECB81]/10', border: 'border-[#0ECB81]/30', icon: CheckCircle, iconColor: 'text-[#0ECB81]', badge: 'bg-[#0ECB81] text-[#0B0E11]' },
}

const KPI_ALERTAS = [
    { label: 'Alertas Críticas', value: ALERTAS.filter(a => a.tipo === 'danger' && a.activa).length, color: '#F6465D', icon: XCircle },
    { label: 'Advertencias', value: ALERTAS.filter(a => a.tipo === 'warning' && a.activa).length, color: '#F0B90B', icon: AlertTriangle },
    { label: 'Informativas', value: ALERTAS.filter(a => a.tipo === 'info' && a.activa).length, color: '#5B8DEF', icon: Bell },
    { label: 'Estado Positivo', value: ALERTAS.filter(a => a.tipo === 'success' && a.activa).length, color: '#0ECB81', icon: CheckCircle },
]

const COP_M = (n: number) => `$${(n / 1000000).toFixed(1)}M`

export default function AlertasPage() {
    const alertasActivas = ALERTAS.filter(a => a.activa)

    return (
        <div className="space-y-6 pb-10 font-sans animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-[#EAECEF]">
                    Centro de <span className="text-[#F0B90B]">Alertas</span>
                </h1>
                <p className="text-[#848E9C] text-sm mt-1">Monitoreo inteligente de tu negocio en Mercado Libre</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {KPI_ALERTAS.map((kpi, i) => (
                    <Card key={i} className="bg-[#1E2329] border-[#2B3139]">
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                                <p className="text-[#848E9C] text-[10px] uppercase font-bold tracking-wider">{kpi.label}</p>
                            </div>
                            <p className="font-black text-3xl" style={{ color: kpi.color }}>{kpi.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Barómetro IVA */}
            <Card className="bg-[#1E2329] border-[#2B3139]">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[#EAECEF] text-sm flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-[#F0B90B]" /> Barómetro IVA — Umbral de Responsabilidad
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-[#848E9C]">Ingresos acumulados: <strong className="text-[#EAECEF]">{COP_M(IVA_ACUMULADO)}</strong></span>
                        <span className="text-[#848E9C]">Umbral: <strong className="text-[#F0B90B]">{COP_M(IVA_UMBRAL)}</strong></span>
                    </div>
                    <div className="w-full bg-[#2B3139] rounded-full h-4 overflow-hidden">
                        <div className="h-4 rounded-full transition-all duration-1000"
                            style={{
                                width: `${Math.min((IVA_ACUMULADO / IVA_UMBRAL) * 100, 100)}%`,
                                background: IVA_ACUMULADO > IVA_UMBRAL * 0.9 ? '#F6465D' : IVA_ACUMULADO > IVA_UMBRAL * 0.75 ? '#F0B90B' : '#0ECB81'
                            }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#848E9C]">
                        <span>$0</span>
                        <span className="text-[#F0B90B]">⚠ Zona de riesgo (75%)</span>
                        <span>{COP_M(IVA_UMBRAL)}</span>
                    </div>
                </CardContent>
            </Card>

            {/* KPIs de negocio */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className={`bg-[#1E2329] ${COMISIONES_PCT > 20 ? 'border-[#F6465D]/40' : 'border-[#2B3139]'}`}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-[#F0B90B]" /><p className="text-[#848E9C] text-xs uppercase font-bold">% Comisiones / Ventas</p></div>
                        <p className={`font-black text-2xl ${COMISIONES_PCT > 20 ? 'text-[#F6465D]' : 'text-[#0ECB81]'}`}>{COMISIONES_PCT}%</p>
                        <p className="text-[#848E9C] text-xs">Objetivo: menor al 20%</p>
                    </CardContent>
                </Card>
                <Card className={`bg-[#1E2329] ${DEVOLUCIONES_PCT > 5 ? 'border-[#F6465D]/40' : 'border-[#2B3139]'}`}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 mb-1"><RotateCcw className="w-4 h-4 text-[#F6465D]" /><p className="text-[#848E9C] text-xs uppercase font-bold">% Devoluciones</p></div>
                        <p className={`font-black text-2xl ${DEVOLUCIONES_PCT > 5 ? 'text-[#F6465D]' : 'text-[#0ECB81]'}`}>{DEVOLUCIONES_PCT}%</p>
                        <p className="text-[#848E9C] text-xs">Límite ML: 10%</p>
                    </CardContent>
                </Card>
                <Card className={`bg-[#1E2329] ${TENDENCIA_UTILIDAD < 0 ? 'border-[#F6465D]/40' : 'border-[#2B3139]'}`}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-[#F0B90B]" /><p className="text-[#848E9C] text-xs uppercase font-bold">Tendencia Utilidad</p></div>
                        <p className={`font-black text-2xl ${TENDENCIA_UTILIDAD < 0 ? 'text-[#F6465D]' : 'text-[#0ECB81]'}`}>{TENDENCIA_UTILIDAD}%</p>
                        <p className="text-[#848E9C] text-xs">vs mes anterior</p>
                    </CardContent>
                </Card>
            </div>

            {/* Lista de alertas */}
            <div className="space-y-3">
                <h2 className="text-[#EAECEF] font-bold text-sm">Alertas activas ({alertasActivas.length})</h2>
                {alertasActivas.map((alerta) => {
                    const cfg = TIPO_CONFIG[alerta.tipo]
                    const Icon = cfg.icon
                    const ruta = RUTAS_ACCION[alerta.id]
                    return (
                        <div key={alerta.id} className={`p-4 ${cfg.bg} border ${cfg.border} rounded-xl`}>
                            <div className="flex items-start gap-3">
                                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${cfg.iconColor}`} />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <p className="text-[#EAECEF] font-bold text-sm">{alerta.titulo}</p>
                                        {alerta.valor && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.badge}`}>{alerta.valor}</span>
                                        )}
                                    </div>
                                    <p className="text-[#848E9C] text-xs leading-relaxed">{alerta.descripcion}</p>
                                    {alerta.accion && ruta && (
                                        <Link
                                            href={ruta}
                                            className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${cfg.iconColor} hover:underline underline-offset-2 transition-all`}
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            {alerta.accion}
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
