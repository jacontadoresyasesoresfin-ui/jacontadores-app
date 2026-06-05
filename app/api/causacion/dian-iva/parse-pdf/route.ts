import { NextRequest, NextResponse } from 'next/server'

export interface ItemFacturaPdf {
  numero: number
  descripcion: string
  cantidad: number
  valor_unitario: number
  descuento: number
  base: number
  porcentaje_iva: number
  valor_iva: number
  total: number
}

export interface ParsePdfResult {
  ok: boolean
  archivo: string
  cufe: string
  numero_factura: string
  fecha: string
  nit_emisor: string
  nombre_emisor: string
  nit_receptor: string
  nombre_receptor: string
  items: ItemFacturaPdf[]
  resumen: {
    base_19: number; iva_19: number
    base_5:  number; iva_5:  number
    base_cero: number
    total_base: number
    total_iva: number
    total: number
  }
  error?: string
  advertencias: string[]
}

/* ── Prompt Claude ─────────────────────────────────────────────────────────── */
function buildPrompt(text: string): string {
  return `Eres un experto en facturación electrónica colombiana (DIAN, Resolución 000042/2020, UBL 2.1).

Analiza el siguiente texto de una factura electrónica colombiana y extrae TODOS los ítems/líneas de detalle con su información de IVA INDIVIDUAL por ítem.

IMPORTANTE: En Colombia una misma factura puede tener ítems con diferentes tarifas de IVA:
- Medicamentos veterinarios / insumos agropecuarios: 5%
- Equipos, servicios generales, tecnología: 19%
- Servicios de salud, alimentos básicos, bienes excluidos: 0%

Responde ÚNICAMENTE con este JSON válido (sin texto antes ni después):
{
  "cufe": "",
  "numero_factura": "",
  "fecha": "YYYY-MM-DD",
  "nit_emisor": "",
  "nombre_emisor": "",
  "nit_receptor": "",
  "nombre_receptor": "",
  "items": [
    {
      "numero": 1,
      "descripcion": "Descripción exacta del ítem",
      "cantidad": 1,
      "valor_unitario": 0,
      "descuento": 0,
      "base": 0,
      "porcentaje_iva": 19,
      "valor_iva": 0,
      "total": 0
    }
  ],
  "total_base": 0,
  "total_iva": 0,
  "total_factura": 0
}

Reglas:
- Extrae TODOS los ítems que aparezcan, sin omitir ninguno
- base = valor sin IVA (después de descuentos) = cantidad × valor_unitario − descuento
- valor_iva = base × (porcentaje_iva / 100), redondea a entero
- total = base + valor_iva
- porcentaje_iva: usa exactamente el porcentaje que aparece en el documento (0, 5, 8, 19...)
- Si el documento no discrimina IVA por ítem sino solo al final, infiere la tarifa por tipo de producto
- CUFE: cadena hexadecimal de 96 caracteres si aparece en el texto

TEXTO DE LA FACTURA:
${text.slice(0, 9000)}`
}

