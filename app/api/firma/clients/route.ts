import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
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

    const tenantId = myProfile.role === 'superadmin'
        ? (request.nextUrl.searchParams.get('tenantId') || myProfile.tenant_id)
        : myProfile.tenant_id

    if (!tenantId) return NextResponse.json({ tenant: null, clients: [] })

    const [{ data: tenantData }, { data: clientData }] = await Promise.all([
        adminClient.from('tenants').select('*').eq('id', tenantId).maybeSingle(),
        adminClient
            .from('profiles')
            .select('*')
            .eq('tenant_id', tenantId)
            .neq('id', user.id)
            .neq('role', 'firma_admin')
            .neq('role', 'superadmin')
            .order('created_at', { ascending: false }),
    ])

    return NextResponse.json({
        tenant: tenantData || null,
        tenantId,
        clients: clientData || [],
    })
}
