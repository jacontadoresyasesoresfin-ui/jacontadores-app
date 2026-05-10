import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/firma/update-client
 * Actualiza datos de un cliente de la firma (usa service role para evitar RLS).
 * Solo firma_admin del mismo tenant o superadmin pueden actualizar.
 */
export async function POST(request: NextRequest) {
    const cookieStore = await cookies()
    const callerClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { user } } = await callerClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: myProfile } = await adminClient
        .from('profiles')
        .select('role, tenant_id')
        .eq('id', user.id)
        .maybeSingle()

    if (!myProfile || !['firma_admin', 'superadmin'].includes(myProfile.role)) {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { clientId, company_name, google_sheet_url, siigo_url, drive_invoices_url, app_modules } = body

    if (!clientId) return NextResponse.json({ error: 'clientId requerido' }, { status: 400 })

    // Verificar que el cliente pertenece al tenant de quien llama
    if (myProfile.role === 'firma_admin') {
        const { data: targetProfile } = await adminClient
            .from('profiles')
            .select('tenant_id')
            .eq('id', clientId)
            .maybeSingle()

        if (!targetProfile || targetProfile.tenant_id !== myProfile.tenant_id) {
            return NextResponse.json({ error: 'Cliente no pertenece a tu firma' }, { status: 403 })
        }
    }

    const { error } = await adminClient
        .from('profiles')
        .update({
            company_name,
            google_sheet_url: google_sheet_url || null,
            siigo_url: siigo_url || null,
            drive_invoices_url: drive_invoices_url || null,
            app_modules: app_modules || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
