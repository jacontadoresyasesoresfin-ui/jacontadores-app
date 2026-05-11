import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

async function canAccess(callerId: string, targetProfileId: string): Promise<boolean> {
    if (callerId === targetProfileId) return true
    const { data } = await adminSupa()
        .from('profiles')
        .select('role, tenant_id')
        .eq('id', callerId)
        .maybeSingle()
    if (!data) return false
    if (data.role === 'superadmin') return true
    if (data.role === 'firma_admin' && data.tenant_id) {
        const { data: target } = await adminSupa()
            .from('profiles')
            .select('tenant_id')
            .eq('id', targetProfileId)
            .maybeSingle()
        return target?.tenant_id === data.tenant_id
    }
    return false
}

export async function GET(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const p = request.nextUrl.searchParams
    const profileId = p.get('profile_id') || user.id

    if (!await canAccess(user.id, profileId)) {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const page = Math.max(1, parseInt(p.get('page') || '1'))
    const limit = Math.min(200, parseInt(p.get('limit') || '100'))
    const estado = p.get('estado')
    const tipo = p.get('tipo')
    const from = p.get('fecha_from')
    const to = p.get('fecha_to')
    const q = p.get('q')

    let query = adminSupa()
        .from('causaciones')
        .select('*', { count: 'exact' })
        .eq('profile_id', profileId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1)

    if (estado) query = query.eq('estado', estado)
    if (tipo) query = query.eq('tipo', tipo)
    if (from) query = query.gte('fecha', from)
    if (to) query = query.lte('fecha', to)
    if (q) query = query.or(`nombre_tercero.ilike.%${q}%,nit_tercero.ilike.%${q}%,numero_factura.ilike.%${q}%`)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ facturas: data || [], total: count || 0, page, limit })
}

export async function POST(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const profileId = body.profile_id || user.id

    if (!await canAccess(user.id, profileId)) {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const facturas: Record<string, unknown>[] = Array.isArray(body.facturas) ? body.facturas : [body]
    const rows = facturas.map(f => ({
        ...f,
        profile_id: profileId,
        id: undefined,
        created_at: undefined,
        updated_at: undefined,
    }))

    const { data, error } = await adminSupa()
        .from('causaciones')
        .insert(rows)
        .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ facturas: data })
}

export async function PATCH(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { ids, profile_id, ...updates } = body
    const profileId = profile_id || user.id

    if (!await canAccess(user.id, profileId)) {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'ids requeridos' }, { status: 400 })
    }

    const { data, error } = await adminSupa()
        .from('causaciones')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('profile_id', profileId)
        .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ facturas: data })
}

export async function DELETE(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { ids, profile_id } = body
    const profileId = profile_id || user.id

    if (!await canAccess(user.id, profileId)) {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'ids requeridos' }, { status: 400 })
    }

    const { error } = await adminSupa()
        .from('causaciones')
        .delete()
        .in('id', ids)
        .eq('profile_id', profileId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, deleted: ids.length })
}
