'use client'

import { useState, useRef, useCallback, useMemo, DragEvent } from 'react'
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle,
  RefreshCw, X, ChevronDown, ChevronRight, ExternalLink, Wrench,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import type { DianFactura, ClasificacionIVA } from '@/lib/causacion/dian-iva-parser'
import type { DetalleDian, ItemDian } from '@/app/api/causacion/dian-cufe-detalle/route'

/* ─── Paleta J&A ─────────────────────────────────────────────────────────── */
const JA = {
  NAVY: '#13213C', GOLD: '#B8960C',
  TEXT: '#1C2B45', GREY: '#4B5563', GREY_LT: '#9CA3AF',
  BORDER: '#E5E7EB', BG: '#F8FAFC', WHITE: '#FFFFFF',
  GREEN: '#059669', GREEN_LT: '#D1FAE5',
  RED: '#DC2626', RED_LT: '#FEE2E2',
  BLUE: '#2563EB', BLUE_LT: '#DBEAFE',
  YELLOW: '#D97706', YELLOW_LT: '#FEF3C7',
  PURPLE: '#7C3AED', PURPLE_LT: '#EDE9FE',
  TEAL: '#0D9488', TEAL_LT: '#CCFBF1',
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const cop = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const CLASIF_META: Record<ClasificacionIVA, { label: string; color: string; bg: string }> = {
  GRAVADA_19: { label: 'Gravada 19%', color: JA.RED,    bg: JA.RED_LT },
  GRAVADA_5:  { label: 'Gravada 5%',  color: JA.BLUE,   bg: JA.BLUE_LT },
  EXENTA:     { label: 'Exenta 0%',   color: JA.GREEN,  bg: JA.GREEN_LT },
  EXCLUIDA:   { label: 'Excluida',    color: JA.GREY,   bg: JA.BG },
  MIXTA:      { label: 'Mixta ⚠',    color: JA.YELLOW, bg: JA.YELLOW_LT },
  SIN_DATO:   { label: 'Sin dato',    color: JA.GREY,   bg: JA.BG },
}

function ClasifBadge({ c }: { c: ClasificacionIVA }) {
  const m = CLASIF_META[c] || CLASIF_META.SIN_DATO
  return (
    <span style={{
      background: m.bg, color: m.color, borderRadius: 99,
      padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{m.label}</span>
  )
}

/* ─── Excel export ───────────────────────────────────────────────────────── */
const EXCEL_HEADERS = [
  'Año', 'Tipo Documento', 'CUFE', 'N° Factura', 'Fecha Emisión',
  'NIT Proveedor', 'Nombre Proveedor', 'NIT Empresa', 'Nombre Empresa',
  'Dirección', 'Estado DIAN', 'Hoja Origen',
  'Base Gravada 19%', 'IVA 19%',
  'Base Gravada 5%', 'IVA 5%',
  'Base Exenta', 'Base Excluida',
  'Total', 'Clasificación', 'Fuente', 'Nota',
]

function facturaToRow(f: DianFactura): (string | number)[] {
  const recv = f.grupo.toLowerCase().includes('recib')
  return [
    f.año, f.tipo_documento, f.cufe,
    f.prefijo ? `${f.prefijo}-${f.folio}` : f.folio,
    f.fecha_emision,
    recv ? f.nit_emisor    : f.nit_receptor,
    recv ? f.nombre_emisor : f.nombre_receptor,
    recv ? f.nit_receptor  : f.nit_emisor,
    recv ? f.nombre_receptor : f.nombre_emisor,
    f.grupo, f.estado_dian, f.hoja_origen,
    f.base_gravada_19, f.iva_19,
    f.base_gravada_5,  f.iva_5,
    f.base_exenta, f.base_excluida,
    f.total,
    CLASIF_META[f.clasificacion]?.label ?? f.clasificacion,
    f.fuente_clasificacion, f.nota_ia ?? '',
  ]
}

function generarExcel(facturas: DianFactura[]) {
  const wb = XLSX.utils.book_new()
  const años = [...new Set(facturas.map(f => f.año))].sort()

  /* ── RESUMEN ── */
  const resRows: (string | number)[][] = [
    ['RESUMEN IVA DIAN — Facturas electrónicas'], [],
    ['Año', 'Categoría', 'N° Facturas', 'Base', 'IVA', 'Total Base + IVA'],
  ]
  for (const año of años) {
    const by = facturas.filter(f => f.año === año)
    const cats = [
      { label: 'Gravadas 19%', f: (x: DianFactura) => x.clasificacion === 'GRAVADA_19', b: (x: DianFactura) => x.base_gravada_19, iv: (x: DianFactura) => x.iva_19 },
      { label: 'Gravadas 5%',  f: (x: DianFactura) => x.clasificacion === 'GRAVADA_5',  b: (x: DianFactura) => x.base_gravada_5,  iv: (x: DianFactura) => x.iva_5 },
      { label: 'Exentas 0%',   f: (x: DianFactura) => x.clasificacion === 'EXENTA',     b: (x: DianFactura) => x.base_exenta,     iv: () => 0 },
      { label: 'Excluidas',    f: (x: DianFactura) => x.clasificacion === 'EXCLUIDA',   b: (x: DianFactura) => x.base_excluida,   iv: () => 0 },
      { label: 'Mixtas/Rev',   f: (x: DianFactura) => x.clasificacion === 'MIXTA',      b: (x: DianFactura) => x.total,           iv: (x: DianFactura) => x.iva_total },
    ]
    for (const cat of cats) {
      const rows = by.filter(cat.f)
      if (!rows.length) continue
      const base = rows.reduce((s, x) => s + cat.b(x), 0)
      const iva  = rows.reduce((s, x) => s + cat.iv(x), 0)
      resRows.push([año, cat.label, rows.length, base, iva, base + iva])
    }
    resRows.push([])
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resRows), 'RESUMEN')

  /* ── TODAS ── */
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...facturas.map(facturaToRow)]), 'TODAS')

  /* ── Por categoría ── */
  const subs: { name: string; claz: ClasificacionIVA[] }[] = [
    { name: 'GRAVADAS 19%', claz: ['GRAVADA_19'] },
    { name: 'GRAVADAS 5%',  claz: ['GRAVADA_5'] },
    { name: 'EXENTAS',      claz: ['EXENTA'] },
    { name: 'EXCLUIDAS',    claz: ['EXCLUIDA'] },
    { name: 'MIXTAS - REV', claz: ['MIXTA', 'SIN_DATO'] },
  ]
  for (const { name, claz } of subs) {
    const rows = facturas.filter(f => claz.includes(f.clasificacion)).map(facturaToRow)
    if (!rows.length) continue
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...rows]), name)
  }

  XLSX.writeFile(wb, `Causacion_IVA_DIAN_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/* ─── Modal Resolver MIXTA ───────────────────────────────────────────────── */
function ModalResolver({
  factura,
  onAplicar,
  onCerrar,
}: {
  factura: DianFactura
  onAplicar: (f: DianFactura) => void
  onCerrar: () => void
}) {
  const [dianRes, setDianRes] = useState<DetalleDian | null>(null)
  const [dianLoading, setDianLoading] = useState(false)
  const [dianError, setDianError] = useState('')

  const [base19, setBase19] = useState(factura.base_gravada_19 || 0)
  const [iva19,  setIva19]  = useState(factura.iva_19 || 0)
  const [base5,  setBase5]  = useState(factura.base_gravada_5 || 0)
  const [iva5,   setIva5]   = useState(factura.iva_5 || 0)

  const esRecibida = factura.grupo.toLowerCase().includes('recib')
  const proveedor  = esRecibida ? factura.nombre_emisor : factura.nombre_receptor
  const portalUrl  = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${factura.cufe}`

  // Totals for validation
  const totalBase = base19 + base5
  const totalIva  = iva19  + iva5
  const diffBase  = Math.abs(totalBase - (factura.total - factura.iva_total))
  const diffIva   = Math.abs(totalIva  - factura.iva_total)
  const valid     = totalBase > 0

  async function consultarDian() {
    setDianLoading(true); setDianError(''); setDianRes(null)
    try {
      const res = await fetch(`/api/causacion/dian-cufe-detalle?cufe=${encodeURIComponent(factura.cufe)}`)
      const data: DetalleDian = await res.json()
      setDianRes(data)
      if (data.ok && data.resumen) {
        setBase19(Math.round(data.resumen.base_19))
        setIva19(Math.round(data.resumen.iva_19))
        setBase5(Math.round(data.resumen.base_5))
        setIva5(Math.round(data.resumen.iva_5))
      } else {
        setDianError(data.error || 'No se obtuvieron ítems del portal DIAN.')
      }
    } catch {
      setDianError('Error de red al consultar el portal DIAN.')
    } finally {
      setDianLoading(false)
    }
  }

  function aplicar() {
    const claz: ClasificacionIVA =
      base19 > 0 && base5 > 0 ? 'MIXTA' :
      base19 > 0 ? 'GRAVADA_19' :
      base5  > 0 ? 'GRAVADA_5'  : 'EXCLUIDA'

    onAplicar({
      ...factura,
      clasificacion: claz,
      base_gravada_19: base19, iva_19: iva19,
      base_gravada_5: base5,   iva_5: iva5,
      base_exenta: 0, base_excluida: 0,
      fuente_clasificacion: dianRes?.ok ? 'ia' : 'regla',
      nota_ia: dianRes?.ok
        ? `Desglose obtenido del portal DIAN (${dianRes.items.length} ítems)`
        : 'Corrección manual del desglose de IVA',
    })
  }

  const inp = {
    border: `1px solid ${JA.BORDER}`, borderRadius: 6, padding: '6px 10px',
    fontSize: 13, color: JA.TEXT, width: '100%', outline: 'none',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: JA.WHITE, borderRadius: 12, padding: 28,
        width: '100%', maxWidth: 720, maxHeight: '92vh',
        overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: JA.TEXT, margin: '0 0 2px' }}>
              Resolver Factura Mixta
            </h3>
            <p style={{ fontSize: 12, color: JA.GREY, margin: 0 }}>
              {proveedor} · {factura.prefijo ? `${factura.prefijo}-${factura.folio}` : factura.folio} · {factura.fecha_emision.slice(0, 10)}
            </p>
          </div>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: JA.GREY }}>
            <X size={20} />
          </button>
        </div>

        {/* Totales del documento */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total Factura', value: cop(factura.total) },
            { label: 'IVA Total (DIAN)', value: cop(factura.iva_total) },
            { label: 'Base implícita', value: cop(factura.total - factura.iva_total) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: JA.TEXT }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Consulta DIAN */}
        <div style={{ background: JA.BLUE_LT, border: `1px solid ${JA.BLUE}`, borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: JA.BLUE, marginBottom: 10 }}>
            Paso 1 — Consultar ítems en el portal DIAN
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={consultarDian}
              disabled={dianLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: JA.NAVY, color: JA.WHITE, border: 'none',
                borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600,
                cursor: dianLoading ? 'not-allowed' : 'pointer', opacity: dianLoading ? 0.7 : 1,
              }}
            >
              {dianLoading
                ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Consultando DIAN...</>
                : <><CheckCircle2 size={13} /> Consultar automáticamente</>}
            </button>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: JA.WHITE, color: JA.BLUE, border: `1px solid ${JA.BLUE}`,
                borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={13} /> Ver en portal DIAN
            </a>
          </div>

          {/* Error DIAN */}
          {dianError && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-start', background: JA.YELLOW_LT, borderRadius: 6, padding: '8px 12px' }}>
              <AlertTriangle size={14} color={JA.YELLOW} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: JA.YELLOW }}>{dianError}</span>
            </div>
          )}

          {/* Ítems DIAN si se obtuvieron */}
          {dianRes?.ok && dianRes.items.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: JA.BLUE, fontWeight: 600, marginBottom: 6 }}>
                {dianRes.items.length} ítems encontrados — valores pre-cargados en el formulario:
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: JA.NAVY }}>
                      {['#', 'Descripción', 'Base', '% IVA', 'Valor IVA', 'Total'].map(h => (
                        <th key={h} style={{ padding: '5px 8px', color: JA.WHITE, textAlign: 'left', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dianRes.items.map((item: ItemDian) => (
                      <tr key={item.numero} style={{ borderBottom: `1px solid ${JA.BORDER}` }}>
                        <td style={{ padding: '5px 8px', color: JA.GREY }}>{item.numero}</td>
                        <td style={{ padding: '5px 8px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.descripcion}>{item.descripcion}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{cop(item.base)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700,
                          color: item.porcentaje_iva === 19 ? JA.RED : item.porcentaje_iva === 5 ? JA.BLUE : JA.GREY }}>
                          {item.porcentaje_iva}%
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>{cop(item.valor_iva)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{cop(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Inputs manuales */}
        <div style={{ background: JA.BG, border: `1px solid ${JA.BORDER}`, borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: JA.TEXT, marginBottom: 12 }}>
            Paso 2 — Confirmar o ajustar el desglose (valores en COP)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* IVA 19% */}
            <div style={{ background: JA.RED_LT, border: `1px solid ${JA.RED}`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: JA.RED, marginBottom: 10, textTransform: 'uppercase' }}>IVA 19%</div>
              <label style={{ fontSize: 11, color: JA.GREY, display: 'block', marginBottom: 4 }}>Base Gravada 19%</label>
              <input
                type="number" value={base19 || ''} placeholder="0"
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0
                  setBase19(v)
                  setIva19(Math.round(v * 0.19))
                }}
                style={{ ...inp, marginBottom: 8 }}
              />
              <label style={{ fontSize: 11, color: JA.GREY, display: 'block', marginBottom: 4 }}>Valor IVA 19%</label>
              <input
                type="number" value={iva19 || ''} placeholder="0"
                onChange={e => setIva19(parseFloat(e.target.value) || 0)}
                style={inp}
              />
            </div>

            {/* IVA 5% */}
            <div style={{ background: JA.BLUE_LT, border: `1px solid ${JA.BLUE}`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: JA.BLUE, marginBottom: 10, textTransform: 'uppercase' }}>IVA 5%</div>
              <label style={{ fontSize: 11, color: JA.GREY, display: 'block', marginBottom: 4 }}>Base Gravada 5%</label>
              <input
                type="number" value={base5 || ''} placeholder="0"
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0
                  setBase5(v)
                  setIva5(Math.round(v * 0.05))
                }}
                style={{ ...inp, marginBottom: 8 }}
              />
              <label style={{ fontSize: 11, color: JA.GREY, display: 'block', marginBottom: 4 }}>Valor IVA 5%</label>
              <input
                type="number" value={iva5 || ''} placeholder="0"
                onChange={e => setIva5(parseFloat(e.target.value) || 0)}
                style={inp}
              />
            </div>
          </div>

          {/* Validación */}
          {valid && (
            <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: JA.GREY }}>
                Base total: <strong>{cop(totalBase)}</strong>
              </span>
              <span style={{ fontSize: 12, color: JA.GREY }}>
                IVA total: <strong>{cop(totalIva)}</strong>
              </span>
              {diffBase > 500 && (
                <span style={{ fontSize: 12, color: JA.YELLOW, fontWeight: 600 }}>
                  ⚠ Diferencia en base: {cop(diffBase)}
                </span>
              )}
              {diffIva > 500 && (
                <span style={{ fontSize: 12, color: JA.YELLOW, fontWeight: 600 }}>
                  ⚠ Diferencia en IVA: {cop(diffIva)}
                </span>
              )}
              {diffBase <= 500 && diffIva <= 500 && (
                <span style={{ fontSize: 12, color: JA.GREEN, fontWeight: 600 }}>
                  ✓ Cuadra con el total del documento
                </span>
              )}
            </div>
          )}
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCerrar}
            style={{ padding: '8px 20px', borderRadius: 6, border: `1px solid ${JA.BORDER}`, background: JA.WHITE, fontSize: 13, cursor: 'pointer', color: JA.GREY }}>
            Cancelar
          </button>
          <button
            onClick={aplicar}
            disabled={!valid}
            style={{
              padding: '8px 24px', borderRadius: 6, border: 'none',
              background: valid ? JA.NAVY : JA.GREY_LT, color: JA.WHITE,
              fontSize: 13, fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed',
            }}
          >
            Aplicar corrección
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Componente principal ───────────────────────────────────────────────── */
interface UploadedFile { file: File; nombre: string }

export function TabIvaDian() {
  const [uploaded, setUploaded] = useState<UploadedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [facturas, setFacturas] = useState<DianFactura[]>([])
  const [hasResults, setHasResults] = useState(false)
  const [error, setError] = useState('')
  const [filtroClasif, setFiltroClasif] = useState('')
  const [filtroAño, setFiltroAño] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState('')
  const [filtroQ, setFiltroQ] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [resolverFactura, setResolverFactura] = useState<DianFactura | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  /* ── Resumen dinámico (se actualiza con correcciones) ── */
  const resumen = useMemo(() => {
    if (!facturas.length) return null
    return {
      total: facturas.length,
      años: [...new Set(facturas.map(f => f.año))].sort() as number[],
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
  }, [facturas])

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return
    const valid = Array.from(incoming).filter(f => f.name.endsWith('.xlsx'))
    if (!valid.length) { setError('Solo se aceptan archivos .xlsx'); return }
    setUploaded(prev => {
      const next = [...prev]
      for (const f of valid) {
        if (next.length >= 2) break
        if (!next.find(u => u.nombre === f.name)) next.push({ file: f, nombre: f.name })
      }
      return next.slice(0, 2)
    })
    setError('')
  }, [])

  const handleDrop = (e: DragEvent) => {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  async function procesar() {
    if (!uploaded.length) { setError('Sube al menos un archivo'); return }
    setProcessing(true); setError(''); setFacturas([]); setHasResults(false)
    try {
      const form = new FormData()
      for (const u of uploaded) form.append('files', u.file)
      const res = await fetch('/api/causacion/dian-iva', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error procesando'); return }
      setFacturas(data.facturas)
      setHasResults(true)
    } catch {
      setError('Error de conexión al procesar los archivos')
    } finally {
      setProcessing(false)
    }
  }

  function aplicarCorreccion(corregida: DianFactura) {
    setFacturas(prev => prev.map(f => f.cufe === corregida.cufe ? corregida : f))
    setResolverFactura(null)
  }

  /* ── Filtros ── */
  const filtradas = useMemo(() => facturas.filter(f => {
    if (filtroClasif && f.clasificacion !== filtroClasif) return false
    if (filtroAño && String(f.año) !== filtroAño) return false
    if (filtroGrupo) {
      const recv = f.grupo.toLowerCase().includes('recib')
      if (filtroGrupo === 'compras' && !recv) return false
      if (filtroGrupo === 'ventas' && recv) return false
    }
    if (filtroQ) {
      const q = filtroQ.toLowerCase()
      if (![f.nombre_emisor, f.nombre_receptor, f.nit_emisor, f.nit_receptor, f.folio, f.cufe].some(v => v.toLowerCase().includes(q))) return false
    }
    return true
  }), [facturas, filtroClasif, filtroAño, filtroGrupo, filtroQ])

  /* ─── Render ─────────────────────────────────────────────────────── */
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Modal Resolver */}
      {resolverFactura && (
        <ModalResolver
          factura={resolverFactura}
          onAplicar={aplicarCorreccion}
          onCerrar={() => setResolverFactura(null)}
        />
      )}

      {/* ── Zona de carga ── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? JA.NAVY : JA.BORDER}`,
          borderRadius: 8, padding: 28, textAlign: 'center', cursor: 'pointer',
          background: dragging ? JA.BLUE_LT : JA.BG, transition: 'all .15s', marginBottom: 16,
        }}
      >
        <input ref={fileRef} type="file" accept=".xlsx" multiple hidden onChange={e => addFiles(e.target.files)} />
        <Upload size={28} color={JA.GREY} style={{ margin: '0 auto 8px' }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: JA.TEXT, margin: '0 0 4px' }}>
          Arrastra los archivos DIAN aquí o haz clic para seleccionar
        </p>
        <p style={{ fontSize: 12, color: JA.GREY, margin: 0 }}>
          1 o 2 archivos .xlsx del portal DIAN — años 2024 y/o 2025
        </p>
      </div>

      {/* ── Archivos cargados ── */}
      {uploaded.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {uploaded.map(u => (
            <div key={u.nombre} style={{ display: 'flex', alignItems: 'center', gap: 8, background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 6, padding: '6px 12px' }}>
              <FileSpreadsheet size={16} color={JA.GREEN} />
              <span style={{ fontSize: 13, color: JA.TEXT }}>{u.nombre}</span>
              <button onClick={e => { e.stopPropagation(); setUploaded(p => p.filter(x => x.nombre !== u.nombre)) }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                <X size={14} color={JA.GREY} />
              </button>
            </div>
          ))}
          <button onClick={procesar} disabled={processing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: JA.NAVY, color: JA.WHITE, border: 'none',
              borderRadius: 6, padding: '6px 16px', fontSize: 13, fontWeight: 600,
              cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.7 : 1,
            }}>
            {processing
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Procesando con IA...</>
              : <><CheckCircle2 size={14} /> Procesar y clasificar</>}
          </button>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: JA.RED_LT, border: `1px solid ${JA.RED}`, borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
          <AlertTriangle size={14} color={JA.RED} />
          <span style={{ fontSize: 13, color: JA.RED }}>{error}</span>
        </div>
      )}

      {/* ── Resultados ── */}
      {hasResults && resumen && (
        <>
          {/* Tarjetas resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total Facturas',   value: resumen.total,                   color: JA.TEXT,   sub: resumen.años.map(a => `Año ${a}`).join(' + ') },
              { label: 'Base Gravada 19%', value: cop(resumen.base_total_19),       color: JA.RED,    sub: `IVA: ${cop(resumen.iva_total_19)} — ${resumen.gravadas_19} fact.` },
              { label: 'Base Gravada 5%',  value: cop(resumen.base_total_5),        color: JA.BLUE,   sub: `IVA: ${cop(resumen.iva_total_5)} — ${resumen.gravadas_5} fact.` },
              { label: 'Base Exenta 0%',   value: cop(resumen.base_exenta_total),   color: JA.GREEN,  sub: `${resumen.exentas} facturas` },
              { label: 'Base Excluida',    value: cop(resumen.base_excluida_total), color: JA.GREY,   sub: `${resumen.excluidas} facturas` },
              { label: 'Mixtas / Revisar', value: resumen.mixtas,                  color: JA.YELLOW, sub: resumen.mixtas > 0 ? 'Usar botón Resolver ↓' : 'Sin mixtas pendientes ✓' },
            ].map(({ label, value, color, sub }) => (
              <div key={label} style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 8, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: JA.GREY, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 11, color: JA.GREY_LT, marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Filtros + descarga */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="Buscar NIT, proveedor, CUFE..."
              value={filtroQ} onChange={e => setFiltroQ(e.target.value)}
              style={{ border: `1px solid ${JA.BORDER}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, color: JA.TEXT, width: 220, outline: 'none' }}
            />
            <select value={filtroClasif} onChange={e => setFiltroClasif(e.target.value)}
              style={{ padding: '6px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: 6, fontSize: 13, color: JA.TEXT, background: JA.WHITE }}>
              <option value="">Todas las clasificaciones</option>
              <option value="GRAVADA_19">Gravadas 19%</option>
              <option value="GRAVADA_5">Gravadas 5%</option>
              <option value="EXENTA">Exentas 0%</option>
              <option value="EXCLUIDA">Excluidas</option>
              <option value="MIXTA">Mixtas / Revisar</option>
            </select>
            <select value={filtroAño} onChange={e => setFiltroAño(e.target.value)}
              style={{ padding: '6px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: 6, fontSize: 13, color: JA.TEXT, background: JA.WHITE }}>
              <option value="">Todos los años</option>
              {resumen.años.map(a => <option key={a} value={String(a)}>{a}</option>)}
            </select>
            <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}
              style={{ padding: '6px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: 6, fontSize: 13, color: JA.TEXT, background: JA.WHITE }}>
              <option value="">Compras + Ventas</option>
              <option value="compras">Solo Compras (Recibidas)</option>
              <option value="ventas">Solo Ventas (Emitidas)</option>
            </select>
            <span style={{ fontSize: 12, color: JA.GREY }}>{filtradas.length} de {facturas.length}</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => generarExcel(facturas)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: JA.GREEN, color: JA.WHITE, border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Download size={14} /> Descargar Excel
            </button>
          </div>

          {/* Tabla */}
          <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${JA.BORDER}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: JA.NAVY }}>
                  {['', 'Año', 'Fecha', 'NIT', 'Proveedor / Cliente', 'Dir.', 'Base 19%', 'IVA 19%', 'Base 5%', 'IVA 5%', 'Exenta/Excl.', 'Total', 'Clasificación', 'Fuente', ''].map((h, i) => (
                    <th key={i} style={{ padding: '8px 8px', textAlign: 'left', color: JA.WHITE, fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.slice(0, 300).flatMap((f, i) => {
                  const recv      = f.grupo.toLowerCase().includes('recib')
                  const proveedor = recv ? f.nombre_emisor : f.nombre_receptor
                  const nit       = recv ? f.nit_emisor    : f.nit_receptor
                  const baseExcl  = f.base_exenta + f.base_excluida
                  const isMixta   = f.clasificacion === 'MIXTA'
                  const isExp     = expandedRow === f.cufe

                  return [
                    <tr
                      key={f.cufe}
                      onClick={() => setExpandedRow(isExp ? null : f.cufe)}
                      style={{
                        background: isMixta ? '#FFFBEB' : i % 2 === 0 ? JA.WHITE : JA.BG,
                        cursor: 'pointer',
                        borderBottom: `1px solid ${JA.BORDER}`,
                        borderLeft: isMixta ? `3px solid ${JA.YELLOW}` : undefined,
                      }}
                    >
                      <td style={{ padding: '6px 8px', width: 20 }}>
                        {isExp ? <ChevronDown size={12} color={JA.GREY} /> : <ChevronRight size={12} color={JA.GREY} />}
                      </td>
                      <td style={{ padding: '6px 8px', color: JA.GREY }}>{f.año}</td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{f.fecha_emision.slice(0, 10)}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11 }}>{nit}</td>
                      <td style={{ padding: '6px 8px', maxWidth: 180 }}>
                        <div style={{ fontWeight: 500, color: JA.TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proveedor}</div>
                        <div style={{ color: JA.GREY_LT, fontSize: 11 }}>{f.prefijo ? `${f.prefijo}-${f.folio}` : f.folio}</div>
                      </td>
                      <td style={{ padding: '6px 8px', fontSize: 11, color: recv ? JA.BLUE : JA.PURPLE }}>
                        {recv ? '↓ Rec.' : '↑ Emi.'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: JA.RED, fontWeight: f.base_gravada_19 > 0 ? 600 : 400 }}>
                        {f.base_gravada_19 > 0 ? cop(f.base_gravada_19) : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: JA.RED }}>
                        {f.iva_19 > 0 ? cop(f.iva_19) : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: JA.BLUE, fontWeight: f.base_gravada_5 > 0 ? 600 : 400 }}>
                        {f.base_gravada_5 > 0 ? cop(f.base_gravada_5) : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: JA.BLUE }}>
                        {f.iva_5 > 0 ? cop(f.iva_5) : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: JA.GREY }}>
                        {baseExcl > 0 ? cop(baseExcl) : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500 }}>{cop(f.total)}</td>
                      <td style={{ padding: '6px 8px' }}><ClasifBadge c={f.clasificacion} /></td>
                      <td style={{ padding: '6px 8px', fontSize: 11, color: JA.GREY }}>
                        {f.fuente_clasificacion === 'ia' ? '🤖' : f.fuente_clasificacion === 'preexistente' ? '📊' : f.fuente_clasificacion === 'regla' ? '📋' : '∑'}
                      </td>
                      {/* Botón Resolver solo en MIXTAS */}
                      <td style={{ padding: '4px 8px' }}>
                        {isMixta && (
                          <button
                            onClick={e => { e.stopPropagation(); setResolverFactura(f) }}
                            title="Resolver factura mixta"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              background: JA.YELLOW_LT, color: JA.YELLOW,
                              border: `1px solid ${JA.YELLOW}`, borderRadius: 6,
                              padding: '3px 8px', fontSize: 11, fontWeight: 700,
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            <Wrench size={11} /> Resolver
                          </button>
                        )}
                      </td>
                    </tr>,

                    /* ── Fila expandida ── */
                    isExp ? (
                      <tr key={`${f.cufe}-exp`} style={{ background: JA.BLUE_LT }}>
                        <td colSpan={15} style={{ padding: '10px 20px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 10, textTransform: 'uppercase', color: JA.GREY, marginBottom: 2 }}>CUFE/CUDE</div>
                              <div style={{ fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all', color: JA.TEXT }}>{f.cufe}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, textTransform: 'uppercase', color: JA.GREY, marginBottom: 2 }}>Estado DIAN</div>
                              <div style={{ fontSize: 12 }}>{f.estado_dian}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, textTransform: 'uppercase', color: JA.GREY, marginBottom: 2 }}>Hoja origen</div>
                              <div style={{ fontSize: 12 }}>{f.hoja_origen}</div>
                            </div>
                            {f.nota_ia && (
                              <div>
                                <div style={{ fontSize: 10, textTransform: 'uppercase', color: JA.GREY, marginBottom: 2 }}>Nota</div>
                                <div style={{ fontSize: 12 }}>{f.nota_ia}</div>
                              </div>
                            )}
                            {isMixta && (
                              <div style={{ gridColumn: '1/-1' }}>
                                <button
                                  onClick={() => setResolverFactura(f)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    background: JA.NAVY, color: JA.WHITE, border: 'none',
                                    borderRadius: 6, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                  }}
                                >
                                  <Wrench size={13} /> Abrir resolver con consulta DIAN
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ].filter(Boolean)
                })}
              </tbody>
            </table>
            {filtradas.length > 300 && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: JA.GREY, background: JA.BG, borderTop: `1px solid ${JA.BORDER}` }}>
                Mostrando 300 de {filtradas.length} filas — descarga el Excel para ver todas.
              </div>
            )}
            {filtradas.length === 0 && facturas.length > 0 && (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: JA.GREY }}>
                Ninguna factura coincide con los filtros.
              </div>
            )}
          </div>
        </>
      )}

      {/* Estado vacío */}
      {!hasResults && !processing && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: JA.GREY }}>
          <FileSpreadsheet size={40} color={JA.GREY_LT} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: JA.TEXT }}>Carga los archivos DIAN para comenzar</p>
          <p style={{ fontSize: 13, maxWidth: 520, margin: '0 auto', lineHeight: 1.5 }}>
            Sube 1 o 2 archivos .xlsx del portal DIAN (2024 y/o 2025). El sistema clasifica cada factura por
            CUFE en <strong>Gravada 19%</strong>, <strong>5%</strong>, <strong>Exenta</strong> o <strong>Excluida</strong>.
            Las facturas <strong>Mixtas</strong> tienen un botón <em>Resolver</em> que consulta
            el detalle de ítems directamente en el portal DIAN.
          </p>
        </div>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  )
}
