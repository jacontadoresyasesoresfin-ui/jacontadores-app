import { NextRequest, NextResponse } from 'next/server'

const CUFE_REGEX = /^[a-f0-9]{96}$/i

export async function POST(request: NextRequest) {
    const { cufe } = await request.json()
    if (!cufe || typeof cufe !== 'string') {
        return NextResponse.json({ error: 'CUFE requerido' }, { status: 400 })
    }

    const trimmed = cufe.trim()
    const valid_format = CUFE_REGEX.test(trimmed)

    if (!valid_format) {
        return NextResponse.json({
            cufe: trimmed,
            valid_format: false,
            message: 'El CUFE debe tener exactamente 96 caracteres hexadecimales en minúscula (generados por DIAN).',
            portal_url: null,
        })
    }

    // URL oficial de verificación DIAN para factura electrónica
    const portal_url = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${trimmed}`
    // URL alternativa habilitación (para facturas en ambiente de pruebas)
    const portal_url_hab = `https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=${trimmed}`

    return NextResponse.json({
        cufe: trimmed,
        valid_format: true,
        message: 'Formato CUFE válido. Verifique en el portal DIAN haciendo clic en el enlace.',
        portal_url,
        portal_url_hab,
        instructions: 'Abra el enlace del portal DIAN. Si la factura está en producción use el primero; si es de pruebas use el de habilitación.',
    })
}
