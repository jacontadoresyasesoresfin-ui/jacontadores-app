import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/admin/create-collaborator
 * Crea un colaborador interno (admin o user) en Supabase Auth + perfil
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, password, full_name, phone, role } = body

        if (!email || !password || !full_name) {
            return NextResponse.json({ error: 'Email, password y full_name son requeridos' }, { status: 400 })
        }

        const validRoles = ['admin', 'user']
        const userRole = validRoles.includes(role) ? role : 'user'

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

        // 2. Crear perfil de colaborador (sin company_name — así se distingue de clientes)
        const { error: profileError } = await adminClient.from('profiles').upsert({
            id: userId,
            full_name,
            phone: phone || null,
            role: userRole,
            company_name: null, // Explícitamente null = colaborador, no cliente
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })

        if (profileError) {
            await adminClient.auth.admin.deleteUser(userId)
            return NextResponse.json({ error: profileError.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            userId,
            role: userRole,
            message: `Colaborador "${full_name}" creado con rol "${userRole}"`
        })

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error interno'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
