'use client'

import { useState, useRef, useCallback, DragEvent, useMemo } from 'react'
import {
  Upload, FileText, CheckCircle2, AlertTriangle, Download,
  RefreshCw, ChevronRight, X, Info, TrendingUp, TrendingDown,
  FileCheck, Banknote, Scale, Receipt, Search, ChevronDown, ChevronUp,
} from 'lucide-react'
import type {
  ResultadoConciliacion, MovimientoBancario,
  Discrepancia, ResultadoMatch,
  ResumenConciliacionBancaria, PartidaConciliatoria,
} from '@/lib/conciliaciones/models'
import { FORMATOS_BANCO } from '@/lib/conciliaciones/config'

/* ─── Paleta J&A ────────────────────────────────────────────────────────── */
const JA = {
  NAVY: '#13213C', GOLD: '#B8960C', GOLD_LT: '#FFF8E7',
  TEXT: '#1C2B45', GREY: '#4B5563', GREY_LT: '#9CA3AF',
  BORDER: '#E5E7EB', BG: '#F8FAFC', WHITE: '#FFFFFF',
  GREEN: '#059669', GREEN_LT: '#D1FAE5',
  RED: '#DC2626', RED_LT: '#FEE2E2',
  BLUE: '#2563EB', BLUE_LT: '#DBEAFE',
  YELLOW: '#D97706', YELLOW_LT: '#FEF3C7',
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
const PCT = (n: number) => `${n.toFixed(1)}%`
const fmt = (n: number) => new Intl.NumberFormat('es-CO').format(n)

/* ─── Tipos de estado ───────────────────────────────────────────────────── */
type Paso = 1 | 2 | 3 | 4

interface Config {
  periodoInicio: string
  periodoFin: string
  nitEmpresa: string
  nombreEmpresa: string
  banco: string
  numeroCuenta: string
  municipioIca: string
  ciuuPrincipal: string
  toleranciaMontosPct: string
  toleranciaDias: string
  umbralConfianzaMin: string
  calcularIva: boolean
  calcularRfte: boolean
  calcularIca: boolean
}

const cfgDefault: Config = {
  periodoInicio: '', periodoFin: '', nitEmpresa: '', nombreEmpresa: '',
  banco: 'bancolombia', numeroCuenta: '', municipioIca: 'Bogotá D.C.',
  ciuuPrincipal: '', toleranciaMontosPct: '0.001', toleranciaDias: '5',
  umbralConfianzaMin: '0.50', calcularIva: true, calcularRfte: true, calcularIca: true,
}

/* ═══════════════════════════════════════════════════════════════════════════
   Componente: FileDropZone
   ══════════════════════════════════════════════════════════════════════════ */
function FileDropZone({
  label, accept, multiple, files, onChange, hint,
}: {
  label: string; accept: string; multiple?: boolean
  files: File[]; onChange: (files: File[]) => void; hint?: string
}) {
  const [dragging, setDragging] = useState(false)
  const [errorDrop, setErrorDrop] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const extensionesAceptadas = accept.split(',').map(e => e.trim().toLowerCase())

  const filtrarPorExtension = (lista: File[]): { ok: File[]; rechazados: string[] } => {
    const ok: File[] = []
    const rechazados: string[] = []
    for (const f of lista) {
      const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase()
      if (extensionesAceptadas.includes(ext)) ok.push(f)
      else rechazados.push(f.name)
    }
    return { ok, rechazados }
  }

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    const { ok, rechazados } = filtrarPorExtension(dropped)
    if (rechazados.length > 0)
      setErrorDrop(`Tipo de archivo no permitido: ${rechazados.join(', ')}. Permitidos: ${accept}`)
    else
      setErrorDrop('')
    if (ok.length === 0) return
    onChange(multiple ? [...files, ...ok] : ok.slice(0, 1))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, multiple, onChange, accept])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    setErrorDrop('')
    onChange(multiple ? [...files, ...selected] : selected.slice(0, 1))
    e.target.value = ''
  }

  const removeFile = (idx: number) => onChange(files.filter((_, i) => i !== idx))

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: JA.TEXT, marginBottom: 6, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? JA.GOLD : JA.BORDER}`,
          borderRadius: 2, padding: '14px 16px', cursor: 'pointer',
          background: dragging ? JA.GOLD_LT : JA.BG,
          display: 'flex', alignItems: 'center', gap: 10,
          transition: 'all 0.15s',
        }}
      >
        <Upload size={16} color={JA.GOLD} />
        <span style={{ fontSize: 12, color: JA.GREY_LT, fontFamily: 'Inter, sans-serif' }}>
          {files.length === 0
            ? `Arrastre ${multiple ? 'archivos' : 'archivo'} aquí o haga clic para seleccionar`
            : `${files.length} archivo${files.length > 1 ? 's' : ''} seleccionado${files.length > 1 ? 's' : ''}`
          }
        </span>
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={handleChange} style={{ display: 'none' }} />
      </div>
      {hint && <div style={{ fontSize: 11, color: JA.GREY_LT, marginTop: 4, fontFamily: 'Inter, sans-serif' }}>{hint}</div>}
      {errorDrop && (
        <div style={{ fontSize: 11, color: JA.RED, marginTop: 4, fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          {errorDrop}
        </div>
      )}
      {files.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2 }}>
              <FileText size={12} color={JA.GOLD} />
              <span style={{ fontSize: 11, color: JA.TEXT, flex: 1, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ fontSize: 10, color: JA.GREY_LT, fontFamily: 'Inter, sans-serif' }}>{(f.size / 1024).toFixed(0)} KB</span>
              <button onClick={e => { e.stopPropagation(); removeFile(i) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: JA.RED, padding: 0 }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Componente: KpiCard
   ══════════════════════════════════════════════════════════════════════════ */
function KpiCard({ title, value, sub, color, icon }: {
  title: string; value: string; sub?: string; color: string; icon: React.ReactNode
}) {
  return (
    <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6, borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ color }}>{icon}</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: JA.GREY, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: JA.TEXT, fontFamily: 'Inter, sans-serif', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: JA.GREY_LT, fontFamily: 'Inter, sans-serif' }}>{sub}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Componente: TablaMatches
   ══════════════════════════════════════════════════════════════════════════ */
function TablaMatches({ matches, resultado }: { matches: ResultadoMatch[]; resultado: ResultadoConciliacion }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 20

  const bancoById = useMemo(() => new Map(resultado.movimientosBanco.map(m => [m.id, m])), [resultado])
  const factByCufe = useMemo(() => new Map(resultado.facturasDian.map(f => [f.cufe, f])), [resultado])

  const filtrados = matches.filter(m => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    const mov = bancoById.get(m.idsBanco[0])
    if (mov?.descripcion.toLowerCase().includes(q)) return true
    return m.idsFacturas.some(cufe => factByCufe.get(cufe)?.numero.toLowerCase().includes(q))
  })
  const total = filtrados.length
  const slice = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)

  const toggle = (i: number) => {
    const s = new Set(expanded)
    s.has(i) ? s.delete(i) : s.add(i)
    setExpanded(s)
  }

  const TIPO_COLOR: Record<string, string> = {
    exacto: JA.GREEN, fuzzy: JA.BLUE, manual: JA.GOLD,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: JA.GREY_LT }} />
          <input
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setPagina(0) }}
            placeholder="Buscar por descripción banco o número de factura..."
            style={{ width: '100%', paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7, fontSize: 12, border: `1px solid ${JA.BORDER}`, borderRadius: 2, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <span style={{ fontSize: 11, color: JA.GREY_LT, whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>{fmt(total)} registros</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
          <thead>
            <tr style={{ background: JA.BG, borderBottom: `2px solid ${JA.BORDER}` }}>
              {['Descripción Banco', 'Monto Banco', 'Monto Factura', 'Diferencia', 'Confianza', 'Tipo Match', 'Facturas', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: h.startsWith('Monto') || h === 'Diferencia' ? 'right' : 'left', fontWeight: 700, color: JA.GREY, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((m, idx) => {
              const isExp = expanded.has(idx)
              const tipoColor = TIPO_COLOR[m.tipoMatch] ?? JA.GREY
              const mov = bancoById.get(m.idsBanco[0])
              return (
                <>
                  <tr key={idx} style={{ borderBottom: `1px solid ${JA.BORDER}`, background: isExp ? JA.GOLD_LT : undefined }}>
                    <td style={{ padding: '8px 12px', color: JA.TEXT, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mov?.descripcion ?? m.idsBanco[0]}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: JA.GREEN }}>{COP(m.montoBanco)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: JA.BLUE }}>{COP(m.montoFactura)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: m.diferenciaMonto > 1000 ? JA.RED : JA.GREY_LT }}>{COP(m.diferenciaMonto)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: JA.BORDER, borderRadius: 2, minWidth: 50 }}>
                          <div style={{ width: `${Math.min(100, m.confianza * 100)}%`, height: '100%', background: m.confianza >= 0.8 ? JA.GREEN : m.confianza >= 0.6 ? JA.YELLOW : JA.RED, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11, color: JA.GREY, minWidth: 36 }}>{PCT(m.confianza * 100)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: JA.WHITE, background: tipoColor, padding: '2px 6px', borderRadius: 2 }}>{m.tipoMatch}</span>
                      {m.esPagoParcial && <span style={{ fontSize: 9, color: JA.GOLD, marginLeft: 4 }}>parcial</span>}
                      {m.esPagoAgrupado && <span style={{ fontSize: 9, color: JA.GOLD, marginLeft: 4 }}>agrupado</span>}
                    </td>
                    <td style={{ padding: '8px 12px', color: JA.GREY, fontSize: 11 }}>{m.idsFacturas.length} fact.</td>
                    <td style={{ padding: '8px 12px' }}>
                      <button onClick={() => toggle(idx)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: JA.GREY_LT }}>
                        {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                  </tr>
                  {isExp && (
                    <tr key={`${idx}-detail`} style={{ background: JA.GOLD_LT }}>
                      <td colSpan={8} style={{ padding: '0 12px 12px 40px' }}>
                        {mov && (
                          <div style={{ fontSize: 11, color: JA.GREY, marginBottom: 6 }}>
                            <strong>Banco:</strong> {mov.fecha} · {mov.tipo} · {mov.referencia ?? '—'}
                          </div>
                        )}
                        {m.idsFacturas.length > 0 && (
                          <>
                            <div style={{ fontSize: 11, color: JA.GREY, marginBottom: 4, fontWeight: 700 }}>Facturas vinculadas:</div>
                            {m.idsFacturas.map((cufe, fi) => {
                              const f = factByCufe.get(cufe)
                              return (
                                <div key={fi} style={{ display: 'flex', gap: 16, padding: '4px 0', borderBottom: fi < m.idsFacturas.length - 1 ? `1px solid ${JA.BORDER}` : undefined }}>
                                  <span style={{ color: JA.NAVY, fontWeight: 600 }}>{f?.numero ?? cufe.slice(0, 12) + '…'}</span>
                                  <span style={{ color: JA.GREY }}>{f?.fechaEmision}</span>
                                  <span style={{ color: JA.GREY }}>{f?.nombreEmisor}</span>
                                  <span style={{ fontWeight: 600, color: JA.TEXT }}>{f ? COP(f.total) : '—'}</span>
                                </div>
                              )
                            })}
                          </>
                        )}
                        {m.idsSiigo.length > 0 && (
                          <div style={{ marginTop: 6, fontSize: 11, color: JA.GREY }}>
                            Siigo IDs: {m.idsSiigo.join(', ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {total > POR_PAGINA && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}
            style={{ padding: '6px 14px', fontSize: 12, border: `1px solid ${JA.BORDER}`, borderRadius: 2, background: JA.WHITE, cursor: pagina === 0 ? 'not-allowed' : 'pointer', color: JA.TEXT, fontFamily: 'Inter, sans-serif' }}>
            ← Anterior
          </button>
          <span style={{ fontSize: 12, color: JA.GREY_LT, alignSelf: 'center', fontFamily: 'Inter, sans-serif' }}>
            Página {pagina + 1} de {Math.ceil(total / POR_PAGINA)}
          </span>
          <button disabled={(pagina + 1) * POR_PAGINA >= total} onClick={() => setPagina(p => p + 1)}
            style={{ padding: '6px 14px', fontSize: 12, border: `1px solid ${JA.BORDER}`, borderRadius: 2, background: JA.WHITE, cursor: (pagina + 1) * POR_PAGINA >= total ? 'not-allowed' : 'pointer', color: JA.TEXT, fontFamily: 'Inter, sans-serif' }}>
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Componente: TablaMovimientos (sin conciliar)
   ══════════════════════════════════════════════════════════════════════════ */
function TablaMovimientos({ movimientos, titulo }: { movimientos: MovimientoBancario[]; titulo: string }) {
  const [pag, setPag] = useState(0)
  const POR_PAGINA = 15
  const slice = movimientos.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA)

  if (movimientos.length === 0) return null

  return (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: JA.TEXT, fontFamily: 'Inter, sans-serif', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={14} color={JA.YELLOW} />
        {titulo} ({fmt(movimientos.length)})
      </h4>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
          <thead>
            <tr style={{ background: JA.BG, borderBottom: `2px solid ${JA.BORDER}` }}>
              {['Fecha', 'Descripción', 'Tipo', 'Monto', 'Referencia'].map(h => (
                <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Monto' ? 'right' : 'left', fontWeight: 700, color: JA.GREY, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((m, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${JA.BORDER}` }}>
                <td style={{ padding: '7px 10px', color: JA.TEXT, whiteSpace: 'nowrap' }}>{m.fecha}</td>
                <td style={{ padding: '7px 10px', color: JA.TEXT, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.descripcion}</td>
                <td style={{ padding: '7px 10px', color: m.tipo === 'credito' ? JA.GREEN : JA.RED }}>{m.tipo}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: m.tipo === 'credito' ? JA.GREEN : JA.RED }}>{COP(m.monto)}</td>
                <td style={{ padding: '7px 10px', color: JA.GREY_LT, fontSize: 11 }}>{m.referencia ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {movimientos.length > POR_PAGINA && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
          <button disabled={pag === 0} onClick={() => setPag(p => p - 1)} style={{ fontSize: 11, padding: '4px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: 2, background: JA.WHITE, cursor: 'pointer', fontFamily: 'Inter, sans-serif', color: JA.TEXT }}>← Prev</button>
          <span style={{ fontSize: 11, color: JA.GREY_LT, alignSelf: 'center', fontFamily: 'Inter, sans-serif' }}>{pag + 1}/{Math.ceil(movimientos.length / POR_PAGINA)}</span>
          <button disabled={(pag + 1) * POR_PAGINA >= movimientos.length} onClick={() => setPag(p => p + 1)} style={{ fontSize: 11, padding: '4px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: 2, background: JA.WHITE, cursor: 'pointer', fontFamily: 'Inter, sans-serif', color: JA.TEXT }}>Sig →</button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Componente: TablaDiscrepancias
   ══════════════════════════════════════════════════════════════════════════ */
function TablaDiscrepancias({ discrepancias }: { discrepancias: Discrepancia[] }) {
  if (discrepancias.length === 0) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: JA.GREEN, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        <CheckCircle2 size={24} style={{ marginBottom: 8 }} />
        <div>No se detectaron discrepancias</div>
      </div>
    )
  }

  const SEV_COLOR: Record<string, string> = { alta: JA.RED, media: JA.YELLOW, baja: JA.BLUE }
  const TIPO_COLOR: Record<string, string> = {
    pago_sin_factura: JA.YELLOW, debito_sin_soporte: JA.RED, factura_sin_pago: JA.BLUE,
    nota_credito_pendiente: JA.GOLD, diferencia_monto: JA.RED,
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
      <thead>
        <tr style={{ background: JA.BG, borderBottom: `2px solid ${JA.BORDER}` }}>
          {['Severidad', 'Tipo', 'Descripción', 'Monto', 'Fecha', 'Recomendación'].map(h => (
            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: JA.GREY, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {discrepancias.map((d, i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${JA.BORDER}` }}>
            <td style={{ padding: '8px 10px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: JA.WHITE, background: SEV_COLOR[d.severidad] ?? JA.GREY, padding: '2px 6px', borderRadius: 2 }}>{d.severidad}</span>
            </td>
            <td style={{ padding: '8px 10px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: JA.WHITE, background: TIPO_COLOR[d.tipo] ?? JA.GREY, padding: '2px 6px', borderRadius: 2 }}>{d.tipo.replace(/_/g, ' ')}</span>
            </td>
            <td style={{ padding: '8px 10px', color: JA.TEXT, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.descripcion}</td>
            <td style={{ padding: '8px 10px', color: JA.GREY, textAlign: 'right' }}>{d.montoInvolucrado != null ? COP(d.montoInvolucrado) : '—'}</td>
            <td style={{ padding: '8px 10px', color: JA.GREY_LT, whiteSpace: 'nowrap' }}>{d.fechaDeteccion}</td>
            <td style={{ padding: '8px 10px', color: JA.GREY, fontSize: 11, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.recomendacion}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Componente: PanelIva
   ══════════════════════════════════════════════════════════════════════════ */
function PanelIva({ resumen }: { resumen: ResultadoConciliacion['resumenIva'] }) {
  if (!resumen) return <div style={{ padding: 24, color: JA.GREY_LT, fontFamily: 'Inter, sans-serif', fontSize: 13 }}>IVA no calculado (sin facturas o desactivado)</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <KpiCard title="IVA Generado" value={COP(resumen.totalIvaGenerado)} sub={`Base: ${COP(resumen.totalBaseVentas)}`} color={JA.GREEN} icon={<TrendingUp size={16} />} />
        <KpiCard title="IVA Descontable" value={COP(resumen.totalIvaDescontable)} sub={`Base: ${COP(resumen.totalBaseCompras)}`} color={JA.BLUE} icon={<TrendingDown size={16} />} />
        <KpiCard title={resumen.saldoAPagar > 0 ? 'Saldo a Pagar' : 'Saldo a Favor'} value={COP(resumen.saldoAPagar > 0 ? resumen.saldoAPagar : resumen.saldoAFavor)} sub={resumen.saldoAPagar > 0 ? 'IVA neto por declarar' : 'Saldo a su favor'} color={resumen.saldoAPagar > 0 ? JA.RED : JA.GREEN} icon={<Scale size={16} />} />
      </div>

      <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2 }}>
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${JA.BORDER}`, fontWeight: 700, fontSize: 12, color: JA.TEXT, fontFamily: 'Inter, sans-serif' }}>Detalle por tarifa</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
          <thead>
            <tr style={{ background: JA.BG }}>
              {['Tipo', 'Tarifa', 'N° Facturas', 'Base Gravable', 'Valor IVA'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: h.startsWith('N°') || h === 'Base Gravable' || h === 'Valor IVA' ? 'right' : 'left', fontWeight: 700, color: JA.GREY, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...resumen.lineasGenerado.map(l => ({ ...l, cls: 'gen' })), ...resumen.lineasDescontable.map(l => ({ ...l, cls: 'desc' }))].map((l, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${JA.BORDER}` }}>
                <td style={{ padding: '7px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, color: JA.WHITE, background: l.cls === 'gen' ? JA.GREEN : JA.BLUE, padding: '2px 6px', borderRadius: 2 }}>{l.tipo}</span></td>
                <td style={{ padding: '7px 12px', color: JA.TEXT }}>{l.tarifa}%</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', color: JA.GREY }}>{l.numFacturas}</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600, color: JA.TEXT }}>{COP(l.baseGravable)}</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: l.cls === 'gen' ? JA.GREEN : JA.BLUE }}>{COP(l.valorIva)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resumen.ivaBimestral > 0 && (
        <div style={{ padding: '10px 16px', background: JA.YELLOW_LT, border: `1px solid ${JA.YELLOW}22`, borderRadius: 2, fontSize: 12, color: JA.TEXT, fontFamily: 'Inter, sans-serif' }}>
          <strong>Periodicidad estimada:</strong> Bimestral {COP(resumen.ivaBimestral)} · Cuatrimestral {COP(resumen.ivaCuatrimestral)}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Componente: PanelRfte
   ══════════════════════════════════════════════════════════════════════════ */
function PanelRfte({ resumen }: { resumen: ResultadoConciliacion['resumenRetefuente'] }) {
  if (!resumen) return <div style={{ padding: 24, color: JA.GREY_LT, fontFamily: 'Inter, sans-serif', fontSize: 13 }}>Retefuente no calculada</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <KpiCard title="Total Practicado" value={COP(resumen.totalPracticado)} sub="Empresa retiene a proveedores" color={JA.GOLD} icon={<Banknote size={16} />} />
        <KpiCard title="Total Sufrido" value={COP(resumen.totalSufrido)} sub="Clientes retienen a empresa" color={JA.BLUE} icon={<Receipt size={16} />} />
        <KpiCard title="Saldo Neto" value={COP(resumen.saldoNeto)} sub={resumen.saldoNeto >= 0 ? 'A declarar' : 'A recuperar'} color={resumen.saldoNeto >= 0 ? JA.GREEN : JA.RED} icon={<Scale size={16} />} />
      </div>

      <div style={{ fontSize: 11, color: JA.GREY, fontFamily: 'Inter, sans-serif', padding: '6px 12px', background: JA.BG, borderRadius: 2 }}>
        UVT 2026 vigente: <strong>${fmt(resumen.uvtVigente)}</strong> (Res. DIAN 000238/2025) · Decreto 1625/2016 + Comunicado DIAN 070/2026
      </div>

      <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'Inter, sans-serif' }}>
          <thead>
            <tr style={{ background: JA.BG, borderBottom: `2px solid ${JA.BORDER}` }}>
              {['Código', 'Concepto', 'Tarifa', 'Base Mín.', 'Base Practicada', 'Valor Practicado', 'Transacc.', 'Base Sufrida', 'Valor Sufrido'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: JA.GREY, fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumen.conceptos.map((c, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${JA.BORDER}` }}>
                <td style={{ padding: '7px 10px', color: JA.NAVY, fontWeight: 700 }}>{c.codigoConcepto}</td>
                <td style={{ padding: '7px 10px', color: JA.TEXT, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</td>
                <td style={{ padding: '7px 10px', color: JA.GREY }}>{c.tarifaPct}%</td>
                <td style={{ padding: '7px 10px', color: JA.GREY_LT }}>{c.baseMinimaUvt} UVT</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: JA.TEXT }}>{COP(c.basePracticada)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: JA.GOLD }}>{COP(c.valorPracticado)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: JA.GREY }}>{c.numTransPracticadas}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: JA.TEXT }}>{COP(c.baseSufrida)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: JA.BLUE }}>{COP(c.valorSufrido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Componente: PanelIca
   ══════════════════════════════════════════════════════════════════════════ */
function PanelIca({ resumen }: { resumen: ResultadoConciliacion['resumenIca'] }) {
  if (!resumen) return <div style={{ padding: 24, color: JA.GREY_LT, fontFamily: 'Inter, sans-serif', fontSize: 13 }}>ICA no calculado</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <KpiCard title="Ingresos Brutos" value={COP(resumen.totalIngresosBrutos)} sub={resumen.municipio} color={JA.NAVY} icon={<TrendingUp size={16} />} />
        <KpiCard title="Base Gravable" value={COP(resumen.totalBaseGravable)} sub={`Excluidos: ${COP(resumen.totalIngresosExcluidos)}`} color={JA.GOLD} icon={<Scale size={16} />} />
        <KpiCard title="ICA Estimado" value={COP(resumen.totalImpuestoEstimado)} sub="Acuerdo 065/2002 Bogotá" color={JA.RED} icon={<Receipt size={16} />} />
      </div>

      <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
          <thead>
            <tr style={{ background: JA.BG, borderBottom: `2px solid ${JA.BORDER}` }}>
              {['CIIU', 'Descripción', 'Municipio', 'Tarifa x Mil', 'Base Gravable', 'Impuesto Est.', 'N° Fact.'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: JA.GREY, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumen.actividades.map((a, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${JA.BORDER}` }}>
                <td style={{ padding: '8px 12px', color: JA.NAVY, fontWeight: 700 }}>{a.ciiu}</td>
                <td style={{ padding: '8px 12px', color: JA.TEXT }}>{a.descripcion}</td>
                <td style={{ padding: '8px 12px', color: JA.GREY }}>{a.municipio}</td>
                <td style={{ padding: '8px 12px', color: JA.GREY }}>{a.tarifaPorMil}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: JA.TEXT }}>{COP(a.baseGravable)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: JA.RED }}>{COP(a.impuestoEstimado)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: JA.GREY }}>{a.numFacturas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Componente: PanelConciliacionBancaria
   Formato oficial colombiano de conciliación bancaria.
   ══════════════════════════════════════════════════════════════════════════ */
function FilaPartida({ p }: { p: PartidaConciliatoria }) {
  const TIPO_LABEL: Record<string, string> = {
    deposito_transito:  'Depósito en tránsito',
    cheque_circulacion: 'Cheque/Pago pendiente',
    nota_debito_banco:  'Nota débito banco',
    nota_credito_banco: 'Nota crédito banco',
    error_registro:     'Error de registro',
  }
  const TIPO_COLOR: Record<string, string> = {
    deposito_transito:  JA.BLUE,
    cheque_circulacion: JA.YELLOW,
    nota_debito_banco:  JA.RED,
    nota_credito_banco: JA.GREEN,
    error_registro:     JA.GOLD,
  }
  return (
    <tr style={{ borderBottom: `1px solid ${JA.BORDER}` }}>
      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: JA.GREY_LT, fontSize: 11 }}>{p.fecha}</td>
      <td style={{ padding: '6px 10px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: JA.WHITE, background: TIPO_COLOR[p.tipo] ?? JA.GREY, padding: '2px 6px', borderRadius: 2 }}>
          {TIPO_LABEL[p.tipo] ?? p.tipo}
        </span>
      </td>
      <td style={{ padding: '6px 10px', color: JA.TEXT, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{p.descripcion}</td>
      <td style={{ padding: '6px 10px', color: JA.GREY_LT, fontSize: 11 }}>{p.cuentaContable ?? '—'}</td>
      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: JA.TEXT, fontSize: 12 }}>{COP(p.monto)}</td>
    </tr>
  )
}

function FilaConciliacion({ label, monto, esTotal, signo, indent }: {
  label: string; monto: number; esTotal?: boolean; signo?: '+' | '-'; indent?: boolean
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: esTotal ? '10px 16px' : '6px 16px',
      background: esTotal ? JA.BG : JA.WHITE,
      borderTop: esTotal ? `2px solid ${JA.BORDER}` : undefined,
      fontFamily: 'Inter, sans-serif',
    }}>
      <span style={{
        fontSize: esTotal ? 13 : 12, fontWeight: esTotal ? 800 : 400,
        color: esTotal ? JA.NAVY : JA.TEXT,
        paddingLeft: indent ? 20 : 0,
      }}>
        {signo && <span style={{ color: signo === '+' ? JA.GREEN : JA.RED, marginRight: 6 }}>{signo}</span>}
        {label}
      </span>
      <span style={{ fontSize: esTotal ? 14 : 12, fontWeight: esTotal ? 800 : 600, color: esTotal ? JA.NAVY : JA.TEXT }}>
        {COP(monto)}
      </span>
    </div>
  )
}

function PanelConciliacionBancaria({ r }: { r: ResumenConciliacionBancaria }) {
  const concilia = r.diferencia <= 100   // tolerancia $100 para errores de redondeo
  const todasPartidas = [
    ...r.depositosTransito, ...r.chequesPendientes,
    ...r.notasDebitoBanco,  ...r.notasCreditoBanco, ...r.erroresRegistro,
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPIs superiores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <KpiCard title="Saldo Según Banco" value={COP(r.saldoSegunBanco)}
          sub={`${r.totalMovimientosBanco} movimientos extracto`} color={JA.NAVY} icon={<Banknote size={16} />} />
        <KpiCard title="Saldo Según Libros" value={COP(r.saldoSegunLibros)}
          sub={`${r.totalMovimientosSiigoBanco} mov. cuentas banco Siigo`} color={JA.BLUE} icon={<FileCheck size={16} />} />
        <KpiCard
          title={concilia ? 'Concilia' : 'Diferencia'}
          value={concilia ? '✓ $0' : COP(r.diferencia)}
          sub={concilia ? 'Saldos ajustados iguales' : 'Revisar partidas abajo'}
          color={concilia ? JA.GREEN : JA.RED}
          icon={concilia ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        />
        <KpiCard title="Partidas Conciliatorias" value={String(todasPartidas.length)}
          sub={`${r.depositosTransito.length} dep. + ${r.chequesPendientes.length} chq. + ${r.notasDebitoBanco.length + r.notasCreditoBanco.length} notas`}
          color={JA.GOLD} icon={<Scale size={16} />} />
      </div>

      {/* Formato T: lado banco + lado libros */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Columna BANCO */}
        <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: JA.NAVY, color: JA.WHITE, fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
            Extracto Bancario{r.cuentaBancaria ? ` — Cta. ${r.cuentaBancaria}` : ''}
          </div>
          <FilaConciliacion label="Saldo según extracto" monto={r.saldoSegunBanco} esTotal />
          {r.depositosTransito.length > 0 && (
            <FilaConciliacion
              label={`Menos: Depósitos en tránsito (${r.depositosTransito.length})`}
              monto={r.totalDepositosTransito} signo="-" indent
            />
          )}
          {r.chequesPendientes.length > 0 && (
            <FilaConciliacion
              label={`Más: Cheques/pagos pendientes (${r.chequesPendientes.length})`}
              monto={r.totalChequesPendientes} signo="+" indent
            />
          )}
          <FilaConciliacion label="Saldo ajustado banco" monto={r.saldoAjustadoBanco} esTotal />
        </div>

        {/* Columna LIBROS */}
        <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: JA.BLUE, color: JA.WHITE, fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
            Libros Contables (Siigo)
          </div>
          <FilaConciliacion label="Saldo según libros" monto={r.saldoSegunLibros} esTotal />
          {r.notasDebitoBanco.length > 0 && (
            <FilaConciliacion
              label={`Menos: Notas débito banco (${r.notasDebitoBanco.length})`}
              monto={r.totalNotasDebito} signo="-" indent
            />
          )}
          {r.notasCreditoBanco.length > 0 && (
            <FilaConciliacion
              label={`Más: Notas crédito banco (${r.notasCreditoBanco.length})`}
              monto={r.totalNotasCredito} signo="+" indent
            />
          )}
          <FilaConciliacion label="Saldo ajustado libros" monto={r.saldoAjustadoLibros} esTotal />
        </div>
      </div>

      {/* Banner diferencia */}
      {!concilia && (
        <div style={{ padding: '12px 16px', background: JA.RED_LT, border: `1px solid ${JA.RED}44`, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} color={JA.RED} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: JA.RED, fontFamily: 'Inter, sans-serif' }}>
            <strong>Diferencia sin explicar: {COP(r.diferencia)}.</strong> Revise si hay partidas no clasificadas, errores de digitación o movimientos fuera del período.
          </span>
        </div>
      )}
      {concilia && (
        <div style={{ padding: '12px 16px', background: JA.GREEN_LT, border: `1px solid ${JA.GREEN}44`, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 size={16} color={JA.GREEN} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: JA.GREEN, fontFamily: 'Inter, sans-serif' }}>
            <strong>¡Concilia perfectamente!</strong> Los saldos ajustados de banco y libros son iguales.
          </span>
        </div>
      )}

      {/* Tabla detalle partidas */}
      {todasPartidas.length > 0 && (
        <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${JA.BORDER}`, fontSize: 12, fontWeight: 700, color: JA.TEXT, fontFamily: 'Inter, sans-serif' }}>
            Detalle de Partidas Conciliatorias ({todasPartidas.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
              <thead>
                <tr style={{ background: JA.BG }}>
                  {['Fecha', 'Tipo', 'Descripción', 'Cuenta', 'Monto'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Monto' ? 'right' : 'left', fontWeight: 700, color: JA.GREY, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `2px solid ${JA.BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todasPartidas.map((p, i) => <FilaPartida key={i} p={p} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {r.totalMovimientosSiigoBanco === 0 && (
        <div style={{ padding: '10px 14px', background: JA.YELLOW_LT, border: `1px solid ${JA.YELLOW}33`, borderRadius: 2, fontSize: 12, color: JA.GREY, fontFamily: 'Inter, sans-serif' }}>
          <strong>Sin movimientos de cuentas bancarias en Siigo.</strong> Cargue el Libro Auxiliar de Siigo (Mov. aux cuenta contable) para obtener la conciliación completa banco vs. libros.
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Página principal
   ══════════════════════════════════════════════════════════════════════════ */
export default function ConciliacionesPage() {
  const [paso, setPaso] = useState<Paso>(1)
  const [cfg, setCfg] = useState<Config>(cfgDefault)
  const [archivoBanco, setArchivoBanco] = useState<File[]>([])
  const [archivosXml, setArchivosXml] = useState<File[]>([])
  const [archivosSiigo, setArchivosSiigo] = useState<File[]>([])
  const [resultado, setResultado] = useState<ResultadoConciliacion | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tabTrib, setTabTrib] = useState<'iva' | 'rfte' | 'ica'>('iva')

  const setCfgField = (k: keyof Config, v: string | boolean) =>
    setCfg(prev => ({ ...prev, [k]: v }))

  /* ── Procesar ── */
  const procesar = async () => {
    if (archivoBanco.length === 0 && archivosXml.length === 0) {
      setError('Debe cargar al menos el extracto bancario o facturas DIAN')
      return
    }
    setCargando(true); setError(null)
    try {
      const fd = new FormData()
      Object.entries(cfg).forEach(([k, v]) => fd.append(k, String(v)))
      if (archivoBanco[0]) fd.append('banco_archivo', archivoBanco[0])
      archivosXml.forEach(f => fd.append('dian_xmls', f))
      archivosSiigo.forEach(f => fd.append('siigo_archivos', f))

      const res = await fetch('/api/conciliaciones/procesar', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detalle ?? err.error ?? 'Error del servidor')
      }
      const data: ResultadoConciliacion = await res.json()
      setResultado(data)
      setPaso(2)
    } catch (e) {
      setError(String(e))
    } finally {
      setCargando(false)
    }
  }

  /* ── Exportar Excel ── */
  const exportarExcel = async () => {
    if (!resultado) return
    setCargando(true)
    try {
      const res = await fetch('/api/conciliaciones/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultado),
      })
      if (!res.ok) throw new Error('Error generando Excel')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Conciliacion_${cfg.nombreEmpresa.replace(/\s+/g, '_') || 'empresa'}_${cfg.periodoInicio?.slice(0, 7) ?? 'periodo'}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(String(e))
    } finally {
      setCargando(false)
    }
  }

  /* ── Tabs de pasos ── */
  const PASOS: { n: Paso; label: string; icon: React.ReactNode }[] = [
    { n: 1, label: 'Cargar Archivos', icon: <Upload size={14} /> },
    { n: 2, label: 'Conciliación', icon: <FileCheck size={14} /> },
    { n: 3, label: 'Tributario', icon: <Receipt size={14} /> },
    { n: 4, label: 'Exportar', icon: <Download size={14} /> },
  ]

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: JA.BG, minHeight: '100vh', padding: '24px 0' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 24px' }}>

        {/* ── Cabecera ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 4, height: 28, background: JA.GOLD, borderRadius: 2 }} />
            <h1 style={{ fontSize: 20, fontWeight: 800, color: JA.NAVY, margin: 0 }}>
              Conciliaciones Bancarias y Tributario DIAN
            </h1>
            <span style={{ fontSize: 10, fontWeight: 700, color: JA.GOLD, background: JA.GOLD_LT, padding: '2px 8px', borderRadius: 2, border: `1px solid ${JA.GOLD}44` }}>BETA</span>
          </div>
          <p style={{ fontSize: 12, color: JA.GREY_LT, margin: 0, paddingLeft: 14 }}>
            Motor de conciliación 4 etapas · IVA, Retefuente (Comunicado DIAN 070/2026) e ICA Bogotá · UVT 2026 $52.374
          </p>
        </div>

        {/* ── Pestañas de pasos ── */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: JA.WHITE, padding: 4, borderRadius: 2, border: `1px solid ${JA.BORDER}` }}>
          {PASOS.map(({ n, label, icon }) => {
            const activo = paso === n
            const habilitado = n === 1 || (resultado !== null)
            return (
              <button
                key={n}
                onClick={() => habilitado && setPaso(n)}
                disabled={!habilitado}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 12px', borderRadius: 2, border: 'none', cursor: habilitado ? 'pointer' : 'not-allowed',
                  background: activo ? JA.NAVY : 'transparent',
                  color: activo ? JA.WHITE : habilitado ? JA.GREY : JA.GREY_LT,
                  fontSize: 12, fontWeight: activo ? 700 : 500, fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                {icon}
                <span>{n}. {label}</span>
                {resultado && n > 1 && n !== paso && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
              </button>
            )
          })}
        </div>

        {/* ── Error global ── */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: JA.RED_LT, border: `1px solid ${JA.RED}44`, borderRadius: 2, marginBottom: 16 }}>
            <AlertTriangle size={16} color={JA.RED} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: JA.RED }}>Error</div>
              <div style={{ fontSize: 12, color: JA.RED, marginTop: 2 }}>{error}</div>
            </div>
            <button onClick={() => setError(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: JA.RED }}><X size={14} /></button>
          </div>
        )}

        {/* ═══════════════════ PASO 1: Cargar ═════════════════════════════════ */}
        {paso === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* Configuración */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2, padding: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: JA.NAVY, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={14} color={JA.GOLD} />
                Configuración del período
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {[
                  { label: 'Período inicio', key: 'periodoInicio', type: 'date' },
                  { label: 'Período fin', key: 'periodoFin', type: 'date' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: JA.TEXT, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                    <input
                      type={type}
                      value={cfg[key as keyof Config] as string}
                      onChange={e => setCfgField(key as keyof Config, e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: `1px solid ${JA.BORDER}`, borderRadius: 2, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {[
                  { label: 'NIT empresa', key: 'nitEmpresa', placeholder: '900123456' },
                  { label: 'Nombre empresa', key: 'nombreEmpresa', placeholder: 'Mi Empresa S.A.S.' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: JA.TEXT, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                    <input
                      type="text"
                      placeholder={placeholder}
                      value={cfg[key as keyof Config] as string}
                      onChange={e => setCfgField(key as keyof Config, e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: `1px solid ${JA.BORDER}`, borderRadius: 2, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: JA.TEXT, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Banco</label>
                <select
                  value={cfg.banco}
                  onChange={e => setCfgField('banco', e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: `1px solid ${JA.BORDER}`, borderRadius: 2, fontFamily: 'Inter, sans-serif', outline: 'none' }}
                >
                  {Object.entries(FORMATOS_BANCO).map(([k, v]) => (
                    <option key={k} value={k}>{v.nombre}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: JA.TEXT, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Municipio ICA</label>
                <input
                  type="text"
                  value={cfg.municipioIca}
                  onChange={e => setCfgField('municipioIca', e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: `1px solid ${JA.BORDER}`, borderRadius: 2, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: JA.TEXT, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CIIU principal (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: 6201"
                  value={cfg.ciuuPrincipal}
                  onChange={e => setCfgField('ciuuPrincipal', e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: `1px solid ${JA.BORDER}`, borderRadius: 2, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Parámetros motor */}
              <div style={{ borderTop: `1px solid ${JA.BORDER}`, paddingTop: 14, marginBottom: 14 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: JA.GREY, margin: '0 0 10px 0' }}>Parámetros del motor</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Tolerancia montos %', key: 'toleranciaMontosPct', placeholder: '0.001' },
                    { label: 'Tolerancia días', key: 'toleranciaDias', placeholder: '5' },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: JA.GREY, display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>{label}</label>
                      <input
                        type="number"
                        step="any"
                        placeholder={placeholder}
                        value={cfg[key as keyof Config] as string}
                        onChange={e => setCfgField(key as keyof Config, e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: `1px solid ${JA.BORDER}`, borderRadius: 2, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Módulos tributarios */}
              <div style={{ borderTop: `1px solid ${JA.BORDER}`, paddingTop: 14 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: JA.GREY, margin: '0 0 10px 0' }}>Módulos tributarios</h4>
                {[
                  { label: 'Calcular IVA', key: 'calcularIva' },
                  { label: 'Calcular Retefuente', key: 'calcularRfte' },
                  { label: 'Calcular ICA', key: 'calcularIca' },
                ].map(({ label, key }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={cfg[key as keyof Config] as boolean}
                      onChange={e => setCfgField(key as keyof Config, e.target.checked)}
                      style={{ accentColor: JA.GOLD, width: 14, height: 14 }}
                    />
                    <span style={{ fontSize: 12, color: JA.TEXT, fontFamily: 'Inter, sans-serif' }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Archivos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: JA.NAVY, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Banknote size={14} color={JA.GOLD} />
                  Extracto Bancario
                </h3>
                <FileDropZone
                  label="Archivo banco (PDF / Excel / CSV)"
                  accept=".pdf,.xlsx,.xls,.csv"
                  files={archivoBanco}
                  onChange={setArchivoBanco}
                  hint="PDF nativo del banco, Excel o CSV — Bancolombia, Davivienda, BBVA, Bogotá, personalizado. Los PDFs escaneados (imágenes) no son compatibles."
                />
              </div>

              <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: JA.NAVY, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={14} color={JA.GOLD} />
                  Facturas DIAN (XML UBL 2.1)
                </h3>
                <FileDropZone
                  label="XMLs de facturación electrónica"
                  accept=".xml,.zip"
                  multiple
                  files={archivosXml}
                  onChange={setArchivosXml}
                  hint="Facturas, notas crédito/débito. Puede cargar ZIPs del portal DIAN"
                />
              </div>

              <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: JA.NAVY, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileCheck size={14} color={JA.GOLD} />
                  Siigo (opcional)
                </h3>
                <FileDropZone
                  label="Exportaciones Siigo"
                  accept=".xlsx,.xls,.csv"
                  multiple
                  files={archivosSiigo}
                  onChange={setArchivosSiigo}
                  hint="Cartera, CxP, movimientos — mejora el matching"
                />
              </div>

              {/* Nota normativa */}
              <div style={{ padding: '10px 14px', background: JA.BLUE_LT, border: `1px solid ${JA.BLUE}22`, borderRadius: 2, display: 'flex', gap: 8 }}>
                <Info size={14} color={JA.BLUE} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 11, color: JA.BLUE, fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
                  <strong>Normatividad 2026:</strong> Retefuente según Decreto 1625/2016 restaurado por Comunicado DIAN No. 070 (vigente desde 8 mayo 2026). Todas las facturas electrónicas en COP (Res. 000165/2023 + 000202/2025).
                </div>
              </div>

              <button
                onClick={procesar}
                disabled={cargando}
                style={{
                  width: '100%', padding: '12px 0', border: 'none', borderRadius: 2,
                  background: cargando ? JA.GREY_LT : JA.NAVY, color: JA.WHITE,
                  fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                  cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}
              >
                {cargando ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Procesando…</> : <><FileCheck size={14} /> Procesar Conciliación</>}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════ PASO 2: Conciliación ════════════════════════════ */}
        {paso === 2 && resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Conciliación Bancaria Formal */}
            {resultado.resumenConciliacionBancaria && (
              <div style={{ background: JA.WHITE, border: `2px solid ${JA.GOLD}`, borderRadius: 2 }}>
                <div style={{ padding: '12px 20px', borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 20, background: JA.GOLD, borderRadius: 2 }} />
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: JA.NAVY, fontFamily: 'Inter, sans-serif' }}>
                    Conciliación Bancaria
                  </h3>
                  <span style={{ fontSize: 10, fontWeight: 700, color: JA.GOLD, background: JA.GOLD_LT, padding: '2px 8px', borderRadius: 2, border: `1px solid ${JA.GOLD}44` }}>
                    FORMATO OFICIAL
                  </span>
                </div>
                <div style={{ padding: 20 }}>
                  <PanelConciliacionBancaria r={resultado.resumenConciliacionBancaria} />
                </div>
              </div>
            )}

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <KpiCard title="Créditos Banco" value={COP(resultado.kpis.totalBancoCreditos)} color={JA.GREEN} icon={<TrendingUp size={16} />} />
              <KpiCard title="Débitos Banco" value={COP(resultado.kpis.totalBancoDebitos)} color={JA.RED} icon={<TrendingDown size={16} />} />
              <KpiCard title="Ventas Facturadas" value={COP(resultado.kpis.totalFacturasVentas)} color={JA.GOLD} icon={<Receipt size={16} />} />
              <KpiCard title="% Conciliado Banco" value={PCT(resultado.kpis.porcentajeConciliadoBanco)} sub={`${resultado.kpis.numBancoConciliados} de ${resultado.kpis.numBancoConciliados + resultado.kpis.numBancoNoConciliados}`} color={resultado.kpis.porcentajeConciliadoBanco >= 80 ? JA.GREEN : JA.YELLOW} icon={<FileCheck size={16} />} />
              <KpiCard title="% Conciliado Facturas" value={PCT(resultado.kpis.porcentajeConciliadoFacturas)} sub={`${resultado.kpis.numFacturasConciliadas} de ${resultado.kpis.numFacturasConciliadas + resultado.kpis.numFacturasNoConciliadas}`} color={resultado.kpis.porcentajeConciliadoFacturas >= 80 ? JA.GREEN : JA.YELLOW} icon={<Scale size={16} />} />
            </div>

            {/* Matches conciliados */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2 }}>
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${JA.BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: JA.TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={14} color={JA.GREEN} />
                  Transacciones Conciliadas ({fmt(resultado.matches.length)})
                </h3>
              </div>
              <div style={{ padding: 20 }}>
                <TablaMatches matches={resultado.matches} resultado={resultado} />
              </div>
            </div>

            {/* Sin conciliar */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2 }}>
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${JA.BORDER}` }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: JA.TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={14} color={JA.YELLOW} />
                  Sin Conciliar
                </h3>
              </div>
              <div style={{ padding: 20 }}>
                <TablaMovimientos
                  movimientos={resultado.movimientosBanco.filter(m => m.estado !== 'conciliado')}
                  titulo="Movimientos banco sin conciliar"
                />
                {resultado.movimientosBanco.filter(m => m.estado !== 'conciliado').length === 0 && (
                  <div style={{ padding: '16px 0', textAlign: 'center', color: JA.GREEN, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
                    <CheckCircle2 size={20} style={{ marginBottom: 6 }} />
                    <div>Todos los movimientos bancarios fueron conciliados</div>
                  </div>
                )}
              </div>
            </div>

            {/* Discrepancias */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2 }}>
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${JA.BORDER}` }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: JA.TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={14} color={JA.RED} />
                  Discrepancias Detectadas ({resultado.discrepancias.length})
                </h3>
              </div>
              <div style={{ padding: 20 }}>
                <TablaDiscrepancias discrepancias={resultado.discrepancias} />
              </div>
            </div>

            {/* Warnings del log */}
            {resultado.logProceso.filter(l => l.startsWith('⚠️')).length > 0 && (
              <div style={{ padding: '12px 16px', background: JA.YELLOW_LT, border: `1px solid ${JA.YELLOW}33`, borderRadius: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: JA.YELLOW, marginBottom: 6 }}>Advertencias de ingesta</div>
                {resultado.logProceso.filter(l => l.startsWith('⚠️')).map((l, i) => (
                  <div key={i} style={{ fontSize: 11, color: JA.GREY, fontFamily: 'Inter, sans-serif', marginBottom: 2 }}>{l}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ PASO 3: Tributario ══════════════════════════════ */}
        {paso === 3 && resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 2, background: JA.WHITE, padding: 4, borderRadius: 2, border: `1px solid ${JA.BORDER}` }}>
              {([
                { k: 'iva', label: 'IVA', activo: cfg.calcularIva },
                { k: 'rfte', label: 'Retefuente', activo: cfg.calcularRfte },
                { k: 'ica', label: 'ICA', activo: cfg.calcularIca },
              ] as const).map(({ k, label, activo }) => (
                <button
                  key={k}
                  onClick={() => setTabTrib(k)}
                  style={{
                    flex: 1, padding: '8px 0', border: 'none', borderRadius: 2, cursor: 'pointer',
                    background: tabTrib === k ? JA.GOLD : 'transparent',
                    color: tabTrib === k ? JA.WHITE : activo ? JA.GREY : JA.GREY_LT,
                    fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                  }}
                >
                  {label} {!activo && '(desactivado)'}
                </button>
              ))}
            </div>

            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2, padding: 20 }}>
              {tabTrib === 'iva' && <PanelIva resumen={resultado.resumenIva} />}
              {tabTrib === 'rfte' && <PanelRfte resumen={resultado.resumenRetefuente} />}
              {tabTrib === 'ica' && <PanelIca resumen={resultado.resumenIca} />}
            </div>
          </div>
        )}

        {/* ═══════════════════ PASO 4: Exportar ════════════════════════════════ */}
        {paso === 4 && resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, background: JA.GOLD_LT, border: `2px solid ${JA.GOLD}44`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Download size={24} color={JA.GOLD} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: JA.NAVY, margin: '0 0 4px 0' }}>Exportar Informe Completo</h3>
                <p style={{ fontSize: 12, color: JA.GREY_LT, margin: 0 }}>
                  Excel con 9 hojas: Portada, Conciliación, Sin Conciliar, Facturas DIAN, IVA, Retefuente, ICA, Discrepancias, Log Auditoría
                </p>
              </div>
              <button
                onClick={exportarExcel}
                disabled={cargando}
                style={{
                  padding: '10px 32px', border: 'none', borderRadius: 2,
                  background: cargando ? JA.GREY_LT : JA.GOLD, color: JA.WHITE,
                  fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                  cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'background 0.15s',
                }}
              >
                <Download size={14} />
                {cargando ? 'Generando…' : 'Descargar Excel (.xlsx)'}
              </button>
            </div>

            {/* Log completo */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: 2 }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${JA.BORDER}`, fontWeight: 700, fontSize: 12, color: JA.TEXT, fontFamily: 'Inter, sans-serif' }}>
                Log de proceso ({resultado.logProceso.length} entradas)
              </div>
              <div style={{ padding: 16, maxHeight: 400, overflowY: 'auto', background: '#0F172A', borderRadius: '0 0 2px 2px' }}>
                {resultado.logProceso.map((l, i) => (
                  <div key={i} style={{ fontSize: 11, color: l.startsWith('⚠️') ? '#FCD34D' : '#94A3B8', fontFamily: 'monospace', lineHeight: 1.8 }}>
                    <span style={{ color: '#475569', marginRight: 8 }}>{String(i + 1).padStart(3, '0')}</span>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
