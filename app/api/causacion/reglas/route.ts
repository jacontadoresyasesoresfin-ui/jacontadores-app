import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { REGLAS_DEFAULT } from '@/lib/causacion/motor'

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

    const profileId = request.nextUrl.searchParams.get('profile_id') || user.id

    const { data, error } = await adminSupa()
        .from('causacion_reglas')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
        reglas: data || [],
        defaults: REGLAS_DEFAULT,
    })
}

export async function POST(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const profileId = body.profile_id || user.id
    const { nombre, reglas, activo } = body

    if (!reglas) return NextResponse.json({ error: 'reglas requeridas' }, { status: 400 })

    const { data, error } = await adminSupa()
        .from('causacion_reglas')
        .upsert({
            profile_id: profileId,
            nombre: nombre || 'Reglas personalizadas',
            reglas,
            activo: activo ?? true,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'profile_id' })
        .select()
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
}

export async function DELETE(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id, profile_id } = await request.json()
    const profileId = profile_id || user.id

    const { error } = await adminSupa()
        .from('causacion_reglas')
        .delete()
        .eq('id', id)
        .eq('profile_id', profileId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
