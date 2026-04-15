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

        const { userId } = await req.json()
        if (!userId) {
            return new Response(JSON.stringify({ error: 'userId is required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (userId === caller.id) {
            return new Response(JSON.stringify({ error: 'No puedes eliminar tu propia cuenta' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Delete from auth (removes user completely)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (deleteError) {
            return new Response(JSON.stringify({ error: deleteError.message }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Explicit profile cleanup (in case cascade doesn't fire)
        await supabaseAdmin.from('profiles').delete().eq('id', userId)

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        })
    }
})
