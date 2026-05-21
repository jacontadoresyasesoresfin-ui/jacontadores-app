'use client'
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useClient } from '../ClientContext'
import type { TarjetaExcepcion, AccionExcepcion } from '@/lib/exogenas/engine/humanizador'

// ── Paleta J&A ────────────────────────────────────────────────────────────────
const JA = {
  NAVY: '#13213C', GOLD: '#B8960C', GOLD_LT: '#D4A843',
  TEXT: '#1C2B45', GREY: '#4B5563', BORDER: '#E5E7EB', BG: '#F8FAFC',
  WHITE: '#FFFFFF', RED: '#DC2626', GREEN: '#059669', AMBER: '#D97706',
  BLUE: '#2563EB', SURFACE: '#F1F5F9', RED_BG: '#FEF2F2', GREEN_BG: '#F0FDF4',
  AMBER_BG: '#FFFBEB', BLUE_BG: '#EFF6FF',
}
const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmtCOP = (n: number) => COP.format(n)

// ── Tipos de estado de UI ─────────────────────────────────────────────────────
type Vista = 'inicio' | 'procesando' | 'resumen' | 'excepciones' | 'listo'

interface ResumenFormato {
  codigo: string; nombre: string; totalFilas: number
  totales: Record<string, number>
  excepcionesCriticas: number; excepcionesMedia: number
}

interface ResumenExcepciones {
  criticas: number; alertas: number; informativas: number; descripcionResumen: string
}

interface ResultadoGeneral {
  asientosProcesados: number
  advertenciasCsv: string[]
  metaCsv: { empresa?: string; periodo?: string }
  cuentasSinRegla: string[]
  resumenFormatos: ResumenFormato[]
  tarjetasExcepciones: TarjetaExcepcion[]
  resumenExcepciones: ResumenExcepciones
  asientosParaExportar: unknown[]
  configParaExportar: unknown
}

// ── Config guardada por localStorage ─────────────────────────────────────────
const STORAGE_KEY = 'ja_exogenas_config'
interface ConfigGuardada { nitDeclarante: string; dvDeclarante: string; razonSocial: string; tipoDeclarante: string }

