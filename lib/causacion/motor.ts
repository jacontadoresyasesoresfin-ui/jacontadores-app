/**
 * Motor de Causación Inteligente.
 * Aplica reglas configuradas por el usuario y, si no hay coincidencia,
 * consulta Claude (IA) para sugerir la cuenta PUC y el concepto de retefuente.
 */

import { FacturaUBL, ItemFactura } from './xml-parser'

export interface ReglaKeyword {
    keywords: string[]      // Palabras clave en descripción del ítem
    cuenta_puc: string
    descripcion_cuenta: string
    concepto_retefuente?: string
}

export interface ReglaNIT {
    nit: string
    cuenta_puc: string
    descripcion_cuenta: string
    concepto_retefuente?: string
    nombre_proveedor?: string
}

export interface ReglaTipoDoc {
    tipo: string            // '01', '91', etc.
    cuenta_puc: string
    descripcion_cuenta: string
}

export interface ReglasConfig {
    keywords: ReglaKeyword[]
    nit_proveedor: ReglaNIT[]
    tipo_documento: ReglaTipoDoc[]
    defaults: {
        cuenta_gasto: string
        cuenta_proveedor: string
        concepto_retefuente: string
        tasa_reteiva: number
        tasa_reteica: number
    }
    usar_ia: boolean
}

export interface LineaAsiento {
    cuenta: string
    descripcion: string
    debito: number
    credito: number
    nit_tercero?: string
}

export interface AsientoContable {
    fecha: string
    documento: string
    proveedor: string
    nit_proveedor: string
    detalles: LineaAsiento[]
    balanceado: boolean
    total_debito: number
    total_credito: number
    metodo_causacion: 'regla_nit' | 'regla_keyword' | 'regla_tipo' | 'ia' | 'default'
    ia_sugerencia?: string
}

export const REGLAS_DEFAULT: ReglasConfig = {
    keywords: [
        { keywords: ['internet', 'fibra', 'banda ancha', 'hosting', 'nube', 'cloud', 'vpn'], cuenta_puc: '530515', descripcion_cuenta: 'Telecomunicaciones', concepto_retefuente: 'servicios' },
        { keywords: ['mantenimiento', 'reparación', 'técnico', 'soporte', 'servicio técnico'], cuenta_puc: '519616', descripcion_cuenta: 'Mantenimiento y reparaciones', concepto_retefuente: 'mantenimiento' },
        { keywords: ['arrendamiento', 'arriendo', 'alquiler', 'renta', 'canon'], cuenta_puc: '519520', descripcion_cuenta: 'Arrendamientos', concepto_retefuente: 'arrendamiento_inmueble' },
        { keywords: ['honorario', 'consultoría', 'asesoría', 'profesional'], cuenta_puc: '512015', descripcion_cuenta: 'Honorarios', concepto_retefuente: 'honorarios_pj' },
        { keywords: ['publicidad', 'propaganda', 'marketing', 'pauta', 'diseño', 'impresión'], cuenta_puc: '513035', descripcion_cuenta: 'Publicidad', concepto_retefuente: 'publicidad' },
        { keywords: ['transporte', 'flete', 'envío', 'mensajería', 'courier', 'logística'], cuenta_puc: '519560', descripcion_cuenta: 'Transporte', concepto_retefuente: 'transporte_carga' },
        { keywords: ['papelería', 'útiles', 'suministros', 'insumos', 'papeleria'], cuenta_puc: '519525', descripcion_cuenta: 'Útiles y papelería', concepto_retefuente: 'compras' },
        { keywords: ['mercancía', 'mercancia', 'producto', 'materia prima', 'inventario', 'compra'], cuenta_puc: '143001', descripcion_cuenta: 'Mercancías', concepto_retefuente: 'compras' },
        { keywords: ['salud', 'medicina', 'médico', 'eps', 'clínica', 'hospital'], cuenta_puc: '519535', descripcion_cuenta: 'Gastos médicos', concepto_retefuente: 'servicios' },
        { keywords: ['seguro', 'póliza', 'prima'], cuenta_puc: '519545', descripcion_cuenta: 'Seguros', concepto_retefuente: 'sin_retencion' },
        { keywords: ['comisión', 'comision'], cuenta_puc: '512025', descripcion_cuenta: 'Comisiones', concepto_retefuente: 'comisiones' },
    ],
    nit_proveedor: [],
    tipo_documento: [
        { tipo: '91', cuenta_puc: '143001', descripcion_cuenta: 'Nota crédito — ajuste inventario' },
        { tipo: '92', cuenta_puc: '143001', descripcion_cuenta: 'Nota débito — ajuste inventario' },
    ],
    defaults: {
        cuenta_gasto: '519595',
        cuenta_proveedor: '220501',
        concepto_retefuente: 'servicios',
        tasa_reteiva: 15,
        tasa_reteica: 0,
    },
    usar_ia: true,
}

const UVT_2025 = 49799

