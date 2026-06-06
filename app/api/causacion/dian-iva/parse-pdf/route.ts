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
    total_base: number; total_iva: number; total: number
  }
  error?: string
  advertencias: string[]
  metodo: 'dian_formato' | 'ia' | 'regex'
}

/* ══════════════════════════════════════════════════════════════════════════
   PARSER 1: Formato DIAN estándar (sin IA)
   Reconoce la "Representación Gráfica" generada por la Solución Gratuita DIAN
   y proveedores tecnológicos colombianos (Siigo, Alegra, etc.)

   Estructura de la línea de datos de cada ítem:
   [UOM][qty_cop][precio_cop][dcto_cop][recargo_cop][iva_valor_cop][iva_pct].00  [precio_venta_cop]

   Ejemplo real:
   "WSD1,00231.428,570,000,0011.571,435.00  231.428,57"
    ^^^  ^^^^                  ^^^^^^^^^^^ ^^^          ^^^^^^^^^^
    UOM  qty                   iva_valor   iva_pct      precio_venta
══════════════════════════════════════════════════════════════════════════ */

function parseCOP(s: string): number {
  // Colombian format: 231.428,57  →  231428.57
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
}

function extractCufe(text: string, filename: string): string {
  // 1. Try from file name (DIAN often names the file with the CUFE)
  const fromFile = filename.match(/^([a-f0-9]{96})/i)?.[1]
  if (fromFile) return fromFile.toLowerCase()
  // 2. Try from text content
  const fromText = text.match(/([a-f0-9]{96})/i)?.[1]
  return fromText ? fromText.toLowerCase() : ''
}

