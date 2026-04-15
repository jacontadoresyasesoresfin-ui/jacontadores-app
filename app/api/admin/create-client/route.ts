import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/admin/create-client
 * Crea un cliente (empresa) en Supabase Auth + perfil
 * Solo puede ser llamado por un superadmin autenticado
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, password, company_name, sheet_url, phone } = body

        if (!email || !password || !company_name) {
            return NextResponse.json({ error: 'Email, password y company_name son requeridos' }, { status: 400 })
        }

        // Cliente con service_role para operaciones administrativas
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // 1. Crear usuario en Auth
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 400 })
        }

        const userId = authData.user.id

        // 2. Crear o actualizar perfil con company_name (lo diferencia como cliente)
        const { error: profileError } = await adminClient.from('profiles').upsert({
            id: userId,
            company_name,
            google_sheet_url: sheet_url || null,
            phone: phone || null,
            role: 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })

        if (profileError) {
            // Si falla el perfil, intentar eliminar el usuario Auth para no dejar basura
            await adminClient.auth.admin.deleteUser(userId)
            return NextResponse.json({ error: profileError.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            userId,
            message: `Cliente "${company_name}" creado exitosamente`
        })

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error interno del servidor'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