const CONCEPTOS_RETE: Record<string, { tasa: number; baseUVT: number; cuenta: string }> = {
    compras: { tasa: 2.5, baseUVT: 27, cuenta: '236540' },
    honorarios_pn: { tasa: 10, baseUVT: 0, cuenta: '236506' },
    honorarios_pj: { tasa: 11, baseUVT: 0, cuenta: '236506' },
    servicios: { tasa: 4, baseUVT: 4, cuenta: '236515' },
    arrendamiento_mueble: { tasa: 4, baseUVT: 0, cuenta: '236518' },
    arrendamiento_inmueble: { tasa: 3.5, baseUVT: 0, cuenta: '236518' },
    comisiones: { tasa: 11, baseUVT: 0, cuenta: '236515' },
    transporte_carga: { tasa: 1, baseUVT: 27, cuenta: '236515' },
    transporte_pasajeros: { tasa: 3.5, baseUVT: 27, cuenta: '236515' },
    mantenimiento: { tasa: 4, baseUVT: 4, cuenta: '236515' },
    publicidad: { tasa: 3.5, baseUVT: 4, cuenta: '236515' },
    sin_retencion: { tasa: 0, baseUVT: 0, cuenta: '' },
}

// ── Funciones de matching ─────────────────────────────────────

function matchKeyword(desc: string, reglas: ReglaKeyword[]): ReglaKeyword | null {
    const lower = desc.toLowerCase()
    for (const r of reglas) {
        if (r.keywords.some(k => lower.includes(k.toLowerCase()))) return r
    }
    return null
}

function matchNIT(nit: string, reglas: ReglaNIT[]): ReglaNIT | null {
    return reglas.find(r => r.nit === nit) || null
}

// ── Sugerencia IA ─────────────────────────────────────────────

async function sugerirCuentaIA(
    proveedor_nombre: string, nit: string, item: ItemFactura | null, descripcion_general: string
): Promise<{ cuenta_puc: string; descripcion_cuenta: string; concepto_retefuente: string; razon: string } | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return null

    const prompt = `Eres un contador colombiano experto en el Plan Único de Cuentas (PUC) y retención en la fuente 2025.

Datos de la factura:
- Proveedor: ${proveedor_nombre}
- NIT: ${nit}
- Descripción del ítem/servicio: ${item?.descripcion || descripcion_general}
- Valor: ${item?.subtotal || '(no disponible)'}

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "cuenta_puc": "XXXXXX",
  "descripcion_cuenta": "nombre descriptivo de la cuenta PUC",
  "concepto_retefuente": "uno de: compras|honorarios_pn|honorarios_pj|servicios|arrendamiento_mueble|arrendamiento_inmueble|comisiones|transporte_carga|mantenimiento|publicidad|sin_retencion",
  "razon": "breve explicación de 1 línea"
}`

    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 256,
                messages: [{ role: 'user', content: prompt }],
            }),
        })
        if (!res.ok) return null
        const data = await res.json()
        const text: string = data?.content?.[0]?.text || ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return null
        return JSON.parse(jsonMatch[0])
    } catch {
        return null
    }
}

// ── Generación del asiento contable ──────────────────────────