function parsearFormatoDIAN(text: string, filename: string): ParsePdfResult | null {
  // Only proceed if it looks like a DIAN electronic invoice
  if (!text.includes('FACTURA ELECTR') && !text.includes('FACTURA ELECTRONICA')) return null
  if (!text.includes('Detalles de Productos')) return null

  const lines = text.split('\n').map(l => l.trim())

  /* ── Cabecera ── */
  const cufe           = extractCufe(text, filename)
  // Invoice number ends at first uppercase+lowercase boundary (e.g. "FEV-17380Forma" → "FEV-17380")
  const numeroFactura  = (text.match(/Número de Factura:\s*([A-Z]{1,6}[-–]?\d{1,12})/i)?.[1] ?? '').trim()
  const fechaRaw       = text.match(/Fecha de Emisión:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? ''
  const fecha          = fechaRaw.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')
  const nitEmisor      = text.match(/Nit del Emisor:\s*([\d]+)/i)?.[1] ?? ''
  const nombreEmisor   = text.match(/Razón Social:\s*([^\n]+)/i)?.[1]?.trim() ?? ''
  const nitReceptor    = text.match(/Número Documento:\s*([\d]+)/i)?.[1] ?? ''
  const nombreReceptor = text.match(/Nombre o Razón Social:\s*([^\n]+)/i)?.[1]?.trim() ?? ''

  /* ── Totales (sección "MONEDACOP") ── */
  const totalStr   = text.match(/Total factura[^C]*COP\s*\$([\d.]+,\d{2})/i)?.[1] ?? ''
  const subtotStr  = text.match(/^Subtotal([\d.]+,\d{2})$/m)?.[1] ?? ''
  const ivaTotStr  = text.match(/^IVA([\d.]+,\d{2})$/m)?.[1] ?? ''
  const totalDoc   = parseCOP(totalStr)
  const subtotDoc  = parseCOP(subtotStr)
  const ivaTotDoc  = parseCOP(ivaTotStr)

  /* ── Zona de productos ── */
  const startIdx = lines.findIndex(l => l === 'Detalles de Productos')
  const endIdx   = lines.findIndex((l, i) => i > startIdx && (l === 'Notas Finales' || l === 'Datos Totales' || l === '$$'))
  const productLines = lines.slice(startIdx + 1, endIdx > 0 ? endIdx : undefined)

  /* ── Regex para línea de datos ──────────────────────────────────────────
     Busca al final de la línea el patrón:
       [iva_valor_cop]  [iva_pct].00   [2+ espacios]  [precio_venta_cop]
     Ejemplo: ...11.571,43  5.00  231.428,57
     Regex:   ([\d.]+,\d{2})(\d{1,2})\.00\s{2,}([\d.]+,\d{2})$
  ────────────────────────────────────────────────────────────────────── */
  const DATA_LINE_RE = /([\d.]+,\d{2})(\d{1,2})\.00\s{2,}([\d.]+,\d{2})$/

  const items: ItemFacturaPdf[] = []
  let descBuf: string[] = []
  let itemNum = 0

  for (let i = 0; i < productLines.length; i++) {
    const line = productLines[i]
    if (!line) continue
    // Skip known header noise lines
    if (/^(IMPUESTOS|unitario de|venta|Nro\.|CódigoDescripción|IVA%|INC%)/.test(line)) continue

    const dataMatch = line.match(DATA_LINE_RE)
    if (dataMatch) {
      const [, ivaValStr, ivaPctStr, precioVentaStr] = dataMatch

      const ivaVal    = parseCOP(ivaValStr)
      const ivaPct    = parseInt(ivaPctStr)       // 5, 19, 0, 8, etc.
      const unitPrice = parseCOP(precioVentaStr)

      // Quantity: first Colombian number after any UOM prefix (uppercase letters)
      const qtyMatch = line.match(/^[A-Z]*([\d]+,\d{2})/)
      const qty       = qtyMatch ? parseCOP(qtyMatch[1]) : 1
      const base      = Math.round(qty * unitPrice)

      itemNum++
      items.push({
        numero:         itemNum,
        descripcion:    descBuf.join(' ').trim() || `Ítem ${itemNum}`,
        cantidad:       qty,
        valor_unitario: unitPrice,
        descuento:      0,
        base,
        porcentaje_iva: ivaPct,
        valor_iva:      Math.round(ivaVal),
        total:          base + Math.round(ivaVal),
      })
      descBuf = []
    } else if (/^\d{1,3}\d{4,}$/.test(line)) {
      // Row number + product code merged (e.g. "102311" = row 1, code 02311)
      descBuf = []
    } else if (line.length > 1 && !/^\$+$/.test(line)) {
      descBuf.push(line)
    }
  }

  if (items.length === 0) return null

  /* ── Resumen por tasa ── */
  const resumen = {
    base_19: 0, iva_19: 0,
    base_5:  0, iva_5:  0,
    base_cero: 0,
    total_base: subtotDoc || items.reduce((s, x) => s + x.base, 0),
    total_iva:  ivaTotDoc  || items.reduce((s, x) => s + x.valor_iva, 0),
    total:      totalDoc   || items.reduce((s, x) => s + x.total, 0),
  }
  for (const item of items) {
    if (item.porcentaje_iva >= 18 && item.porcentaje_iva <= 20)
      { resumen.base_19 += item.base; resumen.iva_19 += item.valor_iva }
    else if (item.porcentaje_iva >= 4 && item.porcentaje_iva <= 6.5)
      { resumen.base_5  += item.base; resumen.iva_5  += item.valor_iva }
    else
      { resumen.base_cero += item.base }
  }

  return {
    ok: true, archivo: '', cufe, numero_factura: numeroFactura, fecha,
    nit_emisor: nitEmisor, nombre_emisor: nombreEmisor,
    nit_receptor: nitReceptor, nombre_receptor: nombreReceptor,
    items, resumen, advertencias: [], metodo: 'dian_formato',
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   PARSER 2: Claude IA — para otros formatos de factura
══════════════════════════════════════════════════════════════════════════ */

function buildPrompt(text: string, filename: string): string {
  const cufeHint = filename.match(/^[a-f0-9]{96}/i)?.[0] ?? ''
  return `Eres un experto en facturación electrónica colombiana (DIAN, UBL 2.1).

Analiza el siguiente texto de una factura electrónica y extrae TODOS los ítems con su IVA INDIVIDUAL.
${cufeHint ? `El CUFE de esta factura es: ${cufeHint}` : ''}

En Colombia una misma factura puede tener ítems a diferentes tarifas:
- Medicamentos / insumos veterinarios / agropecuarios: 5%
- Equipos, servicios, tecnología, repuestos: 19%
- Servicios de salud, alimentos básicos excluidos: 0%

Formato del texto DIAN: la línea de datos de cada ítem termina con:
  [valor_iva][iva_pct].00  [precio_unitario]
  Ejemplo: "11.571,435.00  231.428,57" → IVA valor=11.571,43 | IVA%=5 | precio=231.428,57

Responde ÚNICAMENTE con JSON válido (sin texto antes ni después):
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
      "descripcion": "Nombre exacto del ítem",
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

TEXTO:
${text.slice(0, 9000)}`
}

async function parsearConIA(text: string, filename: string): Promise<Omit<ParsePdfResult, 'archivo' | 'advertencias'> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  let res: Response
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 25000)
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt(text, filename) }],
      }),
    })
    clearTimeout(t)
  } catch { return null }

  if (!res.ok) return null
  const data = await res.json()
  const raw: string = data?.content?.[0]?.text ?? ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null

  try {
    const p = JSON.parse(m[0])
    const cufe = extractCufe(raw + '\n' + p.cufe, filename)
    const items: ItemFacturaPdf[] = (p.items ?? []).map((x: Record<string, unknown>, i: number) => {
      const base  = Math.round(Number(x.base)  || 0)
      const pct   = Number(x.porcentaje_iva)   || 0
      const iva   = Math.round(Number(x.valor_iva) || base * pct / 100)
      const total = Math.round(Number(x.total) || base + iva)
      return {
        numero: Number(x.numero) || i + 1,
        descripcion: String(x.descripcion || '').trim(),
        cantidad: Number(x.cantidad) || 1,
        valor_unitario: Math.round(Number(x.valor_unitario) || 0),
        descuento: Math.round(Number(x.descuento) || 0),
        base, porcentaje_iva: pct, valor_iva: iva, total,
      }
    })
    const resumen = { base_19:0, iva_19:0, base_5:0, iva_5:0, base_cero:0,
      total_base: Math.round(Number(p.total_base)||0),
      total_iva:  Math.round(Number(p.total_iva)||0),
      total:      Math.round(Number(p.total_factura)||0),
    }
    for (const item of items) {
      if (item.porcentaje_iva >= 18 && item.porcentaje_iva <= 20)
        { resumen.base_19 += item.base; resumen.iva_19 += item.valor_iva }
      else if (item.porcentaje_iva >= 4 && item.porcentaje_iva <= 6.5)
        { resumen.base_5 += item.base; resumen.iva_5 += item.valor_iva }
      else resumen.base_cero += item.base
    }
    return {
      ok: true, cufe, metodo: 'ia',
      numero_factura: String(p.numero_factura || ''),
      fecha: String(p.fecha || ''),
      nit_emisor: String(p.nit_emisor || ''),
      nombre_emisor: String(p.nombre_emisor || ''),
      nit_receptor: String(p.nit_receptor || ''),
      nombre_receptor: String(p.nombre_receptor || ''),
      items, resumen,
    }
  } catch { return null }
}

