import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/causacion/encryption'
import { syncReceived } from '@/lib/causacion/pt-adapters'
import { parseUBL21 } from '@/lib/causacion/xml-parser'

function adminSupa() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

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

export async function POST(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const profileId = body.profile_id || user.id

    // Cargar configuración DIAN del cliente
    const { data: cfg } = await adminSupa()
        .from('user_dian_config')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle()

    if (!cfg || !cfg.activo) {
        return NextResponse.json({ error: 'Configura y activa la integración DIAN primero' }, { status: 400 })
    }

    // Rango de fechas
    const to = new Date().toISOString().slice(0, 10)
    const fromDefault = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const from = body.fecha_from || cfg.last_sync?.slice(0, 10) || fromDefault

    const ptCfg = {
        proveedor_tecnologico: cfg.proveedor_tecnologico,
        api_key: decrypt(cfg.api_key_enc || ''),
        api_secret: decrypt(cfg.api_secret_enc || ''),
        nit_empresa: cfg.nit_empresa,
        ambiente: cfg.ambiente,
        config_extra: cfg.config_extra,
    }

    // Obtener CUFEs ya guardados para evitar duplicados
    const { data: existentes } = await adminSupa()
        .from('facturas_recibidas')
        .select('cufe, pt_document_id')
        .eq('profile_id', profileId)

    const cufesExistentes = new Set((existentes || []).map(e => e.cufe).filter(Boolean))
    const ptIdsExistentes = new Set((existentes || []).map(e => e.pt_document_id).filter(Boolean))

    let docs
    try {
        docs = await syncReceived(ptCfg, from, to)
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al conectar con el PT'
        return NextResponse.json({ error: msg }, { status: 502 })
    }

    const nuevas = docs.filter(d =>
        (!d.cufe || !cufesExistentes.has(d.cufe)) &&
        (!d.pt_id || !ptIdsExistentes.has(d.pt_id))
    )

    if (nuevas.length === 0) {
        return NextResponse.json({ ok: true, nuevas: 0, total_descargadas: docs.length, message: 'No hay facturas nuevas' })
    }

    const rows = nuevas.map(d => {
        // Parsear XML si viene en base64
        let items = null
        let impuestos = null
        if (d.xml_base64) {
            try {
                const xmlText = Buffer.from(d.xml_base64, 'base64').toString('utf-8')
                const parsed = parseUBL21(xmlText)
                items = parsed.items
                impuestos = parsed.impuestos
            } catch { /* XML malformado — se guarda sin parsear */ }
        }

        return {
            profile_id: profileId,
            cufe: d.cufe || null,
            numero_factura: d.numero_factura,
            proveedor_nit: d.proveedor_nit,
            proveedor_nombre: d.proveedor_nombre,
            fecha_emision: d.fecha_emision || new Date().toISOString().slice(0, 10),
            subtotal: d.subtotal,
            iva: d.iva,
            total: d.total,
            xml_content: d.xml_base64 || null,
            estado: 'pendiente',
            pt_document_id: d.pt_id || null,
            tipo_documento: d.tipo_documento || '01',
            items: items ? JSON.stringify(items) : null,
            impuestos: impuestos ? JSON.stringify(impuestos) : null,
        }
    })

    const { data: inserted, error: insertError } = await adminSupa()
        .from('facturas_recibidas')
        .insert(rows)
        .select('id, numero_factura, proveedor_nombre')

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // Actualizar last_sync
    await adminSupa()
        .from('user_dian_config')
        .update({ last_sync: new Date().toISOString() })
        .eq('profile_id', profileId)

    // Log de auditoría
    await adminSupa().from('causacion_auditoria').insert({
        profile_id: profileId,
        accion: 'sincronizacion',
        detalle: { nuevas: nuevas.length, total: docs.length, desde: from, hasta: to, proveedor_tecnologico: cfg.proveedor_tecnologico },
    })

    return NextResponse.json({
        ok: true,
        nuevas: inserted?.length || 0,
        total_descargadas: docs.length,
        facturas: inserted,
    })
}
