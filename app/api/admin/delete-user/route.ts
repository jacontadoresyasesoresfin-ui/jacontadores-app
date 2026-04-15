import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/admin/delete-user
 * Elimina un usuario de Supabase Auth y su perfil
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

        // 1. Eliminar perfil primero (FK constraint)
        await adminClient.from('profiles').delete().eq('id', userId)

        // 2. Eliminar usuario de Auth
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
