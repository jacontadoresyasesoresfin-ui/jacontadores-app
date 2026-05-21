'use client'
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useClient } from '../ClientContext'
import { MUNICIPIOS_LISTA, DEPARTAMENTOS } from '@/lib/exogenas/config/divipola'
import { INFO_FORMATOS, VERSION_POR_ANIO } from '@/lib/exogenas/registry/formato-registry'
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
  { num: 1, titulo: 'Leer archivo de Siigo',   icono: '📂', estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 2, titulo: 'Cargar reglas DIAN 2025', icono: '📋', estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 3, titulo: 'Analizar movimientos',     icono: '🔍', estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 4, titulo: 'Generar formatos DIAN',    icono: '📊', estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 5, titulo: 'Validar excepciones',      icono: '✅', estado: 'pendiente', detalles: [], subformatos: [] },
]

const STORAGE_KEY = 'ja_exogenas_config_v2'
const FORMATOS_DISPONIBLES = ['1001', '1005', '1006', '1007', '1010']

interface ConfigGuardada {
  nitDeclarante: string
  dvDeclarante: string
  razonSocial: string
  tipoDeclarante: string
  municipioCodigo: string
  formatosSeleccionados: string[]
  anioGravable: number
}

const CONFIG_DEFECTO: ConfigGuardada = {
  nitDeclarante: '',
  dvDeclarante: '',
  razonSocial: '',
  tipoDeclarante: 'contribuyente',
  municipioCodigo: '11001',
  formatosSeleccionados: FORMATOS_DISPONIBLES,
  anioGravable: 2025,
}

// ── Algoritmo DV módulo 11 (DIAN) ────────────────────────────────────────────
function calcularDV(nit: string): string {
  const digits = nit.replace(/\D/g, '')
  if (!digits || digits.length < 5) return ''
  const primos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[digits.length - 1 - i]) * primos[i]
  }
  const r = sum % 11
  return String(r === 0 || r === 1 ? r : 11 - r)
}

// ── Municipios agrupados por departamento ─────────────────────────────────────
const MUNICIPIOS_POR_DEPTO: Record<string, { codigo: string; nombre: string }[]> = {}
MUNICIPIOS_LISTA.forEach(m => {
  if (!MUNICIPIOS_POR_DEPTO[m.depto]) MUNICIPIOS_POR_DEPTO[m.depto] = []
  MUNICIPIOS_POR_DEPTO[m.depto].push({ codigo: m.codigo, nombre: m.nombre })
})
const DEPTOS_CON_MUNICIPIOS = Object.entries(DEPARTAMENTOS)
  .filter(([cod]) => MUNICIPIOS_POR_DEPTO[cod]?.length)
  .sort(([, a], [, b]) => a.localeCompare(b))

