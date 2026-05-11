/**
 * Adaptadores para Proveedores Tecnológicos (PT) DIAN colombianos.
 * Soporta: Factus, Siigo, API genérica REST.
 */

export interface PTDocumento {
    pt_id: string
    cufe: string
    numero_factura: string
    proveedor_nit: string
    proveedor_nombre: string
    fecha_emision: string
    subtotal: number
    iva: number
    total: number
    xml_base64?: string
    xml_url?: string
    tipo_documento?: string
}

export interface PTConfig {
    proveedor_tecnologico: string
    api_key: string         // ya desencriptada
    api_secret: string      // ya desencriptada
    nit_empresa: string
    ambiente: 'produccion' | 'prueba'
    config_extra?: Record<string, string>  // endpoint, partner_id, etc.
}

export interface PTTestResult {
    ok: boolean
    message: string
    empresa?: string
    nit?: string
}

// ── Factus ────────────────────────────────────────────────────
// https://factus.com.co — PT autorizado DIAN

async function factusToken(cfg: PTConfig): Promise<string> {
    const base = cfg.ambiente === 'produccion'
        ? 'https://api.factus.com.co'
        : 'https://apidemo.factus.com.co'

    const res = await fetch(`${base}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: new URLSearchParams({
            grant_type: 'password',
            client_id: 'client_id_factus',
            client_secret: cfg.api_secret,
            username: cfg.api_key,
            password: cfg.api_secret,
        }),
    })
    if (!res.ok) throw new Error(`Factus auth error: ${res.status}`)
    const data = await res.json()
    return data.access_token as string
}

async function factusTest(cfg: PTConfig): Promise<PTTestResult> {
    try {
        const token = await factusToken(cfg)
        const base = cfg.ambiente === 'produccion' ? 'https://api.factus.com.co' : 'https://apidemo.factus.com.co'
        const res = await fetch(`${base}/v1/companies`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        })
        if (!res.ok) return { ok: false, message: `Error ${res.status}: ${res.statusText}` }
        const data = await res.json()
        return {
            ok: true,
            message: 'Conexión exitosa con Factus',
            empresa: data?.data?.business_name,
            nit: data?.data?.document,
        }
    } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'Error de conexión' }
    }
}

async function factusSyncReceived(cfg: PTConfig, from: string, to: string): Promise<PTDocumento[]> {
    const token = await factusToken(cfg)
    const base = cfg.ambiente === 'produccion' ? 'https://api.factus.com.co' : 'https://apidemo.factus.com.co'

    const params = new URLSearchParams({
        start_date: from,
        end_date: to,
        status: '1',  // validados DIAN
        per_page: '50',
    })

    const res = await fetch(`${base}/v1/purchases?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Factus sync error: ${res.status}`)
    const data = await res.json()
    const docs: PTDocumento[] = []

    for (const item of (data?.data?.data || [])) {
        docs.push({
            pt_id: String(item.id),
            cufe: item.cufe || item.uuid || '',
            numero_factura: item.number || item.invoice_number || '',
            proveedor_nit: item.sender_nit || item.company_document || '',
            proveedor_nombre: item.sender_name || item.company_name || '',
            fecha_emision: item.created_at?.slice(0, 10) || item.date || '',
            subtotal: parseFloat(item.subtotal || '0'),
            iva: parseFloat(item.tax_amount || item.iva || '0'),
            total: parseFloat(item.total || '0'),
            xml_base64: item.attached_document,
            tipo_documento: item.type_document_id,
        })
    }
    return docs
}

// ── Siigo ─────────────────────────────────────────────────────
// https://www.siigo.com/api-siigo/

async function siigoToken(cfg: PTConfig): Promise<string> {
    const res = await fetch('https://api.siigo.com/auth/api/v1/generate_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Partner-Id': cfg.config_extra?.partner_id || 'JA-Contadores',
        },
        body: JSON.stringify({ username: cfg.api_key, access_key: cfg.api_secret }),
    })
    if (!res.ok) throw new Error(`Siigo auth error: ${res.status}`)
    const data = await res.json()
    return data.access_token as string
}

async function siigoTest(cfg: PTConfig): Promise<PTTestResult> {
    try {
        await siigoToken(cfg)
        return { ok: true, message: 'Conexión exitosa con Siigo' }
    } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'Error de conexión Siigo' }
    }
}

async function siigoSyncReceived(cfg: PTConfig, from: string, to: string): Promise<PTDocumento[]> {
    const token = await siigoToken(cfg)
    const params = new URLSearchParams({ invoices_date_start: from, invoices_date_end: to, page: '1', page_size: '50' })
    const res = await fetch(`https://api.siigo.com/v1/invoices?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Siigo sync error: ${res.status}`)
    const data = await res.json()
    const docs: PTDocumento[] = []
    for (const item of (data?.results || [])) {
        docs.push({
            pt_id: String(item.id),
            cufe: item.cufe || '',
            numero_factura: item.name || '',
            proveedor_nit: item.supplier?.identification || '',
            proveedor_nombre: item.supplier?.name || '',
            fecha_emision: item.date || '',
            subtotal: item.subtotal || 0,
            iva: item.taxes?.reduce((a: number, t: { value: number }) => a + t.value, 0) || 0,
            total: item.total || 0,
        })
    }
    return docs
}

// ── API Genérica REST ─────────────────────────────────────────

async function genericTest(cfg: PTConfig): Promise<PTTestResult> {
    const endpoint = cfg.config_extra?.test_endpoint || cfg.config_extra?.base_url
    if (!endpoint) return { ok: false, message: 'Configura el endpoint base en la configuración avanzada' }
    try {
        const res = await fetch(endpoint, {
            headers: { Authorization: `Bearer ${cfg.api_key}`, 'X-API-Key': cfg.api_key },
        })
        return res.ok
            ? { ok: true, message: `Conexión OK (HTTP ${res.status})` }
            : { ok: false, message: `HTTP ${res.status}: ${res.statusText}` }
    } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'Error de red' }
    }
}

