'use client'

import { useState, useCallback, useEffect } from 'react'
import { useClient } from '../ClientContext'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, Legend, PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts'
import {
    ExternalLink, RefreshCw, TrendingUp, TrendingDown, DollarSign,
    ArrowUpRight, ArrowDownRight, AlertCircle, CheckCircle2, FileSpreadsheet, Info
} from 'lucide-react'

/*
 * ═══════════════════════════════════════════════════════════
 *   Paleta exacta jacontadores.com
 *   Navy: #13213C  |  Gold: #B8960C  |  Cream: #F4F4F0
 * ═══════════════════════════════════════════════════════════
 */
const JA = {
    NAVY:     '#13213C',
    NAVY_MID: '#1C3460',
    GOLD:     '#B8960C',
    GOLD_LT:  '#D4A843',
    GOLD_PALE: '#F5E9C0',
    CREAM:    '#F4F4F0',
    CREAM_D:  '#E8E8E2',
    WHITE:    '#FFFFFF',
    TEXT:     '#1C2B45',
    GREY:     '#6B7A8D',
    GREY_LT:  '#A0AEBF',
    TEAL:     '#0F7B71',
    TEAL_LT:  '#14B8A6',
    GREEN:    '#059669',
    RED:      '#DC2626',
    PURPLE:   '#7C3AED',
} as const

/* Paleta de gráficas — ordenada cromáticamente, perfectamente armónica */
const CHART_COLORS = [JA.NAVY, JA.GOLD, JA.TEAL, JA.GREEN, JA.PURPLE, JA.NAVY_MID, JA.RED]

const COP = (n: number): string => {
    const abs = Math.abs(n)
    const sign = n < 0 ? '-' : ''
    if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
    if (abs >= 1_000_000)     return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000)         return `${sign}$${(abs / 1_000).toFixed(0)}K`
    return `${sign}$${Math.round(abs).toLocaleString('es-CO')}`
}

/* ── Estilos comunes ─────────────────────────────────────── */
const TOOLTIP_STYLE = {
    contentStyle: {
        backgroundColor: '#FFFFFF',
        border: '1.5px solid #E0DDD8',
        borderRadius: '2px',
        color: JA.TEXT,
        fontSize: '12px',
        fontFamily: 'Inter, sans-serif',
        boxShadow: '0 8px 28px rgba(19,33,60,0.12)',
    },
    cursor: { fill: 'rgba(19,33,60,0.03)' },
}
const AXIS_STYLE = { fill: JA.GREY_LT, fontSize: 10, fontFamily: 'Inter, sans-serif' }

const CARD: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1.5px solid #E0DDD8',
    borderRadius: '2px',
    boxShadow: '0 2px 12px rgba(19,33,60,0.06)',
    padding: '22px',
}

/* ── Tipos ──────────────────────────────────────────────── */
interface SiigoRow {
    fecha: string;  mes: string;  descripcion: string;  cuenta: string
    nit?: string;   referencia?: string;  debe: number;  haber: number;  saldo?: number
}
interface MonthData  { mes: string; ingresos: number; egresos: number; neto: number }
interface CuentaData { cuenta: string; total: number; tipo: 'ingreso' | 'egreso' }

/* Estado de Cuenta por cliente (NIT) */
interface EstadoCuentaRow {
    nit: string
    nombre: string
    totalFacturado: number
    totalPagado: number
    saldoPendiente: number
    facturas: number
    d0_30: number   /* saldo en cartera 0-30 días */
    d31_60: number
    d61_90: number
    dMas90: number
    ultimaFecha: string
}

interface SiigoSummary {
    totalIngresos: number; totalEgresos: number; saldoNeto: number; margenPct: number
    rows: SiigoRow[];  byMonth: MonthData[];  byCuenta: CuentaData[];  columnas: string[]
    tipoInforme: 'ventas' | 'libro'
    estadoCuenta: EstadoCuentaRow[]
}

/* ── Parser CSV ──────────────────────────────────────────── */
function parseCSV(raw: string): string[][] {
    const rows: string[][] = []
    for (const line of raw.split('\n')) {
        if (!line.trim()) continue
        const cols: string[] = []
        let inside = false; let cell = ''
        for (const ch of line) {
            if (ch === '"') { inside = !inside; continue }
            if (ch === ',' && !inside) { cols.push(cell.trim()); cell = ''; continue }
            cell += ch
        }
        cols.push(cell.trim()); rows.push(cols)
    }
    return rows
}

/*
 * Aliases para Libro Diario/Mayor y para Informe Ventas de Siigo
 */
const ALIASES: Record<string, string[]> = {
    fecha:        ['fecha emisi','fecha emis','fecha','date','periodo'],
    descripcion:  ['nombre receptor','nombre emisor','descripcion','concepto','detalle','tipo de doc','glosa'],
    cuenta:       ['prefijo','folio','cuenta','cta','grupo'],
    nit:          ['nit receptor','nit emisor','nit','documento','tercero'],
    debe:         ['total','debe','debito','cargo','ingresos','ingreso'],
    haber:        ['haber','credito','abono','egresos','egreso'],
    iva:          ['iva'],
    saldo:        ['saldo'],
}

function mapCol(header: string): string | null {
    const h = header.toLowerCase().trim()
    for (const [field, aliases] of Object.entries(ALIASES)) {
        if (aliases.some(a => h === a || h.startsWith(a) || h.includes(a))) return field
    }
    return null
}

function parseMoney(val: string): number {
    if (!val) return 0
    const s = val.trim()
    if (s === '-' || s === '-   ' || s === '') return 0
    // Colombian: 19.449,45 → 19449.45
    const clean = s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')
    const n = parseFloat(clean)
    return isNaN(n) ? 0 : n
}

function toMonthKey(d: string): string {
    if (!d) return 'ND'
    // dd-mm-yyyy or dd/mm/yyyy (Siigo format)
    const dmy = d.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{2,4})/)
    if (dmy) {
        const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
        return `${y}-${dmy[2].padStart(2,'0')}`
    }
    // yyyy-mm-dd
    const iso = d.match(/^(\d{4})-(\d{2})/)
    if (iso) return `${iso[1]}-${iso[2]}`
    return 'ND'
}

