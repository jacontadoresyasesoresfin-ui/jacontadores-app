import { createClient } from '@supabase/supabase-js'

// Usamos el cliente anónimo público para llamar a las Edge Functions
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// También necesitamos el admin para llamadas de BD en el servidor (getMLConnection)
// Solo válido en el servidor.
const supabaseAdmin = typeof window === 'undefined' ? createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
) : null

export interface MLConnection {
    id: string
    tenant_id: string
    ml_user_id: string
    ml_nickname: string
    access_token: string
    refresh_token: string
    token_expires_at: string
    site_id: string
    connected_at: string
    last_sync_at: string | null
    created_at: string
    updated_at: string
}

/** Obtiene la URL de autenticación de Mercado Libre llamando a la Edge Function ml-auth */
export async function getMLAuthUrl(tenant_id: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('ml-auth', {
        body: { tenant_id }
    })
    
    if (error || !data?.url) {
        throw new Error(error?.message || 'Error al obtener URL de autorización ML')
    }
    
    return data.url
}

/**
 * Llama a la Edge Function ml-status para obtener el estado, 
 * renovar el token o desconectar la cuenta.
 */
export async function mlStatusAPI(action: 'GET' | 'POST' | 'DELETE', tenant_id: string) {
    const { data, error } = await supabase.functions.invoke('ml-status', {
        method: action,
        body: { tenant_id },
        // Para GET y DELETE la function espera tenant_id en query param, 
        // pero nuestra Edge function modificada arriba lo acepta en body para POST.
        // Simplificamos pasándolo siempre en el payload o query según el método.
        ...(action !== 'POST' ? { headers: { 'x-tenant-id': tenant_id } } : {}) // Alternativa
    })

    // Como modifiqué ml-status para recibir tenant_id por URL param en GET/DELETE:
    if (action === 'GET' || action === 'DELETE') {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ml-status?tenant_id=${tenant_id}`, {
            method: action,
            headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` }
        })
        return await res.json()
    }

    if (error) throw new Error(error.message)
    return data
}

/** Obtiene la conexión ML de un tenant directo desde BD (solo servidor) */
export async function getMLConnection(tenant_id: string): Promise<MLConnection | null> {
    if (!supabaseAdmin) return null // Client-side cannot use this
    
    const { data, error } = await supabaseAdmin
        .from('ml_connections')
        .select('*')
        .eq('tenant_id', tenant_id)
        .single()

    if (error || !data) return null
    return data as MLConnection
}

/** 
 * Hace una llamada autenticada a la API de Mercado Libre desde el servidor.
 * Este método delega la renovación del token a la Edge Function si es necesario.
 */
export async function mlFetch(
    endpoint: string,
    tenant_id: string,
    options: RequestInit = {}
): Promise<{ data: unknown; error: string | null }> {
    if (!supabaseAdmin) return { data: null, error: 'mlFetch solo debe usarse en backend' }

    // 1. Verificar si hay token y si expiró
    const conn = await getMLConnection(tenant_id)
    if (!conn) return { data: null, error: 'No hay conexión ML' }

    let token = conn.access_token
    const minutesLeft = (new Date(conn.token_expires_at).getTime() - Date.now()) / 60000

    // 2. Si expiró (o le quedan menos de 30 min), forzar refresh
    if (minutesLeft < 30) {
         try {
             // Llamamos a nuestra propia Edge Function para que renueve usando los secrets
             await mlStatusAPI('POST', tenant_id)
             // Volvemos a leer de la BD
             const updatedConn = await getMLConnection(tenant_id)
             if (!updatedConn) throw new Error('Refresh falló')
             token = updatedConn.access_token
         } catch (e: unknown) {
             return { data: null, error: `Error renovando token: ${e instanceof Error ? e.message : 'Error desconocido'}` }
         }
    }

    // 3. Llamada a ML
    const url = `https://api.mercadolibre.com${endpoint}`
    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    })

    if (!response.ok) {
        return { data: null, error: `ML API error: ${await response.text()}` }
    }

    return { data: await response.json(), error: null }
}
