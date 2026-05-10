import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId } = body

        if (!userId) {
            return NextResponse.json({ error: 'userId es requerido' }, { status: 400 })
        }

        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Verificar quién llama — debe ser superadmin o firma_admin del mismo tenant
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

        if (!callerProfile) {
            return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })
        }

        // Superadmin puede eliminar cualquiera
        // Firma_admin solo puede eliminar usuarios de su mismo tenant
        if (callerProfile.role !== 'superadmin') {
            if (callerProfile.role !== 'firma_admin') {
                return NextResponse.json({ error: 'Sin permisos para eliminar usuarios' }, { status: 403 })
            }
            // Verificar que el target pertenece al mismo tenant
            const { data: targetProfile } = await adminClient
                .from('profiles')
                .select('tenant_id')
                .eq('id', userId)
                .maybeSingle()

            if (!targetProfile || targetProfile.tenant_id !== callerProfile.tenant_id) {
                return NextResponse.json({ error: 'No puedes eliminar usuarios de otro tenant' }, { status: 403 })
            }
        }

        // Limpiar datos relacionados
        const cleanupTables = ['dian_invoices', 'sales', 'inventory']
        for (const table of cleanupTables) {
            await adminClient.from(table).delete().eq('profile_id', userId)
        }
        await adminClient.from('tenants').update({ created_by: null }).eq('created_by', userId)

        // Eliminar perfil
        await adminClient.from('profiles').delete().eq('id', userId)

        // Eliminar de Auth
        const { error } = await adminClient.auth.admin.deleteUser(userId)
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true, message: 'Usuario eliminado correctamente' })

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error interno'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
