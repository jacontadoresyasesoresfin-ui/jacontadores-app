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
    // Totales brutos
    totalVentasBruto: number       // Subtotal sin IVA (real o calculado)
    totalIVACobrado: number        // IVA generado (ventas) — real si CSV tiene columna IVA
    totalIVAPorPagar: number       // IVA a declarar (cobrado - descontable)
    totalReteFuente: number        // Retención en la fuente
    totalReteIVA: number           // ReteIVA (15% del IVA cobrado)
    totalReteICA: number           // Retención ICA
    totalImpuestosCargo: number    // Suma total de impuestos a cargo

    // Desglose mensual para gráficas
    monthlyBreakdown: {
        month: string
        ventas: number
        iva: number
        reteFuente: number
        reteICA: number
        neto: number
    }[]

    // Para declaraciones
    ivaDeclaracionBimestral: number
    ivaDeclaracionCuatrimestral: number
    baseGravableRenta: number
    impuestoRentaEstimado: number

    // Indicadores de cumplimiento
    totalFacturas: number
    facturasPendientes: number
    tasaEfectivaTributaria: number

    // Régimen
    regimenSugerido: 'Simplificado' | 'Ordinario' | 'Simple (SIMPLE)'
    alertas: string[]

    // Metadatos: indica qué valores vienen del CSV real
    fuenteDatos: {
        ivaReal: boolean         // true si la columna IVA/Valor IVA existe en el CSV
        subtotalReal: boolean    // true si la columna Subtotal/Valor existe en el CSV
        reteFuenteReal: boolean  // true si ReteFuente viene del CSV
        reteICAReal: boolean     // true si ReteICA viene del CSV
        columnasDetectadas: string[]  // nombres de columnas reconocidas
    }
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
        current: { value: string; percent: number; color: string }
        dueSoon: { value: string; percent: number; color: string }
        overdue: { value: string; percent: number; color: string }
    }
    recentActivity: {
        type: 'sale' | 'payment' | 'alert'
        text: string
        client: string
        amount: string
        time: string
        color: string
    }[]
    recurringCustomers: { name: string; count: number; total: number }[]
    topProducts: { name: string; count: number; total: number }[]
    prediction: {
        nextMonth: number
        growthRate: number
        formula: string
    }
    taxData: TaxData
}

