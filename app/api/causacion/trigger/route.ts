import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { syncReceived, PTConfig, PTDocumento } from '@/lib/causacion/pt-adapters'
import { parseUBL21, FacturaUBL } from '@/lib/causacion/xml-parser'
import { generarAsientoUBL, REGLAS_DEFAULT, ReglasConfig } from '@/lib/causacion/motor'

// ── Convierte PTDocumento en FacturaUBL cuando no hay XML ─────────────────────
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

// ── Desencoda valor BYTEA que llega de Supabase ───────────────────────────────
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

// ── Envía notificación por email vía Resend ───────────────────────────────────
async function notificarContador(
    email: string,
    nombre: string,
    stats: { nuevas: number; causadas: number; errores: number; omitidas: number },
    errores: string[]
) {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
        console.log(`[EMAIL-SKIP] RESEND_API_KEY no configurado. Contador: ${email}`)
        return
    }

    const subject = stats.errores > 0
        ? `⚠️ DIAN Auto: ${stats.nuevas} facturas (${stats.errores} con error)`
        : `✓ DIAN Auto: ${stats.nuevas} facturas causadas`

    const erroresHtml = errores.length > 0
        ? `<h3 style="color:#DC2626">Errores (requieren revisión manual):</h3>
           <ul>${errores.slice(0, 10).map(e => `<li>${e}</li>`).join('')}</ul>`
        : ''

    const html = `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#13213C;padding:20px 24px;border-radius:8px 8px 0 0">
                <h1 style="color:#B8960C;margin:0;font-size:18px">J&A Contadores — Sincronización DIAN</h1>
            </div>
            <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;padding:24px;border-radius:0 0 8px 8px">
                <p>Hola <strong>${nombre || 'Contador'}</strong>,</p>
                <p>Se completó el ciclo automático de descarga y causación de facturas DIAN:</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                    <tr style="background:#F8FAFC">
                        <td style="padding:10px 14px;border:1px solid #E5E7EB">Facturas descargadas</td>
                        <td style="padding:10px 14px;border:1px solid #E5E7EB;font-weight:600">${stats.nuevas}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 14px;border:1px solid #E5E7EB">Causadas automáticamente</td>
                        <td style="padding:10px 14px;border:1px solid #E5E7EB;font-weight:600;color:#059669">${stats.causadas}</td>
                    </tr>
                    <tr style="background:#F8FAFC">
                        <td style="padding:10px 14px;border:1px solid #E5E7EB">Con errores (pendientes)</td>
                        <td style="padding:10px 14px;border:1px solid #E5E7EB;font-weight:600;color:${stats.errores > 0 ? '#DC2626' : '#059669'}">${stats.errores}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 14px;border:1px solid #E5E7EB">Ya procesadas (omitidas)</td>
                        <td style="padding:10px 14px;border:1px solid #E5E7EB;color:#9CA3AF">${stats.omitidas}</td>
                    </tr>
                </table>
                ${erroresHtml}
                <p style="margin-top:24px">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/causacion/automatizacion"
                       style="background:#13213C;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
                       Ver en el portal →
                    </a>
                </p>
            </div>
        </div>`

    try {
        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: 'DIAN Auto <dian@jacontadores.com>',
                to: [email],
                subject,
                html,
            }),
        })
    } catch (e) {
        console.error('[EMAIL-ERROR]', e)
    }
}

