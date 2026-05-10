import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/admin/create-client
 * Crea un cliente (empresa) en Supabase Auth + perfil
 * Puede ser llamado por superadmin o firma_admin autenticados.
 * Un firma_admin solo puede crear clientes dentro de su propio tenant.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, password, company_name, sheet_url, phone, app_modules } = body

        if (!email || !password || !company_name) {
            return NextResponse.json({ error: 'Email, password y company_name son requeridos' }, { status: 400 })
        }

        // Cliente admin para operaciones privilegiadas
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Verificar quién llama
        const cookieStore = await cookies()
        const callerClient = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
        )
        const { data: { user: callerUser } } = await callerClient.auth.getUser()

        if (!callerUser) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }

        const { data: callerProfile } = await adminClient
            .from('profiles')
            .select('role, tenant_id')
            .eq('id', callerUser.id)
            .maybeSingle()

        if (!callerProfile || !['superadmin', 'firma_admin'].includes(callerProfile.role)) {
            return NextResponse.json({ error: 'Sin permisos para crear empresas' }, { status: 403 })
        }

        // firma_admin siempre usa su propio tenant_id (seguridad de aislamiento)
        const tenantId = callerProfile.role === 'firma_admin'
            ? callerProfile.tenant_id
            : (body.tenant_id || null)

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

        // 2. Esperar al trigger de creación de perfil
        await new Promise(resolve => setTimeout(resolve, 600))

        const { error: profileError } = await adminClient
            .from('profiles')
            .update({
                company_name,
                google_sheet_url: sheet_url || null,
                phone: phone || null,
                role: 'user',
                tenant_id: tenantId || null,
                app_modules: app_modules || null,
            })
            .eq('id', userId)

        if (profileError) {
            // Revertir la creación del usuario si el perfil falla
            await adminClient.auth.admin.deleteUser(userId)
            return NextResponse.json({ error: profileError.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            userId,
            message: `Empresa "${company_name}" registrada exitosamente`,
        })

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error interno del servidor'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
