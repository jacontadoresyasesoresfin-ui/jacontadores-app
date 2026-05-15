import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { syncReceived, PTConfig, PTDocumento } from '@/lib/causacion/pt-adapters'
import { parseUBL21, FacturaUBL } from '@/lib/causacion/xml-parser'
import { generarAsientoUBL, REGLAS_DEFAULT, ReglasConfig } from '@/lib/causacion/motor'

/**
 * Endpoint protegido para cron externo (cPanel, GitHub Actions, cron-job.org).
 * Requiere header: x-cron-secret: <CRON_SECRET del .env>
 *
 * Ejemplo cPanel (cada 2 horas):
 *   0 *\/2 * * * curl -s -X POST https://tudominio.com/api/causacion/cron \
 *     -H "x-cron-secret: TU_SECRETO" -H "Content-Type: application/json"
 */
export async function POST(req: Request) {
    // Verificar secreto
    const secret = req.headers.get('x-cron-secret')
    if (!secret || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startMs = Date.now()
    const supabase = createAdminClient()

    // Obtener todos los perfiles con config activa
    const { data: configs, error: cfgErr } = await supabase
        .from('user_dian_config')
        .select('*')
        .eq('activo', true)

    if (cfgErr) {
        return NextResponse.json({ error: cfgErr.message }, { status: 500 })
    }

    if (!configs || configs.length === 0) {
        return NextResponse.json({ success: true, message: 'Sin configuraciones activas', profiles: 0 })
    }

    const dias = 7
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)

    const resumen: Array<{ profile_id: string; nuevas: number; causadas: number; errores: number }> = []

    for (const config of configs) {
        const p_id: string = config.profile_id
        const stats = { nuevas: 0, causadas: 0, errores: 0, omitidas: 0 }
        const erroresDetalle: string[] = []

        const ptConfig: PTConfig = {
            proveedor_tecnologico: config.proveedor_tecnologico,
            api_key: decodeField(config.api_key),
            api_secret: decodeField(config.api_secret),
            nit_empresa: config.nit_empresa,
            ambiente: config.ambiente === 'produccion' ? 'produccion' : 'prueba',
            config_extra: config.config_extra || {},
        }

        const reglasUsuario = config.reglas_causacion as Partial<ReglasConfig> | null
        const reglas: ReglasConfig = {
            keywords: reglasUsuario?.keywords?.length
                ? [...reglasUsuario.keywords, ...REGLAS_DEFAULT.keywords]
                : REGLAS_DEFAULT.keywords,
            nit_proveedor: reglasUsuario?.nit_proveedor || REGLAS_DEFAULT.nit_proveedor,
            tipo_documento: reglasUsuario?.tipo_documento || REGLAS_DEFAULT.tipo_documento,
            defaults: { ...REGLAS_DEFAULT.defaults, ...(reglasUsuario?.defaults || {}) },
            usar_ia: reglasUsuario?.usar_ia ?? REGLAS_DEFAULT.usar_ia,
        }

        let documentos: PTDocumento[] = []
        try {
            documentos = await syncReceived(ptConfig, from, to)
        } catch (e: unknown) {
            console.error(`[CRON] Sync error ${p_id}:`, e instanceof Error ? e.message : e)
            continue
        }

        if (documentos.length === 0) {
            resumen.push({ profile_id: p_id, ...stats })
            continue
        }

        const cufes = documentos.map(d => d.cufe).filter(Boolean)
        const { data: existentes } = await supabase
            .from('facturas_recibidas')
            .select('cufe')
            .eq('profile_id', p_id)
            .in('cufe', cufes)

        const cufesExistentes = new Set((existentes || []).map((r: { cufe: string }) => r.cufe))
        const nuevos = documentos.filter(d => d.cufe && !cufesExistentes.has(d.cufe))
        stats.omitidas = documentos.length - nuevos.length

        for (const doc of nuevos) {
            try {
                let factura: FacturaUBL
                if (doc.xml_base64) {
                    const xmlRaw = Buffer.from(doc.xml_base64, 'base64').toString('utf8')
                    factura = parseUBL21(xmlRaw)
                } else {
                    factura = ptDocToFacturaUBL(doc)
                }

                const asiento = await generarAsientoUBL(factura, reglas)
                const estado: 'causada' | 'pendiente' = asiento.balanceado ? 'causada' : 'pendiente'
                if (!asiento.balanceado) {
                    stats.errores++
                    erroresDetalle.push(`${doc.numero_factura}: Descuadre contable`)
                } else {
                    stats.causadas++
                }

                const cuentasRetenciones = new Set(['236506', '236515', '236518', '236540', '236701', '236801'])
                const impuestosRetenidos = asiento.detalles
                    .filter(l => l.credito > 0 && cuentasRetenciones.has(l.cuenta.slice(0, 6)))
                    .map(l => ({ cuenta: l.cuenta, descripcion: l.descripcion, valor: l.credito }))

                const { error: insertErr } = await supabase.from('facturas_recibidas').insert({
                    profile_id: p_id,
                    cufe: doc.cufe || factura.cufe,
                    numero_factura: doc.numero_factura || factura.numero_factura,
                    proveedor_nit: doc.proveedor_nit || factura.proveedor_nit,
                    proveedor_nombre: doc.proveedor_nombre || factura.proveedor_nombre,
                    fecha_emision: factura.fecha_emision || doc.fecha_emision,
                    subtotal: factura.subtotal,
                    iva: factura.iva_total,
                    total: factura.total,
                    impuestos_retenidos: impuestosRetenidos,
                    estado,
                    asiento_contable_generado: asiento,
                    fecha_causacion: estado === 'causada' ? new Date().toISOString() : null,
                })

                if (!insertErr) stats.nuevas++
            } catch (e: unknown) {
                stats.errores++
                erroresDetalle.push(`${doc.numero_factura}: ${e instanceof Error ? e.message : String(e)}`)
            }
        }

        // Actualizar last_sync y guardar log
        await supabase
            .from('user_dian_config')
            .update({ last_sync: new Date().toISOString() })
            .eq('profile_id', p_id)

        try {
            await supabase.from('dian_sync_logs').insert({
                profile_id: p_id,
                finalizado_en: new Date().toISOString(),
                nuevas: stats.nuevas,
                causadas: stats.causadas,
                errores: stats.errores,
                omitidas: stats.omitidas,
                duration_ms: Date.now() - startMs,
                errores_detalle: erroresDetalle,
                triggered_by: 'cron',
            })
        } catch { /* silencioso */ }

        resumen.push({ profile_id: p_id, ...stats })
    }

    return NextResponse.json({
        success: true,
        duration_ms: Date.now() - startMs,
        profiles_procesados: resumen.length,
        resumen,
    })
}

