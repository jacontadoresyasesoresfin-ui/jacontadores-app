import { NextRequest, NextResponse } from 'next/server'
import { parseDianXlsx, DianFactura, ClasificacionIVA, FuenteClasificacion } from '@/lib/causacion/dian-iva-parser'

// ── Reglas heurísticas para IVA = 0 ─────────────────────────────────────────
const REGLAS_CERO: { keywords: string[]; claz: ClasificacionIVA; razon: string }[] = [
  { keywords: ['CLINICA', 'HOSPITAL', 'IPS ', 'CENTRO MEDIC', 'REHABILIT', 'TERAPIA', 'ODONTOLOG', 'OPTOMETR', 'LABORATORIO CLINICO'], claz: 'EXCLUIDA', razon: 'Servicio de salud (Art. 476 E.T.)' },
  { keywords: ['BANCO ', 'BANCOLOMBIA', 'DAVIVIENDA', 'BBVA', 'BOGOTA', 'COLPATRIA', 'FINANCIER', 'FIDUCIARIA', 'LEASING', 'SEGUROS', 'ASEGURADOR', 'MAPFRE', 'SURA SEGUROS'], claz: 'EXCLUIDA', razon: 'Servicio financiero/seguros (Art. 476 E.T.)' },
  { keywords: ['COLEGIO', 'UNIVERSIDAD', 'EDUCACION', 'ACADEMIA ', 'INSTITUTO', 'ESCUELA', 'JARDIN INFANTIL', 'PREESCOLAR'], claz: 'EXCLUIDA', razon: 'Servicio educativo (Art. 476 E.T.)' },
  { keywords: ['AVICOLA', 'GANADERO', 'PORCICOLA', 'PISCICOLA', 'GRANJA', 'ACUICOLA'], claz: 'EXENTA', razon: 'Producción pecuaria primaria (Art. 477 E.T.)' },
  { keywords: ['MEDICAMENTO', 'FARMACIA', 'DROGUERIA', 'LABORATORIO FARMAC'], claz: 'EXENTA', razon: 'Medicamentos y productos farmacéuticos (Art. 477 E.T.)' },
  { keywords: ['TRANSPORTE DE PASAJEROS', 'TAXI', 'SERVICIO PUBLICO COLECTIVO'], claz: 'EXCLUIDA', razon: 'Transporte de pasajeros (Art. 476 E.T.)' },
]

function reglaClasificar(nombre: string): { claz: ClasificacionIVA; fuente: FuenteClasificacion; nota: string } {
  const up = nombre.toUpperCase()
  for (const r of REGLAS_CERO) {
    if (r.keywords.some(k => up.includes(k))) {
      return { claz: r.claz, fuente: 'regla', nota: r.razon }
    }
  }
  return { claz: 'EXCLUIDA', fuente: 'matematico', nota: 'IVA = $0 — clasificado como excluida por defecto' }
}