export default function ExogenasPage() {
  const { tenant } = useClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [vista, setVista] = useState<Vista>('inicio')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
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

  const [config, setConfig] = useState<ConfigGuardada>(CONFIG_DEFECTO)
  const [dvAuto, setDvAuto] = useState('')   // DV calculado automáticamente

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ConfigGuardada>
        setConfig(prev => ({ ...CONFIG_DEFECTO, ...prev, ...parsed }))
      } else if (tenant?.name) {
        setConfig(prev => ({ ...prev, razonSocial: tenant.name }))
      }
    } catch { /* ignorar */ }
  }, [tenant])

  // Auto-calcular DV cuando cambia el NIT
  useEffect(() => {
    const dv = calcularDV(config.nitDeclarante)
    setDvAuto(dv)
    if (dv && !config.dvDeclarante) {
      const next = { ...config, dvDeclarante: dv }
      setConfig(next)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
  }, [config.nitDeclarante]) // eslint-disable-line react-hooks/exhaustive-deps

  const actualizarConfig = (campo: keyof ConfigGuardada, valor: string | string[] | number) => {
    setConfig(prev => {
      const next = { ...prev, [campo]: valor }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const toggleFormato = (codigo: string) => {
    const actual = config.formatosSeleccionados
    const next = actual.includes(codigo) ? actual.filter(f => f !== codigo) : [...actual, codigo]
    if (next.length === 0) return  // al menos uno requerido
    actualizarConfig('formatosSeleccionados', next)
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = () => setDragOver(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.match(/\.(csv|txt|CSV)$/i)) { setArchivo(f); setError('') }
    else setError('Cargue un archivo .csv exportado desde Siigo.')
  }
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) { setArchivo(f); setError('') }
  }

  // ── Validación ───────────────────────────────────────────────────────────────
  const errNit = config.nitDeclarante && config.nitDeclarante.replace(/\D/g, '').length < 5
    ? 'El NIT debe tener al menos 5 dígitos' : ''
  const errDv = config.dvDeclarante && dvAuto && config.dvDeclarante !== dvAuto
    ? `El DV calculado es ${dvAuto} — verifique` : ''
  const puedeGenerar = !!archivo
    && config.nitDeclarante.replace(/\D/g, '').length >= 5
    && !!config.razonSocial.trim()
    && config.formatosSeleccionados.length > 0

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
      setPorcentaje((ev.etapa - 1) * 18 + 5)
    }
    if (ev.tipo === 'etapa_ok' && ev.etapa) {
      const e = ev.etapa
      actualizarEtapa(e, { estado: 'ok' })
      if (e === 1) {
        if (d.empresa) agregarDetalle(1, `Empresa detectada: ${d.empresa}`)
        if (d.periodo) agregarDetalle(1, `Período: ${d.periodo}`)
        agregarDetalle(1, `${Number(d.asientosCont).toLocaleString('es-CO')} movimientos contables`)
        if (Number(d.filasFallidas) > 0) agregarDetalle(1, `${d.filasFallidas} filas de encabezado/totales omitidas`)
        setPorcentaje(20)
      }
      if (e === 2) {
        agregarDetalle(2, `${d.totalReglas} reglas PUC → Formato DIAN cargadas`)
        if (Number(d.reglasPersonalizadas) > 0) agregarDetalle(2, `${d.reglasPersonalizadas} reglas personalizadas de su empresa`)
        setPorcentaje(35)
      }
      if (e === 3) {
        agregarDetalle(3, `${d.cuentasUnicas} cuentas PUC distintas en el período`)
        agregarDetalle(3, `${d.tercerosUnicos} terceros únicos identificados`)
        setPorcentaje(45)
      }
      if (e === 4) setPorcentaje(85)
      if (e === 5) {
        const criticas = Number(d.criticas), alertas = Number(d.alertas), sinRegla = Number(d.cuentasSinRegla)
        if (criticas === 0 && alertas === 0) agregarDetalle(5, 'Todo está en orden — sin situaciones pendientes')
        if (criticas > 0) agregarDetalle(5, `${criticas} situación(es) crítica(s) que requieren revisión`)
        if (alertas > 0) agregarDetalle(5, `${alertas} alerta(s) para revisar antes de enviar`)
        if (sinRegla > 0) agregarDetalle(5, `${sinRegla} cuenta(s) sin clasificación DIAN asignada`)
        setPorcentaje(100)
      }
    }
    if (ev.tipo === 'formato_inicio' && ev.codigo) {
      setEtapas(prev => prev.map(e =>
        e.num === 4
          ? { ...e, subformatos: e.subformatos.some(f => f.codigo === ev.codigo)
              ? e.subformatos.map(f => f.codigo === ev.codigo ? { ...f, estado: 'activa' as const } : f)
              : [...e.subformatos, { codigo: ev.codigo!, nombre: '', estado: 'activa' as const }] }
          : e
      ))
    }
    if (ev.tipo === 'formato_ok' && ev.codigo) {
      const totalFilas = Number(d.totalFilas ?? 0)
      const montoStr = d.montoFormateado as string ?? ''
      const excepciones = Number(d.excepcionesCnt ?? 0)
      const nombre = d.nombre as string ?? ''
      actualizarFormato(ev.codigo, {
        estado: 'ok', nombre,
        detalle: `${totalFilas.toLocaleString('es-CO')} ${totalFilas === 1 ? 'tercero' : 'terceros'}${montoStr ? ` · ${montoStr}` : ''}${excepciones > 0 ? ` · ⚠ ${excepciones} excep.` : ''}`,
      })
    }
    if (ev.tipo === 'fin' && d) { setResultado(d as unknown as ResultadoFinal); setVista('resumen') }
    if (ev.tipo === 'error') {
      setEtapas(prev => prev.map(e => e.estado === 'activa' ? { ...e, estado: 'error' } : e))
      setError(ev.mensaje ?? 'Error al procesar.')
      setVista('inicio')
    }
  }, [actualizarEtapa, agregarDetalle, actualizarFormato])

  // ── Generar exógenas ────────────────────────────────────────────────────────
  const generarExogenas = useCallback(async () => {
    if (!puedeGenerar || !archivo) return
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
      anioGravable: config.anioGravable,
      nitDeclarante: config.nitDeclarante.replace(/\D/g, ''),
      dvDeclarante: config.dvDeclarante,
      razonSocial: config.razonSocial,
      tipoDeclarante: config.tipoDeclarante,
      municipioCodigo: config.municipioCodigo,
      formatos: config.formatosSeleccionados,
    }))

    let recibiFinEvent = false
    try {
      const res = await fetch('/api/exogenas/generar', { method: 'POST', body: fd })

      // Si el servidor responde con error HTTP, mostrar el mensaje real
      if (!res.ok) {
        let detalle = `Error del servidor (${res.status})`
        try {
          const texto = await res.text()
          // Intentar parsear como NDJSON (el servidor podría enviar {tipo:'error',...})
          const lineas = texto.split('\n').filter(l => l.trim())
          for (const linea of lineas) {
            try {
              const ev = JSON.parse(linea) as Evento
              if (ev.tipo === 'error' && ev.mensaje) { detalle = ev.mensaje; break }
            } catch { /* no es JSON */ }
          }
          // Si no había JSON, mostrar los primeros caracteres del texto
          if (detalle.startsWith('Error del servidor') && texto) {
            detalle += ': ' + texto.replace(/<[^>]*>/g, '').trim().slice(0, 200)
          }
        } catch { /* ignorar */ }
        throw new Error(detalle)
      }

      if (!res.body) throw new Error('El servidor no devolvió datos (sin stream).')
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
          try {
            const ev = JSON.parse(linea) as Evento
            if (ev.tipo === 'fin') recibiFinEvent = true
            procesarEvento(ev)
          } catch { /* ignorar línea malformada */ }
        }
      }
      // Procesar residuo final
      if (buffer.trim()) {
        try {
          const ev = JSON.parse(buffer) as Evento
          if (ev.tipo === 'fin') recibiFinEvent = true
          procesarEvento(ev)
        } catch { /* ignorar */ }
      }

      // Stream terminó sin evento 'fin' ni 'error' → informar al usuario
      if (!recibiFinEvent) {
        throw new Error('El proceso terminó sin generar resultados. Verifique que el archivo CSV sea el Libro Auxiliar completo de Siigo con movimientos del período.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión con el servidor.')
      setVista('inicio')
    }
  }, [puedeGenerar, archivo, config, procesarEvento])

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
      a.download = `Exogenas_${config.nitDeclarante}_AG${config.anioGravable}_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar.')
    } finally { setExportando(false) }
  }, [resultado, config])

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
        <div style={{ width: '36px', height: '36px', background: JA.GOLD, borderRadius: '2px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', fontWeight: 800, color: JA.NAVY, flexShrink: 0 }}>E</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: JA.WHITE }}>Exógenas DIAN 2025</div>
          <div style={{ fontSize: '11px', color: '#94A3B8' }}>Medios magnéticos · Res. 000227/2025 · AG {config.anioGravable}</div>
        </div>
        {(vista === 'resumen' || vista === 'excepciones' || vista === 'listo') && (
          <button onClick={reiniciar} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2px', color: JA.WHITE, fontSize: '12px', cursor: 'pointer' }}>
            ← Nueva empresa
          </button>
        )}
      </div>

      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '28px 20px' }}>

        {/* Error global */}
        {error && (
          <div style={{ padding: '12px 16px', background: JA.RED_BG, border: '1px solid #FECACA',
            borderRadius: '2px', color: JA.RED, fontSize: '13px', marginBottom: '20px',
            display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span>⚠</span><span>{error}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA: INICIO — Formulario completo
        ══════════════════════════════════════════════════════════ */}
        {vista === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* ─── SECCIÓN 1: Datos del declarante ─── */}
            <Seccion num="1" titulo="Datos del declarante" requerido>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
                {/* NIT */}
                <Campo label="NIT del declarante" requerido>
                  <input
                    value={config.nitDeclarante}
                    onChange={e => actualizarConfig('nitDeclarante', e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="900123456"
                    maxLength={12}
                    style={{ ...inputSt, borderColor: errNit ? JA.RED : JA.BORDER }}
                  />
                  {errNit && <span style={{ fontSize: '11px', color: JA.RED, marginTop: '3px', display: 'block' }}>{errNit}</span>}
                </Campo>
                {/* DV */}
                <Campo label="Dígito de verificación" requerido>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={config.dvDeclarante}
                      onChange={e => actualizarConfig('dvDeclarante', e.target.value.replace(/\D/g, '').slice(0, 1))}
                      placeholder={dvAuto || '0'}
                      maxLength={1}
                      style={{ ...inputSt, borderColor: errDv ? JA.AMBER : JA.BORDER }}
                    />
                    {dvAuto && (
                      <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                        fontSize: '10px', color: config.dvDeclarante === dvAuto ? JA.GREEN : JA.GREY }}>
                        {config.dvDeclarante === dvAuto ? '✓' : `auto: ${dvAuto}`}
                      </span>
                    )}
                  </div>
                  {errDv && <span style={{ fontSize: '11px', color: JA.AMBER, marginTop: '3px', display: 'block' }}>{errDv}</span>}
                  {dvAuto && !config.dvDeclarante && (
                    <button onClick={() => actualizarConfig('dvDeclarante', dvAuto)}
                      style={{ fontSize: '10px', color: JA.BLUE, background: 'none', border: 'none',
                        cursor: 'pointer', padding: '2px 0', textDecoration: 'underline', marginTop: '2px' }}>
                      Usar {dvAuto} (calculado)
                    </button>
                  )}
                </Campo>
              </div>

              {/* Razón social */}
              <Campo label="Razón social / Nombre" requerido>
                <input
                  value={config.razonSocial}
                  onChange={e => actualizarConfig('razonSocial', e.target.value)}
                  placeholder="Ej: EMPRESA EJEMPLO S.A.S"
                  style={inputSt}
                />
              </Campo>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Tipo declarante */}
                <Campo label="Tipo de declarante">
                  <select value={config.tipoDeclarante}
                    onChange={e => actualizarConfig('tipoDeclarante', e.target.value)}
                    style={inputSt}>
                    <option value="contribuyente">Contribuyente</option>
                    <option value="gran_contribuyente">Gran contribuyente</option>
                    <option value="autoretenedor">Autorretenedor</option>
                    <option value="agente_retenedor">Agente retenedor</option>
                    <option value="persona_natural">Persona natural obligada</option>
                    <option value="entidad_sin_animo">Entidad sin ánimo de lucro</option>
                  </select>
                </Campo>

                {/* Año gravable */}
                <Campo label="Año gravable">
                  <select value={config.anioGravable}
                    onChange={e => actualizarConfig('anioGravable', Number(e.target.value))}
                    style={inputSt}>
                    <option value={2025}>2025 (presentación 2026)</option>
                    <option value={2024}>2024 (presentación 2025)</option>
                  </select>
                </Campo>
              </div>

              {/* Municipio */}
              <Campo label="Municipio de la empresa (DIVIPOLA)">
                <select value={config.municipioCodigo}
                  onChange={e => actualizarConfig('municipioCodigo', e.target.value)}
                  style={inputSt}>
                  {DEPTOS_CON_MUNICIPIOS.map(([codDepto, nombreDepto]) => (
                    <optgroup key={codDepto} label={nombreDepto}>
                      {(MUNICIPIOS_POR_DEPTO[codDepto] ?? []).map(m => (
                        <option key={m.codigo} value={m.codigo}>{m.nombre} ({m.codigo})</option>
                      ))}
                    </optgroup>
                  ))}
                  <optgroup label="EXTRANJERO">
                    <option value="00000">EXTRANJERO (00000)</option>
                  </optgroup>
                </select>
              </Campo>
            </Seccion>

            {/* ─── SECCIÓN 2: Archivo de Siigo ─── */}
            <Seccion num="2" titulo="Libro auxiliar de Siigo" requerido>
              <div
                onClick={() => !archivo && fileRef.current?.click()}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                style={{ border: `2px dashed ${dragOver ? JA.NAVY : archivo ? JA.GREEN : JA.BORDER}`,
                  borderRadius: '4px', padding: '28px 20px', textAlign: 'center',
                  background: dragOver ? JA.BLUE_BG : archivo ? JA.GREEN_BG : JA.WHITE,
                  cursor: archivo ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                <input ref={fileRef} type="file" accept=".csv,.txt,.CSV" style={{ display: 'none' }} onChange={onFileChange} />
                {!archivo ? (
                  <>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>📂</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: JA.TEXT, marginBottom: '5px' }}>
                      Arrastre aquí el archivo .csv de Siigo
                    </div>
                    <div style={{ fontSize: '12px', color: JA.GREY, marginBottom: '12px' }}>
                      o haga clic para buscar en su computador
                    </div>
                    <div style={{ fontSize: '11px', color: JA.GREY, background: JA.SURFACE, borderRadius: '2px',
                      padding: '8px 14px', display: 'inline-block', textAlign: 'left', lineHeight: '1.7' }}>
                      <strong>¿Cómo exportar desde Siigo Nube?</strong><br />
                      Contabilidad → Libros → Libro Auxiliar → seleccione <em>Todo el año {config.anioGravable}</em> → Exportar CSV
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '32px', marginBottom: '6px' }}>✅</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: JA.GREEN, marginBottom: '3px' }}>{archivo.name}</div>
                    <div style={{ fontSize: '12px', color: JA.GREY, marginBottom: '10px' }}>
                      {(archivo.size / 1024).toFixed(0)} KB · listo para procesar
                    </div>
                    <button onClick={e => { e.stopPropagation(); setArchivo(null); if (fileRef.current) fileRef.current.value = '' }}
                      style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${JA.BORDER}`,
                        borderRadius: '2px', fontSize: '12px', color: JA.GREY, cursor: 'pointer' }}>
                      Cambiar archivo
                    </button>
                  </>
                )}
              </div>

              <div style={{ fontSize: '11px', color: JA.GREY, padding: '8px 12px', background: JA.AMBER_BG,
                border: '1px solid #FDE68A', borderRadius: '2px', lineHeight: '1.6', marginTop: '4px' }}>
                <strong>Importante:</strong> El libro auxiliar debe incluir <em>todos los movimientos del año {config.anioGravable}</em>,
                con las columnas de tercero (NIT/CC), cuenta PUC, débitos y créditos. Exporte en formato CSV con detalle de movimientos.
              </div>

              {/* Descarga CSV de prueba */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                background: JA.BLUE_BG, border: '1px solid #BFDBFE', borderRadius: '2px' }}>
                <span style={{ fontSize: '13px' }}>🧪</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: JA.BLUE }}>¿Sin archivo de Siigo? Use el CSV de prueba</div>
                  <div style={{ fontSize: '10px', color: JA.GREY }}>Datos ficticios con cuentas PUC reales para verificar que el sistema funciona</div>
                </div>
                <a href="/libro-auxiliar-prueba.csv" download
                  style={{ padding: '5px 12px', background: JA.BLUE, color: JA.WHITE, borderRadius: '2px',
                    fontSize: '11px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Descargar CSV prueba
                </a>
              </div>
            </Seccion>

            {/* ─── SECCIÓN 3: Formatos a generar ─── */}
            <Seccion num="3" titulo="Formatos a generar">
              <div style={{ fontSize: '12px', color: JA.GREY, marginBottom: '10px', lineHeight: '1.5' }}>
                Seleccione los formatos según las obligaciones de la empresa para el año gravable {config.anioGravable}.
                El sistema generará automáticamente cada formato a partir del libro auxiliar.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {FORMATOS_DISPONIBLES.map(codigo => {
                  const info = INFO_FORMATOS[codigo]
                  const version = VERSION_POR_ANIO[config.anioGravable]?.[codigo] ?? 'v1'
                  const seleccionado = config.formatosSeleccionados.includes(codigo)
                  return (
                    <label key={codigo}
                      style={{ display: 'flex', gap: '12px', alignItems: 'flex-start',
                        padding: '12px 14px', borderRadius: '2px', cursor: 'pointer',
                        background: seleccionado ? JA.BLUE_BG : JA.WHITE,
                        border: `1px solid ${seleccionado ? '#BFDBFE' : JA.BORDER}`,
                        transition: 'all 0.12s' }}>
                      <input type="checkbox" checked={seleccionado} onChange={() => toggleFormato(codigo)}
                        style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: JA.NAVY, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ width: '36px', height: '22px', background: seleccionado ? JA.NAVY : JA.SURFACE,
                            color: seleccionado ? JA.WHITE : JA.GREY, borderRadius: '2px', display: 'inline-flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
                            {codigo}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>{info?.nombre}</span>
                          <span style={{ fontSize: '10px', color: JA.GREY, marginLeft: 'auto', padding: '1px 6px',
                            background: JA.SURFACE, borderRadius: '2px' }}>{version}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: JA.GREY, lineHeight: '1.5', paddingLeft: '44px' }}>
                          {info?.descripcion}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
              {config.formatosSeleccionados.length === 0 && (
                <div style={{ fontSize: '12px', color: JA.RED, marginTop: '6px' }}>
                  Seleccione al menos un formato para continuar.
                </div>
              )}
            </Seccion>

            {/* ─── Validación y botón generar ─── */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '16px 18px' }}>
              {/* Resumen de validación */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <ValidacionItem ok={config.nitDeclarante.replace(/\D/g, '').length >= 5} label="NIT del declarante" />
                <ValidacionItem ok={!!config.razonSocial.trim()} label="Razón social" />
                <ValidacionItem ok={!!archivo} label="Archivo de Siigo (.csv)" />
                <ValidacionItem ok={config.formatosSeleccionados.length > 0} label={`${config.formatosSeleccionados.length} formato(s) seleccionado(s)`} />
              </div>

              <button onClick={generarExogenas} disabled={!puedeGenerar}
                style={{ width: '100%', padding: '18px', borderRadius: '4px', border: 'none',
                  background: puedeGenerar ? JA.NAVY : '#CBD5E1',
                  color: JA.WHITE, fontSize: '16px', fontWeight: 700,
                  cursor: puedeGenerar ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  transition: 'background 0.2s' }}>
                <span style={{ fontSize: '20px' }}>⚡</span>
                {puedeGenerar
                  ? `Generar Exógenas AG ${config.anioGravable} — ${config.formatosSeleccionados.length} formato(s)`
                  : 'Complete los campos requeridos para continuar'}
              </button>

              {puedeGenerar && (
                <div style={{ fontSize: '11px', color: JA.GREY, textAlign: 'center', marginTop: '10px', lineHeight: '1.6' }}>
                  El sistema clasificará los movimientos del Libro Auxiliar según el PUC colombiano
                  y la Resolución DIAN 000227/2025. Podrá seguir cada etapa en tiempo real.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA: PROCESANDO — Stepper en tiempo real
        ══════════════════════════════════════════════════════════ */}
        {vista === 'procesando' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Info de lo que se está generando */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
              padding: '12px 18px', marginBottom: '12px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '10px', color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresa</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>{config.razonSocial}</div>
              </div>
              <div style={{ borderLeft: `1px solid ${JA.BORDER}`, paddingLeft: '16px' }}>
                <div style={{ fontSize: '10px', color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NIT</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>{config.nitDeclarante}-{config.dvDeclarante}</div>
              </div>
              <div style={{ borderLeft: `1px solid ${JA.BORDER}`, paddingLeft: '16px' }}>
                <div style={{ fontSize: '10px', color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Año gravable</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: JA.NAVY }}>{config.anioGravable}</div>
              </div>
              <div style={{ borderLeft: `1px solid ${JA.BORDER}`, paddingLeft: '16px' }}>
                <div style={{ fontSize: '10px', color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Formatos</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>{config.formatosSeleccionados.join(', ')}</div>
              </div>
            </div>

            {/* Barra de progreso */}
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
                    <div style={{ padding: '14px 18px', background: bgHeader, borderLeft: `4px solid ${colorBorde}`,
                      display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                        {activa && <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '2px' }}>En proceso…</div>}
                      </div>
                      {completada && (
                        <span style={{ fontSize: '11px', padding: '2px 8px', background: '#D1FAE5',
                          color: JA.GREEN, borderRadius: '2px', fontWeight: 600 }}>Completado</span>
                      )}
                    </div>
                    {(etapa.detalles.length > 0 || etapa.subformatos.length > 0) && (
                      <div style={{ paddingLeft: '54px', paddingRight: '18px', paddingTop: '8px', paddingBottom: '10px', background: JA.BG }}>
                        {etapa.detalles.map((d, i) => (
                          <div key={i} style={{ fontSize: '12px', color: JA.GREY, marginBottom: '4px',
                            display: 'flex', alignItems: 'center', gap: '6px', animation: 'fadeIn 0.3s ease' }}>
                            <span style={{ color: JA.GREEN, fontSize: '10px' }}>└─</span>{d}
                          </div>
                        ))}
                        {etapa.subformatos.map(f => (
                          <div key={f.codigo} style={{ display: 'flex', alignItems: 'center', gap: '8px',
                            marginBottom: '4px', fontSize: '12px', animation: 'fadeIn 0.3s ease' }}>
                            <span style={{ color: JA.GREEN, fontSize: '10px' }}>└─</span>
                            <span style={{ width: '24px', height: '24px',
                              background: f.estado === 'ok' ? JA.NAVY : f.estado === 'activa' ? '#3B82F6' : JA.SURFACE,
                              color: f.estado === 'pendiente' ? JA.GREY : JA.WHITE,
                              borderRadius: '2px', display: 'inline-flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: '9px', fontWeight: 800, flexShrink: 0 }}>
                              {f.estado === 'ok' ? '✓' : f.estado === 'activa' ? '…' : f.codigo}
                            </span>
                            <span style={{ color: JA.TEXT, fontWeight: 500 }}>
                              Formato {f.codigo}{f.nombre && <span style={{ color: JA.GREY, fontWeight: 400 }}> — {f.nombre}</span>}
                            </span>
                            {f.detalle && <span style={{ color: JA.GREY, marginLeft: 'auto', fontSize: '11px' }}>{f.detalle}</span>}
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
            {/* Encabezado empresa */}
            <div style={{ background: JA.NAVY, borderRadius: '2px', padding: '14px 18px',
              display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div style={{ width: '42px', height: '42px', background: JA.GOLD, borderRadius: '2px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 800, color: JA.NAVY, flexShrink: 0 }}>
                {config.razonSocial.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: JA.WHITE }}>{config.razonSocial}</div>
                <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                  NIT {config.nitDeclarante}-{config.dvDeclarante} · AG {config.anioGravable} · {config.tipoDeclarante}
                </div>
              </div>
            </div>

            {/* Estado global */}
            <div style={{ background: resultado.resumenExcepciones.criticas > 0 ? JA.AMBER_BG : JA.GREEN_BG,
              border: `1px solid ${resultado.resumenExcepciones.criticas > 0 ? '#FDE68A' : '#BBF7D0'}`,
              borderRadius: '4px', padding: '20px 22px' }}>
              <div style={{ fontSize: '26px', marginBottom: '8px' }}>
                {resultado.resumenExcepciones.criticas > 0 ? '⚠️' : '✅'}
              </div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: JA.TEXT, marginBottom: '4px' }}>
                {resultado.resumenExcepciones.criticas === 0
                  ? '¡Exógenas generadas sin problemas!'
                  : `Generadas — ${resultado.resumenExcepciones.criticas} situación(es) a revisar`}
              </div>
              <div style={{ fontSize: '13px', color: JA.GREY }}>
                Procesé {resultado.asientosProcesados.toLocaleString('es-CO')} movimientos contables.{' '}
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
                      fontSize: '10px', fontWeight: 800, color: JA.WHITE, flexShrink: 0 }}>{f.codigo}</div>
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

            {/* Advertencias CSV */}
            {resultado.advertenciasCsv.length > 0 && (
              <details style={{ background: JA.AMBER_BG, border: '1px solid #FDE68A', borderRadius: '2px', padding: '10px 14px' }}>
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
              <details style={{ background: JA.SURFACE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '10px 14px' }}>
                <summary style={{ fontSize: '12px', fontWeight: 600, color: JA.GREY, cursor: 'pointer' }}>
                  {resultado.cuentasSinRegla.length} cuenta(s) PUC sin clasificación DIAN asignada
                </summary>
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {resultado.cuentasSinRegla.map(c => (
                    <span key={c} style={{ fontSize: '11px', padding: '2px 8px', background: JA.WHITE,
                      border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontFamily: 'monospace' }}>{c}</span>
                  ))}
                </div>
              </details>
            )}

            {/* Detalle del proceso */}
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
                style={{ padding: '13px',
                  background: resultado.tarjetasExcepciones.length === 0 ? JA.GOLD : JA.WHITE,
                  color: resultado.tarjetasExcepciones.length === 0 ? JA.NAVY : JA.GREY,
                  border: `1px solid ${resultado.tarjetasExcepciones.length === 0 ? JA.GOLD : JA.BORDER}`,
                  borderRadius: '4px', fontSize: '13px',
                  fontWeight: resultado.tarjetasExcepciones.length === 0 ? 700 : 400,
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
                  <div style={{ height: '100%', background: JA.GREEN,
                    width: `${(excepcionesResueltas.size / tarjetas.length) * 100}%`, transition: 'width 0.3s' }} />
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
                  <div style={{ padding: '16px 20px',
                    background: resuelta ? JA.GREEN_BG : tarjeta.excepcionOriginal.severidad === 'alta' ? JA.RED_BG : JA.AMBER_BG,
                    borderBottom: `1px solid ${resuelta ? '#BBF7D0' : tarjeta.excepcionOriginal.severidad === 'alta' ? '#FECACA' : '#FDE68A'}`,
                    display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '26px' }}>{resuelta ? '✅' : tarjeta.icono}</span>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: JA.TEXT }}>
                        {resuelta ? 'Situación resuelta' : tarjeta.titulo}
                      </div>
                      {!resuelta && (
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '2px', fontWeight: 700,
                          marginTop: '4px', display: 'inline-block',
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
                    borderRadius: '2px', fontSize: '13px', color: JA.TEXT,
                    cursor: indiceExcepcion === 0 ? 'not-allowed' : 'pointer', opacity: indiceExcepcion === 0 ? 0.4 : 1 }}>
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
            <div style={{ background: JA.GREEN_BG, border: '1px solid #BBF7D0', borderRadius: '4px',
              padding: '28px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎉</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: JA.TEXT, marginBottom: '6px' }}>
                Exógenas listas para la DIAN
              </div>
              <div style={{ fontSize: '13px', color: JA.GREY, marginBottom: '6px' }}>
                {config.razonSocial} · NIT {config.nitDeclarante}-{config.dvDeclarante} · AG {config.anioGravable}
              </div>
              <p style={{ fontSize: '13px', color: JA.GREY, marginBottom: '22px', lineHeight: '1.6' }}>
                {excepcionesResueltas.size > 0
                  ? `Resolvió ${excepcionesResueltas.size} situación(es). El archivo está listo para el Prevalidador DIAN.`
                  : 'El archivo está listo para cargar en el Prevalidador de la DIAN.'}
              </p>
              <button onClick={exportarExcel} disabled={exportando}
                style={{ padding: '15px 30px', background: JA.GOLD, color: JA.NAVY, border: 'none',
                  borderRadius: '4px', fontSize: '15px', fontWeight: 800,
                  cursor: exportando ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>⬇</span>
                {exportando ? 'Generando…' : 'Descargar Excel para el Prevalidador DIAN'}
              </button>
              <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '12px' }}>
                Verifique siempre en el Prevalidador oficial de la DIAN antes de presentar.
              </div>
            </div>
            <button onClick={reiniciar} style={{ padding: '11px', background: 'transparent',
              border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '13px', color: JA.GREY, cursor: 'pointer' }}>
              Generar exógenas de otra empresa
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Seccion({ num, titulo, requerido, children }: {
  num: string; titulo: string; requerido?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', background: JA.SURFACE, borderBottom: `1px solid ${JA.BORDER}`,
        display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '24px', height: '24px', background: JA.NAVY, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 800, color: JA.WHITE, flexShrink: 0 }}>{num}</div>
        <span style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT }}>{titulo}</span>
        {requerido && (
          <span style={{ fontSize: '10px', padding: '1px 6px', background: '#FEE2E2', color: JA.RED,
            borderRadius: '2px', fontWeight: 600 }}>REQUERIDO</span>
        )}
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, requerido, children }: { label: string; requerido?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: JA.GREY,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>
        {label}{requerido && <span style={{ color: JA.RED, marginLeft: '3px' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function ValidacionItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
        background: ok ? JA.GREEN : JA.BORDER, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: JA.WHITE }}>
        {ok ? '✓' : ''}
      </span>
      <span style={{ fontSize: '12px', color: ok ? JA.GREEN : JA.GREY }}>{label}</span>
    </div>
  )
}

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

const JA_CONST = JA

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${JA_CONST.BORDER}`, borderRadius: '2px',
  fontSize: '13px', color: JA_CONST.TEXT, background: JA_CONST.WHITE, boxSizing: 'border-box',
  fontFamily: 'Inter, sans-serif', outline: 'none',
}
