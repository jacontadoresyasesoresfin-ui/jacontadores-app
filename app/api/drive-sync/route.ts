import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// ─── Helpers de extracción ────────────────────────────────────────────────────

function extractCufe(text: string): string | null {
    // CUFE colombiano: exactamente 96 caracteres hexadecimales
    const match = text.match(/CUFE[\s:\-]*([\da-fA-F]{96})/i) ||
                  text.match(/([\da-fA-F]{96})/)
    return match ? match[1].toLowerCase() : null
}

function extractNit(text: string): string | null {
    // NIT: entre 8 y 12 dígitos, con o sin dígito verificador
    const match = text.match(/NIT[\s:\.\-]*([\d]{5,12}(?:[\-\.]?\d)?)/i)
    return match ? match[1].replace(/[^0-9]/g, '') : null
}

function extractNombre(text: string, fallback: string): string {
    const match = text.match(/Raz[oó]n\s+Social[\s:\-]*(.+?)(?:\r?\n|NIT|Direcci[oó]n)/i) ||
                  text.match(/Nombre[\s:\-]*(.+?)(?:\r?\n|NIT)/i)
    return match ? match[1].trim().substring(0, 200) : fallback
}

function extractTotal(text: string): number {
    // Buscar "Total a pagar" o "Total factura" primero, luego "Total" genérico
    const patterns = [
        /Total\s+a\s+pagar[\s:\$]*([0-9.,]+)/i,
        /Total\s+factura[\s:\$]*([0-9.,]+)/i,
        /Valor\s+total[\s:\$]*([0-9.,]+)/i,
        /Total[\s:\$]*([0-9.,]+)/i,
    ]
    for (const p of patterns) {
        const m = text.match(p)
        if (m) {
            // Formato colombiano: puntos como miles, coma como decimal
            const numStr = m[1].replace(/\./g, '').replace(/,/g, '.')
            const n = parseFloat(numStr)
            if (!isNaN(n) && n > 0) return n
        }
    }
    return 0
}

function extractIva(text: string): number {
    const m = text.match(/(?:IVA|Impuesto|I\.V\.A)[\s:\$]*([0-9.,]+)/i)
    if (!m) return 0
    return parseFloat(m[1].replace(/\./g, '').replace(/,/g, '.')) || 0
}

function extractFecha(text: string): string {
    // Formatos: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
    const m = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/) ||
              text.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
    if (!m) return new Date().toISOString().split('T')[0]
    // Normalizar a YYYY-MM-DD
    if (m[1].length === 4) return `${m[1]}-${m[2]}-${m[3]}`
    return `${m[3]}-${m[2]}-${m[1]}`
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { folderUrl } = body

        if (!folderUrl) {
            return NextResponse.json({ error: 'Se requiere la URL de la carpeta de Drive' }, { status: 400 })
        }

        const apiKey = process.env.GOOGLE_DRIVE_API_KEY
        if (!apiKey) {
            return NextResponse.json({
                error: 'GOOGLE_DRIVE_API_KEY no configurada. ' +
                    'Obtén tu clave gratuita en: https://console.cloud.google.com/apis/credentials ' +
                    '→ Habilita "Google Drive API" → Crea una "API Key" → Agrégala como variable de entorno.',
                setup_required: true,
                setup_url: 'https://console.cloud.google.com/apis/credentials'
            }, { status: 503 })
        }

        // Extraer el Folder ID de la URL
        const folderIdMatch = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/)
        if (!folderIdMatch) {
            return NextResponse.json({
                error: 'URL inválida. Usa el formato: https://drive.google.com/drive/folders/CARPETA_ID'
            }, { status: 400 })
        }
        const folderId = folderIdMatch[1]

        // 1. Listar archivos PDF en la carpeta
        const listRes = await fetch(
            `https://www.googleapis.com/drive/v3/files` +
            `?q='${folderId}'+in+parents+and+mimeType='application/pdf'+and+trashed=false` +
            `&fields=files(id,name,size,createdTime)` +
            `&pageSize=50&orderBy=createdTime+desc` +
            `&key=${apiKey}`
        )

        if (!listRes.ok) {
            const errData = await listRes.json()
            const msg = errData?.error?.message || listRes.statusText
            if (listRes.status === 403) {
                throw new Error(`Acceso denegado. Asegúrate de que la carpeta sea pública ("Cualquiera con el enlace puede ver"). Detalle: ${msg}`)
            }
            throw new Error(`Error listando carpeta Drive: ${msg}`)
        }

        const listData = await listRes.json()
        const files: { id: string; name: string; size?: string }[] = listData.files || []

        if (files.length === 0) {
            return NextResponse.json({
                message: 'No se encontraron PDFs en esta carpeta. Verifica que tenga archivos y sea pública.',
                invoices: []
            })
        }

        // 2. Descargar y parsear cada PDF
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse')
        const invoicesData = []

        for (const file of files) {
            try {
                const fileRes = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}`
                )

                if (!fileRes.ok) {
                    throw new Error(`No se pudo descargar el archivo (¿carpeta pública?): ${fileRes.statusText}`)
                }

                const arrayBuffer = await fileRes.arrayBuffer()
                const pdfBuffer = Buffer.from(arrayBuffer)
                const pdfData = await pdfParse(pdfBuffer)
                const text = pdfData.text

                const cufe  = extractCufe(text)
                const nit   = extractNit(text)
                const nombre = extractNombre(text, file.name.replace(/\.pdf$/i, ''))
                const total = extractTotal(text)
                const iva   = extractIva(text)
                const fecha = extractFecha(text)

                invoicesData.push({
                    driveFileId: file.id,
                    fileName: file.name,
                    cufe,
                    nit,
                    nombre,
                    total,
                    iva,
                    fecha,
                    // Snippet de texto para depuración
                    rawTextSnippet: text.substring(0, 300).replace(/\s+/g, ' ')
                })

            } catch (err: any) {
                invoicesData.push({
                    driveFileId: file.id,
                    fileName: file.name,
                    error: err.message || 'Error al procesar el archivo'
                })
            }
        }

        const exitosos = invoicesData.filter(i => !('error' in i)).length
        return NextResponse.json({
            message: `${files.length} PDFs encontrados, ${exitosos} procesados exitosamente`,
            invoices: invoicesData
        })

    } catch (error: any) {
        console.error('[drive-sync] Error:', error)
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
    }
}
