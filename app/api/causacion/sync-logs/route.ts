import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: Request) {
    try {
        const supabase = await createClient()
        const { searchParams } = new URL(req.url)
        const profile_id = searchParams.get('profile_id')
        const limit = Math.min(Number(searchParams.get('limit') || '20'), 50)

        if (!profile_id) {
            return NextResponse.json({ error: 'profile_id requerido' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('dian_sync_logs')
            .select('*')
            .eq('profile_id', profile_id)
            .order('iniciado_en', { ascending: false })
            .limit(limit)

        if (error) {
            // La tabla puede no existir aún — retornar vacío en lugar de error
            if (error.code === '42P01') {
                return NextResponse.json({ logs: [] })
            }
            throw error
        }

        return NextResponse.json({ logs: data || [] })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
