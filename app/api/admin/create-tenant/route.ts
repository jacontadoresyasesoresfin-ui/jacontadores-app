import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'



export async function POST(req: NextRequest) {
    try {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        )
        const body = await req.json()
        const {
            // Datos de la firma
            name, brand_name, primary_color, accent_color, plan, available_modules,
            // Datos del admin de la firma
            admin_email, admin_password, admin_full_name,
        } = body

        if (!name || !admin_email || !admin_password) {
            return NextResponse.json({ error: 'Campos requeridos: name, admin_email, admin_password' }, { status: 400 })
        }

        // 1. Crear el tenant (firma contable)
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .insert({
                name,
                brand_name: brand_name || name,
                primary_color: primary_color || '#13213C',
                accent_color: accent_color || '#B8960C',
                plan: plan || 'basic',
                available_modules: available_modules || [
                    'analytics', 'sales', 'taxes', 'inventory', 'reports',
                    'reconciliation', 'portfolio', 'nomina',
                ],
                is_active: true,
            })
            .select()
            .single()

        if (tenantError) {
            return NextResponse.json({ error: `Error creando firma: ${tenantError.message}` }, { status: 500 })
        }

        // 2. Crear el usuario admin de la firma en Auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: admin_email,
            password: admin_password,
            email_confirm: true,
        })

        if (authError) {
            // Rollback: eliminar el tenant creado
            await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
            return NextResponse.json({ error: `Error creando usuario: ${authError.message}` }, { status: 500 })
        }

        // 3. Actualizar el perfil que el trigger creó automáticamente
        await new Promise(resolve => setTimeout(resolve, 500))
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                role: 'firma_admin',
                full_name: admin_full_name || name,
                tenant_id: tenant.id,
                app_modules: available_modules || tenant.available_modules,
            })
            .eq('id', authUser.user.id)

        if (profileError) {
            return NextResponse.json({ error: `Error creando perfil admin: ${profileError.message}` }, { status: 500 })
        }

        return NextResponse.json({
            ok: true,
            tenant_id: tenant.id,
            admin_id: authUser.user.id,
            message: `Firma "${name}" creada con admin ${admin_email}`,
        })

    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error interno' },
            { status: 500 }
        )
    }
}
