import { NextResponse } from 'next/server'
import { testConnection, PTConfig } from '@/lib/causacion/pt-adapters'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { proveedor_tecnologico, nit_empresa, ambiente, api_key, api_secret, config_extra } = body

        if (!api_key || !proveedor_tecnologico) {
            return NextResponse.json({ ok: false, message: 'Faltan credenciales para probar la conexión' })
        }

        const cfg: PTConfig = {
            proveedor_tecnologico,
            api_key,
            api_secret: api_secret || '',
            nit_empresa: nit_empresa || '',
            ambiente: ambiente === 'produccion' ? 'produccion' : 'prueba',
            config_extra: config_extra || {},
        }

        const result = await testConnection(cfg)
        return NextResponse.json(result)

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Error testing DIAN connection:', msg)
        return NextResponse.json({ ok: false, message: msg }, { status: 500 })
    }
}
