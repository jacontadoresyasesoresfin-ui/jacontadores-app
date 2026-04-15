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
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        const url = new URL(req.url)
        
        // GET: Estado de conexión
        if (req.method === 'GET') {
            const tenant_id = url.searchParams.get('tenant_id')
            if (!tenant_id) return new Response(JSON.stringify({ error: 'tenant_id requerido' }), { status: 400, headers: corsHeaders })
            
            const { data: conn } = await supabase.from('ml_connections').select('*').eq('tenant_id', tenant_id).single()
            if (!conn) return new Response(JSON.stringify({ connected: false }), { headers: corsHeaders })
            
            const isExpired = new Date(conn.token_expires_at) < new Date()
            
            return new Response(JSON.stringify({
                connected: true,
                ml_user_id: conn.ml_user_id,
                ml_nickname: conn.ml_nickname,
                site_id: conn.site_id,
                connected_at: conn.connected_at,
                last_sync_at: conn.last_sync_at,
                token_expires_at: conn.token_expires_at,
                token_status: isExpired ? 'expired' : 'active',
            }), { headers: corsHeaders })
        }

        // POST: Forzar refresh de token
        if (req.method === 'POST') {
             const body = await req.json()
             const tenant_id = body.tenant_id
             
             if (!tenant_id) return new Response(JSON.stringify({ error: 'tenant_id requerido' }), { status: 400, headers: corsHeaders })
             
             const { data: conn } = await supabase.from('ml_connections').select('*').eq('tenant_id', tenant_id).single()
             if (!conn) return new Response(JSON.stringify({ error: 'No hay conexión ML' }), { status: 404, headers: corsHeaders })
             
             const { data: config } = await supabase.from('ml_app_settings').select('app_id, secret_key').limit(1).single()
             if (!config) return new Response(JSON.stringify({ error: 'App ML no configurada' }), { status: 500, headers: corsHeaders })

             const response = await fetch('https://api.mercadolibre.com/oauth/token', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                 body: new URLSearchParams({
                     grant_type: 'refresh_token',
                     client_id: config.app_id,
                     client_secret: config.secret_key,
                     refresh_token: conn.refresh_token,
                 }),
             })
             
             if (!response.ok) {
                 return new Response(JSON.stringify({ error: 'ML rechazó el refresh' }), { status: 400, headers: corsHeaders })
             }
             
             const tokens = await response.json()
             const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000)
             
             await supabase.from('ml_connections').update({
                 access_token: tokens.access_token,
                 refresh_token: tokens.refresh_token || conn.refresh_token,
                 token_expires_at: newExpiresAt.toISOString(),
                 updated_at: new Date().toISOString()
             }).eq('tenant_id', tenant_id)
             
             return new Response(JSON.stringify({ success: true, message: 'Token renovado' }), { headers: corsHeaders })
        }

        // DELETE: Desconectar
        if (req.method === 'DELETE') {
             const tenant_id = url.searchParams.get('tenant_id')
             if (!tenant_id) return new Response(JSON.stringify({ error: 'tenant_id requerido' }), { status: 400, headers: corsHeaders })
             
             await supabase.from('ml_connections').delete().eq('tenant_id', tenant_id)
             return new Response(JSON.stringify({ success: true, message: 'Desconectado' }), { headers: corsHeaders })
        }

        return new Response('Not found', { status: 404, headers: corsHeaders })
        
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
