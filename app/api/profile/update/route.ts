import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/profile/update
 * Actualiza los datos de configuración del perfil del usuario autenticado.
 * Solo puede modificar su propio perfil. Los admins/firma_admin pueden
 * actualizar el perfil de cualquier cliente de su tenant.
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

    const adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Obtener perfil del caller para saber su rol
    const { data: callerProfile } = await adminClient
        .from('profiles')
        .select('role, tenant_id')
        .eq('id', user.id)
        .maybeSingle()

    if (!callerProfile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    const body = await request.json()
    const {
        targetId,           // Si se pasa, actualizar ese perfil (solo admins)
        company_name,
        google_sheet_url,
        siigo_url,
        drive_invoices_url,
        reconciliation_sheet_url,
        phone,
    } = body

    // Determinar qué perfil actualizar
    let profileIdToUpdate = user.id  // Por defecto, el propio perfil

    if (targetId && targetId !== user.id) {
        // Solo superadmin o firma_admin pueden actualizar otros perfiles
        if (!['superadmin', 'firma_admin'].includes(callerProfile.role)) {
            return NextResponse.json({ error: 'Sin permisos para actualizar otros perfiles' }, { status: 403 })
        }

        // firma_admin solo puede actualizar clientes de su mismo tenant
        if (callerProfile.role === 'firma_admin') {
            const { data: targetProfile } = await adminClient
                .from('profiles')
                .select('tenant_id')
                .eq('id', targetId)
                .maybeSingle()

            if (!targetProfile || targetProfile.tenant_id !== callerProfile.tenant_id) {
                return NextResponse.json({ error: 'Perfil no pertenece a tu firma' }, { status: 403 })
            }
        }

        profileIdToUpdate = targetId
    }

    // Construir objeto de actualización — solo incluir campos que se enviaron
    const updates: Record<string, string | null> = {
        updated_at: new Date().toISOString(),
    }
    if (company_name !== undefined)              updates.company_name = company_name || null
    if (google_sheet_url !== undefined)          updates.google_sheet_url = google_sheet_url?.trim() || null
    if (siigo_url !== undefined)                 updates.siigo_url = siigo_url?.trim() || null
    if (drive_invoices_url !== undefined)        updates.drive_invoices_url = drive_invoices_url?.trim() || null
    if (reconciliation_sheet_url !== undefined)  updates.reconciliation_sheet_url = reconciliation_sheet_url?.trim() || null
    if (phone !== undefined)                     updates.phone = phone?.trim() || null

    const { error } = await adminClient
        .from('profiles')
        .update(updates)
        .eq('id', profileIdToUpdate)

    if (error) {
        console.error('[profile/update] Supabase error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Devolver el perfil actualizado completo
    const { data: updatedProfile } = await adminClient
        .from('profiles')
        .select('id, company_name, google_sheet_url, siigo_url, drive_invoices_url, reconciliation_sheet_url, phone, role, tenant_id, app_modules')
        .eq('id', profileIdToUpdate)
        .maybeSingle()

    return NextResponse.json({ success: true, profile: updatedProfile })
}
