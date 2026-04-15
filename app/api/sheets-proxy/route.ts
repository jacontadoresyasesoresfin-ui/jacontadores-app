import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy para Google Sheets CSV — evita errores CORS al cargar sheets públicos.
 * GET /api/sheets-proxy?url=https://docs.google.com/spreadsheets/...
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
        return NextResponse.json({ error: 'Falta parámetro url' }, { status: 400 })
    }

    if (!url.includes('docs.google.com/spreadsheets') && !url.includes('sheets.googleapis.com')) {
        return NextResponse.json({ error: 'Solo se aceptan URLs de Google Sheets' }, { status: 403 })
    }

    try {
        const response = await fetch(url, {
            method: 'GET',
            // CRÍTICO: pub?output=csv devuelve un redirect 302 — debe seguirse
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; JAContadores-BI/1.0)',
                'Accept': 'text/csv,text/plain,*/*',
            },
            cache: 'no-store',
        })

        console.log(`[sheets-proxy] → ${response.status} | url: ${url.slice(0, 90)}`)

        if (!response.ok) {
            return NextResponse.json(
                { error: `Google Sheets respondió ${response.status}. Verifica que el Sheet sea público.` },
                { status: response.status >= 500 ? 502 : response.status }
            )
        }

        const contentType = response.headers.get('content-type') ?? ''
        const text = await response.text()

        // Si Google devolvió HTML en vez de CSV → el sheet es privado
        if (contentType.includes('text/html') && text.includes('<!DOCTYPE')) {
            return NextResponse.json(
                { error: 'El Sheet es privado. Usa: Archivo → Compartir → Publicar en la web → Formato CSV.' },
                { status: 403 }
            )
        }

        return new NextResponse(text, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': '*',
            },
        })
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error desconocido'
        console.error(`[sheets-proxy] fetch failed:`, msg)
        return NextResponse.json(
            { error: `No se pudo conectar con Google Sheets: ${msg}` },
            { status: 502 }
        )
    }
}
