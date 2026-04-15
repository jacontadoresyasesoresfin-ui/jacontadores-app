import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        let tenant_id = url.searchParams.get('tenant_id') // Para GET redirect
        
        if (req.method === 'POST') {
             const body = await req.json()
             tenant_id = body.tenant_id
        }

        if (!tenant_id) {
            return new Response(JSON.stringify({ error: 'tenant_id requerido' }), { 
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            })
        }

        // Obtener config global desde Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data: config } = await supabase
            .from('ml_app_settings')
            .select('app_id, redirect_uri')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!config || !config.app_id) {
            return new Response(JSON.stringify({ error: 'App ML no configurada' }), { 
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            })
        }

        const mlAuthUrl = new URL('https://auth.mercadolibre.com.co/authorization')
        mlAuthUrl.searchParams.set('response_type', 'code')
        mlAuthUrl.searchParams.set('client_id', config.app_id)
        mlAuthUrl.searchParams.set('redirect_uri', config.redirect_uri)
        mlAuthUrl.searchParams.set('state', tenant_id) // state lleva el tenant_id

        // Devolvemos el URL para que el frontend haga la redirección
        return new Response(JSON.stringify({ url: mlAuthUrl.toString() }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
