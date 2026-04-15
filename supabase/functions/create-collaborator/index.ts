// @ts-nocheck
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Verify caller is superadmin
        const token = authHeader.replace('Bearer ', '')
        const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token)
        if (callerError || !caller) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Extract and check caller role
        const { data: callerProfile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .maybeSingle()

        if (callerProfile?.role !== 'superadmin') {
            return new Response(JSON.stringify({ error: 'Forbidden: superadmin only' }), {
                status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const body = await req.json()
        const { email, password, full_name, phone, role, tenant_id } = body

        if (!email || !password || !full_name) {
            return new Response(JSON.stringify({ error: 'email, password y full_name son requeridos' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Create user with email already confirmed
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name, role: role || 'user' }
        })

        if (createError) {
            return new Response(JSON.stringify({ error: createError.message }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }
        if (!newUser.user) {
            return new Response(JSON.stringify({ error: 'No se pudo crear el usuario' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Upsert profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: newUser.user.id,
                full_name,
                phone: phone || null,
                role: role || 'user',
                tenant_id: tenant_id || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' })

        if (profileError) {
            return new Response(JSON.stringify({ error: profileError.message }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
