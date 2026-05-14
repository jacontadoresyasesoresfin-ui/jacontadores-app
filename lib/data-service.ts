import Papa from 'papaparse'

export interface DashboardMetrics {
    title: string
    value: string
    change: number
    changeLabel: string
    trend: 'up' | 'down' | 'neutral'
    rawValue: number
    sparklineData: number[]
}

export interface TaxData {
    totalVentasBruto: number
    totalIVACobrado: number
    totalIVAPorPagar: number
    totalReteFuente: number
    totalReteIVA: number
    totalReteICA: number
    totalImpuestosCargo: number
    monthlyBreakdown: {
        month: string; ventas: number; iva: number
        reteFuente: number; reteICA: number; neto: number
    }[]
    ivaDeclaracionBimestral: number
    ivaDeclaracionCuatrimestral: number
    baseGravableRenta: number
    impuestoRentaEstimado: number
    totalFacturas: number
    facturasPendientes: number
    tasaEfectivaTributaria: number
    regimenSugerido: 'Simplificado' | 'Ordinario' | 'Simple (SIMPLE)'
    alertas: string[]
    fuenteDatos: {
        ivaReal: boolean; subtotalReal: boolean; reteFuenteReal: boolean
        reteICAReal: boolean; columnasDetectadas: string[]
    }
    /* Tasas aplicadas — para mostrar en UI */
    tasasAplicadas: TaxRates
}

export interface ClientData {
    id: string
    name: string
    metrics: {
        sales: DashboardMetrics
        newClients: DashboardMetrics
        overdue: DashboardMetrics
        productsSold: DashboardMetrics
    }
    salesHistory: { date: string; amount: number }[]
    topClients: { name: string; amount: number; percent: number }[]
    portfolio: {
        total: string
        current:  { value: string; percent: number; color: string }
        dueSoon:  { value: string; percent: number; color: string }
        overdue:  { value: string; percent: number; color: string }
    }
    recentActivity: {
        type: 'sale' | 'payment' | 'alert'
        text: string; client: string; amount: string; time: string; color: string
    }[]
    recurringCustomers: { name: string; count: number; total: number }[]
    topProducts:        { name: string; count: number; total: number }[]
    prediction: { nextMonth: number; growthRate: number; formula: string }
    taxData: TaxData
}

/* ─────────────────────────────────────────────────────────────
   TASAS TRIBUTARIAS CONFIGURABLES
   Fuente: Estatuto Tributario, Decreto DIAN vigente 2025
   ───────────────────────────────────────────────────────────── */
export interface TaxRates {
    UVT: number              // Unidad de Valor Tributario (DIAN - anual)
    SMMLV: number            // Salario Mínimo Mensual Legal Vigente
    IVA_RATE: number         // Tarifa general IVA (Art. 468 ET)
    RETE_FUENTE: number      // ReteFuente compras/servicios general (Art. 383)
    RETE_IVA: number         // ReteIVA (15% del IVA — Art. 437-1)
    RETE_ICA_BOGOTA: number  // ReteICA Bogotá (Acuerdo 65/2002)
    RENTA_RATE: number       // Tarifa Renta Personas Jurídicas (Art. 240)
    COSTO_ESTIMADO: number   // % costos sobre ingresos (estimado)
}

export const DEFAULT_TAX_RATES: TaxRates = {
    UVT:              49_799,   // 2025 — Decreto 2604/2024
    SMMLV:         1_300_606,   // 2025 — Decreto 2641/2024
    IVA_RATE:          0.19,    // 19% — Ley 1819/2016, mantiene 2025
    RETE_FUENTE:       0.035,   // 3.5% general — Art. 383 ET
    RETE_IVA:          0.15,    // 15% — Art. 437-1 ET
    RETE_ICA_BOGOTA:   0.00414, // 4.14‰ — tarifa media Bogotá Acuerdo 65
    RENTA_RATE:        0.35,    // 35% — Art. 240 ET (PJ)
    COSTO_ESTIMADO:    0.65,    // 65% costos estimados s/ventas
}

export const LS_TAX_KEY = 'ja_tax_config'

export const loadTaxRates = (): TaxRates => {
    if (typeof window === 'undefined') return DEFAULT_TAX_RATES
    try {
        const stored = localStorage.getItem(LS_TAX_KEY)
        if (stored) return { ...DEFAULT_TAX_RATES, ...JSON.parse(stored) }
    } catch { /* ignore */ }
    return DEFAULT_TAX_RATES
}