// ── Handler POST principal ────────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const supabase = await createClient()

        let profile_id: string | null = null
        let mode = 'single'
        let dias = 7

        try {
            const body = await req.json()
            profile_id = body.profile_id || null
            mode = body.mode || 'single'
            dias = Number(body.dias) || 7
        } catch { /* body vacío o no-JSON */ }

        if (!profile_id) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) profile_id = user.id
        }

        if (!profile_id && mode !== 'all_active') {
            return NextResponse.json(
                { error: 'profile_id es requerido o mode="all_active"' },
                { status: 400 }
            )
        }

        const startMs = Date.now()
        let profilesToProcess: string[] = []

        // Nodo A: Obtener perfiles a procesar
        if (mode === 'all_active') {
            const { data: configs } = await supabase
                .from('user_dian_config')
                .select('profile_id')
                .eq('activo', true)
            profilesToProcess = configs?.map((c: { profile_id: string }) => c.profile_id) || []
        } else {
            profilesToProcess = [profile_id!]
        }

        const stats = { nuevas: 0, causadas: 0, errores: 0, omitidas: 0 }
        const erroresDetalle: string[] = []

        // Rango de fechas: últimos X días
        const to = new Date().toISOString().slice(0, 10)
        const from = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)

        for (const p_id of profilesToProcess) {
            // ── Leer configuración del PT ─────────────────────────────────────
            const { data: config, error: cfgErr } = await supabase
                .from('user_dian_config')
                .select('*')
                .eq('profile_id', p_id)
                .maybeSingle()

            if (cfgErr || !config || !config.activo) {
                if (mode === 'single') {
                    return NextResponse.json({ error: 'Configuración DIAN no activa para este perfil' }, { status: 400 })
                }
                continue
            }

            // Mezclar reglas del usuario con defaults del motor
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

            // Construir PTConfig (credenciales guardadas en BYTEA como texto)
            const ptConfig: PTConfig = {
                proveedor_tecnologico: config.proveedor_tecnologico,
                api_key: decodeField(config.api_key),
                api_secret: decodeField(config.api_secret),
                nit_empresa: config.nit_empresa,
                ambiente: config.ambiente === 'produccion' ? 'produccion' : 'prueba',
                config_extra: config.config_extra || {},
            }

            // Nodo B & C: Conectar al PT y consultar documentos recibidos
            let documentos: PTDocumento[] = []
            try {
                documentos = await syncReceived(ptConfig, from, to)
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e)
                console.error(`[DIAN-TRIGGER] Sync PT error profile ${p_id}:`, msg)
                erroresDetalle.push(`Conexión PT (${config.proveedor_tecnologico}): ${msg}`)
                continue
            }

            // Nodo D: Filtrar solo facturas nuevas (por CUFE vs BD)
            if (documentos.length === 0) continue

            const cufes = documentos.map(d => d.cufe).filter(Boolean)
            const { data: existentes } = await supabase
                .from('facturas_recibidas')
                .select('cufe')
                .eq('profile_id', p_id)
                .in('cufe', cufes)

            const cufesExistentes = new Set((existentes || []).map((r: { cufe: string }) => r.cufe))
            const nuevos = documentos.filter(d => d.cufe && !cufesExistentes.has(d.cufe))
            stats.omitidas += documentos.length - nuevos.length

            if (nuevos.length === 0) continue

            // Nodo E‒J: Procesar cada factura nueva
            for (const doc of nuevos) {
                try {
                    // Nodo E & F: Descargar/parsear XML UBL o construir desde datos estructurados
                    let factura: FacturaUBL
                    if (doc.xml_base64) {
                        const xmlRaw = Buffer.from(doc.xml_base64, 'base64').toString('utf8')
                        factura = parseUBL21(xmlRaw)
                    } else {
                        factura = ptDocToFacturaUBL(doc)
                    }

                    // Nodo G & H: Causación automática + generación asiento contable
                    const asiento = await generarAsientoUBL(factura, reglas)

                    // Nodo I & J: Validar retenciones / partida doble
                    const errorCausacion = !asiento.balanceado
                        ? `Descuadre contable (D:${asiento.total_debito.toFixed(0)} ≠ C:${asiento.total_credito.toFixed(0)})`
                        : null

                    const estado: 'causada' | 'pendiente' = errorCausacion ? 'pendiente' : 'causada'
                    if (errorCausacion) {
                        stats.errores++
                        erroresDetalle.push(`${doc.numero_factura}: ${errorCausacion}`)
                    } else {
                        stats.causadas++
                    }

                    // Impuestos retenidos para JSONB
                    const cuentasRetenciones = new Set(['236506', '236515', '236518', '236540', '236701', '236801'])
                    const impuestosRetenidos = asiento.detalles
                        .filter(l => l.credito > 0 && cuentasRetenciones.has(l.cuenta.slice(0, 6)))
                        .map(l => ({ cuenta: l.cuenta, descripcion: l.descripcion, valor: l.credito }))

                    // Nodo K / L: Guardar en facturas_recibidas
                    const { error: insertErr } = await supabase
                        .from('facturas_recibidas')
                        .insert({
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

                    if (insertErr) {
                        console.error(`[DIAN-TRIGGER] Insert error ${doc.cufe}:`, insertErr.message)
                        stats.errores++
                        erroresDetalle.push(`${doc.numero_factura}: ${insertErr.message}`)
                        continue
                    }

                    stats.nuevas++

                    // Nodo M: Acuse de recibo a DIAN vía PT
                    if (estado === 'causada') {
                        await enviarAcuseDian(doc.cufe || factura.cufe, ptConfig)
                    }
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e)
                    console.error(`[DIAN-TRIGGER] Error procesando ${doc.numero_factura}:`, msg)
                    stats.errores++
                    erroresDetalle.push(`${doc.numero_factura}: ${msg}`)
                }
            }

            // Nodo N: Actualizar last_sync
            await supabase
                .from('user_dian_config')
                .update({ last_sync: new Date().toISOString() })
                .eq('profile_id', p_id)

            // Guardar log de sincronización (silencioso si la tabla aún no existe)
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
                    triggered_by: mode,
                })
            } catch { /* tabla puede no existir hasta correr la migración */ }

            // Nodo O: Notificar al contador por email
            if (stats.nuevas > 0 || stats.errores > 0) {
                try {
                    const { data: { user } } = await supabase.auth.getUser()
                    const email = user?.email || ''
                    const nombre = (user?.user_metadata?.full_name as string) || ''
                    if (email) await notificarContador(email, nombre, stats, erroresDetalle)
                } catch { /* email es best-effort */ }
            }
        }

        return NextResponse.json({
            success: true,
            nuevas_sincronizadas: stats.nuevas,
            causadas: stats.causadas,
            errores: stats.errores,
            omitidas: stats.omitidas,
            duration_ms: Date.now() - startMs,
            errores_detalle: erroresDetalle.slice(0, 10),
        })

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[DIAN-TRIGGER] Fatal:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

// ── Envío Evento 030 (Acuse de Recibo) a DIAN vía PT ─────────────────────────
async function enviarAcuseDian(cufe: string, ptConfig: PTConfig): Promise<void> {
    if (ptConfig.proveedor_tecnologico === 'factus') {
        console.log(`[DIAN-ACUSE] Evento 030 pendiente para CUFE ${cufe} vía Factus`)
    } else {
        console.log(`[DIAN-ACUSE] Evento 030 para CUFE ${cufe} vía ${ptConfig.proveedor_tecnologico}`)
    }
}
