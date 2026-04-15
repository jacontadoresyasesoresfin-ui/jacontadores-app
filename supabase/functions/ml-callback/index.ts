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
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state') // tenant_id
        const authError = url.searchParams.get('error')

        // URL base del dashboard, la calcularemos según el origen de la petición si es posible,
        // o como fallback la configurada en la BD.
        let dashboardUrl = 'https://app.ecomfinsas.com/dashboard/configuracion'

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseKey)

        if (authError) {
             return Response.redirect(`${dashboardUrl}?ml_status=cancelled`)
        }

        if (!code || !state) {
            return Response.redirect(`${dashboardUrl}?ml_status=error&msg=missing_params`)
        }

        // Obtener config
        const { data: config } = await supabase
            .from('ml_app_settings')
            .select('app_id, secret_key, redirect_uri')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (!config) {
             return Response.redirect(`${dashboardUrl}?ml_status=error&msg=App+no+configurada`)
        }

        // Intercambiar código
        const response = await fetch('https://api.mercadolibre.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: config.app_id,
                client_secret: config.secret_key,
                code,
                redirect_uri: config.redirect_uri,
            }),
        })

        if (!response.ok) {
            const errText = await response.text()
            return Response.redirect(`${dashboardUrl}?ml_status=error&msg=` + encodeURIComponent(`Rechazado: ${errText}`))
        }

        const tokens = await response.json()
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

        // Obtener info del usuario ML
        const userRes = await fetch(`https://api.mercadolibre.com/users/${tokens.user_id}`, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        const userInfo = userRes.ok ? await userRes.json() : {}

        // Guardar Tokens
         await supabase
            .from('ml_connections')
            .upsert({
                tenant_id: state,
                ml_user_id: String(tokens.user_id),
                ml_nickname: userInfo.nickname || 'Usuario ML',
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                token_expires_at: expiresAt.toISOString(),
                site_id: tokens.site_id || 'MCO',
                connected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'tenant_id' })

        const nick = encodeURIComponent(userInfo.nickname || 'Cuenta ML')
        return Response.redirect(`${dashboardUrl}?ml_status=connected&nick=${nick}`)
        
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