export const saveTaxRates = (rates: TaxRates) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(LS_TAX_KEY, JSON.stringify(rates))
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────── */
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

/** Normaliza cualquier formato de fecha a YYYY-MM-DD */
const normalizeDate = (raw: string): string => {
    const s = String(raw || '').split(' ')[0].split('T')[0].trim()
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    // DD-MM-YYYY o DD/MM/YYYY o D-M-YYYY
    const m1 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
    if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
    // DD.MM.YYYY
    const m2 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
    if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`
    // YYYYMMDD
    if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
    // DD-MM-YY
    const m3 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})$/)
    if (m3) return `20${m3[3]}-${m3[2].padStart(2,'0')}-${m3[1].padStart(2,'0')}`
    return s
}

const parseNum = (val: unknown): number => {
    if (val === null || val === undefined || val === '') return 0
    const cleaned = String(val).replace(/\s/g,'').replace(/\./g,'').replace(/,/g,'.')
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : Math.abs(n)
}

/* ─────────────────────────────────────────────────────────────
   CONVIERTE CUALQUIER URL DE GOOGLE SHEETS A FORMATO CSV
   Soporta:
     - /edit, /view, /htmlview  → /export?format=csv
     - /pub?output=csv          → pasa sin cambio
     - /pub (sin output)        → agrega output=csv
     - /d/e/2PACX-... (publicado)→ /pub?output=csv
   ───────────────────────────────────────────────────────────── */
function convertSheetUrl(url: string): string {
    const u = url.trim()
    if (!u) return u

    // Ya es un export CSV válido — no tocar
    if (u.includes('output=csv') || u.includes('format=csv')) return u

    // Formato publicado como web: /d/e/2PACX-...
    if (u.includes('/d/e/')) {
        const base = u.replace(/\/pub.*$/, '/pub')
        return `${base}?output=csv`
    }

    // Formato edición o vista normal: /d/SHEET_ID/edit o /d/SHEET_ID/view etc.
    const idMatch = u.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (idMatch) {
        const gidMatch = u.match(/[?&]gid=([0-9]+)/)
        const gid = gidMatch?.[1] ?? '0'
        return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`
    }

    // Cualquier otra cosa — devolver sin cambio
    return u
}


/* ─────────────────────────────────────────────────────────────
   FETCH + PARSE DATA FROM GOOGLE SHEETS
   ───────────────────────────────────────────────────────────── */
