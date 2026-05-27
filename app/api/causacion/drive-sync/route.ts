import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { google } from 'googleapis'

async function getUser() {
    const cookieStore = await cookies()
    const client = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await client.auth.getUser()
    return user
}

function folderIdFromUrl(url: string): string | null {
    const match = url.match(/\/folders\/([a-zA-Z0-9_-]{25,50})/)
    return match ? match[1] : null
}

function parseColombianNumber(raw: string): number {
    if (!raw) return 0
    return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0
}

function parseColombianDate(raw: string): string {
    if (!raw) return ''
    const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
    const dmy = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
    if (dmy) {
        const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
        return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    }
    return ''
}

function extractFromText(text: string, filename: string) {
    const t = text.replace(/\r\n/g, '\n').replace(/\s{2,}/g, ' ')
    const cufeMatch = t.match(/CUFE[:\s]*([a-f0-9]{96})/i) || t.match(/([a-f0-9]{96})/)
    const cufe = cufeMatch ? cufeMatch[1] : ''
    const invoiceMatch = t.match(/(?:Factura\s*de\s*Venta|No\.?\s*Factura|Número|Factura)[:\s#]*([A-Z]{1,5}[-–]?\s*\d{4,12})/i)
        || t.match(/\b(FE[-–\s]?\d{4,12})\b/i) || t.match(/\b(FV[-–\s]?\d{4,12})\b/i)
    const numero_factura = invoiceMatch ? invoiceMatch[1].replace(/\s/g, '') : ''
    const fechaMatch = t.match(/Fecha\s*(?:de\s*Expedici[oó]n)?[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i)
        || t.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/) || t.match(/(\d{4}-\d{2}-\d{2})/)
    const fecha = fechaMatch ? parseColombianDate(fechaMatch[1]) : ''
    const nitMatch = t.match(/NIT[:\s.]*(\d{8,10})[-–]?(\d)?/i) || t.match(/(\d{9,10})-\d\b/)
    const nit_tercero = nitMatch ? nitMatch[1] : ''
    const nombreMatch = t.match(/(?:Raz[oó]n\s*Social|Nombre)[:\s]*([A-ZÁÉÍÓÚÑ][^\n]{5,60})/i)
        || t.match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑA-Za-z\s&.,]{10,50})\s*NIT/i)
    const nombre_tercero = nombreMatch ? nombreMatch[1].trim() : ''
    const iva19Match = t.match(/IVA\s*19\s*%[:\s]*\$?\s*([\d.,]+)/i)
    const iva5Match = t.match(/IVA\s*5\s*%[:\s]*\$?\s*([\d.,]+)/i)
    const ivaGenMatch = t.match(/(?:IVA|Impuesto)[:\s]*\$?\s*([\d.,]+)/i)
    let valor_iva = 0, porcentaje_iva = 0
    if (iva19Match) { valor_iva = parseColombianNumber(iva19Match[1]); porcentaje_iva = 19 }
    else if (iva5Match) { valor_iva = parseColombianNumber(iva5Match[1]); porcentaje_iva = 5 }
    else if (ivaGenMatch) { valor_iva = parseColombianNumber(ivaGenMatch[1]) }
    const baseMatch = t.match(/(?:Subtotal|Base\s*Gravable|Valor\s*Base)[:\s]*\$?\s*([\d.,]+)/i)
    let valor_base = baseMatch ? parseColombianNumber(baseMatch[1]) : 0
    if (valor_base === 0) {
        const totalMatch = t.match(/(?:Total\s*a\s*Pagar|Total\s*Factura|Gran\s*Total)[:\s]*\$?\s*([\d.,]+)/i)
            || t.match(/Total[:\s]*\$?\s*([\d.,]+)/i)
        const total = totalMatch ? parseColombianNumber(totalMatch[1]) : 0
        if (total > 0 && porcentaje_iva === 19) valor_base = Math.round(total / 1.19)
        else if (total > 0 && porcentaje_iva === 5) valor_base = Math.round(total / 1.05)
        else valor_base = total
    }
    return { numero_factura, fecha, nit_tercero, nombre_tercero, valor_base: Math.round(valor_base), porcentaje_iva, valor_iva: Math.round(valor_iva), cufe, archivo_nombre: filename, fuente: 'drive', tipo: 'compra', estado: 'pendiente' }
}

export async function POST(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON
    if (!keyJson) {
        return NextResponse.json({
            error: 'GOOGLE_SERVICE_ACCOUNT_KEY_JSON no configurado. Ver guía de configuración en el módulo.',
            setup_required: true,
        }, { status: 503 })
    }

    const { folder_url } = await request.json()
    if (!folder_url) return NextResponse.json({ error: 'folder_url requerido' }, { status: 400 })

    const folderId = folderIdFromUrl(folder_url)
    if (!folderId) return NextResponse.json({ error: 'URL de carpeta Drive no válida' }, { status: 400 })

    try {
        const key = JSON.parse(keyJson)
        const auth = new google.auth.GoogleAuth({
            credentials: key,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        })

        const drive = google.drive({ version: 'v3', auth })

        const { data: fileList } = await drive.files.list({
            q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
            fields: 'files(id,name,modifiedTime,size)',
            orderBy: 'modifiedTime desc',
            pageSize: 100,
        })

        const files = fileList.files || []
        const results: { filename: string; ok: boolean; data?: Record<string, unknown>; error?: string }[] = []

        for (const file of files) {
            if (!file.id || !file.name) continue
            try {
                const streamRes = await drive.files.get(
                    { fileId: file.id, alt: 'media' },
                    { responseType: 'arraybuffer' }
                )
                const buffer = Buffer.from(streamRes.data as unknown as ArrayBuffer)
                // pdf-parse v1 — require estático, excluido de webpack via serverExternalPackages
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const pdfParse = require('pdf-parse') as (b: Buffer, o?: object) => Promise<{ text: string }>
                const parsed = await pdfParse(buffer, { max: 0 })
                const extracted = extractFromText(parsed.text, file.name)
                results.push({ filename: file.name, ok: true, data: extracted as unknown as Record<string, unknown> })
            } catch {
                results.push({ filename: file.name ?? '', ok: false, error: 'Error al procesar PDF' })
            }
        }

        return NextResponse.json({ results, total_files: files.length })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al conectar con Drive'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
