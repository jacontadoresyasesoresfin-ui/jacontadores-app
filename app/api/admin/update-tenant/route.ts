import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    try {
        const { tenant_id, ...updates } = await req.json()
        if (!tenant_id) return NextResponse.json({ error: 'tenant_id requerido' }, { status: 400 })

        const allowed = ['name', 'brand_name', 'primary_color', 'accent_color', 'plan', 'available_modules', 'is_active', 'logo_url']
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
        for (const key of allowed) {
            if (updates[key] !== undefined) patch[key] = updates[key]
        }

        const { error } = await supabaseAdmin
            .from('tenants')
            .update(patch)
            .eq('id', tenant_id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ ok: true })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 })
    }
}