async function genericSyncReceived(cfg: PTConfig, from: string, to: string): Promise<PTDocumento[]> {
    const base = cfg.config_extra?.base_url
    if (!base) return []
    const endpoint = cfg.config_extra?.received_endpoint || '/documents/received'
    const params = new URLSearchParams({ from, to })
    const res = await fetch(`${base}${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${cfg.api_key}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Generic PT error: ${res.status}`)
    const data = await res.json()
    // Map generic response — the user maps via config_extra.field_map
    const items: Record<string, unknown>[] = data?.data || data?.results || data || []
    return items.map((item) => ({
        pt_id: String(item.id || item.document_id || ''),
        cufe: String(item.cufe || item.uuid || ''),
        numero_factura: String(item.number || item.invoice_number || item.numero || ''),
        proveedor_nit: String(item.sender_nit || item.nit || ''),
        proveedor_nombre: String(item.sender_name || item.nombre || ''),
        fecha_emision: String(item.date || item.fecha || '').slice(0, 10),
        subtotal: parseFloat(String(item.subtotal || 0)),
        iva: parseFloat(String(item.iva || item.tax || 0)),
        total: parseFloat(String(item.total || 0)),
        xml_base64: item.xml as string | undefined,
    }))
}

// ── Dispatcher principal ──────────────────────────────────────

export async function testConnection(cfg: PTConfig): Promise<PTTestResult> {
    switch (cfg.proveedor_tecnologico) {
        case 'factus': return factusTest(cfg)
        case 'siigo': return siigoTest(cfg)
        case 'manual': return { ok: true, message: 'Modo manual — sin integración PT activa' }
        default: return genericTest(cfg)
    }
}

export async function syncReceived(cfg: PTConfig, from: string, to: string): Promise<PTDocumento[]> {
    switch (cfg.proveedor_tecnologico) {
        case 'factus': return factusSyncReceived(cfg, from, to)
        case 'siigo': return siigoSyncReceived(cfg, from, to)
        case 'manual': return []
        default: return genericSyncReceived(cfg, from, to)
    }
}
