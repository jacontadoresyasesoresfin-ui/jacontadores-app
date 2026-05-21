'use client'
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useClient } from '../ClientContext'
import type { TarjetaExcepcion, AccionExcepcion } from '@/lib/exogenas/engine/humanizador'

// ── Paleta J&A ────────────────────────────────────────────────────────────────
const JA = {
  NAVY: '#13213C', GOLD: '#B8960C', GOLD_LT: '#D4A843',
  TEXT: '#1C2B45', GREY: '#4B5563', BORDER: '#E5E7EB', BG: '#F8FAFC',
  WHITE: '#FFFFFF', RED: '#DC2626', GREEN: '#059669', AMBER: '#D97706',
  BLUE: '#2563EB', SURFACE: '#F1F5F9',
  RED_BG: '#FEF2F2', GREEN_BG: '#F0FDF4', AMBER_BG: '#FFFBEB', BLUE_BG: '#EFF6FF',
}
const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmtCOP = (n: number) => COP.format(n)

// ── Tipos de eventos del stream ───────────────────────────────────────────────
type TipoEvento = 'etapa_inicio' | 'etapa_ok' | 'formato_inicio' | 'formato_ok' | 'fin' | 'error'
interface Evento { tipo: TipoEvento; etapa?: number; codigo?: string; datos?: Record<string, unknown>; mensaje?: string }

// ── Estado de una etapa ───────────────────────────────────────────────────────
type EstadoEtapa = 'pendiente' | 'activa' | 'ok' | 'error'
interface EtapaUI {
  num: number
  titulo: string
  icono: string
  estado: EstadoEtapa
  detalles: string[]
  subformatos: FormatoItem[]
}
interface FormatoItem {
  codigo: string
  nombre: string
  estado: 'pendiente' | 'activa' | 'ok'
  detalle?: string
}

// ── Resultado final ───────────────────────────────────────────────────────────
interface ResultadoFinal {
  asientosProcesados: number
  advertenciasCsv: string[]
  metaCsv: { empresa?: string; periodo?: string }
  cuentasSinRegla: string[]
  resumenFormatos: Array<{
    codigo: string; nombre: string; totalFilas: number
    totales: Record<string, number>
    excepcionesCriticas: number; excepcionesMedia: number
  }>
  tarjetasExcepciones: TarjetaExcepcion[]
  resumenExcepciones: { criticas: number; alertas: number; informativas: number; descripcionResumen: string }
  asientosParaExportar: unknown[]
  configParaExportar: unknown
}

// ── Vista de la página ────────────────────────────────────────────────────────
type Vista = 'inicio' | 'procesando' | 'resumen' | 'excepciones' | 'listo'

const ETAPAS_INICIALES: EtapaUI[] = [
  { num: 1, titulo: 'Leer archivo de Siigo',      icono: '📂', estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 2, titulo: 'Cargar reglas DIAN 2025',    icono: '📋', estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 3, titulo: 'Analizar movimientos',        icono: '🔍', estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 4, titulo: 'Generar formatos DIAN',       icono: '📊', estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 5, titulo: 'Validar excepciones',         icono: '✅', estado: 'pendiente', detalles: [], subformatos: [] },
]

const STORAGE_KEY = 'ja_exogenas_config'
interface ConfigGuardada { nitDeclarante: string; dvDeclarante: string; razonSocial: string; tipoDeclarante: string }

