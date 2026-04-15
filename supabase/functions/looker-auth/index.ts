// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts"

console.log("Looker Auth Function Initialized")

serve(async (req: Request) => {
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Configuration from secrets
        const secret = Deno.env.get('LOOKER_EMBED_SECRET')
        const host = Deno.env.get('LOOKER_HOST') // e.g., 'yourcompany.looker.com'

        // DEMO MODE: If Looker credentials are not set, return a demo iframe URL
        if (!secret || !host) {
            console.log('Running in DEMO mode - Looker credentials not configured')
            return new Response(
                JSON.stringify({
                    url: "https://lookerstudio.google.com/embed/reporting/create?c.mode=view",
                    mode: "demo",
                    message: "Looker credentials not configured. Showing demo dashboard."
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // PRODUCTION MODE: Verify User Session
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) {
            throw new Error('Unauthorized')
        }

        // Get User Tenant Logic (Fetch profile)
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .single()

        if (!profile?.tenant_id) {
            throw new Error('No tenant assigned')
        }

        // ... (Implementation of Looker URL signing would go here)
        // For this task, we will return a constructed dummy URL with the tenant_id as a filter,
        // simulating a real signed URL response.

        const embedUrl = `/embed/dashboards/1?TenantID=${profile.tenant_id}`
        const signedUrl = `https://${host}${embedUrl}&signature=mock_signature`

        return new Response(
            JSON.stringify({ url: signedUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return new Response(JSON.stringify({ error: errorMessage }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
