'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    RefreshCw, Play, Clock, CheckCircle2, AlertCircle, XCircle,
    Activity, Zap, Calendar, ChevronDown, ChevronRight, Terminal,
    Info, Shield, Copy, Check,
} from 'lucide-react'
import { useClient } from '@/app/dashboard/ClientContext'

/* ─── Paleta J&A ─────────────────────────────────────────── */
const JA = {
    NAVY: '#13213C', GOLD: '#B8960C',
    TEXT: '#1C2B45', GREY: '#4B5563', GREY_LT: '#9CA3AF',
    BORDER: '#E5E7EB', BG: '#F8FAFC', WHITE: '#FFFFFF',
    GREEN: '#059669', GREEN_LT: '#D1FAE5',
    RED: '#DC2626', RED_LT: '#FEE2E2',
    BLUE: '#2563EB', BLUE_LT: '#DBEAFE',
    YELLOW: '#D97706', YELLOW_LT: '#FEF3C7',
}

/* ─── Tipos ──────────────────────────────────────────────── */
interface SyncLog {
    id: string
    iniciado_en: string
    finalizado_en: string | null
    nuevas: number
    causadas: number
    errores: number
    omitidas: number
    duration_ms: number
    errores_detalle: string[]
    triggered_by: string
}

interface DianConfig {
    activo: boolean
    proveedor_tecnologico: string
    nit_empresa: string
    last_sync: string | null
    ambiente: string
}

interface TriggerResult {
    success: boolean
    nuevas_sincronizadas: number
    causadas: number
    errores: number
    omitidas: number
    duration_ms: number
    errores_detalle: string[]
    error?: string
}

/* ─── Helpers ────────────────────────────────────────────── */
function fmt(n: number) { return n.toLocaleString('es-CO') }

function fmtDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('es-CO', {
        dateStyle: 'medium', timeStyle: 'short',
    })
}

function fmtMs(ms: number) {
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function BadgeEstado({ activo, ambiente }: { activo: boolean; ambiente: string }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: activo ? JA.GREEN_LT : JA.RED_LT,
            color: activo ? JA.GREEN : JA.RED,
        }}>
            <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: activo ? JA.GREEN : JA.RED,
                display: 'inline-block',
            }} />
            {activo ? `Activo · ${ambiente}` : 'Inactivo'}
        </span>
    )
}

