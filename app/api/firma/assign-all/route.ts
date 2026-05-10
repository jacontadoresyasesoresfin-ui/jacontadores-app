import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/firma/assign-all
 * Asigna TODOS los usuarios con role='user' sin tenant (o huérfanos)
 * al tenant del firma_admin autenticado.
 */
export async function POST() {
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

    const tenantId = myProfile.tenant_id
    if (!tenantId) return NextResponse.json({ error: 'Tu cuenta no tiene tenant asignado' }, { status: 400 })

    // Obtener todos los perfiles de usuario que no son admin ni tienen el tenant correcto
    const { data: allProfiles, error: fetchError } = await adminClient
        .from('profiles')
        .select('id, email, role, tenant_id, company_name')
        .not('role', 'in', '("superadmin","firma_admin")')
        .neq('id', user.id)

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

    const toAssign = (allProfiles || []).filter(
        p => !p.tenant_id || p.tenant_id !== tenantId
    )

    if (toAssign.length === 0) {
        return NextResponse.json({ success: true, assigned: 0, message: 'Todos los usuarios ya estaban asignados' })
    }

    const ids = toAssign.map(p => p.id)

    const { error: updateError } = await adminClient
        .from('profiles')
        .update({ tenant_id: tenantId, role: 'user' })
        .in('id', ids)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({
        success: true,
        assigned: ids.length,
        message: `${ids.length} empresa(s) asignadas a tu firma`,
    })
}
