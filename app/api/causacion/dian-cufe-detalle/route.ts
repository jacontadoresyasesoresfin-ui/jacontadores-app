import { NextRequest, NextResponse } from 'next/server'

export interface ItemDian {
  numero: number
  descripcion: string
  cantidad: number
  base: number
  porcentaje_iva: number
  valor_iva: number
  total: number
}

export interface DetalleDian {
  ok: boolean
  items: ItemDian[]
  resumen: {
    base_19: number; iva_19: number
    base_5: number;  iva_5: number
    base_cero: number
  }
  portal_url: string
  error?: string
}

/* ── Helpers de texto ─────────────────────────────────────────────────────── */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseMoney(s: string): number {
  const clean = s.replace(/[^\d.,]/g, '')
  if (!clean) return 0
  // Colombian format: 1.234.567,89  OR  US format: 1,234,567.89
  if (/,\d{2}$/.test(clean)) {
    // Comma is decimal separator
    return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
  }
  // Comma is thousands separator
  return parseFloat(clean.replace(/,/g, '')) || 0
}

/* ── Parser de tabla HTML ─────────────────────────────────────────────────── */
function extractRowCells(rowHtml: string): string[] {
  const cells: string[] = []
  const re = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(rowHtml)) !== null) cells.push(stripTags(m[1]))
  return cells
}

function findIvaColumn(headers: string[]): number {
  const h = headers.map(x => x.toUpperCase())
  // Priority: cell that is exactly "%" or "% IVA" or contains "PORCENTAJE" + "IVA"
  for (let i = 0; i < h.length; i++) {
    if (/^%\s*(IVA|IMP|TRIBUTO)?$/.test(h[i])) return i
    if (h[i].includes('PORCENTAJE') && (h[i].includes('IVA') || h[i].includes('IMPUESTO'))) return i
    if (h[i] === 'IVA' || h[i] === 'IMP.') return i
  }
  // Fallback: first column with only a "%" sign or short label
  for (let i = 0; i < h.length; i++) {
    if (h[i].length <= 5 && (h[i].includes('%') || h[i] === 'IVA')) return i
  }
  return -1
}

function findBaseColumn(headers: string[]): number {
  const h = headers.map(x => x.toUpperCase())
  for (let i = 0; i < h.length; i++) {
    if (h[i].includes('V. BRUTO') || h[i].includes('VALOR BRUTO')) return i
    if (h[i].includes('SUBTOTAL') && !h[i].includes('IVA')) return i
    if (h[i].includes('BASE') && !h[i].includes('IVA')) return i
    if ((h[i].includes('VALOR TOTAL') || h[i] === 'V. TOTAL') && !h[i].includes('IVA')) return i
  }
  return -1
}

function findIvaValColumn(headers: string[]): number {
  const h = headers.map(x => x.toUpperCase())
  for (let i = 0; i < h.length; i++) {
    if (h[i].includes('VALOR') && h[i].includes('IVA')) return i
    if (h[i].includes('V.') && h[i].includes('IVA')) return i
    if (h[i].includes('MONTO') && h[i].includes('IVA')) return i
  }
  return -1
}

function findDescColumn(headers: string[]): number {
  const h = headers.map(x => x.toUpperCase())
  for (let i = 0; i < h.length; i++) {
    if (h[i].includes('DESCRIPCION') || h[i].includes('DESCRIPCIÓN')) return i
    if (h[i].includes('BIEN') || h[i].includes('SERVICIO')) return i
    if (h[i].includes('DETALLE')) return i
  }
  return 1 // default second column
}

function parseTables(html: string): ItemDian[] | null {
  // Extract all table blocks
  const tableRe = /<table[\s\S]*?<\/table>/gi
  let tableMatch: RegExpExecArray | null

  while ((tableMatch = tableRe.exec(html)) !== null) {
    const tableHtml = tableMatch[0]

    // Extract all rows
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    const rows: string[][] = []
    let rowMatch: RegExpExecArray | null
    while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
      rows.push(extractRowCells(rowMatch[1]))
    }

    if (rows.length < 2) continue

    // Identify header row (first non-empty row or first with th elements)
    const headers = rows[0]
    if (headers.length < 4) continue

    const colIvaPct = findIvaColumn(headers)
    if (colIvaPct < 0) continue  // this table doesn't have an IVA % column

    const colBase    = findBaseColumn(headers)
    const colIvaVal  = findIvaValColumn(headers)
    const colDesc    = findDescColumn(headers)
    const colTotal   = headers.findIndex((h) => {
      const u = h.toUpperCase()
      return (u === 'TOTAL' || u === 'V. CON IVA' || u.includes('TOTAL CON')) && !u.includes('BASE')
    })

    const items: ItemDian[] = []
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i]
      if (cells.length <= colIvaPct) continue

      const pctRaw = cells[colIvaPct]
      const pct = parseFloat(pctRaw.replace(',', '.'))
      if (isNaN(pct) || pct < 0 || pct > 100) continue

      const base   = colBase   >= 0 ? parseMoney(cells[colBase])   : 0
      const ivaVal = colIvaVal >= 0 ? parseMoney(cells[colIvaVal]) : Math.round(base * pct / 100)
      const total  = colTotal  >= 0 ? parseMoney(cells[colTotal])  : base + ivaVal
      const desc   = cells[colDesc] ?? ''

      // Skip rows that are clearly subtotal/total rows (no description, extreme values)
      if (!desc && base === 0) continue

      items.push({
        numero: i,
        descripcion: desc,
        cantidad: 1,
        base,
        porcentaje_iva: pct,
        valor_iva: ivaVal,
        total,
      })
    }

    if (items.length > 0) return items
  }

  return null
}