export const fetchClientData = async (clientName: string, googleSheetUrl: string): Promise<ClientData> => {
    return new Promise((resolve, reject) => {
        if (!googleSheetUrl) {
            reject(new Error("No Google Sheet URL provided"))
            return
        }

        Papa.parse(googleSheetUrl, {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            complete: (results) => {
                const rows = results.data as Record<string, unknown>[]

                // Filtrar por empresa (Emisor o Receptor)
                const normalizedSearch = clientName.toLowerCase().trim()
                const filteredRows = (normalizedSearch === 'empresa demo' || normalizedSearch === '')
                    ? rows
                    : rows.filter(row =>
                        String(row['Nombre Emisor'] || '').toLowerCase().includes(normalizedSearch) ||
                        String(row['Nombre Receptor'] || '').toLowerCase().includes(normalizedSearch)
                    )

                let totalSales = 0
                const dateAggregation: Record<string, number> = {}
                const clientRecurrence: Record<string, { name: string; count: number; total: number }> = {}
                const productAggregation: Record<string, { count: number; total: number }> = {}
                const uniqueClients = new Set<string>()

                filteredRows.forEach(row => {
                    const rawValue = String(row['Total'] || '0')
                        .replace(/\s/g, '')
                        .replace(/\./g, '')
                        .replace(/,/g, '.')
                    const numericValue = parseFloat(rawValue)
                    const val = isNaN(numericValue) ? 0 : numericValue

                    if (val > 0) {
                        totalSales += val

                        // Identificación y Nombre del Receptor
                        const receptorId = String(row['NIT'] || row['Identificación'] || row['Cédula'] || row['Nombre Receptor'] || 'Otros').trim()
                        const receptorName = String(row['Nombre Receptor'] || receptorId)
                        uniqueClients.add(receptorName)

                        // Recurrencia de Clientes (Agrupar por ID para mayor precisión)
                        if (!clientRecurrence[receptorId]) clientRecurrence[receptorId] = { name: receptorName, count: 0, total: 0 }
                        clientRecurrence[receptorId].count++
                        clientRecurrence[receptorId].total += val

                        // Productos (Búsqueda dinámica de columna)
                        const productName = String(row['Descripción'] || row['Nombre Producto'] || row['Detalle'] || 'Servicio/Varios').trim()
                        if (!productAggregation[productName]) productAggregation[productName] = { count: 0, total: 0 }
                        productAggregation[productName].count++
                        productAggregation[productName].total += val

                        const fullDate = String(row['Fecha Recepción'] || '')
                        const shortDate = fullDate.split(' ')[0] // DD-MM-YYYY
                        if (shortDate) {
                            dateAggregation[shortDate] = (dateAggregation[shortDate] || 0) + val
                        }
                    }
                })

                // Generar historial últimos 30 días ordenado por fecha
                const salesHistory = Object.entries(dateAggregation)
                    .map(([date, amount]) => ({ date, amount }))
                    .sort((a, b) => {
                        const [d1, m1, y1] = a.date.split('-').map(Number)
                        const [d2, m2, y2] = b.date.split('-').map(Number)
                        return new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime()
                    })
                    .slice(-30)

                // Top Clientes — derived from clientRecurrence (ordered by total amount)
                const sortedClients = Object.values(clientRecurrence)
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 5)

                const maxAmount = sortedClients[0]?.total || 1
                const topClients = sortedClients.map(c => ({
                    name: c.name,
                    amount: c.total,
                    percent: Math.round((c.total / maxAmount) * 100)
                }))

                // Cartera simulada basada en el total
                const portfolioTotal = totalSales * 1.2
                const portfolio = {
                    total: `COP $${Math.round(portfolioTotal).toLocaleString('es-CO')}`,
                    current: { value: `COP $${Math.round(portfolioTotal * 0.6).toLocaleString('es-CO')}`, percent: 60, color: '#0ECB81' },
                    dueSoon: { value: `COP $${Math.round(portfolioTotal * 0.25).toLocaleString('es-CO')}`, percent: 25, color: '#F0B90B' },
                    overdue: { value: `COP $${Math.round(portfolioTotal * 0.15).toLocaleString('es-CO')}`, percent: 15, color: '#F6465D' },
                }

                // Actividad Reciente
                const recentActivity = filteredRows.slice(-6).reverse().map(row => {
                    const rawValue = String(row['Total'] || '0').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.')
                    const numericAmount = parseFloat(rawValue)
                    return {
                        type: 'sale' as const,
                        text: 'Venta Procesada',
                        client: String(row['Nombre Receptor'] || 'Cliente'),
                        amount: `COP $${(isNaN(numericAmount) ? 0 : numericAmount).toLocaleString('es-CO')}`,
                        time: String(row['Fecha Recepción'] || '').split(' ')[0] || 'Reciente',
                        color: '#0ECB81'
                    }
                })

                resolve({
                    id: normalizedSearch.replace(/\s+/g, '-'),
                    name: clientName,
                    metrics: {
                        sales: {
                            title: 'Ventas Totales',
                            value: `COP $${Math.round(totalSales).toLocaleString('es-CO')}`,
                            rawValue: totalSales,
                            change: 12.5,
                            changeLabel: 'vs mes anterior',
                            trend: 'up',
                            sparklineData: salesHistory.length > 0 ? salesHistory.map(h => h.amount) : [10, 20, 15, 30]
                        },
                        newClients: {
                            title: 'Clientes Únicos',
                            value: uniqueClients.size.toString(),
                            rawValue: uniqueClients.size,
                            change: 5.2,
                            changeLabel: 'vs mes anterior',
                            trend: 'up',
                            sparklineData: [5, 10, 8, 15]
                        },
                        overdue: {
                            title: 'Cartera Vencida (Est.)',
                            value: `COP $${Math.round(portfolioTotal * 0.15).toLocaleString('es-CO')}`,
                            rawValue: portfolioTotal * 0.15,
                            change: -2.1,
                            changeLabel: 'vs mes anterior',
                            trend: 'down',
                            sparklineData: [20, 18, 15, 12]
                        },
                        productsSold: {
                            title: 'Facturas Emitidas',
                            value: filteredRows.length.toString(),
                            rawValue: filteredRows.length,
                            change: 8.4,
                            changeLabel: 'vs mes anterior',
                            trend: 'up',
                            sparklineData: [100, 120, 110, 140]
                        }
                    },
                    salesHistory: salesHistory.length > 0 ? salesHistory : [],
                    topClients,
                    portfolio,
                    recentActivity,
                    recurringCustomers: Object.values(clientRecurrence)
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 8),
                    topProducts: Object.entries(productAggregation)
                        .map(([name, stats]) => ({ name, ...stats }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 8),
                    prediction: calculatePrediction(salesHistory.map(h => h.amount)),
                    taxData: calculateTaxData(filteredRows, totalSales)
                })
            },
            error: (err) => {
                reject(err)
            }
        })
    })
}