// ── Helpers (duplicados aquí para no depender del trigger) ────────────────────

function decodeField(val: unknown): string {
    if (!val) return ''
    if (typeof val === 'string') return val
    if (typeof val === 'object' && val !== null) {
        const obj = val as Record<string, unknown>
        if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
            return Buffer.from(obj.data as number[]).toString('utf8')
        }
    }
    return String(val)
}

function ptDocToFacturaUBL(doc: PTDocumento): FacturaUBL {
    const subtotal = doc.subtotal > 0 ? doc.subtotal : doc.total - doc.iva
    const pctIva = subtotal > 0 ? Math.round((doc.iva / subtotal) * 100) : 19
    return {
        cufe: doc.cufe,
        numero_factura: doc.numero_factura,
        tipo_documento: doc.tipo_documento || '01',
        fecha_emision: doc.fecha_emision,
        hora_emision: '00:00:00',
        proveedor_nit: doc.proveedor_nit,
        proveedor_nombre: doc.proveedor_nombre,
        proveedor_direccion: '',
        proveedor_municipio: '',
        proveedor_regimen: '',
        receptor_nit: '',
        receptor_nombre: '',
        subtotal,
        descuento_total: 0,
        base_gravable: subtotal,
        iva_total: doc.iva,
        ica_total: 0,
        total: doc.total,
        items: [{
            descripcion: `Factura ${doc.numero_factura} — ${doc.proveedor_nombre}`,
            cantidad: 1,
            precio_unitario: subtotal,
            subtotal,
            porcentaje_iva: pctIva,
            valor_iva: doc.iva,
        }],
        impuestos: [],
        forma_pago: '1',
        fecha_vencimiento: doc.fecha_emision,
    }
}
