/**
 * POST /api/causacion/trigger
 *
 * Trigger de causación automática. Puede ser invocado por:
 *  1. Cron job: curl -X POST https://tuapp.com/api/causacion/trigger \
 *       -H "Authorization: Bearer $CRON_SECRET" \
 *       -H "Content-Type: application/json" \
 *       -d '{"mode": "all_active"}'
 *  2. Webhook del PT (si soporta): configurar URL como webhook con header Authorization
 *  3. Manual desde UI: { profile_id, mode: "single" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/causacion/encryption'
import { syncReceived } from '@/lib/causacion/pt-adapters'
import { parseUBL21 } from '@/lib/causacion/xml-parser'
import { generarAsientoUBL, REGLAS_DEFAULT } from '@/lib/causacion/motor'

function adminSupa() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

async function getCallerProfile() {
    const cookieStore = await cookies()
    const client = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await client.auth.getUser()
    return user
}

async function processProfile(profileId: string): Promise<{
    profile_id: string; nuevas_sincronizadas: number; causadas: number; errores: number
}> {
    // 1. Cargar config DIAN
    const { data: cfg } = await adminSupa()
        .from('user_dian_config')
        .select('*')
        .eq('profile_id', profileId)
        .eq('activo', true)
        .maybeSingle()

    if (!cfg) return { profile_id: profileId, nuevas_sincronizadas: 0, causadas: 0, errores: 0 }

    // 2. Sincronizar desde PT
    const to = new Date().toISOString().slice(0, 10)
    const fromDate = cfg.last_sync
        ? new Date(cfg.last_sync).toISOString().slice(0, 10)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const ptCfg = {
        proveedor_tecnologico: cfg.proveedor_tecnologico,
        api_key: decrypt(cfg.api_key_enc || ''),
        api_secret: decrypt(cfg.api_secret_enc || ''),
        nit_empresa: cfg.nit_empresa,
        ambiente: cfg.ambiente,
        config_extra: cfg.config_extra,
    }

    let docs: Awaited<ReturnType<typeof syncReceived>> = []
    try {
        docs = await syncReceived(ptCfg, fromDate, to)
    } catch { /* Log error, continuar */ }

    // Filtrar duplicados
    const { data: existentes } = await adminSupa()
        .from('facturas_recibidas')
        .select('cufe, pt_document_id')
        .eq('profile_id', profileId)

    const cufesSet = new Set((existentes || []).map(e => e.cufe).filter(Boolean))
    const ptIdsSet = new Set((existentes || []).map(e => e.pt_document_id).filter(Boolean))
    const nuevas = docs.filter(d => (!d.cufe || !cufesSet.has(d.cufe)) && (!d.pt_id || !ptIdsSet.has(d.pt_id)))

    let nuevas_sincronizadas = 0
    if (nuevas.length > 0) {
        const rows = nuevas.map(d => ({
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
        }))
        const { data: inserted } = await adminSupa().from('facturas_recibidas').insert(rows).select('id')
        nuevas_sincronizadas = inserted?.length || 0
    }

    // 3. Causar pendientes automáticamente
    const { data: pendientes } = await adminSupa()
        .from('facturas_recibidas')
        .select('*')
        .eq('profile_id', profileId)
        .eq('estado', 'pendiente')
        .limit(100)

    const { data: reglasCfg } = await adminSupa()
        .from('causacion_reglas')
        .select('reglas')
        .eq('profile_id', profileId)
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    const reglas = reglasCfg?.reglas || REGLAS_DEFAULT

    let causadas = 0
    let errores = 0
    const auditRows: Record<string, unknown>[] = []

    for (const f of (pendientes || [])) {
        try {
            let ublData
            if (f.xml_content) {
                try {
                    const xmlText = Buffer.from(f.xml_content, 'base64').toString('utf-8')
                    ublData = parseUBL21(xmlText)
                } catch { ublData = null }
            }

            if (!ublData) {
                ublData = {
                    cufe: f.cufe || '', numero_factura: f.numero_factura || '',
                    tipo_documento: f.tipo_documento || '01', fecha_emision: f.fecha_emision || '',
                    hora_emision: '', proveedor_nit: f.proveedor_nit || '',
                    proveedor_nombre: f.proveedor_nombre || '', proveedor_direccion: '',
                    proveedor_municipio: '', proveedor_regimen: '', receptor_nit: '', receptor_nombre: '',
                    subtotal: f.subtotal || 0, descuento_total: 0, base_gravable: f.subtotal || 0,
                    iva_total: f.iva || 0, ica_total: 0, total: f.total || 0,
                    items: f.items ? JSON.parse(f.items) : [], impuestos: f.impuestos ? JSON.parse(f.impuestos) : [],
                    forma_pago: '1', fecha_vencimiento: f.fecha_emision || '',
                }
            }

            const asiento = await generarAsientoUBL(ublData, reglas)

            await adminSupa()
                .from('facturas_recibidas')
                .update({
                    estado: 'causada',
                    asiento_contable: asiento,
                    fecha_causacion: new Date().toISOString(),
                })
                .eq('id', f.id)

            causadas++
            auditRows.push({
                profile_id: profileId,
                factura_id: f.id,
                accion: 'causacion_automatica',
                detalle: { numero_factura: f.numero_factura, metodo: asiento.metodo_causacion, balanceado: asiento.balanceado },
            })
        } catch (err) {
            errores++
            auditRows.push({
                profile_id: profileId,
                factura_id: f.id,
                accion: 'error',
                detalle: { error: err instanceof Error ? err.message : 'Error desconocido' },
            })
        }
    }

    if (auditRows.length > 0) {
        await adminSupa().from('causacion_auditoria').insert(auditRows)
    }

    await adminSupa()
        .from('user_dian_config')
        .update({ last_sync: new Date().toISOString() })
        .eq('profile_id', profileId)

    return { profile_id: profileId, nuevas_sincronizadas, causadas, errores }
}

export async function POST(request: NextRequest) {
    // Autenticación: acepta JWT de sesión O bearer token de cron
    const authHeader = request.headers.get('authorization') || ''
    const cronSecret = process.env.CRON_SECRET
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

    let user = null
    if (!isCron) {
        user = await getCallerProfile()
        if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const mode = body.mode || 'single'

    const startTime = Date.now()

    if (mode === 'all_active' && isCron) {
        // Modo cron: procesar todos los perfiles con integración activa
        const { data: configs } = await adminSupa()
            .from('user_dian_config')
            .select('profile_id')
            .eq('activo', true)

        const perfiles = configs?.map(c => c.profile_id) || []
        const resultados = []

        for (const pid of perfiles) {
            const r = await processProfile(pid)
            resultados.push(r)
        }

        return NextResponse.json({
            ok: true,
            mode: 'all_active',
            perfiles_procesados: perfiles.length,
            resultados,
            duration_ms: Date.now() - startTime,
        })
    }

    // Modo single: procesar perfil específico
    const profileId = body.profile_id || user?.id
    if (!profileId) return NextResponse.json({ error: 'profile_id requerido' }, { status: 400 })

    const resultado = await processProfile(profileId)
    return NextResponse.json({ ok: true, mode: 'single', ...resultado, duration_ms: Date.now() - startTime })
}