export default function ExogenasPage() {
  const { tenant } = useClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [vista, setVista] = useState<Vista>('inicio')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<ResultadoGeneral | null>(null)
  const [anioGravable, setAnioGravable] = useState(2025)
  const [exportando, setExportando] = useState(false)

  // Config del declarante (guardada en localStorage)
  const [config, setConfig] = useState<ConfigGuardada>({
    nitDeclarante: '', dvDeclarante: '', razonSocial: tenant?.name ?? '', tipoDeclarante: 'contribuyente',
  })
  const [mostrarConfigAvanzada, setMostrarConfigAvanzada] = useState(false)

  // Asistente de excepciones
  const [indiceExcepcion, setIndiceExcepcion] = useState(0)
  const [excepcionesResueltas, setExcepcionesResueltas] = useState<Map<number, { accion: AccionExcepcion; datos?: string }>>(new Map())
  const [busquedaTercero, setBusquedaTercero] = useState('')
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false)

  // Cargar config guardada
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setConfig(prev => ({ ...prev, ...JSON.parse(saved) }))
    } catch { /* ignorar */ }
  }, [])

  const guardarConfig = useCallback((c: ConfigGuardada) => {
    setConfig(c)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
  }, [])

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }, [])
  const onDragLeave = useCallback(() => setDragOver(false), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.txt') || f.name.endsWith('.CSV'))) {
      setArchivo(f); setError('')
    } else {
      setError('Por favor cargue un archivo CSV exportado desde Siigo.')
    }
  }, [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setArchivo(f); setError('') }
  }, [])

  // ── Generar exógenas ───────────────────────────────────────────────────────
  const generarExogenas = useCallback(async () => {
    if (!archivo) { setError('Primero cargue el Libro Auxiliar de Siigo.'); return }
    setVista('procesando')
    setError('')
    setProgreso('Leyendo el archivo de Siigo…')
    setIndiceExcepcion(0)
    setExcepcionesResueltas(new Map())

    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      fd.append('config', JSON.stringify({
        anioGravable,
        nitDeclarante: config.nitDeclarante.replace(/\D/g, ''),
        dvDeclarante: config.dvDeclarante,
        razonSocial: config.razonSocial,
        tipoDeclarante: config.tipoDeclarante,
        municipioCodigo: '11001',
        formatos: ['1001', '1005', '1006', '1007', '1010'],
      }))

      setProgreso('Clasificando los movimientos por cuenta PUC…')
      const res = await fetch('/api/exogenas/generar', { method: 'POST', body: fd })
      setProgreso('Validando y generando excepciones…')
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Error al generar. Intente nuevamente.')
        setVista('inicio')
        return
      }

      setResultado(json)
      setVista('resumen')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión. Intente nuevamente.')
      setVista('inicio')
    }
  }, [archivo, config, anioGravable])

  // ── Resolver excepción ─────────────────────────────────────────────────────
  const resolverExcepcion = useCallback((accion: AccionExcepcion, datos?: string) => {
    setExcepcionesResueltas(prev => {
      const next = new Map(prev)
      next.set(indiceExcepcion, { accion, datos })
      return next
    })
    setMostrarBusqueda(false)
    setBusquedaTercero('')
    // Avanzar a la siguiente sin resolver
    const tarjetas = resultado?.tarjetasExcepciones ?? []
    let siguiente = indiceExcepcion + 1
    while (siguiente < tarjetas.length && excepcionesResueltas.has(siguiente)) siguiente++
    if (siguiente < tarjetas.length) setIndiceExcepcion(siguiente)
    else setVista('listo')
  }, [indiceExcepcion, resultado, excepcionesResueltas])

  const excepcionesPendientes = useMemo(() => {
    if (!resultado) return 0
    return resultado.tarjetasExcepciones.length - excepcionesResueltas.size
  }, [resultado, excepcionesResueltas])

  // ── Exportar Excel ─────────────────────────────────────────────────────────
  const exportarExcel = useCallback(async () => {
    if (!resultado) return
    setExportando(true)
    try {
      const res = await fetch('/api/exogenas/procesos/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: resultado.configParaExportar, asientos: resultado.asientosParaExportar }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Exogenas_AG${anioGravable}_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar')
    } finally {
      setExportando(false)
    }
  }, [resultado, anioGravable])

  const reiniciar = () => {
    setVista('inicio'); setArchivo(null); setResultado(null); setError('')
    setExcepcionesResueltas(new Map()); setIndiceExcepcion(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: JA.BG, fontFamily: 'Inter, sans-serif', color: JA.TEXT }}>

      {/* ── Header fijo ── */}
      <div style={{ background: JA.NAVY, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: '14px',
        position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ width: '36px', height: '36px', background: JA.GOLD, borderRadius: '2px', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: JA.NAVY, flexShrink: 0 }}>
          E
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: JA.WHITE }}>Exógenas DIAN 2025</div>
          <div style={{ fontSize: '11px', color: '#94A3B8' }}>Res. 000227/2025 · Formato automático desde Siigo</div>
        </div>
        {vista !== 'inicio' && vista !== 'procesando' && (
          <button onClick={reiniciar} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2px', color: JA.WHITE,
            fontSize: '12px', cursor: 'pointer' }}>
            ← Nueva empresa
          </button>
        )}
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px' }}>

        {/* ── Error global ── */}
        {error && (
          <div style={{ padding: '12px 16px', background: JA.RED_BG, border: `1px solid #FECACA`,
            borderRadius: '2px', color: JA.RED, fontSize: '13px', marginBottom: '20px',
            display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            VISTA: INICIO — Cargar CSV y configurar
        ═══════════════════════════════════════════════════════════ */}
        {vista === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Zona de carga del CSV */}
            <div
              ref={dropRef}
              onClick={() => !archivo && fileRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              style={{
                border: `2px dashed ${dragOver ? JA.NAVY : archivo ? JA.GREEN : JA.BORDER}`,
                borderRadius: '4px', padding: '40px 24px', textAlign: 'center',
                background: dragOver ? JA.BLUE_BG : archivo ? JA.GREEN_BG : JA.WHITE,
                cursor: archivo ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}>
              <input ref={fileRef} type="file" accept=".csv,.txt,.CSV" style={{ display: 'none' }} onChange={onFileChange} />

              {!archivo ? (
                <>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📂</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: JA.TEXT, marginBottom: '6px' }}>
                    Arrastre aquí el Libro Auxiliar de Siigo
                  </div>
                  <div style={{ fontSize: '13px', color: JA.GREY, marginBottom: '16px' }}>
                    o haga clic para buscarlo en su computador
                  </div>
                  <div style={{ fontSize: '11px', color: JA.GREY, padding: '8px 16px',
                    background: JA.SURFACE, borderRadius: '2px', display: 'inline-block' }}>
                    📋 En Siigo: Contabilidad → Libros → Libro Auxiliar → Exportar CSV
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>✅</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: JA.GREEN, marginBottom: '4px' }}>
                    {archivo.name}
                  </div>
                  <div style={{ fontSize: '12px', color: JA.GREY, marginBottom: '12px' }}>
                    {(archivo.size / 1024).toFixed(0)} KB · Listo para procesar
                  </div>
                  <button onClick={e => { e.stopPropagation(); setArchivo(null); if (fileRef.current) fileRef.current.value = '' }}
                    style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${JA.BORDER}`,
                      borderRadius: '2px', fontSize: '12px', color: JA.GREY, cursor: 'pointer' }}>
                    Cambiar archivo
                  </button>
                </>
              )}
            </div>

            {/* Año gravable */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>Año gravable</div>
                <div style={{ fontSize: '12px', color: JA.GREY, marginTop: '2px' }}>El período que va a reportar a la DIAN</div>
              </div>
              <select value={anioGravable} onChange={e => setAnioGravable(Number(e.target.value))}
                style={{ padding: '8px 12px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
                  fontSize: '14px', fontWeight: 700, color: JA.NAVY, background: JA.WHITE }}>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
              </select>
            </div>

            {/* Config avanzada (colapsable) */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
              <button onClick={() => setMostrarConfigAvanzada(v => !v)}
                style={{ width: '100%', padding: '14px 20px', border: 'none', background: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>
                    {config.nitDeclarante ? `NIT declarante: ${config.nitDeclarante}-${config.dvDeclarante}` : 'Configurar NIT del declarante'}
                  </div>
                  <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '2px' }}>
                    {config.nitDeclarante ? `${config.razonSocial} · ${config.tipoDeclarante}` : 'Opcional — necesario para guardar en la DIAN'}
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: JA.GREY }}>{mostrarConfigAvanzada ? '▲' : '▼'}</span>
              </button>

              {mostrarConfigAvanzada && (
                <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${JA.BORDER}`, display: 'grid',
                  gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ gridColumn: '1/-1', height: '12px' }} />
                  <Campo label="NIT del declarante">
                    <input value={config.nitDeclarante}
                      onChange={e => guardarConfig({ ...config, nitDeclarante: e.target.value.replace(/\D/g, '') })}
                      placeholder="900123456" style={inputStyle} />
                  </Campo>
                  <Campo label="Dígito de verificación">
                    <input value={config.dvDeclarante} maxLength={1}
                      onChange={e => guardarConfig({ ...config, dvDeclarante: e.target.value.replace(/\D/g, '') })}
                      placeholder="1" style={inputStyle} />
                  </Campo>
                  <Campo label="Razón social" style={{ gridColumn: '1/-1' }}>
                    <input value={config.razonSocial}
                      onChange={e => guardarConfig({ ...config, razonSocial: e.target.value })}
                      placeholder="Nombre de la empresa" style={inputStyle} />
                  </Campo>
                  <Campo label="Tipo de declarante" style={{ gridColumn: '1/-1' }}>
                    <select value={config.tipoDeclarante}
                      onChange={e => guardarConfig({ ...config, tipoDeclarante: e.target.value })}
                      style={{ ...inputStyle }}>
                      <option value="contribuyente">Contribuyente</option>
                      <option value="gran_contribuyente">Gran contribuyente</option>
                      <option value="autoretenedor">Autorretenedor</option>
                      <option value="agente_retenedor">Agente retenedor</option>
                    </select>
                  </Campo>
                </div>
              )}
            </div>

            {/* Botón principal */}
            <button
              onClick={generarExogenas}
              disabled={!archivo}
              style={{
                padding: '18px', background: archivo ? JA.NAVY : '#CBD5E1',
                color: JA.WHITE, border: 'none', borderRadius: '4px',
                fontSize: '16px', fontWeight: 700, cursor: archivo ? 'pointer' : 'not-allowed',
                letterSpacing: '0.01em', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '10px',
              }}>
              <span style={{ fontSize: '20px' }}>⚡</span>
              {archivo ? 'Generar Exógenas' : 'Primero cargue el archivo de Siigo'}
            </button>

            <div style={{ fontSize: '11px', color: JA.GREY, textAlign: 'center', lineHeight: '1.6' }}>
              El sistema clasifica automáticamente todos los movimientos según las reglas del PUC colombiano
              y la Resolución DIAN 000227/2025. Solo verá lo que necesita revisar.
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            VISTA: PROCESANDO
        ═══════════════════════════════════════════════════════════ */}
        {vista === 'procesando' && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '52px', marginBottom: '20px' }}>⚙️</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: JA.TEXT, marginBottom: '8px' }}>
              Generando exógenas…
            </div>
            <div style={{ fontSize: '13px', color: JA.GREY, marginBottom: '24px' }}>{progreso}</div>
            <div style={{ height: '4px', background: JA.BORDER, borderRadius: '2px', overflow: 'hidden', maxWidth: '300px', margin: '0 auto' }}>
              <div style={{ height: '100%', background: JA.NAVY, borderRadius: '2px', width: '60%',
                animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            VISTA: RESUMEN
        ═══════════════════════════════════════════════════════════ */}
        {vista === 'resumen' && resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Tarjeta de estado global */}
            <div style={{
              background: resultado.resumenExcepciones.criticas > 0 ? JA.AMBER_BG : JA.GREEN_BG,
              border: `1px solid ${resultado.resumenExcepciones.criticas > 0 ? '#FDE68A' : '#BBF7D0'}`,
              borderRadius: '4px', padding: '20px 24px',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {resultado.resumenExcepciones.criticas > 0 ? '⚠️' : '✅'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: JA.TEXT, marginBottom: '4px' }}>
                {resultado.resumenExcepciones.criticas === 0
                  ? '¡Todo está en orden!'
                  : `Generé las exógenas con ${resultado.resumenExcepciones.criticas} ${resultado.resumenExcepciones.criticas === 1 ? 'situación' : 'situaciones'} por revisar`}
              </div>
              <div style={{ fontSize: '13px', color: JA.GREY }}>
                Procesé {resultado.asientosProcesados.toLocaleString('es-CO')} movimientos del Libro Auxiliar.
                {resultado.resumenExcepciones.criticas > 0
                  ? ` ${resultado.resumenExcepciones.descripcionResumen}`
                  : ' Puede descargar el archivo directamente.'}
              </div>
            </div>

            {/* Totales por formato */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', background: JA.SURFACE, borderBottom: `1px solid ${JA.BORDER}`,
                fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: JA.GREY }}>
                Resumen por formato
              </div>
              {resultado.resumenFormatos.map(f => {
                const totalPrincipal = Object.entries(f.totales).find(([k]) => k.includes('total') && k !== 'totalFilas')?.[1] ?? 0
                const tieneCriticas = f.excepcionesCriticas > 0
                return (
                  <div key={f.codigo} style={{ padding: '14px 20px', borderBottom: `1px solid ${JA.BORDER}`,
                    display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '44px', height: '44px', background: JA.NAVY, borderRadius: '2px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                      fontWeight: 800, color: JA.WHITE, flexShrink: 0, lineHeight: '1.1', textAlign: 'center' }}>
                      {f.codigo}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>{f.nombre}</div>
                      <div style={{ fontSize: '12px', color: JA.GREY, marginTop: '2px' }}>
                        {f.totalFilas.toLocaleString('es-CO')} {f.totalFilas === 1 ? 'tercero' : 'terceros'} · {fmtCOP(totalPrincipal)}
                      </div>
                    </div>
                    {(tieneCriticas || f.excepcionesMedia > 0) ? (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '2px', fontWeight: 600,
                        background: tieneCriticas ? '#FEE2E2' : '#FEF3C7',
                        color: tieneCriticas ? JA.RED : JA.AMBER }}>
                        {tieneCriticas ? `${f.excepcionesCriticas} críticas` : `${f.excepcionesMedia} alertas`}
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '2px',
                        background: '#D1FAE5', color: JA.GREEN, fontWeight: 600 }}>✓ OK</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Advertencias del CSV si las hay */}
            {resultado.advertenciasCsv.length > 0 && (
              <details style={{ background: JA.AMBER_BG, border: `1px solid #FDE68A`, borderRadius: '2px', padding: '12px 16px' }}>
                <summary style={{ fontSize: '12px', fontWeight: 600, color: JA.AMBER, cursor: 'pointer' }}>
                  {resultado.advertenciasCsv.length} advertencia(s) al leer el archivo de Siigo
                </summary>
                <ul style={{ margin: '8px 0 0', paddingLeft: '16px', fontSize: '11px', color: '#92400E' }}>
                  {resultado.advertenciasCsv.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </details>
            )}

            {/* Cuentas sin regla */}
            {resultado.cuentasSinRegla.length > 0 && (
              <details style={{ background: JA.SURFACE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '12px 16px' }}>
                <summary style={{ fontSize: '12px', fontWeight: 600, color: JA.GREY, cursor: 'pointer' }}>
                  {resultado.cuentasSinRegla.length} cuenta(s) que no van a ningún formato de exógena
                </summary>
                <p style={{ fontSize: '11px', color: JA.GREY, margin: '8px 0 4px' }}>
                  Estas cuentas tienen movimientos pero la DIAN no exige reportarlas en los formatos seleccionados:
                </p>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: JA.TEXT }}>
                  {resultado.cuentasSinRegla.join(', ')}
                </div>
              </details>
            )}

            {/* Botones de acción */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {resultado.tarjetasExcepciones.length > 0 ? (
                <button onClick={() => { setVista('excepciones'); setIndiceExcepcion(0) }}
                  style={{ padding: '16px', background: JA.NAVY, color: JA.WHITE, border: 'none',
                    borderRadius: '4px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span>🔍</span>
                  Revisar {resultado.tarjetasExcepciones.length} {resultado.tarjetasExcepciones.length === 1 ? 'situación' : 'situaciones'} ({resultado.resumenExcepciones.criticas} críticas)
                </button>
              ) : null}

              <button onClick={exportarExcel} disabled={exportando}
                style={{ padding: '14px', background: resultado.tarjetasExcepciones.length === 0 ? JA.GOLD : JA.WHITE,
                  color: resultado.tarjetasExcepciones.length === 0 ? JA.NAVY : JA.GREY,
                  border: `1px solid ${resultado.tarjetasExcepciones.length === 0 ? JA.GOLD : JA.BORDER}`,
                  borderRadius: '4px', fontSize: '14px', fontWeight: resultado.tarjetasExcepciones.length === 0 ? 700 : 500,
                  cursor: exportando ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span>⬇</span>
                {exportando ? 'Generando Excel…' : resultado.tarjetasExcepciones.length === 0
                  ? 'Descargar Excel para el Prevalidador DIAN'
                  : 'Descargar de todas formas (con excepciones pendientes)'}
              </button>
            </div>

            {resultado.tarjetasExcepciones.length > 0 && (
              <div style={{ fontSize: '11px', color: JA.GREY, textAlign: 'center', lineHeight: '1.6' }}>
                Puede descargar ahora y resolver las situaciones después, o revisarlas primero para un archivo más completo.
                Las situaciones <strong>críticas</strong> pueden hacer que la DIAN rechace el archivo.
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            VISTA: EXCEPCIONES — Asistente de resolución
        ═══════════════════════════════════════════════════════════ */}
        {vista === 'excepciones' && resultado && (() => {
          const tarjetas = resultado.tarjetasExcepciones
          const tarjeta = tarjetas[indiceExcepcion]
          const resuelta = excepcionesResueltas.get(indiceExcepcion)
          const totalResueltas = excepcionesResueltas.size
          const severidadColor = tarjeta?.excepcionOriginal.severidad === 'alta' ? JA.RED
            : tarjeta?.excepcionOriginal.severidad === 'media' ? JA.AMBER : JA.BLUE

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Barra de progreso */}
              <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '14px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: JA.TEXT }}>
                    Revisando situación {indiceExcepcion + 1} de {tarjetas.length}
                  </span>
                  <span style={{ fontSize: '12px', color: JA.GREEN, fontWeight: 600 }}>
                    {totalResueltas} resueltas
                  </span>
                </div>
                <div style={{ height: '6px', background: JA.BORDER, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: JA.GREEN, borderRadius: '3px',
                    width: `${(totalResueltas / tarjetas.length) * 100}%`, transition: 'width 0.3s' }} />
                </div>
                {/* Miniaturas de tarjetas */}
                <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {tarjetas.map((t, i) => (
                    <button key={i} onClick={() => setIndiceExcepcion(i)}
                      style={{ width: '24px', height: '24px', borderRadius: '2px', border: 'none', cursor: 'pointer',
                        background: excepcionesResueltas.has(i) ? JA.GREEN
                          : i === indiceExcepcion ? JA.NAVY
                          : t.excepcionOriginal.severidad === 'alta' ? '#FEE2E2' : '#FEF3C7',
                        color: excepcionesResueltas.has(i) || i === indiceExcepcion ? JA.WHITE : JA.TEXT,
                        fontSize: '10px', fontWeight: 700 }}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tarjeta de excepción */}
              {tarjeta && (
                <div style={{ background: JA.WHITE, border: `2px solid ${resuelta ? JA.GREEN : severidadColor}`,
                  borderRadius: '4px', overflow: 'hidden' }}>

                  {/* Header de la tarjeta */}
                  <div style={{ padding: '16px 20px', background: resuelta ? JA.GREEN_BG
                    : tarjeta.excepcionOriginal.severidad === 'alta' ? JA.RED_BG : JA.AMBER_BG,
                    borderBottom: `1px solid ${resuelta ? '#BBF7D0' : tarjeta.excepcionOriginal.severidad === 'alta' ? '#FECACA' : '#FDE68A'}` }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '28px', lineHeight: 1 }}>{resuelta ? '✅' : tarjeta.icono}</span>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: JA.TEXT, marginBottom: '2px' }}>
                          {resuelta ? 'Situación resuelta' : tarjeta.titulo}
                        </div>
                        {!resuelta && (
                          <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '2px', fontWeight: 700,
                            background: tarjeta.excepcionOriginal.severidad === 'alta' ? '#FEE2E2' : '#FEF3C7',
                            color: severidadColor }}>
                            {tarjeta.excepcionOriginal.severidad === 'alta' ? 'CRÍTICA — la DIAN puede rechazar esto' : 'ALERTA — revise antes de enviar'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cuerpo */}
                  {!resuelta && (
                    <div style={{ padding: '20px' }}>
                      <p style={{ fontSize: '14px', color: JA.TEXT, lineHeight: '1.65', margin: '0 0 16px' }}>
                        {tarjeta.explicacion}
                      </p>

                      {/* Contexto contable */}
                      {tarjeta.contexto && Object.values(tarjeta.contexto).some(Boolean) && (
                        <div style={{ background: JA.SURFACE, borderRadius: '2px', padding: '12px 14px',
                          marginBottom: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                          {tarjeta.contexto.cuenta && (
                            <InfoDato label="Cuenta" valor={`${tarjeta.contexto.cuenta}${tarjeta.contexto.nombreCuenta ? ` — ${tarjeta.contexto.nombreCuenta}` : ''}`} />
                          )}
                          {tarjeta.contexto.monto != null && (
                            <InfoDato label="Valor" valor={fmtCOP(tarjeta.contexto.monto)} />
                          )}
                          {tarjeta.contexto.documentoId && (
                            <InfoDato label="Comprobante" valor={tarjeta.contexto.documentoId} />
                          )}
                          {tarjeta.contexto.terceroId && (
                            <InfoDato label="NIT/Documento" valor={tarjeta.contexto.terceroId} />
                          )}
                        </div>
                      )}

                      <div style={{ fontSize: '12px', color: JA.GREY, padding: '10px 14px',
                        background: '#F8F9FA', borderRadius: '2px', marginBottom: '20px',
                        borderLeft: `3px solid ${JA.GREY}` }}>
                        <strong>¿Por qué importa?</strong> {tarjeta.impacto}
                      </div>

                      {/* Búsqueda de tercero (si aplica) */}
                      {mostrarBusqueda && (
                        <div style={{ marginBottom: '16px', padding: '14px', background: JA.BLUE_BG,
                          border: `1px solid #BFDBFE`, borderRadius: '2px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: JA.BLUE, marginBottom: '8px' }}>
                            Buscar tercero por NIT o nombre
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input value={busquedaTercero} onChange={e => setBusquedaTercero(e.target.value)}
                              placeholder="Ej: 900123456 o EMPRESA XYZ"
                              style={{ ...inputStyle, flex: 1 }}
                              autoFocus />
                            <button onClick={() => resolverExcepcion('asignar_tercero', busquedaTercero)}
                              disabled={!busquedaTercero.trim()}
                              style={{ padding: '8px 14px', background: JA.BLUE, color: JA.WHITE, border: 'none',
                                borderRadius: '2px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                              Asignar
                            </button>
                          </div>
                          <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '6px' }}>
                            Ingrese el NIT para asignarlo. El sistema validará el dígito de verificación automáticamente.
                          </div>
                        </div>
                      )}

                      {/* Acciones */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tarjeta.acciones.map(accion => (
                          <button key={accion.tipo}
                            onClick={() => {
                              if (accion.tipo === 'asignar_tercero') { setMostrarBusqueda(true); return }
                              resolverExcepcion(accion.tipo)
                            }}
                            style={{
                              padding: '12px 16px', border: `1px solid ${accion.primaria ? JA.NAVY : JA.BORDER}`,
                              borderRadius: '2px', background: accion.primaria ? JA.NAVY : JA.WHITE,
                              color: accion.primaria ? JA.WHITE : JA.TEXT,
                              fontSize: '13px', fontWeight: accion.primaria ? 600 : 400,
                              cursor: 'pointer', textAlign: 'left',
                            }}>
                            {accion.etiqueta}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Estado resuelta */}
                  {resuelta && (
                    <div style={{ padding: '16px 20px', fontSize: '13px', color: JA.GREEN }}>
                      Acción: <strong>{etiquetaAccion(resuelta.accion)}</strong>
                      {resuelta.datos && <span style={{ color: JA.GREY }}> — {resuelta.datos}</span>}
                      <button onClick={() => {
                        setExcepcionesResueltas(prev => { const n = new Map(prev); n.delete(indiceExcepcion); return n })
                      }} style={{ marginLeft: '12px', fontSize: '11px', color: JA.GREY, background: 'none',
                        border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                        Cambiar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Navegación */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setIndiceExcepcion(i => Math.max(0, i - 1))}
                  disabled={indiceExcepcion === 0}
                  style={{ flex: 1, padding: '10px', background: JA.WHITE, border: `1px solid ${JA.BORDER}`,
                    borderRadius: '2px', fontSize: '13px', color: JA.TEXT, cursor: indiceExcepcion === 0 ? 'not-allowed' : 'pointer',
                    opacity: indiceExcepcion === 0 ? 0.4 : 1 }}>
                  ← Anterior
                </button>
                {excepcionesPendientes === 0 ? (
                  <button onClick={() => setVista('listo')}
                    style={{ flex: 2, padding: '10px', background: JA.GREEN, color: JA.WHITE, border: 'none',
                      borderRadius: '2px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                    ✓ ¡Listo! Ver resultado final →
                  </button>
                ) : (
                  <button onClick={() => {
                    const tarjetas = resultado.tarjetasExcepciones
                    let siguiente = indiceExcepcion + 1
                    while (siguiente < tarjetas.length && excepcionesResueltas.has(siguiente)) siguiente++
                    if (siguiente < tarjetas.length) setIndiceExcepcion(siguiente)
                    else setVista('listo')
                  }}
                    style={{ flex: 2, padding: '10px', background: JA.NAVY, color: JA.WHITE, border: 'none',
                      borderRadius: '2px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    Siguiente →
                  </button>
                )}
              </div>

              <button onClick={() => setVista('resumen')} style={{ padding: '8px', background: 'transparent',
                border: 'none', fontSize: '12px', color: JA.GREY, cursor: 'pointer', textDecoration: 'underline' }}>
                Volver al resumen
              </button>
            </div>
          )
        })()}

        {/* ═══════════════════════════════════════════════════════════
            VISTA: LISTO — Descarga final
        ═══════════════════════════════════════════════════════════ */}
        {vista === 'listo' && resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: JA.GREEN_BG, border: `1px solid #BBF7D0`, borderRadius: '4px',
              padding: '28px', textAlign: 'center' }}>
              <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎉</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: JA.TEXT, marginBottom: '6px' }}>
                Exógenas listas para la DIAN
              </div>
              <div style={{ fontSize: '13px', color: JA.GREY, marginBottom: '24px', lineHeight: '1.6' }}>
                {excepcionesResueltas.size > 0
                  ? `Resolvió ${excepcionesResueltas.size} de ${resultado.tarjetasExcepciones.length} situaciones. El archivo está listo para cargar en el Prevalidador de la DIAN.`
                  : 'El archivo está listo para cargar en el Prevalidador de la DIAN.'}
              </div>

              <button onClick={exportarExcel} disabled={exportando}
                style={{ padding: '16px 32px', background: JA.GOLD, color: JA.NAVY, border: 'none',
                  borderRadius: '4px', fontSize: '16px', fontWeight: 800, cursor: exportando ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>⬇</span>
                {exportando ? 'Generando…' : 'Descargar Excel para el Prevalidador DIAN'}
              </button>

              <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '14px' }}>
                Recuerde verificar el archivo en el Prevalidador oficial de la DIAN antes de presentar.
              </div>
            </div>

            {/* Resumen de lo que se resolvió */}
            {excepcionesResueltas.size > 0 && (
              <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: JA.SURFACE, borderBottom: `1px solid ${JA.BORDER}`,
                  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: JA.GREY }}>
                  Situaciones resueltas
                </div>
                {Array.from(excepcionesResueltas.entries()).map(([i, r]) => {
                  const t = resultado.tarjetasExcepciones[i]
                  return (
                    <div key={i} style={{ padding: '10px 16px', borderBottom: `1px solid ${JA.BORDER}`,
                      display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                      <span style={{ color: JA.GREEN }}>✓</span>
                      <span style={{ flex: 1, color: JA.GREY }}>{t?.titulo}</span>
                      <span style={{ color: JA.TEXT, fontWeight: 500 }}>{etiquetaAccion(r.accion)}</span>
                    </div>
                  )
                })}
              </div>
            )}

            <button onClick={reiniciar} style={{ padding: '12px', background: 'transparent',
              border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '13px', color: JA.GREY, cursor: 'pointer' }}>
              Generar exógenas de otra empresa
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componentes de apoyo ──────────────────────────────────────────────────────

function Campo({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: JA.GREY,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function InfoDato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: JA.TEXT, marginTop: '2px' }}>{valor}</div>
    </div>
  )
}

function etiquetaAccion(accion: AccionExcepcion): string {
  const mapa: Record<AccionExcepcion, string> = {
    asignar_tercero: 'Tercero asignado',
    corregir_dv: 'DV corregido',
    asignar_concepto: 'Concepto asignado',
    excluir: 'Excluido del reporte',
    confirmar_correcto: 'Confirmado correcto',
    diferir: 'Pendiente de revisión',
  }
  return mapa[accion] ?? accion
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
  fontSize: '13px', color: JA.TEXT, background: JA.WHITE, boxSizing: 'border-box',
  fontFamily: 'Inter, sans-serif', outline: 'none',
}
