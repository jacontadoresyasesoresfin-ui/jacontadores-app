import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function getCallerIntegrations(req: NextRequest, platform: string) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return { error: 'No authorization header', status: 401 }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return { error: 'Invalid token', status: 401 }

    const { data: profile } = await supabase
        .from('profiles')
        .select('ecommerce_integrations')
        .eq('id', user.id)
        .maybeSingle()

    const integration = profile?.ecommerce_integrations?.[platform]
    if (!integration?.enabled) return { error: `${platform} integration not enabled`, status: 400 }
    return { integration }
}

// ─── Mercado Libre ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const body = await req.json()
    const { platform } = body

    if (platform === 'mercadolibre') {
        const result = await getCallerIntegrations(req, 'mercadolibre')
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
        const { seller_id, access_token } = result.integration

        try {
            const [userRes, ordersRes, itemsRes] = await Promise.all([
                fetch(`https://api.mercadolibre.com/users/${seller_id}`, {
                    headers: { Authorization: `Bearer ${access_token}` }
                }),
                fetch(`https://api.mercadolibre.com/orders/search?seller=${seller_id}&sort=date_desc&limit=20`, {
                    headers: { Authorization: `Bearer ${access_token}` }
                }),
                fetch(`https://api.mercadolibre.com/users/${seller_id}/items/search?limit=10`, {
                    headers: { Authorization: `Bearer ${access_token}` }
                }),
            ])

            const [userData, ordersData, itemsData] = await Promise.all([
                userRes.ok ? userRes.json() as any : {},
                ordersRes.ok ? ordersRes.json() as any : { results: [], paging: { total: 0 } },
                itemsRes.ok ? itemsRes.json() as any : { results: [], paging: { total: 0 } },
            ])

            const orders: any[] = (ordersData as any)?.results || []
            const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)
            const completedOrders = orders.filter((o: any) => o.status === 'paid').length

            return NextResponse.json({
                platform: 'mercadolibre',
                seller: {
                    nickname: (userData as any)?.nickname || 'N/A',
                    reputation: (userData as any)?.seller_reputation?.level_id || 'N/A',
                    transactions: (userData as any)?.seller_reputation?.transactions?.completed || 0,
                },
                metrics: {
                    totalOrders: ordersData.paging?.total || 0,
                    recentOrders: orders.length,
                    completedOrders,
                    totalRevenue,
                    activeListings: itemsData.paging?.total || 0,
                },
                recentOrders: orders.slice(0, 10).map((o: any) => ({
                    id: o.id,
                    date: o.date_created?.split('T')[0] || '',
                    buyer: o.buyer?.nickname || 'Comprador',
                    amount: o.total_amount || 0,
                    status: o.status || 'unknown',
                    currency: o.currency_id || 'COP',
                })),
            })
        } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 500 })
        }
    }

    if (platform === 'dropi') {
        const result = await getCallerIntegrations(req, 'dropi')
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
        const { api_key } = result.integration

        try {
            const ordersRes = await fetch('https://api.dropi.co/api/v1/orders?per_page=20', {
                headers: { Authorization: `Bearer ${api_key}`, 'Content-Type': 'application/json' }
            })

            if (!ordersRes.ok) {
                return NextResponse.json({ error: `Dropi API error: ${ordersRes.status}` }, { status: ordersRes.status })
            }

            const ordersData = await ordersRes.json()
            const orders = ordersData.data || ordersData.orders || []
            const totalRevenue = orders.reduce((s: number, o: any) => s + (o.total || o.amount || 0), 0)
            const delivered = orders.filter((o: any) => o.status === 'delivered' || o.status === 'entregado').length

            return NextResponse.json({
                platform: 'dropi',
                metrics: {
                    totalOrders: ordersData.total || orders.length,
                    deliveredOrders: delivered,
                    totalRevenue,
                },
                recentOrders: orders.slice(0, 10).map((o: any) => ({
                    id: o.id,
                    date: o.created_at?.split('T')[0] || '',
                    buyer: o.customer_name || o.shipping_name || 'Cliente',
                    amount: o.total || o.amount || 0,
                    status: o.status,
                    currency: 'COP',
                })),
            })
        } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 500 })
        }
    }

    if (platform === 'shopify') {
        const result = await getCallerIntegrations(req, 'shopify')
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
        const { shop_domain, access_token } = result.integration

        try {
            const [ordersRes, productsRes] = await Promise.all([
                fetch(`https://${shop_domain}/admin/api/2024-01/orders.json?limit=20&status=any`, {
                    headers: { 'X-Shopify-Access-Token': access_token }
                }),
                fetch(`https://${shop_domain}/admin/api/2024-01/products/count.json`, {
                    headers: { 'X-Shopify-Access-Token': access_token }
                }),
            ])

            const ordersData = ordersRes.ok ? await ordersRes.json() : { orders: [] }
            const productsData = productsRes.ok ? await productsRes.json() : { count: 0 }
            const orders = ordersData.orders || []
            const totalRevenue = orders.reduce((s: number, o: any) => s + parseFloat(o.total_price || '0'), 0)

            return NextResponse.json({
                platform: 'shopify',
                metrics: {
                    totalOrders: orders.length,
                    totalRevenue,
                    activeProducts: productsData.count || 0,
                },
                recentOrders: orders.slice(0, 10).map((o: any) => ({
                    id: o.order_number,
                    date: o.created_at?.split('T')[0] || '',
                    buyer: `${o.customer?.first_name || ''} ${o.customer?.last_name || ''}`.trim() || 'Cliente',
                    amount: parseFloat(o.total_price || '0'),
                    status: o.financial_status,
                    currency: o.currency || 'COP',
                })),
            })
        } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 500 })
        }
    }

    if (platform === 'woocommerce') {
        const result = await getCallerIntegrations(req, 'woocommerce')
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
        const { store_url, consumer_key, consumer_secret } = result.integration

        try {
            const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64')
            const [ordersRes, productsRes] = await Promise.all([
                fetch(`${store_url}/wp-json/wc/v3/orders?per_page=20`, {
                    headers: { Authorization: `Basic ${auth}` }
                }),
                fetch(`${store_url}/wp-json/wc/v3/products?per_page=1`, {
                    headers: { Authorization: `Basic ${auth}` }
                }),
            ])

            const orders = ordersRes.ok ? await ordersRes.json() : []
            const totalRevenue = orders.reduce((s: number, o: any) => s + parseFloat(o.total || '0'), 0)
            const productCount = productsRes.ok ? parseInt(productsRes.headers.get('X-WP-Total') || '0') : 0

            return NextResponse.json({
                platform: 'woocommerce',
                metrics: { totalOrders: orders.length, totalRevenue, activeProducts: productCount },
                recentOrders: orders.slice(0, 10).map((o: any) => ({
                    id: o.number,
                    date: o.date_created?.split('T')[0] || '',
                    buyer: `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim() || 'Cliente',
                    amount: parseFloat(o.total || '0'),
                    status: o.status,
                    currency: o.currency || 'COP',
                })),
            })
        } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 500 })
        }
    }

    if (platform === 'tiendanube') {
        const result = await getCallerIntegrations(req, 'tiendanube')
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
        const { store_id, access_token } = result.integration

        try {
            const ordersRes = await fetch(`https://api.tiendanube.com/v1/${store_id}/orders?per_page=20`, {
                headers: { Authentication: `bearer ${access_token}`, 'User-Agent': 'JAContadores/1.0' }
            })
            const orders = ordersRes.ok ? await ordersRes.json() : []
            const totalRevenue = orders.reduce((s: number, o: any) => s + parseFloat(o.total || '0'), 0)

            return NextResponse.json({
                platform: 'tiendanube',
                metrics: { totalOrders: orders.length, totalRevenue },
                recentOrders: orders.slice(0, 10).map((o: any) => ({
                    id: o.number,
                    date: o.created_at?.split('T')[0] || '',
                    buyer: `${o.contact_name || 'Cliente'}`,
                    amount: parseFloat(o.total || '0'),
                    status: o.payment_status,
                    currency: o.currency || 'COP',
                })),
            })
        } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 500 })
        }
    }

    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
}
