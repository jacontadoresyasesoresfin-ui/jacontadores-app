import { NextRequest, NextResponse } from 'next/server'

interface ExtractedInvoice {
    numero_factura: string
    fecha: string
    nit_tercero: string
    nombre_tercero: string
    valor_base: number
    porcentaje_iva: number
    valor_iva: number
    cufe: string
    archivo_nombre: string
    fuente: 'pdf'
    tipo: 'compra'
    estado: 'pendiente'
}

function parseColombianNumber(raw: string): number {
    if (!raw) return 0
    const cleaned = raw.replace(/\./g, '').replace(',', '.')
    return parseFloat(cleaned) || 0
}

function parseColombianDate(raw: string): string {
    if (!raw) return ''
    const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

    const dmyMatch = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
    if (dmyMatch) {
        const [, d, m, y] = dmyMatch
        const year = y.length === 2 ? `20${y}` : y
        return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    return ''
}

function extractFromText(text: string, filename: string): ExtractedInvoice {
    const t = text.replace(/\r\n/g, '\n').replace(/\s{2,}/g, ' ')

    // CUFE: 96 lowercase hex chars (standard DIAN)
    const cufeMatch = t.match(/CUFE[:\s]*([a-f0-9]{96})/i)
        || t.match(/([a-f0-9]{96})/)
    const cufe = cufeMatch ? cufeMatch[1] : ''

    // Número de factura - múltiples patrones DIAN
    const invoiceMatch = t.match(/(?:Factura\s*de\s*Venta|No\.?\s*Factura|Número|Factura)[:\s#]*([A-Z]{1,5}[-–]?\s*\d{4,12})/i)
        || t.match(/\b(FE[-–\s]?\d{4,12})\b/i)
        || t.match(/\b(FV[-–\s]?\d{4,12})\b/i)
        || t.match(/\b(SETP\d{8,12})\b/i)
    const numero_factura = invoiceMatch ? invoiceMatch[1].replace(/\s/g, '') : ''

    // Fecha - buscar múltiples contextos
    const fechaMatch = t.match(/Fecha\s*(?:de\s*Expedici[oó]n)?[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i)
        || t.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/)
        || t.match(/(\d{4}-\d{2}-\d{2})/)
    const fecha = fechaMatch ? parseColombianDate(fechaMatch[1]) : ''

    // NIT del proveedor (emisor)
    const nitMatch = t.match(/NIT[:\s.]*(\d{8,10})[-–]?(\d)?/i)
        || t.match(/(\d{9,10})-\d\b/)
    const nit_tercero = nitMatch ? nitMatch[1] : ''

    // Razón social del proveedor - línea después del NIT o encabezado
    const nombreMatch = t.match(/(?:Raz[oó]n\s*Social|Nombre)[:\s]*([A-ZÁÉÍÓÚÑ][^\n]{5,60})/i)
        || t.match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑA-Za-z\s&.,]{10,50})\s*NIT/i)
    const nombre_tercero = nombreMatch ? nombreMatch[1].trim() : ''

    // Valores - IVA primero para inferir porcentaje
    const iva19Match = t.match(/IVA\s*19\s*%[:\s]*\$?\s*([\d.,]+)/i)
    const iva5Match = t.match(/IVA\s*5\s*%[:\s]*\$?\s*([\d.,]+)/i)
    const ivaGenMatch = t.match(/(?:IVA|Impuesto)[:\s]*\$?\s*([\d.,]+)/i)

    let valor_iva = 0
    let porcentaje_iva = 0
    if (iva19Match) { valor_iva = parseColombianNumber(iva19Match[1]); porcentaje_iva = 19 }
    else if (iva5Match) { valor_iva = parseColombianNumber(iva5Match[1]); porcentaje_iva = 5 }
    else if (ivaGenMatch) { valor_iva = parseColombianNumber(ivaGenMatch[1]) }

    // Valor base / subtotal
    const baseMatch = t.match(/(?:Subtotal|Base\s*Gravable|Valor\s*Base)[:\s]*\$?\s*([\d.,]+)/i)
        || t.match(/(?:Subtotal)[:\s]*\$?\s*([\d.,]+)/i)
    let valor_base = baseMatch ? parseColombianNumber(baseMatch[1]) : 0

    // Si no encontramos base, inferir del total
    if (valor_base === 0) {
        const totalMatch = t.match(/(?:Total\s*a\s*Pagar|Total\s*Factura|Gran\s*Total)[:\s]*\$?\s*([\d.,]+)/i)
            || t.match(/Total[:\s]*\$?\s*([\d.,]+)/i)
        const total = totalMatch ? parseColombianNumber(totalMatch[1]) : 0
        if (total > 0 && valor_iva > 0) valor_base = total - valor_iva
        else if (total > 0 && porcentaje_iva === 19) valor_base = Math.round(total / 1.19)
        else if (total > 0 && porcentaje_iva === 5) valor_base = Math.round(total / 1.05)
        else valor_base = total
    }

    // Si aún no tenemos porcentaje_iva pero sí valor_iva y base
    if (porcentaje_iva === 0 && valor_iva > 0 && valor_base > 0) {
        const pct = Math.round((valor_iva / valor_base) * 100)
        if (pct === 19 || pct === 5) porcentaje_iva = pct
    }

    return {
        numero_factura,
        fecha,
        nit_tercero,
        nombre_tercero,
        valor_base: Math.round(valor_base),
        porcentaje_iva,
        valor_iva: Math.round(valor_iva),
        cufe,
        archivo_nombre: filename,
        fuente: 'pdf',
        tipo: 'compra',
        estado: 'pendiente',
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const files = formData.getAll('files') as File[]

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No se recibieron archivos' }, { status: 400 })
        }

        const results: { filename: string; ok: boolean; data?: ExtractedInvoice; error?: string }[] = []

        for (const file of files) {
            if (!file.name.toLowerCase().endsWith('.pdf')) {
                results.push({ filename: file.name, ok: false, error: 'No es un PDF' })
                continue
            }

            try {
                const buffer = Buffer.from(await file.arrayBuffer())
                // pdf-parse v1 — require estático, excluido de webpack via serverExternalPackages
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const pdfParse = require('pdf-parse') as (b: Buffer, o?: object) => Promise<{ text: string }>
                const parsed = await pdfParse(buffer, { max: 0 })
                const extracted = extractFromText(parsed.text, file.name)
                results.push({ filename: file.name, ok: true, data: extracted })
            } catch {
                results.push({ filename: file.name, ok: false, error: 'No se pudo leer el PDF' })
            }
        }

        return NextResponse.json({ results })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error interno'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