async function enriquecerConIA(facturas: DianFactura[]): Promise<DianFactura[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  // Only process math-classified zero-IVA rows (not already pre-calculated)
  const pendientes = facturas.filter(
    f => f.iva_total === 0 && f.fuente_clasificacion === 'matematico'
  )
  if (pendientes.length === 0) return facturas

  // Unique suppliers to avoid redundant queries
  const proveedoresUnicos = [...new Set(
    pendientes.map(f => f.grupo === 'Recibido' ? f.nombre_emisor : f.nombre_receptor)
  )]

  const mapaClaz = new Map<string, { claz: ClasificacionIVA; fuente: FuenteClasificacion; nota: string }>()

  // Rule-based first pass
  for (const prov of proveedoresUnicos) {
    mapaClaz.set(prov, reglaClasificar(prov))
  }

  // AI second pass if key available
  if (apiKey && proveedoresUnicos.length > 0) {
    const lista = proveedoresUnicos.map((p, i) => `${i + 1}. ${p}`).join('\n')
    const prompt = `Eres un contador colombiano experto en IVA (Estatuto Tributario art. 420-481).

Clasifica cada proveedor/tercero según por qué sus facturas tienen IVA = $0:
- EXCLUIDA: operación no sujeta a IVA por ley (salud, educación, financieros, transporte pasajeros, arrendamiento vivienda)
- EXENTA: bien gravado a tarifa 0% (canasta básica, insumos agropecuarios, medicamentos, libros)
- REGIMEN_SIMPLE: contribuyente de régimen simplificado o SIMPLE sin obligación de cobrar IVA

Proveedores:
${lista}

Responde SOLO JSON válido, sin texto adicional:
[{"nombre":"...","clasificacion":"EXCLUIDA|EXENTA|REGIMEN_SIMPLE","razon":"..."}]`

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
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text: string = data?.content?.[0]?.text ?? ''
        const m = text.match(/\[[\s\S]*\]/)
        if (m) {
          const results = JSON.parse(m[0]) as Array<{ nombre: string; clasificacion: string; razon: string }>
          for (const r of results) {
            const claz: ClasificacionIVA = r.clasificacion === 'EXENTA' ? 'EXENTA' : 'EXCLUIDA'
            mapaClaz.set(r.nombre, { claz, fuente: 'ia', nota: r.razon })
          }
        }
      }
    } catch { /* keep rule-based */ }
  }

  // Apply to facturas
  return facturas.map(f => {
    if (f.iva_total !== 0 || f.fuente_clasificacion !== 'matematico') return f
    const proveedor = f.grupo === 'Recibido' ? f.nombre_emisor : f.nombre_receptor
    const c = mapaClaz.get(proveedor) ?? reglaClasificar(proveedor)
    const base = f.base_exenta || f.total
    return {
      ...f,
      clasificacion: c.claz,
      base_exenta:   c.claz === 'EXENTA'    ? base : 0,
      base_excluida: c.claz === 'EXCLUIDA'  ? base : 0,
      fuente_clasificacion: c.fuente,
      nota_ia: c.nota,
    }
  })
}

// ── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const files = form.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: 'Sube al menos un archivo DIAN (.xlsx)' }, { status: 400 })
    }
    if (files.length > 2) {
      return NextResponse.json({ error: 'Máximo 2 archivos (uno por año)' }, { status: 400 })
    }

    const seen = new Map<string, DianFactura>()

    for (const file of files) {
      const buf = await file.arrayBuffer()
      const facturas = parseDianXlsx(buf)
      for (const f of facturas) {
        const existing = seen.get(f.cufe)
        if (!existing || f.fuente_clasificacion === 'preexistente') {
          seen.set(f.cufe, f)
        }
      }
    }

    let facturas = [...seen.values()]

    // Enriquecer IVA = 0 con reglas + IA
    facturas = await enriquecerConIA(facturas)

    // Sort: year desc → date desc
    facturas.sort((a, b) => {
      if (b.año !== a.año) return b.año - a.año
      return b.fecha_emision.localeCompare(a.fecha_emision)
    })

    const resumen = {
      total: facturas.length,
      años: [...new Set(facturas.map(f => f.año))].sort(),
      gravadas_19: facturas.filter(f => f.clasificacion === 'GRAVADA_19').length,
      gravadas_5:  facturas.filter(f => f.clasificacion === 'GRAVADA_5').length,
      exentas:     facturas.filter(f => f.clasificacion === 'EXENTA').length,
      excluidas:   facturas.filter(f => f.clasificacion === 'EXCLUIDA').length,
      mixtas:      facturas.filter(f => f.clasificacion === 'MIXTA').length,
      base_total_19: facturas.reduce((s, f) => s + f.base_gravada_19, 0),
      iva_total_19:  facturas.reduce((s, f) => s + f.iva_19, 0),
      base_total_5:  facturas.reduce((s, f) => s + f.base_gravada_5, 0),
      iva_total_5:   facturas.reduce((s, f) => s + f.iva_5, 0),
      base_exenta_total:   facturas.reduce((s, f) => s + f.base_exenta, 0),
      base_excluida_total: facturas.reduce((s, f) => s + f.base_excluida, 0),
    }

    return NextResponse.json({ facturas, resumen })
  } catch (err) {
    console.error('[dian-iva] Error:', err)
    return NextResponse.json({ error: 'Error procesando los archivos DIAN' }, { status: 500 })
  }
}