/* ─── Componente principal ───────────────────────────────── */
export default function AutomatizacionPage() {
    const { activeProfile } = useClient()
    const profileId = activeProfile?.id
    const [config, setConfig] = useState<DianConfig | null>(null)
    const [logs, setLogs] = useState<SyncLog[]>([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [lastResult, setLastResult] = useState<TriggerResult | null>(null)
    const [expandedLog, setExpandedLog] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [diasAtras, setDiasAtras] = useState(7)

    const cargarDatos = useCallback(async () => {
        if (!profileId) return
        setLoading(true)
        try {
            // Config DIAN
            const cfgRes = await fetch(`/api/causacion/dian-config?profile_id=${profileId}`)
            const cfgData = await cfgRes.json()
            setConfig(cfgData.config || null)

            // Logs de sincronización
            const logsRes = await fetch(`/api/causacion/sync-logs?profile_id=${profileId}&limit=20`)
            if (logsRes.ok) {
                const logsData = await logsRes.json()
                setLogs(logsData.logs || [])
            }
        } finally {
            setLoading(false)
        }
    }, [profileId])

    useEffect(() => { cargarDatos() }, [cargarDatos])

    const ejecutarManual = async () => {
        if (!profileId || running) return
        setRunning(true)
        setLastResult(null)
        try {
            const res = await fetch('/api/causacion/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile_id: profileId, dias: diasAtras }),
            })
            const data: TriggerResult = await res.json()
            setLastResult(data)
            await cargarDatos()
        } catch (e) {
            setLastResult({ success: false, error: 'Error de red', nuevas_sincronizadas: 0, causadas: 0, errores: 0, omitidas: 0, duration_ms: 0, errores_detalle: [] })
        } finally {
            setRunning(false)
        }
    }

    const cronCommand = `0 */2 * * * curl -s -X POST https://TU_DOMINIO/api/causacion/cron \\
  -H "x-cron-secret: TU_CRON_SECRET" \\
  -H "Content-Type: application/json"`

    const copiarCron = () => {
        navigator.clipboard.writeText(cronCommand)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Stats globales desde logs
    const totalNuevas = logs.reduce((a, l) => a + l.nuevas, 0)
    const totalCausadas = logs.reduce((a, l) => a + l.causadas, 0)
    const totalErrores = logs.reduce((a, l) => a + l.errores, 0)
    const ultimaEjecucion = logs[0]?.iniciado_en || null

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <RefreshCw size={20} color={JA.GOLD} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ marginLeft: 10, color: JA.GREY }}>Cargando...</span>
        </div>
    )

    return (
        <div style={{ fontFamily: 'Inter, sans-serif', color: JA.TEXT, maxWidth: 980, margin: '0 auto' }}>

            {/* ── Header ────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: JA.NAVY, margin: 0 }}>
                        Automatización DIAN
                    </h1>
                    <p style={{ fontSize: 13, color: JA.GREY, margin: '4px 0 0' }}>
                        Descarga automática de facturas recibidas y causación inteligente
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {config && <BadgeEstado activo={config.activo} ambiente={config.ambiente} />}
                    <button onClick={cargarDatos} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', border: `1px solid ${JA.BORDER}`,
                        borderRadius: 6, background: JA.WHITE, cursor: 'pointer',
                        fontSize: 13, color: JA.GREY,
                    }}>
                        <RefreshCw size={14} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* ── Sin configuración ─────────────────────────── */}
            {!config && (
                <div style={{
                    background: JA.YELLOW_LT, border: `1px solid ${JA.YELLOW}`,
                    borderRadius: 8, padding: '16px 20px', marginBottom: 24,
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <Info size={18} color={JA.YELLOW} />
                    <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: JA.YELLOW }}>
                            Sin configuración DIAN activa
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: JA.GREY }}>
                            Configure su Proveedor Tecnológico en{' '}
                            <a href="/dashboard/causacion" style={{ color: JA.BLUE }}>Causación → Configuración</a>
                        </p>
                    </div>
                </div>
            )}

            {/* ── KPIs ──────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Última sincronización', value: fmtDate(config?.last_sync || ultimaEjecucion), icon: <Clock size={18} color={JA.GOLD} />, sub: null },
                    { label: 'Facturas descargadas (20 runs)', value: fmt(totalNuevas), icon: <Activity size={18} color={JA.BLUE} />, sub: null },
                    { label: 'Causadas automáticamente', value: fmt(totalCausadas), icon: <CheckCircle2 size={18} color={JA.GREEN} />, sub: null },
                    { label: 'Errores / Pendientes', value: fmt(totalErrores), icon: <AlertCircle size={18} color={totalErrores > 0 ? JA.RED : JA.GREY_LT} />, sub: null },
                ].map((kpi, i) => (
                    <div key={i} style={{
                        background: JA.WHITE, border: `1px solid ${JA.BORDER}`,
                        borderRadius: 8, padding: '14px 16px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            {kpi.icon}
                            <span style={{ fontSize: 11, color: JA.GREY, textTransform: 'uppercase', letterSpacing: 0.5 }}>{kpi.label}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: JA.NAVY }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* ── Panel de ejecución manual ─────────────── */}
                <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 10, padding: 20 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: JA.NAVY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Zap size={16} color={JA.GOLD} />
                        Ejecución Manual
                    </h2>

                    <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 12, color: JA.GREY, display: 'block', marginBottom: 6 }}>
                            Consultar documentos de los últimos:
                        </label>
                        <select
                            value={diasAtras}
                            onChange={e => setDiasAtras(Number(e.target.value))}
                            style={{
                                width: '100%', padding: '8px 10px', borderRadius: 6,
                                border: `1px solid ${JA.BORDER}`, fontSize: 13,
                                background: JA.BG, color: JA.TEXT,
                            }}
                        >
                            <option value={1}>1 día</option>
                            <option value={3}>3 días</option>
                            <option value={7}>7 días</option>
                            <option value={15}>15 días</option>
                            <option value={30}>30 días</option>
                        </select>
                    </div>

                    <button
                        onClick={ejecutarManual}
                        disabled={running || !config?.activo}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 8, padding: '10px 0', borderRadius: 6, border: 'none', cursor: running || !config?.activo ? 'not-allowed' : 'pointer',
                            background: running || !config?.activo ? '#9CA3AF' : JA.NAVY,
                            color: JA.WHITE, fontWeight: 600, fontSize: 14,
                        }}
                    >
                        {running
                            ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Sincronizando...</>
                            : <><Play size={15} /> Sincronizar Ahora</>
                        }
                    </button>

                    {!config?.activo && (
                        <p style={{ fontSize: 12, color: JA.GREY, marginTop: 8, textAlign: 'center' }}>
                            Active la configuración DIAN para habilitar la sincronización
                        </p>
                    )}

                    {/* Resultado último trigger */}
                    {lastResult && (
                        <div style={{
                            marginTop: 16, padding: '12px 14px', borderRadius: 7,
                            background: lastResult.success ? JA.GREEN_LT : JA.RED_LT,
                            border: `1px solid ${lastResult.success ? JA.GREEN : JA.RED}`,
                        }}>
                            {lastResult.error ? (
                                <p style={{ margin: 0, fontSize: 13, color: JA.RED, fontWeight: 600 }}>
                                    Error: {lastResult.error}
                                </p>
                            ) : (
                                <div style={{ fontSize: 13, color: JA.TEXT }}>
                                    <p style={{ margin: '0 0 6px', fontWeight: 700, color: JA.GREEN }}>
                                        ✓ Sincronización completada ({fmtMs(lastResult.duration_ms)})
                                    </p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                        <span>Descargadas: <strong>{lastResult.nuevas_sincronizadas}</strong></span>
                                        <span>Causadas: <strong>{lastResult.causadas}</strong></span>
                                        <span>Omitidas: <strong>{lastResult.omitidas}</strong></span>
                                        <span style={{ color: lastResult.errores > 0 ? JA.RED : JA.GREEN }}>
                                            Errores: <strong>{lastResult.errores}</strong>
                                        </span>
                                    </div>
                                    {lastResult.errores_detalle?.length > 0 && (
                                        <div style={{ marginTop: 8, fontSize: 12, color: JA.RED }}>
                                            {lastResult.errores_detalle.slice(0, 3).map((e, i) => (
                                                <p key={i} style={{ margin: '2px 0' }}>• {e}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Configuración Cron ────────────────────── */}
                <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 10, padding: 20 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: JA.NAVY, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Calendar size={16} color={JA.GOLD} />
                        Cron Automático (cada 2 horas)
                    </h2>
                    <p style={{ fontSize: 12, color: JA.GREY, margin: '0 0 14px' }}>
                        Configure este comando en cPanel → Tareas Programadas
                    </p>

                    <div style={{
                        background: '#0F172A', borderRadius: 7, padding: '12px 14px',
                        fontFamily: 'monospace', fontSize: 12, color: '#E2E8F0',
                        position: 'relative', lineHeight: 1.8,
                    }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {cronCommand}
                        </pre>
                        <button
                            onClick={copiarCron}
                            style={{
                                position: 'absolute', top: 8, right: 8,
                                background: 'rgba(255,255,255,0.1)', border: 'none',
                                borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
                                color: '#fff', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                            }}
                        >
                            {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                        </button>
                    </div>

                    <div style={{ marginTop: 14 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: JA.NAVY, margin: '0 0 8px' }}>
                            Variables de entorno requeridas:
                        </p>
                        {[
                            { key: 'CRON_SECRET', desc: 'Secreto para autenticar el cron (genere uno aleatorio)' },
                            { key: 'SUPABASE_SERVICE_ROLE_KEY', desc: 'Clave de servicio de Supabase (Dashboard → Settings → API)' },
                            { key: 'RESEND_API_KEY', desc: 'API Key de Resend.com para notificaciones por email (opcional)' },
                            { key: 'NEXT_PUBLIC_APP_URL', desc: 'URL pública de la app (ej: https://app.jacontadores.com)' },
                        ].map(v => (
                            <div key={v.key} style={{
                                display: 'flex', gap: 8, alignItems: 'flex-start',
                                padding: '6px 0', borderBottom: `1px solid ${JA.BORDER}`,
                            }}>
                                <Shield size={12} color={JA.GOLD} style={{ marginTop: 2, flexShrink: 0 }} />
                                <div>
                                    <code style={{ fontSize: 12, color: JA.NAVY, fontWeight: 600 }}>{v.key}</code>
                                    <p style={{ margin: '2px 0 0', fontSize: 11, color: JA.GREY }}>{v.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Historial de Ejecuciones ──────────────────── */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 10, padding: 20, marginTop: 20 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: JA.NAVY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Terminal size={16} color={JA.GOLD} />
                    Historial de Sincronizaciones
                    <span style={{
                        marginLeft: 'auto', fontSize: 12, color: JA.GREY_LT,
                        fontWeight: 400,
                    }}>Últimas 20 ejecuciones</span>
                </h2>

                {logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: JA.GREY_LT }}>
                        <Activity size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                        <p style={{ margin: 0, fontSize: 14 }}>Sin ejecuciones registradas</p>
                        <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                            Ejecute una sincronización manual o espere el cron automático
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: `2px solid ${JA.BORDER}` }}>
                                    {['Fecha', 'Trigger', 'Nuevas', 'Causadas', 'Errores', 'Omitidas', 'Duración', ''].map(h => (
                                        <th key={h} style={{
                                            padding: '8px 12px', textAlign: 'left',
                                            fontSize: 11, color: JA.GREY, fontWeight: 600,
                                            textTransform: 'uppercase', letterSpacing: 0.5,
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <>
                                        <tr
                                            key={log.id}
                                            style={{
                                                borderBottom: `1px solid ${JA.BORDER}`,
                                                background: expandedLog === log.id ? JA.BG : JA.WHITE,
                                                cursor: log.errores > 0 ? 'pointer' : 'default',
                                            }}
                                            onClick={() => log.errores > 0 && setExpandedLog(expandedLog === log.id ? null : log.id)}
                                        >
                                            <td style={{ padding: '10px 12px', color: JA.GREY }}>{fmtDate(log.iniciado_en)}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                                                    background: log.triggered_by === 'cron' ? JA.BLUE_LT : JA.YELLOW_LT,
                                                    color: log.triggered_by === 'cron' ? JA.BLUE : JA.YELLOW,
                                                }}>
                                                    {log.triggered_by === 'cron' ? 'Cron' : 'Manual'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{log.nuevas}</td>
                                            <td style={{ padding: '10px 12px', color: JA.GREEN, fontWeight: 600 }}>{log.causadas}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                {log.errores > 0 ? (
                                                    <span style={{ color: JA.RED, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <XCircle size={13} />
                                                        {log.errores}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: JA.GREEN }}>0</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 12px', color: JA.GREY_LT }}>{log.omitidas}</td>
                                            <td style={{ padding: '10px 12px', color: JA.GREY }}>{fmtMs(log.duration_ms)}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                {log.errores > 0 && (
                                                    expandedLog === log.id
                                                        ? <ChevronDown size={14} color={JA.GREY} />
                                                        : <ChevronRight size={14} color={JA.GREY} />
                                                )}
                                            </td>
                                        </tr>
                                        {expandedLog === log.id && log.errores_detalle?.length > 0 && (
                                            <tr key={`${log.id}-detail`}>
                                                <td colSpan={8} style={{ padding: '0 12px 12px 12px', background: JA.RED_LT }}>
                                                    <div style={{ padding: '10px 12px', borderRadius: 6 }}>
                                                        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: JA.RED }}>
                                                            Errores en esta ejecución:
                                                        </p>
                                                        {log.errores_detalle.map((e, i) => (
                                                            <p key={i} style={{ margin: '2px 0', fontSize: 12, color: JA.RED }}>
                                                                • {e}
                                                            </p>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Flujo del pipeline ────────────────────────── */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 10, padding: 20, marginTop: 20 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: JA.NAVY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={16} color={JA.GOLD} />
                    Pipeline de Procesamiento
                </h2>
                <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
                    {[
                        { icon: '⏰', label: 'Cron (2h)', color: JA.NAVY },
                        { icon: '🔌', label: 'Conectar PT', color: JA.BLUE },
                        { icon: '📥', label: 'Consultar docs', color: JA.BLUE },
                        { icon: '🗂', label: 'Filtrar nuevas', color: JA.YELLOW },
                        { icon: '📄', label: 'Parsear XML UBL', color: JA.YELLOW },
                        { icon: '🧠', label: 'Causación + IA', color: '#7C3AED' },
                        { icon: '⚖️', label: 'Validar asiento', color: '#7C3AED' },
                        { icon: '💾', label: 'Guardar BD', color: JA.GREEN },
                        { icon: '📨', label: 'Acuse DIAN', color: JA.GREEN },
                        { icon: '📧', label: 'Email contador', color: JA.GREEN },
                    ].map((step, i, arr) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                minWidth: 72,
                            }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    background: `${step.color}15`,
                                    border: `2px solid ${step.color}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 16,
                                }}>{step.icon}</div>
                                <p style={{
                                    margin: '6px 0 0', fontSize: 10, textAlign: 'center',
                                    color: JA.GREY, lineHeight: 1.3, maxWidth: 60,
                                }}>{step.label}</p>
                            </div>
                            {i < arr.length - 1 && (
                                <div style={{ width: 20, height: 2, background: JA.BORDER, flexShrink: 0, marginBottom: 16 }} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}