function analyzeSiigo(data: string[][], headers: string[]): SiigoSummary {
    const cleanH = headers.map(h => h.trim())
    const colMap: Record<string, number> = {}
    cleanH.forEach((h, i) => { const f = mapCol(h); if (f && !(f in colMap)) colMap[f] = i })

    // Detect report type: Ventas if 'Total' column exists
    const isVentas = cleanH.some(h => h.toLowerCase() === 'total')
    const tipoInforme: 'ventas' | 'libro' = isVentas ? 'ventas' : 'libro'

    const parsed: SiigoRow[] = []
    for (const row of data) {
        if (row.length < 3) continue
        const debe  = parseMoney(row[colMap['debe']  ?? -1] ?? '')
        const haber = isVentas
            ? parseMoney(row[colMap['iva'] ?? colMap['haber'] ?? -1] ?? '')
            : parseMoney(row[colMap['haber'] ?? -1] ?? '')
        if (debe === 0 && haber === 0) continue

        const fechaRaw = row[colMap['fecha'] ?? -1] ?? ''
        const fechaDate = fechaRaw.includes(' ') ? fechaRaw.split(' ')[0] : fechaRaw

        parsed.push({
            fecha:       fechaDate,
            mes:         toMonthKey(fechaDate),
            descripcion: row[colMap['descripcion'] ?? -1] ?? '',
            cuenta:      row[colMap['cuenta']      ?? -1] ?? '',
            nit:         row[colMap['nit']         ?? -1] ?? '',
            debe, haber,
            saldo: 'saldo' in colMap ? parseMoney(row[colMap['saldo']] ?? '') : undefined,
        })
    }

    const mMap: Record<string, { ingresos: number; egresos: number }> = {}
    const cMap: Record<string, { debe: number; haber: number }> = {}
    for (const r of parsed) {
        const m = r.mes || 'ND'
        if (!mMap[m]) mMap[m] = { ingresos: 0, egresos: 0 }
        mMap[m].ingresos += r.debe
        mMap[m].egresos  += r.haber
        // Group: use Nombre Receptor for Ventas, Cuenta for Libro
        const gk = isVentas
            ? (r.descripcion.length > 32 ? r.descripcion.slice(0,30)+'…' : r.descripcion) || 'Sin nombre'
            : (r.cuenta || 'Sin cuenta')
        if (!cMap[gk]) cMap[gk] = { debe: 0, haber: 0 }
        cMap[gk].debe  += r.debe
        cMap[gk].haber += r.haber
    }

    const byMonth: MonthData[] = Object.entries(mMap)
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([mes, v]) => ({
            mes: mes !== 'ND'
                ? new Date(mes + '-01').toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
                : 'S/F',
            ingresos: v.ingresos, egresos: v.egresos, neto: v.ingresos - v.egresos
        }))

    const byCuenta: CuentaData[] = Object.entries(cMap)
        .map(([cuenta, v]) => ({ cuenta, total: v.debe, tipo: 'ingreso' as const }))
        .sort((a,b) => b.total - a.total).slice(0, 10)

    const totalIngresos = parsed.reduce((s,r)=>s+r.debe,0)
    const totalEgresos  = parsed.reduce((s,r)=>s+r.haber,0)
    const saldoNeto = totalIngresos - (isVentas ? 0 : totalEgresos)

    /* ── Estado de Cuenta por NIT/Cliente ─────────────────── */
    const today = new Date()
    const nitMap: Record<string, EstadoCuentaRow> = {}
    for (const r of parsed) {
        const key = r.nit?.trim() || 'SIN NIT'
        if (!nitMap[key]) {
            nitMap[key] = {
                nit: key,
                nombre: r.descripcion || key,
                totalFacturado: 0, totalPagado: 0, saldoPendiente: 0,
                facturas: 0, d0_30: 0, d31_60: 0, d61_90: 0, dMas90: 0,
                ultimaFecha: r.fecha,
            }
        }
        const c = nitMap[key]
        c.totalFacturado += r.debe
        c.totalPagado    += r.haber
        if (r.descripcion && r.descripcion.length > 2) c.nombre = r.descripcion
        if (r.fecha > c.ultimaFecha) c.ultimaFecha = r.fecha
        c.facturas++

        // Antigüedad basada en la fecha de la transacción
        const partes = r.fecha.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/) ||
                       r.fecha.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
        let diasAntiguedad = 0
        if (partes) {
            const d = partes[1].length === 4
                ? new Date(`${partes[1]}-${partes[2]}-${partes[3]}`)
                : new Date(`${partes[3].length === 2 ? '20'+partes[3] : partes[3]}-${partes[2].padStart(2,'0')}-${partes[1].padStart(2,'0')}`)
            diasAntiguedad = Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86_400_000))
        }
        const saldoFila = r.debe - r.haber
        if (saldoFila > 0) {
            if (diasAntiguedad <= 30)       c.d0_30   += saldoFila
            else if (diasAntiguedad <= 60)  c.d31_60  += saldoFila
            else if (diasAntiguedad <= 90)  c.d61_90  += saldoFila
            else                            c.dMas90  += saldoFila
        }
    }
    const estadoCuenta: EstadoCuentaRow[] = Object.values(nitMap)
        .map(c => ({ ...c, saldoPendiente: Math.max(0, c.totalFacturado - c.totalPagado) }))
        .filter(c => c.totalFacturado > 0)
        .sort((a,b) => b.saldoPendiente - a.saldoPendiente)
        .slice(0, 50)

    return {
        totalIngresos, totalEgresos, saldoNeto,
        margenPct: totalIngresos > 0 ? (saldoNeto/totalIngresos)*100 : 0,
        rows: parsed, byMonth, byCuenta, columnas: cleanH, tipoInforme, estadoCuenta
    }
}

/* ── Componentes auxiliares ──────────────────────────────── */
interface KPICardProps { label: string; value: string; color: string; bg: string; icon: React.ComponentType<{style?:React.CSSProperties}>; trend?: 'up'|'down'|'neutral' }

