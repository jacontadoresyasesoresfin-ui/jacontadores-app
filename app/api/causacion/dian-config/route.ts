import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { encrypt, decrypt, maskKey } from '@/lib/causacion/encryption'

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
        .from('user_dian_config')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!data) return NextResponse.json({ config: null })

    // Devolver con API keys enmascaradas (no en claro)
    return NextResponse.json({
        config: {
            ...data,
            api_key_enc: data.api_key_enc ? maskKey(decrypt(data.api_key_enc)) : '',
            api_secret_enc: data.api_secret_enc ? maskKey(decrypt(data.api_secret_enc)) : '',
            has_api_key: !!data.api_key_enc,
            has_api_secret: !!data.api_secret_enc,
        }
    })
}

export async function POST(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const profileId = body.profile_id || user.id

    const {
        proveedor_tecnologico, api_key, api_secret,
        nit_empresa, ambiente, activo, config_extra,
    } = body

    // Solo encriptar si se envió un valor nuevo (no la máscara)
    const toUpsert: Record<string, unknown> = {
        profile_id: profileId,
        proveedor_tecnologico: proveedor_tecnologico || 'manual',
        nit_empresa: nit_empresa || '',
        ambiente: ambiente || 'prueba',
        activo: activo ?? false,
        config_extra: config_extra || {},
        updated_at: new Date().toISOString(),
    }

    if (api_key && !api_key.includes('****')) toUpsert.api_key_enc = encrypt(api_key)
    if (api_secret && !api_secret.includes('****')) toUpsert.api_secret_enc = encrypt(api_secret)

    const { data, error } = await adminSupa()
        .from('user_dian_config')
        .upsert(toUpsert, { onConflict: 'profile_id' })
        .select()
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, config: data })
}
