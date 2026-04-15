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
        const { email, password, company_name, sheet_url, ecommerce_integrations } = body

        if (!email || !password || !company_name) {
            return new Response(JSON.stringify({ error: 'email, password y company_name son requeridos' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Create user with email already confirmed
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { company_name, full_name: company_name, role: 'cliente' }
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

        // Build ecommerce integrations (only save enabled ones)
        let activeIntegrations = {}
        if (ecommerce_integrations) {
            activeIntegrations = Object.fromEntries(
                Object.entries(ecommerce_integrations).filter(([, v]) => v.enabled)
            )
        }

        // Upsert profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: newUser.user.id,
                company_name,
                google_sheet_url: sheet_url || null,
                full_name: company_name,
                role: 'cliente',
                ecommerce_integrations: Object.keys(activeIntegrations).length > 0 ? activeIntegrations : {},
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' })

        if (profileError) {
            // Rollback
            await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
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
