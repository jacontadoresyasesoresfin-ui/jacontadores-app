import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/causacion/encryption'
import { testConnection } from '@/lib/causacion/pt-adapters'

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

export async function POST(request: NextRequest) {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const profileId = body.profile_id || user.id

    // Cargar config guardada
    const { data: cfg } = await adminSupa()
        .from('user_dian_config')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle()

    if (!cfg) return NextResponse.json({ ok: false, message: 'Guarda la configuración primero' })

    // Resolver claves: usar las del body si son nuevas, o las guardadas
    const api_key = (body.api_key && !body.api_key.includes('****'))
        ? body.api_key
        : decrypt(cfg.api_key_enc || '')

    const api_secret = (body.api_secret && !body.api_secret.includes('****'))
        ? body.api_secret
        : decrypt(cfg.api_secret_enc || '')

    const result = await testConnection({
        proveedor_tecnologico: cfg.proveedor_tecnologico,
        api_key,
        api_secret,
        nit_empresa: cfg.nit_empresa,
        ambiente: cfg.ambiente,
        config_extra: cfg.config_extra,
    })

    // Actualizar last_sync si fue exitoso
    if (result.ok) {
        await adminSupa()
            .from('user_dian_config')
            .update({ last_sync: new Date().toISOString() })
            .eq('profile_id', profileId)
    }

    return NextResponse.json(result)
}
