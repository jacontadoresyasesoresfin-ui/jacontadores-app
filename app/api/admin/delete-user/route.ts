import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/admin/delete-user
 * Elimina un usuario de Supabase Auth y su perfil + datos relacionados
 */
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

        // 1. Limpiar datos relacionados antes de eliminar el perfil
        // (ignorar errores si las tablas no existen o no hay datos)
        const cleanupTables = ['dian_invoices', 'sales', 'inventory']
        for (const table of cleanupTables) {
            await adminClient.from(table).delete().eq('profile_id', userId)
        }

        // Limpiar referencia created_by en tenants (si aplica)
        await adminClient
            .from('tenants')
            .update({ created_by: null })
            .eq('created_by', userId)

        // 2. Eliminar perfil (FK cascade)
        const { error: profileDeleteError } = await adminClient
            .from('profiles')
            .delete()
            .eq('id', userId)

        if (profileDeleteError) {
            console.error('[delete-user] Error eliminando perfil:', profileDeleteError.message)
            // Continuar de todas formas — intentar eliminar el usuario Auth
        }

        // 3. Eliminar usuario de Auth
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