export const fetchClientData = async (
    clientName: string,
    googleSheetUrl: string
): Promise<ClientData> => {
    return new Promise(async (resolve, reject) => {
        if (!googleSheetUrl) {
            reject(new Error('No Google Sheet URL provided'))
            return
        }

        try {
            // Convertir la URL al formato CSV exportable antes de enviar al proxy
            const csvUrl = convertSheetUrl(googleSheetUrl)
            const res = await fetch(`/api/sheets-proxy?url=${encodeURIComponent(csvUrl)}`)
            if (!res.ok) throw new Error(`Proxy error: ${res.status} ${res.statusText}`)
            const csvText = await res.text()

            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                transformHeader: (h) => h.trim(),
                complete: (results) => {
                    const rows = results.data as Record<string, unknown>[]
                    const normalizedSearch = clientName.toLowerCase().trim()
                    const filteredRows = normalizedSearch === 'empresa demo'
                        ? rows.slice(0, 50)
                        : rows

                    /* ── Acumuladores ───────────────────────────────── */
                    let totalSales = 0
                    const dateAggregation:     Record<string, number>                                 = {}
                    const clientRecurrence:    Record<string, { name: string; count: number; total: number }> = {}
                    const productAggregation:  Record<string, { count: number; total: number }>       = {}
                    const uniqueClients = new Set<string>()

                    /* Columnas de fecha más comunes en facturas electrónicas DIAN */
                    const DATE_COLS = [
                        'Fecha Recepción','Fecha Emisión','Fecha','fecha emisi',
                        'Fecha Factura','Fecha de Factura','FechaFactura',
                        'Fecha Vencimiento','Fecha Pago',
                    ]

                    filteredRows.forEach(row => {
                        const rawValue = String(row['Total'] || '0')
                            .replace(/\s/g,'').replace(/\./g,'').replace(/,/g,'.')
                        const val = parseFloat(rawValue)
                        if (isNaN(val) || val <= 0) return

                        totalSales += val

                        /* Cliente */
                        const receptorId   = String(
                            row['NIT Receptor'] || row['NIT Emisor'] || row['NIT'] ||
                            row['Identificación'] || row['Cédula'] ||
                            row['Nombre Receptor'] || 'Otros'
                        ).trim()
                        const receptorName = String(
                            row['Nombre Receptor'] || row['Nombre Emisor'] || receptorId
                        ).trim()
                        uniqueClients.add(receptorName)

                        if (!clientRecurrence[receptorId])
                            clientRecurrence[receptorId] = { name: receptorName, count: 0, total: 0 }
                        clientRecurrence[receptorId].count++
                        clientRecurrence[receptorId].total += val

                        /* Producto */
                        const productName = String(
                            row['Descripción'] || row['Nombre Producto'] || row['Detalle'] ||
                            row['Concepto'] || row['Producto'] || 'Factura/Servicio'
                        ).trim()
                        if (!productAggregation[productName])
                            productAggregation[productName] = { count: 0, total: 0 }
                        productAggregation[productName].count++
                        productAggregation[productName].total += val

                        /* Fecha — busca la primera columna con valor */
                        const rawDate = String(
                            DATE_COLS.map(c => row[c]).find(v => v && String(v).trim()) || ''
                        )
                        const isoDate = normalizeDate(rawDate.split(' ')[0])
                        if (isoDate && isoDate.length >= 7) {
                            dateAggregation[isoDate] = (dateAggregation[isoDate] || 0) + val
                        }
                    })

                    /* ── Historial de ventas (últimos 90 días, ISO asc) ── */
                    const salesHistory = Object.entries(dateAggregation)
                        .map(([date, amount]) => ({ date: normalizeDate(date), amount }))
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .slice(-90)

                    /* ── Cambio MoM real ──────────────────────────────── */
                    const monthlyGrouped: Record<string, number> = {}
                    salesHistory.forEach(({ date, amount }) => {
                        const mk = date.slice(0, 7)
                        monthlyGrouped[mk] = (monthlyGrouped[mk] || 0) + amount
                    })
                    const sortedMK = Object.keys(monthlyGrouped).sort()
                    const lastMoSales = monthlyGrouped[sortedMK.at(-1) || ''] || 0
                    const prevMoSales = monthlyGrouped[sortedMK.at(-2) || ''] || lastMoSales
                    const salesChange = prevMoSales > 0
                        ? Math.round(((lastMoSales - prevMoSales) / prevMoSales) * 1000) / 10
                        : 0

                    /* Clientes únicos MoM */
                    const clientsByMonth: Record<string, Set<string>> = {}
                    filteredRows.forEach(row => {
                        const rawDate = String(DATE_COLS.map(c => row[c]).find(v => v && String(v).trim()) || '')
                        const iso = normalizeDate(rawDate.split(' ')[0])
                        const mk = iso.slice(0, 7)
                        if (!clientsByMonth[mk]) clientsByMonth[mk] = new Set()
                        const name = String(row['Nombre Receptor'] || row['NIT Receptor'] || 'Otros')
                        clientsByMonth[mk].add(name)
                    })
                    const sortedMKc = Object.keys(clientsByMonth).sort()
                    const lastMoClients = clientsByMonth[sortedMKc.at(-1) || '']?.size || 0
                    const prevMoClients = clientsByMonth[sortedMKc.at(-2) || '']?.size || lastMoClients
                    const clientsChange = prevMoClients > 0
                        ? Math.round(((lastMoClients - prevMoClients) / prevMoClients) * 1000) / 10
                        : 0

                    /* ── Top Clientes ─────────────────────────────────── */
                    const sortedClients = Object.values(clientRecurrence)
                        .sort((a, b) => b.total - a.total).slice(0, 8)
                    const maxAmount = sortedClients[0]?.total || 1
                    const topClients = sortedClients.map(c => ({
                        name: c.name, amount: c.total,
                        percent: Math.round((c.total / maxAmount) * 100)
                    }))

                    /* ── Cartera estimada ─────────────────────────────── */
                    const portfolioTotal = totalSales * 1.2
                    const portfolio = {
                        total:    `COP $${Math.round(portfolioTotal).toLocaleString('es-CO')}`,
                        current:  { value: `COP $${Math.round(portfolioTotal * 0.6).toLocaleString('es-CO')}`,  percent: 60, color: '#10B981' },
                        dueSoon:  { value: `COP $${Math.round(portfolioTotal * 0.25).toLocaleString('es-CO')}`, percent: 25, color: '#F59E0B' },
                        overdue:  { value: `COP $${Math.round(portfolioTotal * 0.15).toLocaleString('es-CO')}`, percent: 15, color: '#EF4444' },
                    }

                    /* ── Actividad reciente ───────────────────────────── */
                    const recentActivity = filteredRows.slice(-6).reverse().map(row => {
                        const raw = String(row['Total'] || '0').replace(/\s/g,'').replace(/\./g,'').replace(/,/g,'.')
                        const amt = parseFloat(raw)
                        const rawDate = String(DATE_COLS.map(c => row[c]).find(v => v) || '')
                        return {
                            type: 'sale' as const, text: 'Venta Procesada',
                            client: String(row['Nombre Receptor'] || row['NIT Receptor'] || 'Cliente').trim(),
                            amount: `COP $${(isNaN(amt) ? 0 : amt).toLocaleString('es-CO')}`,
                            time:   normalizeDate(rawDate.split(' ')[0]) || 'Reciente',
                            color:  '#10B981'
                        }
                    })

                    /* ── Tax Data ─────────────────────────────────────── */
                    const taxRates = loadTaxRates()

                    resolve({
                        id:   normalizedSearch.replace(/\s+/g, '-'),
                        name: clientName,
                        metrics: {
                            sales: {
                                title: 'Ventas Totales',
                                value: `COP $${Math.round(totalSales).toLocaleString('es-CO')}`,
                                rawValue: totalSales,
                                change: salesChange,
                                changeLabel: sortedMK.length >= 2 ? 'vs mes anterior (real)' : 'período actual',
                                trend: salesChange >= 0 ? 'up' : 'down',
                                sparklineData: salesHistory.slice(-12).map(h => h.amount),
                            },
                            newClients: {
                                title: 'Clientes Únicos',
                                value: uniqueClients.size.toString(),
                                rawValue: uniqueClients.size,
                                change: clientsChange,
                                changeLabel: sortedMKc.length >= 2 ? 'vs mes anterior (real)' : 'período actual',
                                trend: clientsChange >= 0 ? 'up' : 'down',
                                sparklineData: Object.values(clientsByMonth).map(s => s.size),
                            },
                            overdue: {
                                title: 'Cartera Vencida (Est.)',
                                value: `COP $${Math.round(portfolioTotal * 0.15).toLocaleString('es-CO')}`,
                                rawValue: portfolioTotal * 0.15,
                                change: 0,
                                changeLabel: 'estimado 15% cartera',
                                trend: 'neutral',
                                sparklineData: [20, 18, 15, 12],
                            },
                            productsSold: {
                                title: 'Facturas / Registros',
                                value: filteredRows.length.toString(),
                                rawValue: filteredRows.length,
                                change: 0,
                                changeLabel: 'total registros Sheet',
                                trend: 'neutral',
                                sparklineData: [],
                            },
                        },
                        salesHistory,
                        topClients,
                        portfolio,
                        recentActivity,
                        recurringCustomers: Object.values(clientRecurrence)
                            .sort((a, b) => b.count - a.count).slice(0, 8),
                        topProducts: Object.entries(productAggregation)
                            .map(([name, stats]) => ({ name, ...stats }))
                            .sort((a, b) => b.count - a.count).slice(0, 8),
                        prediction: calculatePrediction(salesHistory.map(h => h.amount)),
                        taxData: calculateTaxData(filteredRows, totalSales, taxRates),
                    })
                },
                error: (err: Error) => reject(err),
            })
        } catch (err) {
            reject(err)
        }
    })
}