/* ── Intento secundario: buscar datos JSON embebidos en scripts ───────────── */
function tryExtractJsonItems(html: string): ItemDian[] | null {
  // Some portals embed hydration data in <script> tags
  const scriptRe = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = scriptRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1])
      const items = findItemsInObject(data)
      if (items && items.length > 0) return items
    } catch { /* continue */ }
  }
  return null
}

function findItemsInObject(obj: unknown, depth = 0): ItemDian[] | null {
  if (depth > 6 || !obj || typeof obj !== 'object') return null
  if (Array.isArray(obj)) {
    for (const el of obj) {
      const result = findItemsInObject(el, depth + 1)
      if (result) return result
    }
    return null
  }
  const keys = Object.keys(obj as Record<string, unknown>)
  // Check if this object looks like an invoice line item
  const hasPercent = keys.some(k => /percent|porcentaje|pct|tasa/i.test(k))
  const hasAmount  = keys.some(k => /amount|valor|monto|subtotal|base/i.test(k))
  if (hasPercent && hasAmount) {
    // Try to extract as a single item
    const o = obj as Record<string, unknown>
    const pct = parseFloat(String(Object.values(o).find(v => typeof v === 'number' && (v === 5 || v === 19 || v === 0)) ?? 0))
    if (!isNaN(pct)) {
      // Could be a line item — but without knowing the exact structure, skip
    }
  }
  // Recurse into child objects
  for (const key of keys) {
    const child = (obj as Record<string, unknown>)[key]
    if (Array.isArray(child) && child.length > 0 && typeof child[0] === 'object') {
      const result = findItemsInObject(child, depth + 1)
      if (result) return result
    }
  }
  return null
}

/* ── API Handler ──────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const cufe = req.nextUrl.searchParams.get('cufe')?.trim() ?? ''

  if (cufe.length < 32) {
    return NextResponse.json({ ok: false, error: 'CUFE inválido', items: [], resumen: { base_19: 0, iva_19: 0, base_5: 0, iva_5: 0, base_cero: 0 }, portal_url: '' }, { status: 400 })
  }

  const portal_url = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}`

  // ── Fetch portal DIAN ──
  let html: string | null = null
  let fetchError = ''
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const res = await fetch(portal_url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    })
    clearTimeout(timeout)
    if (res.ok) {
      html = await res.text()
    } else {
      fetchError = `Portal DIAN respondió con código ${res.status}`
    }
  } catch (e: unknown) {
    fetchError = e instanceof Error && e.name === 'AbortError'
      ? 'Tiempo de espera agotado (12 s) — el portal DIAN no respondió'
      : 'No se pudo conectar al portal DIAN'
  }

  if (!html) {
    return NextResponse.json({
      ok: false, items: [],
      resumen: { base_19: 0, iva_19: 0, base_5: 0, iva_5: 0, base_cero: 0 },
      portal_url,
      error: fetchError || 'No se recibió respuesta del portal DIAN. Use el link para revisión manual.',
    } satisfies DetalleDian)
  }

  // ── Parse ──
  const items = parseTables(html) ?? tryExtractJsonItems(html)

  if (!items || items.length === 0) {
    return NextResponse.json({
      ok: false, items: [],
      resumen: { base_19: 0, iva_19: 0, base_5: 0, iva_5: 0, base_cero: 0 },
      portal_url,
      error: 'Se conectó al portal DIAN pero no se encontró el detalle de ítems. El portal puede requerir autenticación o cambió su estructura. Use el link de revisión manual.',
    } satisfies DetalleDian)
  }

  // ── Aggregate totals ──
  const resumen = { base_19: 0, iva_19: 0, base_5: 0, iva_5: 0, base_cero: 0 }
  for (const item of items) {
    if (item.porcentaje_iva >= 18 && item.porcentaje_iva <= 20) {
      resumen.base_19 += item.base; resumen.iva_19 += item.valor_iva
    } else if (item.porcentaje_iva >= 4 && item.porcentaje_iva <= 6.5) {
      resumen.base_5 += item.base;  resumen.iva_5  += item.valor_iva
    } else {
      resumen.base_cero += item.base
    }
  }

  return NextResponse.json({ ok: true, items, resumen, portal_url } satisfies DetalleDian)
}
