import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { parseUBL21 } from '@/lib/causacion/xml-parser'
import { generarAsientoUBL, REGLAS_DEFAULT } from '@/lib/causacion/motor'

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

async function loadReglas(profileId: string) {
    const { data } = await adminSupa()
        .from('causacion_reglas')
        .select('reglas')
        .eq('profile_id', profileId)
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    return data?.reglas || REGLAS_DEFAULT
}

export async function POST(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const profileId = body.profile_id || user.id
    const ids: string[] = body.ids || []
    const fuente: 'recibida' | 'manual' = body.fuente || 'recibida'

    if (ids.length === 0) return NextResponse.json({ error: 'ids requeridos' }, { status: 400 })

    const reglas = await loadReglas(profileId)

    const tabla = fuente === 'recibida' ? 'facturas_recibidas' : 'causaciones'

    const { data: facturas, error: fetchErr } = await adminSupa()
        .from(tabla)
        .select('*')
        .in('id', ids)
        .eq('profile_id', profileId)

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const resultados: { id: string; ok: boolean; error?: string; asiento?: unknown }[] = []
    const auditRows: Record<string, unknown>[] = []

    for (const f of (facturas || [])) {
        try {
            let ublData = null

            // Intentar parsear XML si existe
            if (f.xml_content) {
                try {
                    const xmlText = Buffer.from(f.xml_content, 'base64').toString('utf-8')
                    ublData = parseUBL21(xmlText)
                } catch { /* XML no parseable */ }
            }

            // Construir FacturaUBL desde los datos almacenados si no hay XML
            if (!ublData) {
                ublData = {
                    cufe: f.cufe || '',
                    numero_factura: f.numero_factura || f.numero_factura || '',
                    tipo_documento: f.tipo_documento || '01',
                    fecha_emision: f.fecha_emision || f.fecha || new Date().toISOString().slice(0, 10),
                    hora_emision: '00:00:00',
                    proveedor_nit: f.proveedor_nit || f.nit_tercero || '',
                    proveedor_nombre: f.proveedor_nombre || f.nombre_tercero || '',
                    proveedor_direccion: '',
                    proveedor_municipio: '',
                    proveedor_regimen: '',
                    receptor_nit: '',
                    receptor_nombre: '',
                    subtotal: f.subtotal || f.valor_base || 0,
                    descuento_total: 0,
                    base_gravable: f.subtotal || f.valor_base || 0,
                    iva_total: f.iva || f.valor_iva || 0,
                    ica_total: 0,
                    total: f.total || f.valor_neto || 0,
                    items: f.items ? (typeof f.items === 'string' ? JSON.parse(f.items) : f.items) : [],
                    impuestos: f.impuestos ? (typeof f.impuestos === 'string' ? JSON.parse(f.impuestos) : f.impuestos) : [],
                    forma_pago: '1',
                    fecha_vencimiento: f.fecha_emision || '',
                }
            }

            const asiento = await generarAsientoUBL(ublData, reglas)

            // Guardar asiento en la factura
            await adminSupa()
                .from(tabla)
                .update({
                    estado: 'causada',
                    asiento_contable: asiento,
                    fecha_causacion: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', f.id)

            resultados.push({ id: f.id, ok: true, asiento })

            auditRows.push({
                profile_id: profileId,
                factura_id: fuente === 'recibida' ? f.id : null,
                accion: 'causacion',
                detalle: {
                    numero_factura: f.numero_factura,
                    proveedor: f.proveedor_nombre || f.nombre_tercero,
                    metodo: asiento.metodo_causacion,
                    total_debito: asiento.total_debito,
                    balanceado: asiento.balanceado,
                    ia_sugerencia: asiento.ia_sugerencia,
                },
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error'
            resultados.push({ id: f.id, ok: false, error: msg })
            auditRows.push({
                profile_id: profileId,
                accion: 'error',
                detalle: { id: f.id, error: msg },
            })
        }
    }

    if (auditRows.length > 0) {
        await adminSupa().from('causacion_auditoria').insert(auditRows).select()
    }

    const exitosos = resultados.filter(r => r.ok).length
    return NextResponse.json({ ok: exitosos > 0, exitosos, errores: resultados.length - exitosos, resultados })
}