/* ─────────────────────────────────────────────────────────────
   PREDICCIÓN LINEAL
   ───────────────────────────────────────────────────────────── */
const calculatePrediction = (history: number[]) => {
    if (history.length < 2) return { nextMonth: 0, growthRate: 0, formula: 'Datos insuficientes' }
    const n = history.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
    for (let i = 0; i < n; i++) { sumX += i; sumY += history[i]; sumXY += i * history[i]; sumX2 += i * i }
    const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    const nextMonth = Math.max(0, slope * (n + 15) + intercept) * 30 / (n || 1)
    const growthRate = (slope / (sumY / n || 1)) * 100
    return {
        nextMonth,
        growthRate,
        formula: `Y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)} | R²≈ regresión ${n} puntos`,
    }
}

/* ─────────────────────────────────────────────────────────────
   CÁLCULO TRIBUTARIO — COLOMBIANO — con tasas configurables
   ───────────────────────────────────────────────────────────── */
export const calculateTaxData = (
    rows: Record<string, unknown>[],
    totalVentas: number,
    rates?: TaxRates
): TaxData => {
    const R = rates ?? loadTaxRates()

    const DATE_COLS = ['Fecha Recepción','Fecha Emisión','Fecha','fecha emisi','Fecha Factura']

    /* ── Detección dinámica de columnas ── */
    const sampleRow = rows[0] || {}
    const cols = Object.keys(sampleRow).map(k => k.trim())

    const colIVA        = cols.find(c => /^(iva|valor\s*iva|impuesto|iva\s*19|valor\s*impuesto|taxes?|vat)$/i.test(c)) || null
    const colSubtotal   = cols.find(c => /^(subtotal|valor\s*bruto|base|base\s*gravable|valor\s*sin\s*iva|neto\s*factura)$/i.test(c)) || null
    const colReteFuente = cols.find(c => /^(retefuente|rete\s*fuente|retenci[oó]n\s*fuente|retenci[oó]n\s*en\s*la\s*fuente|rtefte)$/i.test(c)) || null
    const colReteICA    = cols.find(c => /^(reteica|rete\s*ica|retenci[oó]n\s*ica|ica)$/i.test(c)) || null
    const colTotal      = cols.find(c => /^total$/i.test(c)) || 'Total'

    const fuenteDatos = {
        ivaReal:        colIVA !== null,
        subtotalReal:   colSubtotal !== null,
        reteFuenteReal: colReteFuente !== null,
        reteICAReal:    colReteICA !== null,
        columnasDetectadas: [colIVA, colSubtotal, colReteFuente, colReteICA].filter(Boolean) as string[],
    }

    let sumIVA = 0, sumSubtotal = 0, sumReteFuente = 0, sumReteICA = 0
    const monthlyMap: Record<string, { ventas:number; iva:number; reteFuente:number; reteICA:number; facturas:number }> = {}

    rows.forEach(row => {
        const total = parseNum(row[colTotal])
        if (total <= 0) return

        const ivaRow        = colIVA        ? parseNum(row[colIVA])        : null
        const subtotalRow   = colSubtotal   ? parseNum(row[colSubtotal])   : null
        const reteFuenteRow = colReteFuente ? parseNum(row[colReteFuente]) : null
        const reteICARow    = colReteICA    ? parseNum(row[colReteICA])    : null

        const ivaUsado        = ivaRow        !== null ? ivaRow        : total * R.IVA_RATE / (1 + R.IVA_RATE)
        const subtotalUsado   = subtotalRow   !== null ? subtotalRow   : total - ivaUsado
        const reteFuenteUsado = reteFuenteRow !== null ? reteFuenteRow : subtotalUsado * R.RETE_FUENTE
        const reteICAUsado    = reteICARow    !== null ? reteICARow    : total * R.RETE_ICA_BOGOTA

        sumIVA += ivaUsado; sumSubtotal += subtotalUsado
        sumReteFuente += reteFuenteUsado; sumReteICA += reteICAUsado

        /* Fecha normalizada */
        const rawDate = String(DATE_COLS.map(c => row[c]).find(v => v && String(v).trim()) || '')
        const iso     = normalizeDate(rawDate.split(' ')[0])
        let month = 'Sin fecha'
        if (iso && iso.length >= 7) {
            const [y, m] = iso.split('-')
            month = `${MONTH_NAMES[parseInt(m) - 1] || 'Mes'} ${y}`
        }

        if (!monthlyMap[month]) monthlyMap[month] = { ventas:0, iva:0, reteFuente:0, reteICA:0, facturas:0 }
        monthlyMap[month].ventas      += total
        monthlyMap[month].iva         += ivaUsado
        monthlyMap[month].reteFuente  += reteFuenteUsado
        monthlyMap[month].reteICA     += reteICAUsado
        monthlyMap[month].facturas    += 1
    })

    const totalVentasBruto   = sumSubtotal > 0 ? sumSubtotal : totalVentas - sumIVA
    const totalIVACobrado    = sumIVA
    const totalIVAPorPagar   = fuenteDatos.ivaReal ? totalIVACobrado : totalIVACobrado * 0.70
    const totalReteFuente    = sumReteFuente
    const totalReteIVA       = totalIVACobrado * R.RETE_IVA
    const totalReteICA       = sumReteICA
    const totalImpuestosCargo = totalIVAPorPagar + totalReteIVA + totalReteICA

    const utilidadEstimada    = totalVentasBruto * (1 - R.COSTO_ESTIMADO)
    const baseGravableRenta   = Math.max(0, utilidadEstimada)
    const impuestoRentaEstimado = baseGravableRenta * R.RENTA_RATE

    /* Desglose mensual ordenado cronológicamente */
    const monthlyBreakdown = Object.entries(monthlyMap)
        .sort(([a], [b]) => {
            const toDate = (s: string) => {
                const parts = s.split(' ')
                const mName = parts[0]; const yr = parts[1] || '0'
                return parseInt(yr) * 100 + MONTH_NAMES.indexOf(mName)
            }
            return toDate(a) - toDate(b)
        })
        .slice(-12)
        .map(([month, d]) => ({
            month,
            ventas:     Math.round(d.ventas),
            iva:        Math.round(d.iva),
            reteFuente: Math.round(d.reteFuente),
            reteICA:    Math.round(d.reteICA),
            neto:       Math.round(d.ventas - d.reteFuente - d.reteICA),
        }))

    const ingresoEnUVT = totalVentas / R.UVT
    let regimenSugerido: TaxData['regimenSugerido'] = 'Ordinario'
    if (ingresoEnUVT < 3500) regimenSugerido = 'Simplificado'
    else if (ingresoEnUVT <= 100_000) regimenSugerido = 'Simple (SIMPLE)'

    const alertas: string[] = []
    if (!fuenteDatos.ivaReal)
        alertas.push(`ℹ️ IVA calculado al ${(R.IVA_RATE * 100).toFixed(0)}% (columna IVA no encontrada en Sheet)`)
    if (!fuenteDatos.reteFuenteReal)
        alertas.push(`ℹ️ ReteFuente estimada al ${(R.RETE_FUENTE * 100).toFixed(1)}% (columna no encontrada)`)
    if (!fuenteDatos.reteICAReal)
        alertas.push(`ℹ️ ReteICA estimada ${(R.RETE_ICA_BOGOTA * 1000).toFixed(2)}‰ tarifa Bogotá (columna no encontrada)`)
    if (fuenteDatos.ivaReal)
        alertas.push(`✅ IVA leído del Sheet — columna "${colIVA}"`)
    if (fuenteDatos.columnasDetectadas.length > 0)
        alertas.push(`📊 Columnas tributarias detectadas: ${fuenteDatos.columnasDetectadas.join(', ')}`)
    if (totalIVAPorPagar > 5_000_000)
        alertas.push('⚠️ IVA bimestral supera $5M COP — verifique declaración DIAN')
    if (totalReteFuente > 0)
        alertas.push(`📋 ReteFuente acumulada: COP $${Math.round(totalReteFuente).toLocaleString('es-CO')}`)
    if (ingresoEnUVT > 3_500 && ingresoEnUVT <= 100_000)
        alertas.push('💡 Puede acogerse al Régimen SIMPLE para reducir carga tributaria')

    return {
        totalVentasBruto:       Math.round(totalVentasBruto),
        totalIVACobrado:        Math.round(totalIVACobrado),
        totalIVAPorPagar:       Math.round(totalIVAPorPagar),
        totalReteFuente:        Math.round(totalReteFuente),
        totalReteIVA:           Math.round(totalReteIVA),
        totalReteICA:           Math.round(totalReteICA),
        totalImpuestosCargo:    Math.round(totalImpuestosCargo),
        monthlyBreakdown,
        ivaDeclaracionBimestral:     Math.round(totalIVAPorPagar / 6),
        ivaDeclaracionCuatrimestral: Math.round(totalIVAPorPagar / 3),
        baseGravableRenta:      Math.round(baseGravableRenta),
        impuestoRentaEstimado:  Math.round(impuestoRentaEstimado),
        totalFacturas:          rows.length,
        facturasPendientes:     Math.round(rows.length * 0.12),
        tasaEfectivaTributaria: totalVentas > 0
            ? Math.round((totalImpuestosCargo / totalVentas) * 10000) / 100
            : 0,
        regimenSugerido,
        alertas,
        fuenteDatos,
        tasasAplicadas: R,
    }
}
