import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/firma/link-user
 * Busca un usuario por email y lo asigna al tenant de la firma.
 * Útil para recuperar empresas creadas que perdieron su tenant_id.
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

    const tenantId = myProfile.role === 'firma_admin' ? myProfile.tenant_id : null
    if (!tenantId) return NextResponse.json({ error: 'Sin tenant asignado' }, { status: 400 })

    const body = await request.json()
    const { email, company_name } = body
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

    // Buscar el usuario en Auth por email
    const { data: { users: authUsers }, error: listError } = await adminClient.auth.admin.listUsers()
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

    const targetUser = authUsers.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!targetUser) {
        return NextResponse.json({ error: `No existe usuario con email "${email}" en el sistema` }, { status: 404 })
    }

    // Verificar que no pertenece ya a otro tenant
    const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', targetUser.id)
        .maybeSingle()

    if (targetProfile?.tenant_id && targetProfile.tenant_id !== tenantId) {
        return NextResponse.json({ error: 'Este usuario ya pertenece a otra firma' }, { status: 409 })
    }

    // Vincular al tenant y actualizar datos
    const updateData: Record<string, unknown> = {
        tenant_id: tenantId,
        role: 'user',
        updated_at: new Date().toISOString(),
    }
    if (company_name) updateData.company_name = company_name

    const { error: updateError } = await adminClient
        .from('profiles')
        .upsert({ id: targetUser.id, ...updateData }, { onConflict: 'id' })

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ success: true, userId: targetUser.id })
}
