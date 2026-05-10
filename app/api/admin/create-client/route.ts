import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/admin/create-client
 * Crea una empresa cliente en Supabase Auth + perfil.
 * Llamado por superadmin o firma_admin autenticados.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, password, company_name, sheet_url, phone, app_modules, siigo_url, drive_invoices_url } = body

        if (!email || !password || !company_name) {
            return NextResponse.json(
                { error: 'Email, contraseña y nombre de empresa son requeridos' },
                { status: 400 }
            )
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'La contraseña debe tener al menos 6 caracteres' },
                { status: 400 }
            )
        }

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

        // firma_admin siempre asigna su propio tenant (aislamiento de seguridad)
        const tenantId = callerProfile.role === 'firma_admin'
            ? callerProfile.tenant_id
            : (body.tenant_id || null)

        // 1. Crear usuario en Supabase Auth
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })

        if (authError) {
            // Traducir errores comunes a español
            let msg = authError.message
            if (msg.includes('already registered') || msg.includes('already been registered')) {
                msg = `El email "${email}" ya está registrado en el sistema`
            } else if (msg.includes('invalid email')) {
                msg = 'El email no es válido'
            } else if (msg.includes('Password')) {
                msg = 'La contraseña no cumple los requisitos mínimos'
            }
            return NextResponse.json({ error: msg }, { status: 400 })
        }

        const userId = authData.user.id

        // 2. Upsert del perfil (no depende del trigger de DB)
        // Intentamos inmediatamente, luego con retry si el trigger tarda
        const profileData = {
            id: userId,
            company_name,
            google_sheet_url: sheet_url || null,
            siigo_url: siigo_url || null,
            drive_invoices_url: drive_invoices_url || null,
            phone: phone || null,
            role: 'user',
            tenant_id: tenantId || null,
            app_modules: app_modules || null,
        }

        let profileError = null

        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, 600))
            }

            const { error } = await adminClient
                .from('profiles')
                .upsert(profileData, { onConflict: 'id' })

            if (!error) { profileError = null; break }
            profileError = error
        }

        if (profileError) {
            // Revertir usuario si el perfil no se pudo crear
            await adminClient.auth.admin.deleteUser(userId)
            return NextResponse.json(
                { error: `Usuario creado pero perfil falló: ${profileError.message}` },
                { status: 500 }
            )
        }

        // 3. Verificar que el perfil quedó guardado con los datos correctos
        const { data: verifyProfile } = await adminClient
            .from('profiles')
            .select('id, company_name, tenant_id, role')
            .eq('id', userId)
            .maybeSingle()

        if (!verifyProfile?.company_name) {
            // Último intento forzado
            await adminClient.from('profiles').upsert(profileData, { onConflict: 'id' })
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