/* ── Llamada Claude ────────────────────────────────────────────────────────── */
async function parsearConIA(text: string): Promise<{
  items: ItemFacturaPdf[]
  cufe: string; numero: string; fecha: string
  nit_emisor: string; nombre_emisor: string
  nit_receptor: string; nombre_receptor: string
  total_base: number; total_iva: number; total: number
} | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  let res: Response
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 25000)
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt(text) }],
      }),
    })
    clearTimeout(t)
  } catch {
    return null
  }

  if (!res.ok) return null
  const data = await res.json()
  const raw: string = data?.content?.[0]?.text ?? ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null

  try {
    const p = JSON.parse(m[0])
    const items: ItemFacturaPdf[] = (p.items ?? []).map((x: Record<string, unknown>, i: number) => {
      const base  = Math.round(Number(x.base)  || 0)
      const pct   = Number(x.porcentaje_iva) || 0
      const iva   = Math.round(Number(x.valor_iva) || base * pct / 100)
      const total = Math.round(Number(x.total) || base + iva)
      return {
        numero:          Number(x.numero)         || i + 1,
        descripcion:     String(x.descripcion     || '').trim(),
        cantidad:        Number(x.cantidad)        || 1,
        valor_unitario:  Math.round(Number(x.valor_unitario) || 0),
        descuento:       Math.round(Number(x.descuento)      || 0),
        base, porcentaje_iva: pct, valor_iva: iva, total,
      }
    })
    return {
      items,
      cufe:           String(p.cufe            || ''),
      numero:         String(p.numero_factura  || ''),
      fecha:          String(p.fecha           || ''),
      nit_emisor:     String(p.nit_emisor      || ''),
      nombre_emisor:  String(p.nombre_emisor   || ''),
      nit_receptor:   String(p.nit_receptor    || ''),
      nombre_receptor:String(p.nombre_receptor || ''),
      total_base:     Math.round(Number(p.total_base)    || 0),
      total_iva:      Math.round(Number(p.total_iva)     || 0),
      total:          Math.round(Number(p.total_factura) || 0),
    }
  } catch {
    return null
  }
}

/* ── Fallback: regex cuando no hay API key ─────────────────────────────────── */
function parsearConRegex(text: string): Partial<ItemFacturaPdf>[] {
  const items: Partial<ItemFacturaPdf>[] = []
  // Buscar patrones de líneas con IVA explícito
  const re19 = /IVA\s*19\s*%[:\s]*\$?\s*([\d.,]+)/gi
  const re5  = /IVA\s*5\s*%[:\s]*\$?\s*([\d.,]+)/gi
  let m: RegExpExecArray | null
  while ((m = re19.exec(text)) !== null) {
    const iva = parseFloat(m[1].replace(/\./g,'').replace(',','.')) || 0
    items.push({ descripcion: 'Ítem gravado 19% (extraído por regex)', base: Math.round(iva/0.19), porcentaje_iva: 19, valor_iva: Math.round(iva) })
  }
  while ((m = re5.exec(text)) !== null) {
    const iva = parseFloat(m[1].replace(/\./g,'').replace(',','.')) || 0
    items.push({ descripcion: 'Ítem gravado 5% (extraído por regex)', base: Math.round(iva/0.05), porcentaje_iva: 5, valor_iva: Math.round(iva) })
  }
  return items
}

