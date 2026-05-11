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

export async function GET(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const p = request.nextUrl.searchParams
    const profileId = p.get('profile_id') || user.id
    const page = Math.max(1, parseInt(p.get('page') || '1'))
    const limit = Math.min(100, parseInt(p.get('limit') || '50'))
    const estado = p.get('estado')
    const from = p.get('fecha_from')
    const to = p.get('fecha_to')
    const q = p.get('q')

    let query = adminSupa()
        .from('facturas_recibidas')
        .select('*', { count: 'exact' })
        .eq('profile_id', profileId)
        .order('fecha_emision', { ascending: false })
        .range((page - 1) * limit, page * limit - 1)

    if (estado) query = query.eq('estado', estado)
    if (from) query = query.gte('fecha_emision', from)
    if (to) query = query.lte('fecha_emision', to)
    if (q) query = query.or(`proveedor_nombre.ilike.%${q}%,proveedor_nit.ilike.%${q}%,numero_factura.ilike.%${q}%,cufe.ilike.%${q}%`)

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ facturas: data || [], total: count || 0, page, limit })
}

export async function PATCH(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { ids, profile_id, ...updates } = body
    const profileId = profile_id || user.id

    if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'ids requeridos' }, { status: 400 })
    }

    const { data, error } = await adminSupa()
        .from('facturas_recibidas')
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

    const { ids, profile_id } = await request.json()
    const profileId = profile_id || user.id

    const { error } = await adminSupa()
        .from('facturas_recibidas')
        .delete()
        .in('id', ids || [])
        .eq('profile_id', profileId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