function KPICard({ label, value, color, bg, icon: Icon, trend }: KPICardProps) {
    return (
        <div className="card-hover" style={{ ...CARD, cursor: 'default' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                <p style={{ fontSize:'9px', fontWeight:700, color:JA.GREY, textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:'Inter,sans-serif' }}>{label}</p>
                <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Icon style={{ width:'15px', height:'15px', color }} />
                </div>
            </div>
            <p style={{ fontFamily:'Inter,sans-serif', fontWeight:800, fontSize:'22px', color, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em' }}>{value}</p>
            {trend && trend !== 'neutral' && (
                <div style={{ display:'flex', alignItems:'center', gap:'4px', marginTop:'6px' }}>
                    {trend === 'up'
                        ? <ArrowUpRight style={{ width:'12px', height:'12px', color:JA.GREEN }} />
                        : <ArrowDownRight style={{ width:'12px', height:'12px', color:JA.RED }} />}
                </div>
            )}
        </div>
    )
}

/* Tooltip con formato COP */
function fmtTooltip(v: any, n: any): [string, any] {
    return [COP(Number(v)), n]
}

/* ─── Detectar si es un índice de URLs de clientes ─── */
function isIndexSheet(rows: string[][]): boolean {
    if (rows.length < 2) return false
    const header = rows[0].map(h => h.toLowerCase().trim())
    return header.some(h => h === 'url' || h.includes('sheet') || h.includes('enlace')) &&
           header.some(h => h.includes('client') || h.includes('nombre') || h.includes('id'))
}

function extractUrlsFromIndex(rows: string[][]): { id: string, nombre: string, url: string }[] {
    const header = rows[0].map(h => h.toLowerCase().trim())
    const urlCol = header.findIndex(h => h === 'url' || h.includes('sheet') || h.includes('enlace'))
    const nameCol = header.findIndex(h => h.includes('nombre') || h.includes('client'))
    const results: { id: string, nombre: string, url: string }[] = []
    for (let i = 1; i < rows.length; i++) {
        const urlVal = rows[i][urlCol]?.trim()
        if (urlVal && urlVal.includes('docs.google.com/spreadsheets')) {
            results.push({
                id: rows[i][0]?.trim() || `Cliente ${i}`,
                nombre: nameCol >= 0 ? rows[i][nameCol]?.trim() : `Cliente ${i}`,
                url: urlVal,
            })
        }
    }
    return results
}

/* ── Página principal ────────────────────────────────────── */
export default function SiigoPage() {
    const { activeProfile } = useClient()
    const profileSheetUrl = activeProfile?.google_sheet_url || ''

    const [sheetUrl, setSheetUrl] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [summary, setSummary] = useState<SiigoSummary | null>(null)
    const [activeTab, setActiveTab] = useState<'overview'|'monthly'|'accounts'|'table'|'estado'>('overview')
    const [urlFocused, setUrlFocused] = useState(false)
    const [indexClients, setIndexClients] = useState<{ id: string, nombre: string, url: string }[]>([])

    const convertUrl = (url: string): string => {
        const u = url.trim()
        if (u.includes('pub?output=csv') || u.includes('&output=csv') || u.includes('pub?gid=')) return u
        const m = u.match(/\/d\/([a-zA-Z0-9_-]+)/)
        if (m) {
            const gm = u.match(/gid=([0-9]+)/)
            return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gm?.[1]??'0'}`
        }
        return u
    }

    const loadSheet = useCallback(async (urlToLoad: string) => {
        if (!urlToLoad.trim()) { setError('No hay URL de Google Sheet configurada'); return }
        setLoading(true); setError(null); setSummary(null); setIndexClients([])
        try {
            const csvUrl = convertUrl(urlToLoad.trim())
            const res = await fetch(`/api/sheets-proxy?url=${encodeURIComponent(csvUrl)}`)
            if (!res.ok) throw new Error(`Error ${res.status}: el Sheet no es accesible. Verifica que sea público.`)
            const text = await res.text()
            if (!text || text.length < 10) throw new Error('El Sheet está vacío o no es accesible')
            const rows = parseCSV(text)
            if (rows.length < 2) throw new Error('No se encontraron filas de datos en el Sheet')

            // Si es un índice de URLs de clientes, mostrarlo como selector
            if (isIndexSheet(rows)) {
                const clients = extractUrlsFromIndex(rows)
                if (clients.length > 0) {
                    setIndexClients(clients)
                    setLoading(false)
                    return
                }
            }

            const result = analyzeSiigo(rows.slice(1), rows[0])
            if (result.rows.length === 0) {
                const cols = rows[0].join(', ')
                throw new Error(`No se detectaron columnas contables (Debe/Haber/Total) en este Sheet.\n\nColumnas encontradas: ${cols}\n\nExporta el informe desde Siigo como Libro Diario, Mayor o Ventas.`)
            }
            setSummary(result)
            setActiveTab('overview')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido')
        } finally {
            setLoading(false)
        }
    }, [])

    const handleLoad = useCallback(async () => {
        const url = sheetUrl.trim() || profileSheetUrl
        await loadSheet(url)
    }, [sheetUrl, profileSheetUrl, loadSheet])

    // Auto-cargar cuando cambia el cliente activo
    useEffect(() => {
        if (profileSheetUrl) {
            setSheetUrl(profileSheetUrl)
            loadSheet(profileSheetUrl)
        }
    }, [profileSheetUrl]) // eslint-disable-line react-hooks/exhaustive-deps

    const TABS_CONFIG = [
        { id: 'overview'  as const, label: '📊 Resumen' },
        { id: 'monthly'   as const, label: '📅 Por Mes' },
        { id: 'accounts'  as const, label: '📂 Por Cuenta' },
        { id: 'estado'    as const, label: '🧾 Estado de Cuenta' },
        { id: 'table'     as const, label: '📋 Detalle' },
    ]

    return (
        <div style={{ fontFamily:'Inter, Montserrat, sans-serif' }}>

            {/* ── Header ────────────────────────────────────── */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'24px', gap:'16px', flexWrap:'wrap' }}>
                <div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
                        <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:JA.NAVY, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(19,33,60,0.25)' }}>
                            <FileSpreadsheet style={{ width:'18px', height:'18px', color:JA.GOLD_LT }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize:'22px', fontWeight:900, color:JA.TEXT, fontFamily:'Montserrat,sans-serif', letterSpacing:'-0.02em', margin:0 }}>
                                Informe <span style={{ color:JA.GOLD }}>Siigo</span> — Google Sheets
                            </h1>
                            <p style={{ fontSize:'12px', color:JA.GREY, margin:'2px 0 0', fontFamily:'Inter,sans-serif' }}>
                                Conecta tu informe contable Siigo y visualiza gráficas tipo Power BI en segundos
                            </p>
                        </div>
                    </div>
                </div>
                <a href="https://jacontadores.com" target="_blank" rel="noopener noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', fontWeight:600, color:JA.GOLD, fontFamily:'Inter,sans-serif', textDecoration:'none', padding:'5px 10px', borderRadius:'8px', background:JA.GOLD_PALE, border:`1px solid rgba(184,150,12,0.25)` }}>
                    <ExternalLink style={{ width:'11px', height:'11px' }} />
                    jacontadores.com
                </a>
            </div>

            {/* ── Formulario URL ─────────────────────────────── */}
            <div className="card-hover" style={{ ...CARD, borderLeft:`4px solid ${JA.GOLD}`, marginBottom:'24px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                    <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:JA.GOLD }} />
                    <h3 style={{ fontSize:'13px', fontWeight:700, color:JA.TEXT, margin:0, fontFamily:'Montserrat,sans-serif' }}>
                        Conectar Google Sheet Público de Siigo
                    </h3>
                </div>
                <p style={{ fontSize:'11px', color:JA.GREY, marginBottom:'14px', fontFamily:'Inter,sans-serif', lineHeight:1.5 }}>
                    El Sheet debe tener <strong style={{color:JA.TEXT}}>visibilidad pública</strong> ("Cualquier persona con el enlace"). Soporta: Libro Diario, Ventas, Cuentas por Cobrar de Siigo exportados como Sheet.
                </p>

                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                    <div style={{ flex:1, position:'relative', minWidth:'260px' }}>
                        <ExternalLink style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', width:'14px', height:'14px', color:JA.GOLD }} />
                        <input
                            value={sheetUrl}
                            onChange={e => setSheetUrl(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleLoad()}
                            onFocus={() => setUrlFocused(true)}
                            onBlur={() => setUrlFocused(false)}
                            placeholder="https://docs.google.com/spreadsheets/d/ID_DEL_SHEET/edit"
                            style={{
                                width:'100%', paddingLeft:'36px', paddingRight:'14px', paddingTop:'11px', paddingBottom:'11px',
                                fontSize:'12px', fontFamily:'Inter,sans-serif', color:JA.TEXT,
                                background:'#F9F7F2', border:`1.5px solid ${urlFocused ? JA.GOLD : '#E0DDD8'}`,
                                borderRadius:'10px', outline:'none', transition:'border-color 0.15s',
                                boxShadow: urlFocused ? `0 0 0 3px rgba(184,150,12,0.12)` : 'none',
                            }}
                        />
                    </div>
                    <button onClick={handleLoad} disabled={loading}
                        style={{
                            display:'flex', alignItems:'center', gap:'7px',
                            padding:'11px 22px', fontSize:'12px', fontWeight:700,
                            fontFamily:'Montserrat, sans-serif', letterSpacing:'0.02em',
                            color:'#FFFFFF', borderRadius:'10px', border:'none', cursor:loading?'not-allowed':'pointer',
                            background: loading ? JA.GREY_LT : `linear-gradient(135deg, ${JA.NAVY} 0%, ${JA.NAVY_MID} 100%)`,
                            boxShadow: loading ? 'none' : '0 4px 14px rgba(19,33,60,0.28)',
                            transition:'all 0.15s',
                            opacity: loading ? 0.7 : 1,
                        }}
                        onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform='translateY(-1px)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform='none' }}>
                        {loading
                            ? <><RefreshCw style={{ width:'14px', height:'14px', animation:'spin 1s linear infinite' }} /> Analizando...</>
                            : <><FileSpreadsheet style={{ width:'14px', height:'14px' }} /> Analizar Sheet</>}
                    </button>
                </div>

                {error && (
                    <div style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginTop:'12px', padding:'12px 14px', borderRadius:'10px', background:'#FEF2F2', border:`1px solid rgba(220,38,38,0.2)`, color:JA.RED }}>
                        <AlertCircle style={{ width:'15px', height:'15px', flexShrink:0, marginTop:'1px' }} />
                        <span style={{ fontSize:'12px', fontFamily:'Inter,sans-serif' }}>{error}</span>
                    </div>
                )}

                {!summary && !error && (
                    <div style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginTop:'12px', padding:'12px 14px', borderRadius:'10px', background:'#F9F7F2', border:`1px solid ${JA.CREAM_D}` }}>
                        <Info style={{ width:'14px', height:'14px', flexShrink:0, marginTop:'1px', color:JA.GOLD }} />
                        <p style={{ fontSize:'11px', color:JA.GREY, fontFamily:'Inter,sans-serif', margin:0, lineHeight:1.6 }}>
                            <strong style={{color:JA.TEXT}}>Columnas detectadas automáticamente:</strong> Fecha · Descripción · Cuenta · NIT · <span style={{color:JA.TEAL}}>Debe (Ingresos)</span> · <span style={{color:JA.RED}}>Haber (Egresos)</span> · Saldo<br/>
                            Compatible con exportes CSV/Sheet de <strong style={{color:JA.NAVY}}>Siigo</strong>: Libro Mayor, Libro Diario, Ventas, Cartera.
                        </p>
                    </div>
                )}
            </div>

            {/* ── Selector de clientes (cuando el Sheet es un índice) ─── */}
            {indexClients.length > 0 && !summary && (
                <div style={{ ...CARD, borderLeft: `4px solid ${JA.TEAL}`, marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <CheckCircle2 style={{ width: '16px', height: '16px', color: JA.TEAL }} />
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: JA.TEXT, margin: 0, fontFamily: 'Montserrat,sans-serif' }}>
                            {indexClients.length} clientes detectados — Selecciona uno para ver su informe
                        </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                        {indexClients.map((c, i) => (
                            <button key={i} onClick={() => { setSheetUrl(c.url); loadSheet(c.url) }}
                                style={{
                                    textAlign: 'left', padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                                    border: `1.5px solid ${JA.CREAM_D}`, background: '#F9F7F2',
                                    display: 'flex', flexDirection: 'column', gap: '4px',
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = JA.TEAL; (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = JA.CREAM_D; (e.currentTarget as HTMLButtonElement).style.background = '#F9F7F2' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: JA.NAVY, fontFamily: 'Montserrat,sans-serif' }}>{c.nombre}</span>
                                <span style={{ fontSize: '10px', color: JA.GREY_LT, fontFamily: 'Inter,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.id}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Dashboard Resultados ───────────────────────── */}
            {summary && (
                <div>
                    {/* Status */}
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px', flexWrap:'wrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                            <CheckCircle2 style={{ width:'15px', height:'15px', color:JA.GREEN }} />
                            <span style={{ fontSize:'13px', fontWeight:700, color:JA.TEXT, fontFamily:'Inter,sans-serif' }}>
                                {summary.rows.length.toLocaleString()} movimientos cargados
                            </span>
                        </div>
                        <span style={{ fontSize:'11px', color:JA.GREY }}>·</span>
                        <span style={{ fontSize:'11px', color:JA.GREY, fontFamily:'Inter,sans-serif' }}>
                            Columnas: {summary.columnas.slice(0,6).join(', ')}
                            {summary.columnas.length > 6 ? '…' : ''}
                        </span>
                        <div style={{ marginLeft:'auto', display:'flex', gap:'6px' }}>
                            <button onClick={() => { setSummary(null); setSheetUrl('') }}
                                style={{ fontSize:'11px', fontWeight:600, color:JA.GREY, padding:'4px 10px', borderRadius:'8px', border:`1px solid #E0DDD8`, background:'#FFFFFF', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
                                ✕ Limpiar
                            </button>
                        </div>
                    </div>

                    {/* KPIs — adaptados al tipo de informe */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'16px', marginBottom:'24px' }}>
                        {summary.tipoInforme === 'ventas' ? (
                            <>
                                <KPICard label="Total Facturado" value={COP(summary.totalIngresos)} color={JA.NAVY} bg="#E0F2FE" icon={ArrowUpRight} trend="up" />
                                <KPICard label="IVA Generado" value={COP(summary.totalEgresos)} color={JA.GOLD} bg={JA.GOLD_PALE} icon={TrendingUp} trend="neutral" />
                                <KPICard label="N° Facturas" value={summary.rows.length.toLocaleString()} color={JA.TEAL} bg="rgba(15,123,113,0.1)" icon={DollarSign} trend="neutral" />
                                <KPICard label="Ticket Promedio" value={COP(summary.rows.length>0?summary.totalIngresos/summary.rows.length:0)} color={JA.PURPLE} bg="rgba(124,58,237,0.1)" icon={TrendingUp} trend="neutral" />
                            </>
                        ) : (
                            <>
                                <KPICard label="Total Ingresos (Debe)" value={COP(summary.totalIngresos)} color={JA.TEAL} bg="rgba(15,123,113,0.1)" icon={ArrowUpRight} trend="up" />
                                <KPICard label="Total Egresos (Haber)" value={COP(summary.totalEgresos)} color={JA.RED} bg="rgba(220,38,38,0.08)" icon={ArrowDownRight} trend="down" />
                                <KPICard label="Saldo Neto" value={COP(summary.saldoNeto)} color={summary.saldoNeto>=0?JA.GREEN:JA.RED} bg={summary.saldoNeto>=0?"rgba(5,150,105,0.08)":"rgba(220,38,38,0.08)"} icon={DollarSign} trend={summary.saldoNeto>=0?'up':'down'} />
                                <KPICard label="Margen Neto" value={`${summary.margenPct.toFixed(1)}%`} color={JA.GOLD} bg={JA.GOLD_PALE} icon={summary.margenPct>=0?TrendingUp:TrendingDown} trend="neutral" />
                            </>
                        )}
                    </div>

                    {/* Tabs */}
                    <div style={{ display:'flex', gap:'4px', padding:'4px', borderRadius:'12px', background:'#F9F7F2', border:`1px solid #E0DDD8`, width:'fit-content', marginBottom:'22px', flexWrap:'wrap' }}>
                        {TABS_CONFIG.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding:'7px 14px', fontSize:'12px', fontWeight:700,
                                    fontFamily:'Montserrat, sans-serif',
                                    borderRadius:'9px', border:'none', cursor:'pointer',
                                    transition:'all 0.15s ease',
                                    background: activeTab===tab.id ? JA.NAVY : 'transparent',
                                    color: activeTab===tab.id ? JA.GOLD_LT : JA.GREY,
                                    boxShadow: activeTab===tab.id ? '0 2px 10px rgba(19,33,60,0.22)' : 'none',
                                }}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ── TAB: Overview ──────────────────────── */}
                    {activeTab === 'overview' && (
                        <div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'20px' }} className="responsive-charts">

                                {/* Área: Flujo de caja */}
                                <div style={{ ...CARD, gridColumn:'1 / -1' }}>
                                    <div style={{ marginBottom:'16px' }}>
                                        <h3 style={{ fontSize:'13px', fontWeight:700, color:JA.TEXT, margin:'0 0 3px', fontFamily:'Montserrat,sans-serif' }}>Flujo de Caja — Ingresos vs Egresos</h3>
                                        <p style={{ fontSize:'10px', color:JA.GREY, margin:0, fontFamily:'Inter,sans-serif' }}>Evolución mensual del movimiento contable · COP</p>
                                    </div>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <ComposedChart data={summary.byMonth} margin={{ top:8, right:12, left:0, bottom:0 }}>
                                            <defs>
                                                <linearGradient id="gNavy" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={JA.NAVY} stopOpacity={0.18} />
                                                    <stop offset="95%" stopColor={JA.NAVY} stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={JA.RED} stopOpacity={0.15} />
                                                    <stop offset="95%" stopColor={JA.RED} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="4 3" stroke="#EDEAE4" vertical={false} />
                                            <XAxis dataKey="mes" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                                            <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={56}
                                                tickFormatter={v => v>=1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v>=1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                                            <Tooltip {...TOOLTIP_STYLE} formatter={fmtTooltip} labelStyle={{ color:JA.TEXT, fontWeight:700, fontFamily:'Montserrat,sans-serif' }} />
                                            <Legend wrapperStyle={{ fontSize:'10px', paddingTop:'6px', fontFamily:'Inter,sans-serif' }}
                                                formatter={v => <span style={{ color:JA.GREY }}>{v}</span>} />
                                            <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke={JA.NAVY} strokeWidth={2.5} fill="url(#gNavy)" dot={false} activeDot={{ r:4, fill:JA.NAVY, strokeWidth:0 }} />
                                            <Area type="monotone" dataKey="egresos"  name="Egresos"  stroke={JA.RED}  strokeWidth={2}   fill="url(#gRed)"  dot={false} activeDot={{ r:4, fill:JA.RED,  strokeWidth:0 }} />
                                            <Line type="monotone" dataKey="neto" name="Neto" stroke={JA.GOLD} strokeWidth={2.5} dot={{ r:3, fill:JA.GOLD, strokeWidth:0 }} strokeDasharray="6 3" />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Pie — Distribución */}
                                <div style={CARD}>
                                    <h3 style={{ fontSize:'13px', fontWeight:700, color:JA.TEXT, margin:'0 0 3px', fontFamily:'Montserrat,sans-serif' }}>Distribución</h3>
                                    <p style={{ fontSize:'10px', color:JA.GREY, margin:'0 0 12px', fontFamily:'Inter,sans-serif' }}>Ingresos vs Egresos</p>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={[
                                                { name:'Ingresos (Debe)',  value: summary.totalIngresos },
                                                { name:'Egresos (Haber)', value: summary.totalEgresos  },
                                            ]} cx="50%" cy="46%" innerRadius={60} outerRadius={88} paddingAngle={4} dataKey="value" strokeWidth={0}>
                                                <Cell fill={JA.NAVY} />
                                                <Cell fill={JA.RED} />
                                            </Pie>
                                            <Tooltip contentStyle={{ background:'#FFFFFF', border:'1px solid #E0DDD8', borderRadius:'10px', fontSize:'12px', fontFamily:'Inter,sans-serif' }}
                                                formatter={(v:any,n:any)=>[COP(Number(v)),n]} />
                                            <Legend wrapperStyle={{ fontSize:'10px', fontFamily:'Inter,sans-serif' }}
                                                formatter={v => <span style={{ color:JA.GREY }}>{v}</span>} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Resumen financiero */}
                                <div style={CARD}>
                                    <h3 style={{ fontSize:'13px', fontWeight:700, color:JA.TEXT, margin:'0 0 14px', fontFamily:'Montserrat,sans-serif' }}>Resumen Financiero</h3>
                                    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                                        {[
                                            { label:'Total Ingresos (Debe)',  value:COP(summary.totalIngresos),  color:JA.NAVY },
                                            { label:'Total Egresos (Haber)', value:COP(summary.totalEgresos),   color:JA.RED },
                                            { label:'Saldo Neto',            value:COP(summary.saldoNeto),      color: summary.saldoNeto>=0 ? JA.GREEN : JA.RED, bold:true },
                                            { label:'Margen Neto',           value:`${summary.margenPct.toFixed(1)}%`, color: JA.GOLD, bold:true },
                                            { label:'Periodos',              value:`${summary.byMonth.length} meses`,  color:JA.TEXT },
                                            { label:'Cuentas distintas',     value:`${summary.byCuenta.length}`,      color:JA.TEXT },
                                        ].map((row,i) => (
                                            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:'10px', background: i % 2 === 0 ? '#F9F7F2' : '#FFFFFF', border:'1px solid #EDEAE4' }}>
                                                <span style={{ fontSize:'11px', color:JA.GREY, fontFamily:'Inter,sans-serif' }}>{row.label}</span>
                                                <span style={{ fontSize:'13px', fontWeight: ('bold' in row && row.bold) ? 800 : 600, color:row.color, fontFamily:'Inter,sans-serif', fontVariantNumeric:'tabular-nums' }}>{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TAB: Por Mes ───────────────────────── */}
                    {activeTab === 'monthly' && (
                        <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
                            {/* Barras agrupadas */}
                            <div style={CARD}>
                                <h3 style={{ fontSize:'13px', fontWeight:700, color:JA.TEXT, margin:'0 0 3px', fontFamily:'Montserrat,sans-serif' }}>Desglose Mensual — Ingresos, Egresos y Neto</h3>
                                <p style={{ fontSize:'10px', color:JA.GREY, margin:'0 0 16px', fontFamily:'Inter,sans-serif' }}>Barras agrupadas por mes · COP</p>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={summary.byMonth} barGap={4} margin={{ top:8, right:12, left:0, bottom:0 }}>
                                        <CartesianGrid strokeDasharray="4 3" stroke="#EDEAE4" vertical={false} />
                                        <XAxis dataKey="mes" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
                                        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={56}
                                            tickFormatter={v => v>=1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : `${(v/1000).toFixed(0)}K`} />
                                        <Tooltip {...TOOLTIP_STYLE} formatter={fmtTooltip} labelStyle={{ color:JA.TEXT, fontWeight:700 }} />
                                        <Legend wrapperStyle={{ fontSize:'10px', paddingTop:'8px', fontFamily:'Inter,sans-serif' }}
                                            formatter={v => <span style={{ color:JA.GREY }}>{v}</span>} />
                                        <Bar dataKey="ingresos" name="Ingresos" fill={JA.NAVY}  radius={[5,5,0,0]} maxBarSize={30} />
                                        <Bar dataKey="egresos"  name="Egresos"  fill={JA.RED}   radius={[5,5,0,0]} maxBarSize={30} />
                                        <Bar dataKey="neto"     name="Neto"     fill={JA.GOLD}  radius={[5,5,0,0]} maxBarSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Tabla mensual */}
                            <div style={CARD}>
                                <h3 style={{ fontSize:'13px', fontWeight:700, color:JA.TEXT, margin:'0 0 14px', fontFamily:'Montserrat,sans-serif' }}>Tabla Mensual</h3>
                                <div style={{ overflowX:'auto' }}>
                                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', fontFamily:'Inter,sans-serif' }}>
                                        <thead>
                                            <tr style={{ borderBottom:`2px solid #E0DDD8` }}>
                                                {['Mes','Ingresos (Debe)','Egresos (Haber)','Neto','Margen'].map(h => (
                                                    <th key={h} style={{ textAlign:'left', padding:'8px 12px 10px 0', color:JA.GREY, fontWeight:700, fontSize:'9px', textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summary.byMonth.map((m, i) => {
                                                const mar = m.ingresos > 0 ? ((m.neto/m.ingresos)*100).toFixed(1) : '0.0'
                                                return (
                                                    <tr key={i} style={{ borderBottom:`1px solid #F4F1EC`, background: i%2===0?'transparent':'#FAFAF7' }}>
                                                        <td style={{ padding:'9px 12px 9px 0', fontWeight:700, color:JA.TEXT }}>{m.mes}</td>
                                                        <td style={{ padding:'9px 12px 9px 0', fontFamily:'monospace', color:JA.TEAL, fontWeight:600 }}>{COP(m.ingresos)}</td>
                                                        <td style={{ padding:'9px 12px 9px 0', fontFamily:'monospace', color:JA.RED,  fontWeight:600 }}>{COP(m.egresos)}</td>
                                                        <td style={{ padding:'9px 12px 9px 0', fontFamily:'monospace', fontWeight:800, color:m.neto>=0?JA.GREEN:JA.RED }}>{COP(m.neto)}</td>
                                                        <td style={{ padding:'9px 12px 9px 0', fontWeight:700, color:Number(mar)>=0?JA.GOLD:JA.RED }}>{mar}%</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TAB: Por Cuenta ───────────────────── */}
                    {activeTab === 'accounts' && (
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
                            {/* Barras horizontales */}
                            <div style={{ ...CARD, gridColumn:'1 / -1' }}>
                                <h3 style={{ fontSize:'13px', fontWeight:700, color:JA.TEXT, margin:'0 0 3px', fontFamily:'Montserrat,sans-serif' }}>{summary.tipoInforme==='ventas' ? 'Top Clientes por Facturación' : 'Top Cuentas por Volumen'}</h3>
                                <p style={{ fontSize:'10px', color:JA.GREY, margin:'0 0 16px', fontFamily:'Inter,sans-serif' }}>{summary.tipoInforme==='ventas' ? 'Top 10 clientes con mayor valor facturado · COP' : 'Top 10 cuentas por monto total · COP'}</p>
                                <ResponsiveContainer width="100%" height={290}>
                                    <BarChart data={summary.byCuenta} layout="vertical"
                                        margin={{ top:4, right:20, left:0, bottom:0 }} barSize={13}>
                                        <CartesianGrid strokeDasharray="4 3" stroke="#EDEAE4" horizontal={false} />
                                        <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false}
                                            tickFormatter={v => v>=1_000_000 ? `${(v/1_000_000).toFixed(0)}M` : `${(v/1000).toFixed(0)}K`} />
                                        <YAxis type="category" dataKey="cuenta" tick={AXIS_STYLE} axisLine={false} tickLine={false} width={148} />
                                        <Tooltip {...TOOLTIP_STYLE} formatter={(v:any)=>[COP(Number(v)),'Total']}
                                            labelStyle={{ color:JA.TEXT, fontWeight:700 }} />
                                        <Bar dataKey="total" radius={[0,6,6,0]}>
                                            {summary.byCuenta.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Torta cuentas */}
                            <div style={CARD}>
                                <h3 style={{ fontSize:'13px', fontWeight:700, color:JA.TEXT, margin:'0 0 3px', fontFamily:'Montserrat,sans-serif' }}>Torta de Cuentas</h3>
                                <p style={{ fontSize:'10px', color:JA.GREY, margin:'0 0 10px', fontFamily:'Inter,sans-serif' }}>Proporción por cuenta</p>
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={summary.byCuenta.slice(0,6)} cx="50%" cy="45%" outerRadius={82} paddingAngle={3} dataKey="total" nameKey="cuenta" strokeWidth={0}>
                                            {summary.byCuenta.slice(0,6).map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ background:'#FFFFFF', border:'1px solid #E0DDD8', borderRadius:'10px', fontSize:'11px', fontFamily:'Inter,sans-serif' }}
                                            formatter={(v:any)=>[COP(Number(v)),'Total']} />
                                        <Legend wrapperStyle={{ fontSize:'9px', fontFamily:'Inter,sans-serif' }}
                                            formatter={v => <span style={{ color:JA.GREY }}>{v}</span>} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Lista de cuentas */}
                            <div style={CARD}>
                                <h3 style={{ fontSize:'13px', fontWeight:700, color:JA.TEXT, margin:'0 0 14px', fontFamily:'Montserrat,sans-serif' }}>Detalle de Cuentas</h3>
                                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                                    {summary.byCuenta.map((c,i) => (
                                        <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'9px', background: i%2===0?'#F9F7F2':'transparent', border:`1px solid #EDEAE4` }}>
                                            <div style={{ width:'10px', height:'10px', borderRadius:'3px', background:CHART_COLORS[i%CHART_COLORS.length], flexShrink:0 }} />
                                            <span style={{ flex:1, fontSize:'11px', color:JA.TEXT, fontFamily:'Inter,sans-serif', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.cuenta}</span>
                                            <span style={{ fontSize:'12px', fontWeight:700, color:CHART_COLORS[i%CHART_COLORS.length], fontFamily:'monospace', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{COP(c.total)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TAB: Estado de Cuenta ─────────────── */}
                    {activeTab === 'estado' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* KPIs cartera */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                                {[
                                    { label: 'Total Clientes', value: summary.estadoCuenta.length.toString(), color: JA.NAVY },
                                    { label: 'Cartera 0–30 días', value: COP(summary.estadoCuenta.reduce((s,c)=>s+c.d0_30,0)), color: JA.GREEN },
                                    { label: 'Cartera 31–90 días', value: COP(summary.estadoCuenta.reduce((s,c)=>s+c.d31_60+c.d61_90,0)), color: JA.GOLD },
                                    { label: 'Cartera +90 días', value: COP(summary.estadoCuenta.reduce((s,c)=>s+c.dMas90,0)), color: JA.RED },
                                    { label: 'Saldo Total Pendiente', value: COP(summary.estadoCuenta.reduce((s,c)=>s+c.saldoPendiente,0)), color: JA.NAVY, bold: true },
                                ].map((kpi, i) => (
                                    <div key={i} style={{ ...CARD, borderLeft: `3px solid ${kpi.color}`, padding: '14px 16px' }}>
                                        <p style={{ fontSize: '9px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px', fontFamily: 'Inter,sans-serif' }}>{kpi.label}</p>
                                        <p style={{ fontSize: '18px', fontWeight: 800, color: kpi.color, margin: 0, fontFamily: 'Inter,sans-serif', fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Tabla estado de cuenta */}
                            <div style={CARD}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT, margin: '0 0 2px', fontFamily: 'Montserrat,sans-serif' }}>Estado de Cuenta por Cliente / NIT</h3>
                                        <p style={{ fontSize: '10px', color: JA.GREY, margin: 0, fontFamily: 'Inter,sans-serif' }}>Cartera por antigüedad · ordenada por saldo mayor a menor</p>
                                    </div>
                                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', background: 'rgba(19,33,60,0.08)', color: JA.NAVY, border: '1px solid rgba(19,33,60,0.12)', fontFamily: 'Inter,sans-serif' }}>
                                        {summary.estadoCuenta.length} terceros
                                    </span>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'Inter,sans-serif' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #E0DDD8', background: '#F9F7F2' }}>
                                                {['NIT','Nombre / Razón Social','Facturado','Pagado','Saldo','0–30 d','31–60 d','61–90 d','+90 d','Última Fecha'].map(h => (
                                                    <th key={h} style={{ textAlign: 'left', padding: '9px 10px 9px 0', color: JA.GREY, fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summary.estadoCuenta.map((row, i) => {
                                                const tieneVencido = row.d61_90 > 0 || row.dMas90 > 0
                                                return (
                                                    <tr key={i}
                                                        style={{ borderBottom: '1px solid #F4F1EC', background: tieneVencido ? 'rgba(220,38,38,0.03)' : i%2===0?'transparent':'#FAFAF8' }}
                                                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background='#F0EDE6'}
                                                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = tieneVencido ? 'rgba(220,38,38,0.03)' : i%2===0?'transparent':'#FAFAF8'}>
                                                        <td style={{ padding: '8px 10px 8px 0', color: JA.GREY_LT, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{row.nit}</td>
                                                        <td style={{ padding: '8px 10px 8px 0', color: JA.TEXT, fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.nombre}</td>
                                                        <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', color: JA.NAVY, fontWeight: 700, whiteSpace: 'nowrap' }}>{COP(row.totalFacturado)}</td>
                                                        <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', color: JA.GREEN, whiteSpace: 'nowrap' }}>{row.totalPagado > 0 ? COP(row.totalPagado) : '—'}</td>
                                                        <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', fontWeight: 800, color: row.saldoPendiente > 0 ? (tieneVencido ? JA.RED : JA.GOLD) : JA.GREEN, whiteSpace: 'nowrap' }}>
                                                            {row.saldoPendiente > 0 ? COP(row.saldoPendiente) : <span style={{ color: JA.GREEN }}>✓ Pagado</span>}
                                                        </td>
                                                        <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', color: JA.GREEN, whiteSpace: 'nowrap' }}>{row.d0_30 > 0 ? COP(row.d0_30) : '—'}</td>
                                                        <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', color: JA.GOLD, whiteSpace: 'nowrap' }}>{row.d31_60 > 0 ? COP(row.d31_60) : '—'}</td>
                                                        <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', color: JA.GOLD, whiteSpace: 'nowrap' }}>{row.d61_90 > 0 ? COP(row.d61_90) : '—'}</td>
                                                        <td style={{ padding: '8px 10px 8px 0', fontFamily: 'monospace', color: row.dMas90 > 0 ? JA.RED : '#D0CDCA', fontWeight: row.dMas90 > 0 ? 700 : 400, whiteSpace: 'nowrap' }}>{row.dMas90 > 0 ? COP(row.dMas90) : '—'}</td>
                                                        <td style={{ padding: '8px 0', color: JA.GREY_LT, whiteSpace: 'nowrap' }}>{row.ultimaFecha}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                    {summary.estadoCuenta.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '32px', color: JA.GREY_LT, fontSize: '12px', fontFamily: 'Inter,sans-serif' }}>
                                            No se detectaron NITs en el Sheet. Verifica que el archivo tenga columnas de NIT o Identificación.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TAB: Tabla detalle ─────────────────── */}
                    {activeTab === 'table' && (
                        <div style={CARD}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
                                <h3 style={{ fontSize:'13px', fontWeight:700, color:JA.TEXT, margin:0, fontFamily:'Montserrat,sans-serif' }}>Detalle de Movimientos</h3>
                                <span style={{ fontSize:'10px', fontWeight:700, padding:'3px 10px', borderRadius:'12px', background:'rgba(15,123,113,0.1)', color:JA.TEAL, border:`1px solid rgba(15,123,113,0.2)`, fontFamily:'Inter,sans-serif' }}>
                                    {summary.rows.length.toLocaleString()} registros
                                </span>
                            </div>
                            <div style={{ overflowX:'auto' }}>
                                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px', fontFamily:'Inter,sans-serif' }}>
                                    <thead>
                                        <tr style={{ borderBottom:`2px solid #E0DDD8`, background:'#F9F7F2' }}>
                                            {['Fecha','Descripción','Cuenta','NIT','Debe','Haber','Saldo'].map(h => (
                                                <th key={h} style={{ textAlign:'left', padding:'9px 10px 9px 0', color:JA.GREY, fontWeight:700, fontSize:'9px', textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.rows.slice(0,150).map((row,i) => (
                                            <tr key={i} style={{ borderBottom:`1px solid #F4F1EC`, background: i%2===0?'transparent':'#FAFAF8' }}
                                                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background='#F0EDE6'}
                                                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = i%2===0?'transparent':'#FAFAF8'}>
                                                <td style={{ padding:'7px 10px 7px 0', color:JA.GREY, whiteSpace:'nowrap' }}>{row.fecha}</td>
                                                <td style={{ padding:'7px 10px 7px 0', color:JA.TEXT, fontWeight:500, maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.descripcion}</td>
                                                <td style={{ padding:'7px 10px 7px 0', color:JA.GREY_LT, whiteSpace:'nowrap' }}>{row.cuenta}</td>
                                                <td style={{ padding:'7px 10px 7px 0', color:JA.GREY_LT }}>{row.nit}</td>
                                                <td style={{ padding:'7px 10px 7px 0', fontFamily:'monospace', fontWeight:700, color:row.debe>0?JA.TEAL:'#D0CDCA', whiteSpace:'nowrap' }}>{row.debe>0?COP(row.debe):'—'}</td>
                                                <td style={{ padding:'7px 10px 7px 0', fontFamily:'monospace', fontWeight:700, color:row.haber>0?JA.RED:'#D0CDCA', whiteSpace:'nowrap' }}>{row.haber>0?COP(row.haber):'—'}</td>
                                                <td style={{ padding:'7px 0', fontFamily:'monospace', color:(row.saldo||0)>=0?JA.GREEN:JA.RED, whiteSpace:'nowrap' }}>{row.saldo?COP(row.saldo):'—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {summary.rows.length > 150 && (
                                    <div style={{ textAlign:'center', padding:'12px', fontSize:'11px', color:JA.GREY, borderTop:`1px solid #E0DDD8` }}>
                                        Mostrando 150 de {summary.rows.length.toLocaleString()} registros
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @media (max-width: 768px) {
                    .responsive-charts > div { grid-column: 1 / -1 !important; }
                }
            `}</style>
        </div>
    )
}