/* ── Handler POST ──────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const files = form.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'No se recibieron archivos PDF' }, { status: 400 })
    }

    const results: ParsePdfResult[] = []

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        results.push({
          ok: false, archivo: file.name, cufe: '', numero_factura: '', fecha: '',
          nit_emisor: '', nombre_emisor: '', nit_receptor: '', nombre_receptor: '',
          items: [], resumen: { base_19:0, iva_19:0, base_5:0, iva_5:0, base_cero:0, total_base:0, total_iva:0, total:0 },
          error: 'Solo se aceptan archivos PDF', advertencias: [],
        })
        continue
      }

      const advertencias: string[] = []
      let text = ''

      try {
        const buf = Buffer.from(await file.arrayBuffer())
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse') as (b: Buffer, o?: object) => Promise<{ text: string; numpages: number }>
        const parsed = await pdfParse(buf, { max: 0 })
        text = parsed.text ?? ''
        if (parsed.numpages > 8) advertencias.push(`El PDF tiene ${parsed.numpages} páginas — se analizaron las primeras 9000 caracteres`)
      } catch {
        results.push({
          ok: false, archivo: file.name, cufe: '', numero_factura: '', fecha: '',
          nit_emisor: '', nombre_emisor: '', nit_receptor: '', nombre_receptor: '',
          items: [], resumen: { base_19:0, iva_19:0, base_5:0, iva_5:0, base_cero:0, total_base:0, total_iva:0, total:0 },
          error: 'No se pudo leer el PDF. Puede ser un PDF escaneado (imagen) — intenta usar el portal DIAN.', advertencias: [],
        })
        continue
      }

      if (text.trim().length < 80) {
        results.push({
          ok: false, archivo: file.name, cufe: '', numero_factura: '', fecha: '',
          nit_emisor: '', nombre_emisor: '', nit_receptor: '', nombre_receptor: '',
          items: [], resumen: { base_19:0, iva_19:0, base_5:0, iva_5:0, base_cero:0, total_base:0, total_iva:0, total:0 },
          error: 'El PDF no tiene texto seleccionable (probablemente es escaneado). Usa el portal DIAN para obtener los ítems.', advertencias: [],
        })
        continue
      }

      // Intentar IA primero, regex como fallback
      const aiResult = await parsearConIA(text)

      let items: ItemFacturaPdf[] = []
      let cufe = '', numero = '', fecha = '', nit_e = '', nom_e = '', nit_r = '', nom_r = ''
      let tb = 0, ti = 0, tt = 0

      if (aiResult && aiResult.items.length > 0) {
        items = aiResult.items
        cufe = aiResult.cufe; numero = aiResult.numero; fecha = aiResult.fecha
        nit_e = aiResult.nit_emisor; nom_e = aiResult.nombre_emisor
        nit_r = aiResult.nit_receptor; nom_r = aiResult.nombre_receptor
        tb = aiResult.total_base; ti = aiResult.total_iva; tt = aiResult.total
      } else {
        // Fallback regex
        const regexItems = parsearConRegex(text)
        if (regexItems.length) {
          advertencias.push('IA no disponible o sin resultados — se usó extracción por expresiones regulares (menos precisa)')
          items = regexItems.map((x, i) => ({
            numero: i + 1,
            descripcion:    x.descripcion    ?? '',
            cantidad:       x.cantidad       ?? 1,
            valor_unitario: x.valor_unitario ?? 0,
            descuento:      x.descuento      ?? 0,
            base:           x.base           ?? 0,
            porcentaje_iva: x.porcentaje_iva ?? 0,
            valor_iva:      x.valor_iva      ?? 0,
            total:          (x.base ?? 0) + (x.valor_iva ?? 0),
          }))
        } else {
          results.push({
            ok: false, archivo: file.name, cufe: '', numero_factura: '', fecha: '',
            nit_emisor: '', nombre_emisor: '', nit_receptor: '', nombre_receptor: '',
            items: [], resumen: { base_19:0, iva_19:0, base_5:0, iva_5:0, base_cero:0, total_base:0, total_iva:0, total:0 },
            error: 'No se encontraron ítems en el PDF. Verifica que sea una factura electrónica DIAN válida.', advertencias,
          })
          continue
        }
      }

      // Calcular resumen
      const resumen = { base_19:0, iva_19:0, base_5:0, iva_5:0, base_cero:0, total_base: tb, total_iva: ti, total: tt }
      for (const item of items) {
        if (item.porcentaje_iva >= 18 && item.porcentaje_iva <= 20) {
          resumen.base_19 += item.base; resumen.iva_19 += item.valor_iva
        } else if (item.porcentaje_iva >= 4 && item.porcentaje_iva <= 6.5) {
          resumen.base_5  += item.base; resumen.iva_5  += item.valor_iva
        } else {
          resumen.base_cero += item.base
        }
      }
      if (!resumen.total_base) resumen.total_base = resumen.base_19 + resumen.base_5 + resumen.base_cero
      if (!resumen.total_iva)  resumen.total_iva  = resumen.iva_19 + resumen.iva_5
      if (!resumen.total)      resumen.total      = resumen.total_base + resumen.total_iva

      results.push({
        ok: true, archivo: file.name,
        cufe: cufe, numero_factura: numero, fecha,
        nit_emisor: nit_e, nombre_emisor: nom_e,
        nit_receptor: nit_r, nombre_receptor: nom_r,
        items, resumen, advertencias,
      })
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[parse-pdf] Error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