/* ══════════════════════════════════════════════════════════════════════════
   PARSER 3: Regex fallback (totales + búsqueda de tasas en texto)
══════════════════════════════════════════════════════════════════════════ */
function parsearConRegex(text: string, filename: string): ParsePdfResult | null {
  const subtotStr = text.match(/^Subtotal([\d.]+,\d{2})$/m)?.[1] ?? ''
  const ivaTotStr = text.match(/^IVA([\d.]+,\d{2})$/m)?.[1] ?? ''
  const totalStr  = text.match(/Total factura[^C]*COP\s*\$([\d.]+,\d{2})/i)?.[1] ?? ''

  if (!ivaTotStr) return null

  const subtot   = parseCOP(subtotStr)
  const ivaTot   = parseCOP(ivaTotStr)
  const total    = parseCOP(totalStr)

  // Infer rate from math
  const inferredPct = subtot > 0 ? Math.round((ivaTot / subtot) * 100) : 0
  const pct = (inferredPct === 5 || inferredPct === 19) ? inferredPct : 0

  // Also scan for explicit IVA% patterns in product section
  const has19 = /\b19\.00\b/.test(text)
  const has5  = /\b5\.00\b/.test(text)
  const effectivePct = has19 && !has5 ? 19 : has5 && !has19 ? 5 : pct

  if (!subtot && !ivaTot) return null

  const items: ItemFacturaPdf[] = [{
    numero: 1,
    descripcion: `Ítem(s) factura — ${effectivePct}% IVA`,
    cantidad: 1,
    valor_unitario: subtot,
    descuento: 0,
    base: subtot,
    porcentaje_iva: effectivePct,
    valor_iva: Math.round(ivaTot),
    total: total || subtot + Math.round(ivaTot),
  }]

  const resumen = {
    base_19: effectivePct === 19 ? subtot : 0,
    iva_19:  effectivePct === 19 ? Math.round(ivaTot) : 0,
    base_5:  effectivePct === 5  ? subtot : 0,
    iva_5:   effectivePct === 5  ? Math.round(ivaTot) : 0,
    base_cero: effectivePct === 0 ? subtot : 0,
    total_base: subtot, total_iva: Math.round(ivaTot), total: total || subtot + Math.round(ivaTot),
  }

  return {
    ok: true, archivo: '',
    cufe: extractCufe(text, filename),
    numero_factura: text.match(/Número de Factura:\s*([A-Z0-9-]+)/i)?.[1]?.trim() ?? '',
    fecha: (text.match(/Fecha de Emisión:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? '').replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'),
    nit_emisor:     text.match(/Nit del Emisor:\s*([\d]+)/i)?.[1] ?? '',
    nombre_emisor:  text.match(/Razón Social:\s*([^\n]+)/i)?.[1]?.trim() ?? '',
    nit_receptor:   text.match(/Número Documento:\s*([\d]+)/i)?.[1] ?? '',
    nombre_receptor:text.match(/Nombre o Razón Social:\s*([^\n]+)/i)?.[1]?.trim() ?? '',
    items, resumen,
    advertencias: ['Extracción por regex de totales — revise el desglose por ítem manualmente'],
    metodo: 'regex',
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Handler POST
══════════════════════════════════════════════════════════════════════════ */
export const maxDuration = 60 // seconds

export async function POST(req: NextRequest) {
  // ?batch=1 → skip IA (solo parser nativo + regex) para procesar lotes rápido
  const batch = req.nextUrl.searchParams.get('batch') === '1'

  try {
    const form  = await req.formData()
    const files = form.getAll('files') as File[]
    if (!files.length) return NextResponse.json({ error: 'No se recibieron archivos PDF' }, { status: 400 })
    if (files.length > 25) return NextResponse.json({ error: 'Máximo 25 archivos por llamada (usa lotes)' }, { status: 400 })

    const results: ParsePdfResult[] = []

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        results.push({ ok:false, archivo:file.name, cufe:'', numero_factura:'', fecha:'', nit_emisor:'', nombre_emisor:'', nit_receptor:'', nombre_receptor:'', items:[], resumen:{base_19:0,iva_19:0,base_5:0,iva_5:0,base_cero:0,total_base:0,total_iva:0,total:0}, error:'Solo se aceptan PDFs', advertencias:[], metodo:'regex' })
        continue
      }

      let text = ''
      let pages = 0
      try {
        const buf = Buffer.from(await file.arrayBuffer())
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse') as (b: Buffer, o?: object) => Promise<{ text: string; numpages: number }>
        const parsed = await pdfParse(buf, { max: 0 })
        text = parsed.text ?? ''
        pages = parsed.numpages
      } catch {
        results.push({ ok:false, archivo:file.name, cufe:'', numero_factura:'', fecha:'', nit_emisor:'', nombre_emisor:'', nit_receptor:'', nombre_receptor:'', items:[], resumen:{base_19:0,iva_19:0,base_5:0,iva_5:0,base_cero:0,total_base:0,total_iva:0,total:0}, error:'No se pudo leer el PDF (puede ser imagen escaneada)', advertencias:[], metodo:'regex' })
        continue
      }

      if (text.trim().length < 80) {
        results.push({ ok:false, archivo:file.name, cufe:'', numero_factura:'', fecha:'', nit_emisor:'', nombre_emisor:'', nit_receptor:'', nombre_receptor:'', items:[], resumen:{base_19:0,iva_19:0,base_5:0,iva_5:0,base_cero:0,total_base:0,total_iva:0,total:0}, error:'PDF sin texto (escaneado). Use el portal DIAN para obtener el detalle de ítems.', advertencias:[], metodo:'regex' })
        continue
      }

      const advertencias: string[] = []
      if (pages > 8) advertencias.push(`PDF de ${pages} páginas — se analizaron las primeras 9000 caracteres`)

      // Cascada: DIAN nativo → IA (solo si no es batch) → regex
      let result: ParsePdfResult | null = parsearFormatoDIAN(text, file.name)

      if (!result && !batch) {
        const iaResult = await parsearConIA(text, file.name)
        if (iaResult) result = { ...iaResult, archivo: file.name, advertencias }
      }

      if (!result) result = parsearConRegex(text, file.name)

      if (!result) {
        results.push({ ok:false, archivo:file.name, cufe:'', numero_factura:'', fecha:'', nit_emisor:'', nombre_emisor:'', nit_receptor:'', nombre_receptor:'', items:[], resumen:{base_19:0,iva_19:0,base_5:0,iva_5:0,base_cero:0,total_base:0,total_iva:0,total:0}, error:'No se encontraron ítems en el PDF. Verifica que sea una factura electrónica DIAN.', advertencias, metodo:'regex' })
        continue
      }

      result.archivo = file.name
      if (advertencias.length) result.advertencias.push(...advertencias)
      results.push(result)
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[parse-pdf]', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