const calculatePrediction = (history: number[]) => {
    if (history.length < 2) return { nextMonth: 0, growthRate: 0, formula: "Datos insuficientes" }

    // Regresión lineal simple (x = índice, y = monto)
    const n = history.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
    for (let i = 0; i < n; i++) {
        sumX += i
        sumY += history[i]
        sumXY += i * history[i]
        sumX2 += i * i
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Predicción para el siguiente periodo (30 días)
    const nextMonth = Math.max(0, (slope * (n + 15) + intercept) * 30 / (n || 1))
    const growthRate = (slope / (sumY / n || 1)) * 100

    return {
        nextMonth,
        growthRate,
        formula: `Y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)} | Proyección a 30 días`
    }
}

// ============================================================
// HELPERS: parse numeric from CSV cell (handles COP formatting)
// ============================================================
const parseNum = (val: unknown): number => {
    if (val === null || val === undefined || val === '') return 0
    const cleaned = String(val)
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '.')
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : Math.abs(n) // retenciones pueden venir negativas
}

// ============================================================
// CÁLCULO TRIBUTARIO — LEY COLOMBIANA — con datos REALES del CSV
// ============================================================
export const calculateTaxData = (rows: Record<string, unknown>[], totalVentas: number): TaxData => {
    // Tasas de respaldo (solo se usan si el CSV no tiene las columnas)
    const IVA_RATE = 0.19
    const RETE_FUENTE = 0.035
    const RETE_IVA = 0.15
    const RETE_ICA_BOGOTA = 0.00414
    const RENTA_RATE = 0.35
    const COSTO_ESTIMADO = 0.65
    const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    // ── Detección dinámica de columnas del CSV ──────────────────────
    const sampleRow = rows[0] || {}
    const cols = Object.keys(sampleRow).map(k => k.trim())

    // Columna IVA — nombres comunes en facturas electrónicas colombianas
    const colIVA = cols.find(c =>
        /^(iva|valor\s*iva|impuesto|iva\s*19|valor\s*impuesto|taxes?|vat)$/i.test(c)
    ) || null

    // Columna Subtotal (base sin IVA)
    const colSubtotal = cols.find(c =>
        /^(subtotal|valor\s*bruto|base|base\s*gravable|valor\s*sin\s*iva|neto\s*factura)$/i.test(c)
    ) || null

    // Columna ReteFuente
    const colReteFuente = cols.find(c =>
        /^(retefuente|rete\s*fuente|retenci[oó]n\s*fuente|retenci[oó]n\s*en\s*la\s*fuente|rtefte)$/i.test(c)
    ) || null

    // Columna ReteICA
    const colReteICA = cols.find(c =>
        /^(reteica|rete\s*ica|retenci[oó]n\s*ica|ica)$/i.test(c)
    ) || null

    // Columna Total (siempre presente)
    const colTotal = cols.find(c => /^total$/i.test(c)) || 'Total'

    const fuenteDatos = {
        ivaReal: colIVA !== null,
        subtotalReal: colSubtotal !== null,
        reteFuenteReal: colReteFuente !== null,
        reteICAReal: colReteICA !== null,
        columnasDetectadas: [colIVA, colSubtotal, colReteFuente, colReteICA].filter(Boolean) as string[],
    }

    // ── Acumuladores globales ───────────────────────────────────────
    let sumIVA = 0
    let sumSubtotal = 0
    let sumReteFuente = 0
    let sumReteICA = 0

    // ── Desglose mensual ────────────────────────────────────────────
    const monthlyMap: Record<string, {
        ventas: number; iva: number; reteFuente: number; reteICA: number; facturas: number
    }> = {}

    rows.forEach(row => {
        const total = parseNum(row[colTotal])
        if (total <= 0) return

        // Valores reales del CSV
        const ivaRow = colIVA ? parseNum(row[colIVA]) : null
        const subtotalRow = colSubtotal ? parseNum(row[colSubtotal]) : null
        const reteFuenteRow = colReteFuente ? parseNum(row[colReteFuente]) : null
        const reteICARow = colReteICA ? parseNum(row[colReteICA]) : null

        // Fallbacks cuando la columna no existe
        const ivaUsado = ivaRow !== null ? ivaRow : total * IVA_RATE / (1 + IVA_RATE)
        const subtotalUsado = subtotalRow !== null ? subtotalRow : total - ivaUsado
        const reteFuenteUsado = reteFuenteRow !== null ? reteFuenteRow : subtotalUsado * RETE_FUENTE
        const reteICAUsado = reteICARow !== null ? reteICARow : total * RETE_ICA_BOGOTA

        sumIVA += ivaUsado
        sumSubtotal += subtotalUsado
        sumReteFuente += reteFuenteUsado
        sumReteICA += reteICAUsado

        // Fecha
        const fechaStr = String(row['Fecha Recepción'] || row['Fecha'] || '')
        let month = 'Sin fecha'
        const parts = fechaStr.split('-')
        if (parts.length >= 2) {
            if (parts[0].length <= 2) {
                // DD-MM-YYYY
                const m = parseInt(parts[1]) - 1
                const y = parts[2]?.substring(0, 4) || ''
                month = `${MONTH_NAMES[m] || 'Mes'} ${y}`.trim()
            } else {
                // YYYY-MM-DD
                const m = parseInt(parts[1]) - 1
                month = `${MONTH_NAMES[m] || 'Mes'} ${parts[0]}`.trim()
            }
        }

        if (!monthlyMap[month]) monthlyMap[month] = { ventas: 0, iva: 0, reteFuente: 0, reteICA: 0, facturas: 0 }
        monthlyMap[month].ventas += total
        monthlyMap[month].iva += ivaUsado
        monthlyMap[month].reteFuente += reteFuenteUsado
        monthlyMap[month].reteICA += reteICAUsado
        monthlyMap[month].facturas += 1
    })

    // ── Totales globales ────────────────────────────────────────────
    const totalVentasBruto = sumSubtotal > 0 ? sumSubtotal : totalVentas - sumIVA
    const totalIVACobrado = sumIVA
    // IVA a pagar: si hay datos reales de reteFuente ya no podemos asumir IVA descontable genérico
    // Solo estimamos IVA descontable cuando NO hay columna IVA real
    const totalIVAPorPagar = fuenteDatos.ivaReal
        ? totalIVACobrado   // sin IVA descontable (no tenemos datos de compras)
        : totalIVACobrado * 0.70  // estimado: IVA descontable ~30%
    const totalReteFuente = sumReteFuente
    const totalReteIVA = totalIVACobrado * RETE_IVA
    const totalReteICA = sumReteICA
    const totalImpuestosCargo = totalIVAPorPagar + totalReteIVA + totalReteICA

    // ── Renta ───────────────────────────────────────────────────────
    const utilidadEstimada = totalVentasBruto * (1 - COSTO_ESTIMADO)
    const baseGravableRenta = Math.max(0, utilidadEstimada)
    const impuestoRentaEstimado = baseGravableRenta * RENTA_RATE

    // ── Desglose mensual ordenado ───────────────────────────────────
    const monthlyBreakdown = Object.entries(monthlyMap)
        .map(([month, d]) => ({
            month,
            ventas: Math.round(d.ventas),
            iva: Math.round(d.iva),
            reteFuente: Math.round(d.reteFuente),
            reteICA: Math.round(d.reteICA),
            neto: Math.round(d.ventas - d.reteFuente - d.reteICA),
        }))
        .slice(0, 12)

    // ── Régimen ─────────────────────────────────────────────────────
    const UVT_2024 = 49799
    const ingresoEnUVT = totalVentas / UVT_2024
    let regimenSugerido: TaxData['regimenSugerido'] = 'Ordinario'
    if (ingresoEnUVT < 3500) regimenSugerido = 'Simplificado'
    else if (ingresoEnUVT <= 100000) regimenSugerido = 'Simple (SIMPLE)'

    // ── Alertas ─────────────────────────────────────────────────────
    const alertas: string[] = []

    if (!fuenteDatos.ivaReal)
        alertas.push('ℹ️ Columna IVA no encontrada en los datos — IVA calculado asumiendo 19% sobre el total')
    if (!fuenteDatos.reteFuenteReal)
        alertas.push('ℹ️ Columna ReteFuente no encontrada — estimada al 3.5% sobre base gravable')
    if (!fuenteDatos.reteICAReal)
        alertas.push('ℹ️ Columna ReteICA no encontrada — estimada a la tarifa Bogotá 4.14‰')
    if (fuenteDatos.ivaReal)
        alertas.push(`✅ IVA leído directamente del CSV (columna "${colIVA}")`)
    if (fuenteDatos.columnasDetectadas.length > 0)
        alertas.push(`📊 Columnas tributarias detectadas: ${fuenteDatos.columnasDetectadas.join(', ')}`)
    if (totalIVAPorPagar > 5_000_000)
        alertas.push('⚠️ IVA bimestral supera $5M COP — verifique declaración D.I.')
    if (totalReteFuente > 0)
        alertas.push(`📋 Retención en la fuente acumulada: COP $${Math.round(totalReteFuente).toLocaleString('es-CO')}`)
    if (ingresoEnUVT > 3500 && ingresoEnUVT <= 100000)
        alertas.push('💡 Puede acogerse al Régimen SIMPLE para reducir carga tributaria')
    if (rows.length > 0 && !rows[0]['Fecha Recepción'] && !rows[0]['Fecha'])
        alertas.push('ℹ️ No se detectó columna de fecha — desglose mensual aproximado')

    return {
        totalVentasBruto: Math.round(totalVentasBruto),
        totalIVACobrado: Math.round(totalIVACobrado),
        totalIVAPorPagar: Math.round(totalIVAPorPagar),
        totalReteFuente: Math.round(totalReteFuente),
        totalReteIVA: Math.round(totalReteIVA),
        totalReteICA: Math.round(totalReteICA),
        totalImpuestosCargo: Math.round(totalImpuestosCargo),
        monthlyBreakdown,
        ivaDeclaracionBimestral: Math.round(totalIVAPorPagar / 6),
        ivaDeclaracionCuatrimestral: Math.round(totalIVAPorPagar / 3),
        baseGravableRenta: Math.round(baseGravableRenta),
        impuestoRentaEstimado: Math.round(impuestoRentaEstimado),
        totalFacturas: rows.length,
        facturasPendientes: Math.round(rows.length * 0.12),
        tasaEfectivaTributaria: totalVentas > 0
            ? Math.round((totalImpuestosCargo / totalVentas) * 10000) / 100
            : 0,
        regimenSugerido,
        alertas,
        fuenteDatos,
    }
}