export async function generarAsientoUBL(
    factura: FacturaUBL,
    reglas: ReglasConfig
): Promise<AsientoContable> {
    const cfg = reglas.defaults
    let metodo: AsientoContable['metodo_causacion'] = 'default'
    let ia_sugerencia: string | undefined
    let cuenta_gasto = cfg.cuenta_gasto
    let descripcion_gasto = 'Gasto general'
    let concepto_rete = cfg.concepto_retefuente

    // Prioridad 1: regla por NIT del proveedor
    const regla_nit = matchNIT(factura.proveedor_nit, reglas.nit_proveedor)
    if (regla_nit) {
        cuenta_gasto = regla_nit.cuenta_puc
        descripcion_gasto = regla_nit.descripcion_cuenta
        if (regla_nit.concepto_retefuente) concepto_rete = regla_nit.concepto_retefuente
        metodo = 'regla_nit'
    }

    // Prioridad 2: primer ítem de la factura contra keywords
    if (metodo === 'default' && factura.items.length > 0) {
        const primerItem = factura.items[0]
        const regla_kw = matchKeyword(primerItem.descripcion, reglas.keywords)
        if (regla_kw) {
            cuenta_gasto = regla_kw.cuenta_puc
            descripcion_gasto = regla_kw.descripcion_cuenta
            if (regla_kw.concepto_retefuente) concepto_rete = regla_kw.concepto_retefuente
            metodo = 'regla_keyword'
        } else if (reglas.usar_ia) {
            // Prioridad 3: consultar IA
            const ia = await sugerirCuentaIA(factura.proveedor_nombre, factura.proveedor_nit, primerItem, primerItem.descripcion)
            if (ia) {
                cuenta_gasto = ia.cuenta_puc
                descripcion_gasto = ia.descripcion_cuenta
                if (ia.concepto_retefuente) concepto_rete = ia.concepto_retefuente
                ia_sugerencia = ia.razon
                metodo = 'ia'
            }
        }
    }

    // Prioridad 4: tipo de documento
    if (metodo === 'default') {
        const regla_tipo = reglas.tipo_documento.find(r => r.tipo === factura.tipo_documento)
        if (regla_tipo) {
            cuenta_gasto = regla_tipo.cuenta_puc
            descripcion_gasto = regla_tipo.descripcion_cuenta
            metodo = 'regla_tipo'
        }
    }

    const rete_cfg = CONCEPTOS_RETE[concepto_rete] || CONCEPTOS_RETE.sin_retencion
    const base_minima = rete_cfg.baseUVT * UVT_2025
    const aplica_rete = rete_cfg.tasa > 0 && factura.subtotal >= base_minima
    const valor_retefuente = aplica_rete ? Math.round(factura.subtotal * rete_cfg.tasa / 100) : 0

    const tasa_reteiva = cfg.tasa_reteiva
    const valor_reteiva = factura.iva_total > 0 ? Math.round(factura.iva_total * tasa_reteiva / 100) : 0

    const tasa_reteica = cfg.tasa_reteica
    const valor_reteica = Math.round(factura.subtotal * tasa_reteica / 100)

    const neto_pagar = factura.subtotal + factura.iva_total - valor_retefuente - valor_reteiva - valor_reteica

    const detalles: LineaAsiento[] = []

    // Débitos
    detalles.push({
        cuenta: cuenta_gasto,
        descripcion: `${descripcion_gasto} — ${factura.proveedor_nombre}`,
        debito: factura.subtotal,
        credito: 0,
        nit_tercero: factura.proveedor_nit,
    })
    if (factura.iva_total > 0) {
        detalles.push({
            cuenta: '240810',
            descripcion: `IVA Descontable ${factura.items[0]?.porcentaje_iva || 19}% — ${factura.proveedor_nombre}`,
            debito: factura.iva_total,
            credito: 0,
        })
    }

    // Créditos
    detalles.push({
        cuenta: `${cfg.cuenta_proveedor}${factura.proveedor_nit.slice(-4).padStart(4, '0')}`,
        descripcion: `Proveedores — ${factura.proveedor_nombre}`,
        debito: 0,
        credito: factura.subtotal + factura.iva_total,
        nit_tercero: factura.proveedor_nit,
    })
    if (valor_retefuente > 0 && rete_cfg.cuenta) {
        detalles.push({
            cuenta: rete_cfg.cuenta,
            descripcion: `Retefuente ${rete_cfg.tasa}% — ${factura.proveedor_nombre}`,
            debito: 0,
            credito: valor_retefuente,
            nit_tercero: factura.proveedor_nit,
        })
    }
    if (valor_reteiva > 0) {
        detalles.push({
            cuenta: '236701',
            descripcion: `Reteiva ${tasa_reteiva}% — ${factura.proveedor_nombre}`,
            debito: 0,
            credito: valor_reteiva,
        })
    }
    if (valor_reteica > 0) {
        detalles.push({
            cuenta: '236801',
            descripcion: `Reteica ${tasa_reteica}% — ${factura.proveedor_nombre}`,
            debito: 0,
            credito: valor_reteica,
        })
    }

    const total_debito = detalles.reduce((a, l) => a + l.debito, 0)
    const total_credito = detalles.reduce((a, l) => a + l.credito, 0)
    const balanceado = Math.abs(total_debito - total_credito) < 1

    // Si no balanceó (ej. descuentos, otros impuestos), ajustar crédito de proveedores al valor neto
    if (!balanceado) {
        const provIdx = detalles.findIndex(l => l.cuenta.startsWith(cfg.cuenta_proveedor))
        if (provIdx >= 0) detalles[provIdx].credito = total_debito - (total_credito - detalles[provIdx].credito)
    }

    const total_d2 = detalles.reduce((a, l) => a + l.debito, 0)
    const total_c2 = detalles.reduce((a, l) => a + l.credito, 0)

    return {
        fecha: factura.fecha_emision,
        documento: factura.numero_factura,
        proveedor: factura.proveedor_nombre,
        nit_proveedor: factura.proveedor_nit,
        detalles,
        balanceado: Math.abs(total_d2 - total_c2) < 1,
        total_debito: total_d2,
        total_credito: total_c2,
        metodo_causacion: metodo,
        ia_sugerencia,
    }
}

export function exportAsientoContableCSV(asientos: AsientoContable[]): string {
    const rows: string[][] = [
        ['Fecha', 'Documento', 'Proveedor', 'NIT', 'Cuenta PUC', 'Descripción', 'Débito', 'Crédito', 'Método'],
    ]
    for (const a of asientos) {
        for (const l of a.detalles) {
            rows.push([
                a.fecha, a.documento, a.proveedor, a.nit_proveedor,
                l.cuenta, l.descripcion, String(l.debito), String(l.credito), a.metodo_causacion,
            ])
        }
    }
    return rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
}