export default function ExogenasPage() {
  const { tenant } = useClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [vista, setVista] = useState<Vista>('inicio')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [anioGravable, setAnioGravable] = useState(2025)
  const [mostrarConfig, setMostrarConfig] = useState(false)
  const [exportando, setExportando] = useState(false)

  // Stepper state
  const [etapas, setEtapas] = useState<EtapaUI[]>(ETAPAS_INICIALES)
  const [porcentaje, setPorcentaje] = useState(0)
  const [resultado, setResultado] = useState<ResultadoFinal | null>(null)

  // Asistente excepciones
  const [indiceExcepcion, setIndiceExcepcion] = useState(0)
  const [excepcionesResueltas, setExcepcionesResueltas] = useState<Map<number, { accion: AccionExcepcion; datos?: string }>>(new Map())
  const [busquedaTercero, setBusquedaTercero] = useState('')
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false)

  // Config guardada
  const [config, setConfig] = useState<ConfigGuardada>({
    nitDeclarante: '', dvDeclarante: '', razonSocial: tenant?.name ?? '', tipoDeclarante: 'contribuyente',
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setConfig(prev => ({ ...prev, ...JSON.parse(saved) }))
    } catch { /* ignorar */ }
  }, [])

  const guardarConfig = (c: ConfigGuardada) => {
    setConfig(c)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = () => setDragOver(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.match(/\.(csv|txt|CSV)$/))) { setArchivo(f); setError('') }
    else setError('Cargue un archivo .csv exportado desde Siigo.')
  }
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) { setArchivo(f); setError('') }
  }

  // ── Actualizar etapa en el stepper ─────────────────────────────────────────
  const actualizarEtapa = useCallback((num: number, cambios: Partial<EtapaUI>) => {
    setEtapas(prev => prev.map(e => e.num === num ? { ...e, ...cambios } : e))
  }, [])

  const agregarDetalle = useCallback((num: number, detalle: string) => {
    setEtapas(prev => prev.map(e => e.num === num ? { ...e, detalles: [...e.detalles, detalle] } : e))
  }, [])

  const actualizarFormato = useCallback((codigo: string, cambios: Partial<FormatoItem>) => {
    setEtapas(prev => prev.map(e =>
      e.num === 4 ? { ...e, subformatos: e.subformatos.map(f => f.codigo === codigo ? { ...f, ...cambios } : f) } : e
    ))
  }, [])

  // ── Procesar evento del stream ─────────────────────────────────────────────
  const procesarEvento = useCallback((ev: Evento) => {
    const d = ev.datos ?? {}

    if (ev.tipo === 'etapa_inicio' && ev.etapa) {
      actualizarEtapa(ev.etapa, { estado: 'activa' })
      // Porcentaje: cada etapa aporta ~18%
      setPorcentaje((ev.etapa - 1) * 18 + 5)
    }

    if (ev.tipo === 'etapa_ok' && ev.etapa) {
      const e = ev.etapa
      actualizarEtapa(e, { estado: 'ok' })

      if (e === 1) {
        if (d.empresa) agregarDetalle(1, `Empresa: ${d.empresa}`)
        if (d.periodo) agregarDetalle(1, `Período: ${d.periodo}`)
        agregarDetalle(1, `${Number(d.asientosCont).toLocaleString('es-CO')} movimientos contables encontrados`)
        if (Number(d.filasFallidas) > 0) agregarDetalle(1, `${d.filasFallidas} filas ignoradas (encabezados o totales)`)
        setPorcentaje(20)
      }
      if (e === 2) {
        agregarDetalle(2, `${d.totalReglas} reglas de mapeo PUC → Formato DIAN cargadas`)
        if (Number(d.reglasPersonalizadas) > 0) agregarDetalle(2, `${d.reglasPersonalizadas} reglas personalizadas de su empresa`)
        setPorcentaje(35)
      }
      if (e === 3) {
        agregarDetalle(3, `${d.cuentasUnicas} cuentas PUC distintas en el período`)
        agregarDetalle(3, `${d.tercerosUnicos} terceros únicos identificados`)
        setPorcentaje(45)
      }
      if (e === 4) {
        setPorcentaje(85)
      }
      if (e === 5) {
        const criticas = Number(d.criticas)
        const alertas = Number(d.alertas)
        const sinRegla = Number(d.cuentasSinRegla)
        if (criticas === 0 && alertas === 0) agregarDetalle(5, 'Todo está en orden — sin situaciones pendientes')
        if (criticas > 0) agregarDetalle(5, `${criticas} situación(es) crítica(s) que requieren revisión`)
        if (alertas > 0) agregarDetalle(5, `${alertas} alerta(s) para revisar antes de enviar`)
        if (sinRegla > 0) agregarDetalle(5, `${sinRegla} cuenta(s) sin clasificación DIAN`)
        setPorcentaje(100)
      }
    }

    if (ev.tipo === 'formato_inicio' && ev.codigo) {
      const nombre = ''  // se completa en formato_ok
      setEtapas(prev => prev.map(e =>
        e.num === 4
          ? {
              ...e,
              subformatos: e.subformatos.some(f => f.codigo === ev.codigo)
                ? e.subformatos.map(f => f.codigo === ev.codigo ? { ...f, estado: 'activa' as const } : f)
                : [...e.subformatos, { codigo: ev.codigo!, nombre, estado: 'activa' as const }]
            }
          : e
      ))
    }

    if (ev.tipo === 'formato_ok' && ev.codigo) {
      const totalFilas = Number(d.totalFilas ?? 0)
      const montoStr = d.montoFormateado as string ?? ''
      const excepciones = Number(d.excepcionesCnt ?? 0)
      const nombre = d.nombre as string ?? ''
      const detalle = `${totalFilas.toLocaleString('es-CO')} ${totalFilas === 1 ? 'tercero' : 'terceros'}${montoStr ? ` · ${montoStr}` : ''}${excepciones > 0 ? ` · ${excepciones} excep.` : ''}`
      actualizarFormato(ev.codigo, { estado: 'ok', nombre, detalle })
    }

    if (ev.tipo === 'fin' && d) {
      setResultado(d as unknown as ResultadoFinal)
      setVista('resumen')
    }

    if (ev.tipo === 'error') {
      setEtapas(prev => prev.map(e => e.estado === 'activa' ? { ...e, estado: 'error' } : e))
      setError(ev.mensaje ?? 'Error al procesar.')
      setVista('inicio')
    }
  }, [actualizarEtapa, agregarDetalle, actualizarFormato])

  // ── Generar exógenas (leer stream) ─────────────────────────────────────────
  const generarExogenas = useCallback(async () => {
    if (!archivo) return
    setVista('procesando')
    setError('')
    setEtapas(ETAPAS_INICIALES)
    setPorcentaje(0)
    setResultado(null)
    setIndiceExcepcion(0)
    setExcepcionesResueltas(new Map())

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

    try {
      const res = await fetch('/api/exogenas/generar', { method: 'POST', body: fd })
      if (!res.body) throw new Error('Sin respuesta del servidor.')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lineas = buffer.split('\n')
        buffer = lineas.pop() ?? ''
        for (const linea of lineas) {
          if (!linea.trim()) continue
          try { procesarEvento(JSON.parse(linea) as Evento) } catch { /* ignorar línea malformada */ }
        }
      }
      // Procesar residuo
      if (buffer.trim()) {
        try { procesarEvento(JSON.parse(buffer) as Evento) } catch { /* ignorar */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión.')
      setVista('inicio')
    }
  }, [archivo, config, anioGravable, procesarEvento])

  // ── Exportar Excel ──────────────────────────────────────────────────────────
  const exportarExcel = useCallback(async () => {
    if (!resultado) return
    setExportando(true)
    try {
      const res = await fetch('/api/exogenas/procesos/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: resultado.configParaExportar, asientos: resultado.asientosParaExportar }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Exogenas_AG${anioGravable}_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar.')
    } finally {
      setExportando(false)
    }
  }, [resultado, anioGravable])

  const resolverExcepcion = (accion: AccionExcepcion, datos?: string) => {
    setExcepcionesResueltas(prev => { const n = new Map(prev); n.set(indiceExcepcion, { accion, datos }); return n })
    setMostrarBusqueda(false); setBusquedaTercero('')
    const tarjetas = resultado?.tarjetasExcepciones ?? []
    let sig = indiceExcepcion + 1
    while (sig < tarjetas.length && excepcionesResueltas.has(sig)) sig++
    if (sig < tarjetas.length) setIndiceExcepcion(sig)
    else setVista('listo')
  }

  const reiniciar = () => {
    setVista('inicio'); setArchivo(null); setResultado(null); setError('')
    setEtapas(ETAPAS_INICIALES); setPorcentaje(0)
    setExcepcionesResueltas(new Map()); setIndiceExcepcion(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  const excepcionesPendientes = (resultado?.tarjetasExcepciones.length ?? 0) - excepcionesResueltas.size

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: JA.BG, fontFamily: 'Inter, sans-serif', color: JA.TEXT }}>

      {/* ── Header ── */}
      <div style={{ background: JA.NAVY, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: '14px',
        position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ width: '36px', height: '36px', background: JA.GOLD, borderRadius: '2px', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: JA.NAVY, flexShrink: 0 }}>
          E
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: JA.WHITE }}>Exógenas DIAN 2025</div>
          <div style={{ fontSize: '11px', color: '#94A3B8' }}>Automatización desde Siigo · Res. 000227/2025</div>
        </div>
        {(vista === 'resumen' || vista === 'excepciones' || vista === 'listo') && (
          <button onClick={reiniciar} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2px', color: JA.WHITE, fontSize: '12px', cursor: 'pointer' }}>
            ← Nueva empresa
          </button>
        )}
      </div>

      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '28px 20px' }}>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', background: JA.RED_BG, border: '1px solid #FECACA',
            borderRadius: '2px', color: JA.RED, fontSize: '13px', marginBottom: '20px',
            display: 'flex', gap: '10px' }}>
            <span>⚠</span><span>{error}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA: INICIO
        ══════════════════════════════════════════════════════════ */}
        {vista === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Zona drag & drop */}
            <div
              onClick={() => !archivo && fileRef.current?.click()}
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
              style={{ border: `2px dashed ${dragOver ? JA.NAVY : archivo ? JA.GREEN : JA.BORDER}`,
                borderRadius: '4px', padding: '36px 24px', textAlign: 'center',
                background: dragOver ? JA.BLUE_BG : archivo ? JA.GREEN_BG : JA.WHITE,
                cursor: archivo ? 'default' : 'pointer', transition: 'all 0.15s' }}>
              <input ref={fileRef} type="file" accept=".csv,.txt,.CSV" style={{ display: 'none' }} onChange={onFileChange} />
              {!archivo ? (
                <>
                  <div style={{ fontSize: '42px', marginBottom: '10px' }}>📂</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: JA.TEXT, marginBottom: '6px' }}>
                    Arrastre aquí el Libro Auxiliar de Siigo
                  </div>
                  <div style={{ fontSize: '13px', color: JA.GREY, marginBottom: '14px' }}>
                    o haga clic para buscar el archivo .csv
                  </div>
                  <div style={{ fontSize: '11px', color: JA.GREY, padding: '7px 14px',
                    background: JA.SURFACE, borderRadius: '2px', display: 'inline-block' }}>
                    En Siigo Nube: Contabilidad → Libros → Libro Auxiliar → Exportar
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: JA.GREEN, marginBottom: '4px' }}>{archivo.name}</div>
                  <div style={{ fontSize: '12px', color: JA.GREY, marginBottom: '12px' }}>
                    {(archivo.size / 1024).toFixed(0)} KB · Listo para procesar
                  </div>
                  <button onClick={e => { e.stopPropagation(); setArchivo(null); if (fileRef.current) fileRef.current.value = '' }}
                    style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${JA.BORDER}`,
                      borderRadius: '2px', fontSize: '12px', color: JA.GREY, cursor: 'pointer' }}>
                    Cambiar archivo
                  </button>
                </>
              )}
            </div>

            {/* Año + config */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
                padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: JA.TEXT }}>Año gravable</div>
                  <div style={{ fontSize: '11px', color: JA.GREY }}>Período a reportar a la DIAN</div>
                </div>
                <select value={anioGravable} onChange={e => setAnioGravable(Number(e.target.value))}
                  style={{ padding: '7px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
                    fontSize: '14px', fontWeight: 700, color: JA.NAVY, background: JA.WHITE }}>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>
              </div>
            </div>

            {/* Config avanzada colapsable */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
              <button onClick={() => setMostrarConfig(v => !v)}
                style={{ width: '100%', padding: '13px 16px', border: 'none', background: 'transparent',
                  display: 'flex', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>
                    {config.nitDeclarante ? `NIT: ${config.nitDeclarante}-${config.dvDeclarante} · ${config.razonSocial}` : 'Configurar datos del declarante (opcional)'}
                  </div>
                  <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '1px' }}>
                    {config.nitDeclarante ? `${config.tipoDeclarante} · Guardado automáticamente` : 'Solo se necesita para guardar el proceso en historial'}
                  </div>
                </div>
                <span style={{ color: JA.GREY, fontSize: '12px' }}>{mostrarConfig ? '▲' : '▼'}</span>
              </button>
              {mostrarConfig && (
                <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${JA.BORDER}`,
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ height: '12px', gridColumn: '1/-1' }} />
                  {[
                    { label: 'NIT (sin DV)', key: 'nitDeclarante', placeholder: '900123456', full: false },
                    { label: 'Dígito verificación', key: 'dvDeclarante', placeholder: '1', full: false },
                    { label: 'Razón social', key: 'razonSocial', placeholder: 'Nombre de la empresa', full: true },
                  ].map(f => (
                    <div key={f.key} style={{ gridColumn: f.full ? '1/-1' : undefined }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: JA.GREY,
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                        {f.label}
                      </label>
                      <input value={config[f.key as keyof ConfigGuardada]}
                        onChange={e => guardarConfig({ ...config, [f.key]: e.target.value })}
                        placeholder={f.placeholder} style={inputSt} />
                    </div>
                  ))}
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: JA.GREY,
                      textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      Tipo de declarante
                    </label>
                    <select value={config.tipoDeclarante}
                      onChange={e => guardarConfig({ ...config, tipoDeclarante: e.target.value })}
                      style={{ ...inputSt }}>
                      <option value="contribuyente">Contribuyente</option>
                      <option value="gran_contribuyente">Gran contribuyente</option>
                      <option value="autoretenedor">Autorretenedor</option>
                      <option value="agente_retenedor">Agente retenedor</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Botón principal */}
            <button onClick={generarExogenas} disabled={!archivo}
              style={{ padding: '18px', background: archivo ? JA.NAVY : '#CBD5E1',
                color: JA.WHITE, border: 'none', borderRadius: '4px',
                fontSize: '16px', fontWeight: 700, cursor: archivo ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>⚡</span>
              {archivo ? 'Generar Exógenas' : 'Primero cargue el Libro Auxiliar de Siigo'}
            </button>

            <p style={{ fontSize: '11px', color: JA.GREY, textAlign: 'center', lineHeight: '1.6', margin: 0 }}>
              El sistema clasifica todos los movimientos según las reglas del PUC colombiano y la Resolución DIAN 000227/2025.
              Podrá seguir cada etapa del proceso en tiempo real.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA: PROCESANDO — Stepper en tiempo real
        ══════════════════════════════════════════════════════════ */}
        {vista === 'procesando' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

            {/* Barra de progreso global */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
              padding: '16px 20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>
                  {porcentaje < 100 ? 'Generando exógenas…' : '¡Proceso completado!'}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY }}>{porcentaje}%</span>
              </div>
              <div style={{ height: '8px', background: JA.SURFACE, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: JA.NAVY, borderRadius: '4px',
                  width: `${porcentaje}%`, transition: 'width 0.5s ease' }} />
              </div>
            </div>

            {/* Stepper vertical */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
              {etapas.map((etapa, idx) => {
                const esUltima = idx === etapas.length - 1
                const activa = etapa.estado === 'activa'
                const completada = etapa.estado === 'ok'
                const conError = etapa.estado === 'error'

                const colorBorde = completada ? JA.GREEN : activa ? JA.NAVY : conError ? JA.RED : JA.BORDER
                const bgHeader = completada ? '#F0FDF4' : activa ? '#EFF6FF' : JA.WHITE

                return (
                  <div key={etapa.num} style={{ borderBottom: esUltima ? 'none' : `1px solid ${JA.BORDER}` }}>
                    {/* Cabecera de la etapa */}
                    <div style={{ padding: '14px 18px', background: bgHeader,
                      borderLeft: `4px solid ${colorBorde}`,
                      display: 'flex', alignItems: 'center', gap: '12px' }}>

                      {/* Ícono de estado */}
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                        background: completada ? '#D1FAE5' : activa ? '#DBEAFE' : conError ? '#FEE2E2' : JA.SURFACE,
                        border: `2px solid ${colorBorde}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                        {completada ? '✓' : conError ? '✗' : activa ? <Spinner /> : etapa.num}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600,
                          color: completada ? JA.GREEN : activa ? JA.BLUE : conError ? JA.RED : JA.GREY }}>
                          {etapa.icono} {etapa.titulo}
                        </div>
                        {activa && (
                          <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '2px' }}>
                            En proceso…
                          </div>
                        )}
                      </div>

                      {completada && (
                        <span style={{ fontSize: '11px', padding: '2px 8px', background: '#D1FAE5',
                          color: JA.GREEN, borderRadius: '2px', fontWeight: 600 }}>
                          Completado
                        </span>
                      )}
                    </div>

                    {/* Detalles de la etapa */}
                    {(etapa.detalles.length > 0 || etapa.subformatos.length > 0) && (
                      <div style={{ paddingLeft: '54px', paddingRight: '18px',
                        paddingTop: '8px', paddingBottom: '10px', background: JA.BG }}>

                        {/* Líneas de detalle */}
                        {etapa.detalles.map((d, i) => (
                          <div key={i} style={{ fontSize: '12px', color: JA.GREY, marginBottom: '4px',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            animation: 'fadeIn 0.3s ease' }}>
                            <span style={{ color: JA.GREEN, fontSize: '10px' }}>└─</span>
                            {d}
                          </div>
                        ))}

                        {/* Sub-ítems de formatos (etapa 4) */}
                        {etapa.subformatos.map(f => (
                          <div key={f.codigo} style={{ display: 'flex', alignItems: 'center', gap: '8px',
                            marginBottom: '4px', fontSize: '12px', animation: 'fadeIn 0.3s ease' }}>
                            <span style={{ color: JA.GREEN, fontSize: '10px' }}>└─</span>
                            <span style={{ width: '24px', height: '24px', background: f.estado === 'ok' ? JA.NAVY : f.estado === 'activa' ? '#3B82F6' : JA.SURFACE,
                              color: f.estado === 'pendiente' ? JA.GREY : JA.WHITE,
                              borderRadius: '2px', display: 'inline-flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: '9px', fontWeight: 800, flexShrink: 0 }}>
                              {f.estado === 'ok' ? '✓' : f.estado === 'activa' ? '…' : f.codigo}
                            </span>
                            <span style={{ color: JA.TEXT, fontWeight: 500 }}>
                              Formato {f.codigo}
                              {f.nombre && <span style={{ color: JA.GREY, fontWeight: 400 }}> — {f.nombre}</span>}
                            </span>
                            {f.detalle && (
                              <span style={{ color: JA.GREY, marginLeft: 'auto', fontSize: '11px' }}>{f.detalle}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA: RESUMEN
        ══════════════════════════════════════════════════════════ */}
        {vista === 'resumen' && resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Estado global */}
            <div style={{ background: resultado.resumenExcepciones.criticas > 0 ? JA.AMBER_BG : JA.GREEN_BG,
              border: `1px solid ${resultado.resumenExcepciones.criticas > 0 ? '#FDE68A' : '#BBF7D0'}`,
              borderRadius: '4px', padding: '20px 22px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>
                {resultado.resumenExcepciones.criticas > 0 ? '⚠️' : '✅'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: JA.TEXT, marginBottom: '4px' }}>
                {resultado.resumenExcepciones.criticas === 0
                  ? '¡Exógenas generadas sin problemas!'
                  : `Generadas — ${resultado.resumenExcepciones.criticas} situación(es) a revisar`}
              </div>
              <div style={{ fontSize: '13px', color: JA.GREY }}>
                Procesé {resultado.asientosProcesados.toLocaleString('es-CO')} movimientos.{' '}
                {resultado.resumenExcepciones.descripcionResumen}
              </div>
            </div>

            {/* Tabla de formatos */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 18px', background: JA.SURFACE, borderBottom: `1px solid ${JA.BORDER}`,
                fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: JA.GREY }}>
                Resultado por formato
              </div>
              {resultado.resumenFormatos.map(f => {
                const totalPrincipal = Object.entries(f.totales).find(([k]) => k !== 'totalFilas' && k.startsWith('total'))?.[1] ?? 0
                return (
                  <div key={f.codigo} style={{ padding: '13px 18px', borderBottom: `1px solid ${JA.BORDER}`,
                    display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', background: JA.NAVY, borderRadius: '2px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 800, color: JA.WHITE, flexShrink: 0 }}>
                      {f.codigo}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>{f.nombre}</div>
                      <div style={{ fontSize: '12px', color: JA.GREY, marginTop: '2px' }}>
                        {f.totalFilas.toLocaleString('es-CO')} {f.totalFilas === 1 ? 'tercero' : 'terceros'} · {fmtCOP(totalPrincipal)}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '2px', fontWeight: 600,
                      background: f.excepcionesCriticas > 0 ? '#FEE2E2' : f.excepcionesMedia > 0 ? '#FEF3C7' : '#D1FAE5',
                      color: f.excepcionesCriticas > 0 ? JA.RED : f.excepcionesMedia > 0 ? JA.AMBER : JA.GREEN }}>
                      {f.excepcionesCriticas > 0 ? `${f.excepcionesCriticas} críticas` : f.excepcionesMedia > 0 ? `${f.excepcionesMedia} alertas` : '✓ OK'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Resumen del stepper completado */}
            <details style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px' }}>
              <summary style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 600, color: JA.GREY, cursor: 'pointer' }}>
                Ver detalle del proceso ejecutado
              </summary>
              <div style={{ padding: '0 18px 14px' }}>
                {etapas.filter(e => e.estado === 'ok').map(e => (
                  <div key={e.num} style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: JA.TEXT }}>{e.icono} {e.titulo}</div>
                    {e.detalles.map((d, i) => (
                      <div key={i} style={{ fontSize: '11px', color: JA.GREY, paddingLeft: '16px', marginTop: '3px' }}>└─ {d}</div>
                    ))}
                    {e.subformatos.map(f => (
                      <div key={f.codigo} style={{ fontSize: '11px', color: JA.GREY, paddingLeft: '16px', marginTop: '3px' }}>
                        └─ Formato {f.codigo}: {f.detalle}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </details>

            {/* Advertencias y cuentas sin regla */}
            {resultado.advertenciasCsv.length > 0 && (
              <details style={{ background: JA.AMBER_BG, border: '1px solid #FDE68A', borderRadius: '2px', padding: '10px 14px' }}>
                <summary style={{ fontSize: '12px', fontWeight: 600, color: JA.AMBER, cursor: 'pointer' }}>
                  {resultado.advertenciasCsv.length} advertencia(s) al leer el archivo
                </summary>
                <ul style={{ margin: '8px 0 0', paddingLeft: '16px', fontSize: '11px', color: '#92400E' }}>
                  {resultado.advertenciasCsv.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </details>
            )}

            {/* Acciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {resultado.tarjetasExcepciones.length > 0 && (
                <button onClick={() => { setVista('excepciones'); setIndiceExcepcion(0) }}
                  style={{ padding: '15px', background: JA.NAVY, color: JA.WHITE, border: 'none',
                    borderRadius: '4px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  🔍 Revisar {resultado.tarjetasExcepciones.length} situación(es) pendientes
                </button>
              )}
              <button onClick={exportarExcel} disabled={exportando}
                style={{ padding: '13px', background: resultado.tarjetasExcepciones.length === 0 ? JA.GOLD : JA.WHITE,
                  color: resultado.tarjetasExcepciones.length === 0 ? JA.NAVY : JA.GREY,
                  border: `1px solid ${resultado.tarjetasExcepciones.length === 0 ? JA.GOLD : JA.BORDER}`,
                  borderRadius: '4px', fontSize: '13px', fontWeight: resultado.tarjetasExcepciones.length === 0 ? 700 : 400,
                  cursor: exportando ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                ⬇ {exportando ? 'Generando Excel…' : 'Descargar Excel para el Prevalidador DIAN'}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA: EXCEPCIONES
        ══════════════════════════════════════════════════════════ */}
        {vista === 'excepciones' && resultado && (() => {
          const tarjetas = resultado.tarjetasExcepciones
          const tarjeta = tarjetas[indiceExcepcion]
          const resuelta = excepcionesResueltas.get(indiceExcepcion)
          const severidadColor = tarjeta?.excepcionOriginal.severidad === 'alta' ? JA.RED
            : tarjeta?.excepcionOriginal.severidad === 'media' ? JA.AMBER : JA.BLUE

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Progreso */}
              <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: JA.TEXT }}>
                    Situación {indiceExcepcion + 1} de {tarjetas.length}
                  </span>
                  <span style={{ fontSize: '12px', color: JA.GREEN, fontWeight: 600 }}>
                    {excepcionesResueltas.size} resueltas
                  </span>
                </div>
                <div style={{ height: '5px', background: JA.SURFACE, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: JA.GREEN, width: `${(excepcionesResueltas.size / tarjetas.length) * 100}%`, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {tarjetas.map((t, i) => (
                    <button key={i} onClick={() => setIndiceExcepcion(i)}
                      style={{ width: '26px', height: '26px', borderRadius: '2px', border: 'none', cursor: 'pointer',
                        fontSize: '10px', fontWeight: 700,
                        background: excepcionesResueltas.has(i) ? JA.GREEN : i === indiceExcepcion ? JA.NAVY
                          : t.excepcionOriginal.severidad === 'alta' ? '#FEE2E2' : '#FEF3C7',
                        color: excepcionesResueltas.has(i) || i === indiceExcepcion ? JA.WHITE : JA.TEXT }}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tarjeta */}
              {tarjeta && (
                <div style={{ background: JA.WHITE, border: `2px solid ${resuelta ? JA.GREEN : severidadColor}`, borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', background: resuelta ? JA.GREEN_BG
                    : tarjeta.excepcionOriginal.severidad === 'alta' ? JA.RED_BG : JA.AMBER_BG,
                    borderBottom: `1px solid ${resuelta ? '#BBF7D0' : tarjeta.excepcionOriginal.severidad === 'alta' ? '#FECACA' : '#FDE68A'}`,
                    display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '26px' }}>{resuelta ? '✅' : tarjeta.icono}</span>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: JA.TEXT }}>
                        {resuelta ? 'Situación resuelta' : tarjeta.titulo}
                      </div>
                      {!resuelta && (
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '2px', fontWeight: 700, marginTop: '4px', display: 'inline-block',
                          background: tarjeta.excepcionOriginal.severidad === 'alta' ? '#FEE2E2' : '#FEF3C7',
                          color: severidadColor }}>
                          {tarjeta.excepcionOriginal.severidad === 'alta' ? 'CRÍTICA — la DIAN puede rechazar esto' : 'ALERTA — revise antes de enviar'}
                        </span>
                      )}
                    </div>
                  </div>

                  {!resuelta && (
                    <div style={{ padding: '20px' }}>
                      <p style={{ fontSize: '14px', color: JA.TEXT, lineHeight: '1.7', margin: '0 0 14px' }}>
                        {tarjeta.explicacion}
                      </p>
                      {tarjeta.contexto && Object.values(tarjeta.contexto).some(Boolean) && (
                        <div style={{ background: JA.SURFACE, borderRadius: '2px', padding: '10px 14px',
                          marginBottom: '14px', display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                          {tarjeta.contexto.cuenta && <InfoDato label="Cuenta" valor={`${tarjeta.contexto.cuenta}${tarjeta.contexto.nombreCuenta ? ` — ${tarjeta.contexto.nombreCuenta}` : ''}`} />}
                          {tarjeta.contexto.monto != null && <InfoDato label="Valor" valor={fmtCOP(tarjeta.contexto.monto)} />}
                          {tarjeta.contexto.documentoId && <InfoDato label="Comprobante" valor={tarjeta.contexto.documentoId} />}
                          {tarjeta.contexto.terceroId && <InfoDato label="NIT/Doc." valor={tarjeta.contexto.terceroId} />}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: JA.GREY, padding: '10px 13px',
                        background: JA.SURFACE, borderRadius: '2px', borderLeft: `3px solid ${JA.GREY}`,
                        marginBottom: '18px', lineHeight: '1.6' }}>
                        <strong>¿Por qué importa?</strong> {tarjeta.impacto}
                      </div>
                      {mostrarBusqueda && (
                        <div style={{ marginBottom: '14px', padding: '12px 14px', background: JA.BLUE_BG,
                          border: '1px solid #BFDBFE', borderRadius: '2px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: JA.BLUE, marginBottom: '6px' }}>
                            Buscar tercero por NIT o nombre
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input value={busquedaTercero} onChange={e => setBusquedaTercero(e.target.value)}
                              placeholder="Ej: 900123456 o EMPRESA XYZ"
                              style={{ ...inputSt, flex: 1 }} autoFocus />
                            <button onClick={() => resolverExcepcion('asignar_tercero', busquedaTercero)}
                              disabled={!busquedaTercero.trim()}
                              style={{ padding: '8px 14px', background: JA.BLUE, color: JA.WHITE, border: 'none',
                                borderRadius: '2px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                              Asignar
                            </button>
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tarjeta.acciones.map(accion => (
                          <button key={accion.tipo}
                            onClick={() => { if (accion.tipo === 'asignar_tercero') { setMostrarBusqueda(true); return } resolverExcepcion(accion.tipo) }}
                            style={{ padding: '11px 14px', border: `1px solid ${accion.primaria ? JA.NAVY : JA.BORDER}`,
                              borderRadius: '2px', background: accion.primaria ? JA.NAVY : JA.WHITE,
                              color: accion.primaria ? JA.WHITE : JA.TEXT,
                              fontSize: '13px', fontWeight: accion.primaria ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}>
                            {accion.etiqueta}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {resuelta && (
                    <div style={{ padding: '14px 20px', fontSize: '13px', color: JA.GREEN }}>
                      Acción: <strong>{etiquetaAccion(resuelta.accion)}</strong>
                      {resuelta.datos && <span style={{ color: JA.GREY }}> — {resuelta.datos}</span>}
                      <button onClick={() => setExcepcionesResueltas(prev => { const n = new Map(prev); n.delete(indiceExcepcion); return n })}
                        style={{ marginLeft: '12px', fontSize: '11px', color: JA.GREY, background: 'none',
                          border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cambiar</button>
                    </div>
                  )}
                </div>
              )}

              {/* Navegación */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setIndiceExcepcion(i => Math.max(0, i - 1))} disabled={indiceExcepcion === 0}
                  style={{ flex: 1, padding: '10px', background: JA.WHITE, border: `1px solid ${JA.BORDER}`,
                    borderRadius: '2px', fontSize: '13px', color: JA.TEXT, cursor: indiceExcepcion === 0 ? 'not-allowed' : 'pointer',
                    opacity: indiceExcepcion === 0 ? 0.4 : 1 }}>
                  ← Anterior
                </button>
                {excepcionesPendientes === 0 ? (
                  <button onClick={() => setVista('listo')}
                    style={{ flex: 2, padding: '10px', background: JA.GREEN, color: JA.WHITE, border: 'none',
                      borderRadius: '2px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                    ✓ Terminado → Ver resultado final
                  </button>
                ) : (
                  <button onClick={() => {
                    let sig = indiceExcepcion + 1
                    while (sig < tarjetas.length && excepcionesResueltas.has(sig)) sig++
                    if (sig < tarjetas.length) setIndiceExcepcion(sig); else setVista('listo')
                  }}
                    style={{ flex: 2, padding: '10px', background: JA.NAVY, color: JA.WHITE, border: 'none',
                      borderRadius: '2px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    Siguiente situación →
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

        {/* ══════════════════════════════════════════════════════════
            VISTA: LISTO
        ══════════════════════════════════════════════════════════ */}
        {vista === 'listo' && resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: JA.GREEN_BG, border: '1px solid #BBF7D0', borderRadius: '4px', padding: '28px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎉</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: JA.TEXT, marginBottom: '6px' }}>
                Exógenas listas para la DIAN
              </div>
              <p style={{ fontSize: '13px', color: JA.GREY, marginBottom: '22px', lineHeight: '1.6' }}>
                {excepcionesResueltas.size > 0
                  ? `Resolvió ${excepcionesResueltas.size} situación(es). El archivo está listo para cargar en el Prevalidador de la DIAN.`
                  : 'El archivo está listo para cargar en el Prevalidador de la DIAN.'}
              </p>
              <button onClick={exportarExcel} disabled={exportando}
                style={{ padding: '15px 30px', background: JA.GOLD, color: JA.NAVY, border: 'none',
                  borderRadius: '4px', fontSize: '15px', fontWeight: 800, cursor: exportando ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>⬇</span>
                {exportando ? 'Generando…' : 'Descargar Excel para el Prevalidador DIAN'}
              </button>
              <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '12px' }}>
                Verifique el archivo en el Prevalidador oficial de la DIAN antes de presentar.
              </div>
            </div>
            <button onClick={reiniciar} style={{ padding: '11px', background: 'transparent',
              border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '13px', color: JA.GREY, cursor: 'pointer' }}>
              Generar exógenas de otra empresa
            </button>
          </div>
        )}
      </div>

      {/* Estilos globales */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ width: '14px', height: '14px', border: '2px solid #BFDBFE',
      borderTop: `2px solid ${JA.BLUE}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
  const m: Record<AccionExcepcion, string> = {
    asignar_tercero: 'Tercero asignado', corregir_dv: 'DV corregido',
    asignar_concepto: 'Concepto asignado', excluir: 'Excluido del reporte',
    confirmar_correcto: 'Confirmado correcto', diferir: 'Pendiente de revisión',
  }
  return m[accion] ?? accion
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
  fontSize: '13px', color: JA.TEXT, background: JA.WHITE, boxSizing: 'border-box',
  fontFamily: 'Inter, sans-serif', outline: 'none',
}
