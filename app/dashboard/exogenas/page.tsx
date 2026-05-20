'use client'
import React, { useState, useRef, useCallback } from 'react'
import { useClient } from '../ClientContext'
import { FormatoRegistry } from '@/lib/exogenas/registry/formato-registry'
import type { ConfigExogena, AsientoContable, TipoDeclarante } from '@/lib/exogenas/types'

// ── Paleta J&A ────────────────────────────────────────────────────────────────
const JA = {
  NAVY: '#13213C', GOLD: '#B8960C', GOLD_LT: '#D4A843',
  TEXT: '#1C2B45', GREY: '#4B5563', BORDER: '#E5E7EB', BG: '#F8FAFC',
  WHITE: '#FFFFFF', RED: '#DC2626', GREEN: '#059669', AMBER: '#D97706',
  BLUE: '#2563EB', NAVY_LT: '#1E3A5F', SURFACE: '#F1F5F9',
}

// ── Tipos de resultado ─────────────────────────────────────────────────────────
interface ResultadoFormato {
  formatoCodigo: string
  totalFilas: number
  totalExcepciones: number
  totales: Record<string, number>
  excepciones: Array<{
    tipo: string; severidad: string; descripcion: string; sugerencia?: string; valorInvolucrado?: number
  }>
  cuentasSinRegla: string[]
}

// ── Pasos del proceso ─────────────────────────────────────────────────────────
type Paso = 'config' | 'asientos' | 'revision' | 'exportar'
const PASOS: { id: Paso; titulo: string; desc: string }[] = [
  { id: 'config',   titulo: '1. Configuración',   desc: 'NIT declarante y año gravable' },
  { id: 'asientos', titulo: '2. Asientos',         desc: 'Cargar datos contables' },
  { id: 'revision', titulo: '3. Revisión',         desc: 'Excepciones y totales' },
  { id: 'exportar', titulo: '4. Exportar',         desc: 'Archivo Prevalidador DIAN' },
]

const FORMATOS_DISPONIBLES = FormatoRegistry.listar()

export default function ExogenaPage() {
  const { tenant } = useClient()
  const [paso, setPaso] = useState<Paso>('config')
  const [procesando, setProcesando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState('')
  const [resultados, setResultados] = useState<ResultadoFormato[]>([])
  const [reconciliacion, setReconciliacion] = useState<string[]>([])
  const [formatoActivo, setFormatoActivo] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  // ── Estado de configuración ───────────────────────────────────────────────
  const [config, setConfig] = useState<ConfigExogena>({
    anioGravable: 2025,
    nitDeclarante: '',
    dvDeclarante: '',
    razonSocial: tenant?.name ?? '',
    tipoDeclarante: 'contribuyente',
    municipioCodigo: '11001',
    formatos: ['1001', '1005', '1006', '1007', '1010'],
  })

  // ── JSON de asientos (carga manual o futura integración Siigo) ────────────
  const [asientosJson, setAsientosJson] = useState('')
  const [asientosCargados, setAsientosCargados] = useState<AsientoContable[]>([])

  // ── Ejecutar proceso ──────────────────────────────────────────────────────
  const ejecutarProceso = useCallback(async () => {
    if (!asientosCargados.length) {
      setError('Cargue al menos un asiento contable antes de procesar.')
      return
    }
    if (!config.nitDeclarante) {
      setError('Ingrese el NIT del declarante.')
      return
    }
    setProcesando(true)
    setError('')
    try {
      const res = await fetch('/api/exogenas/procesos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, asientos: asientosCargados }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al procesar')
      setResultados(json.resultados ?? [])
      setReconciliacion(json.reconciliacion ?? [])
      setPaso('revision')
      if (json.resultados?.length) setFormatoActivo(json.resultados[0].formatoCodigo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setProcesando(false)
    }
  }, [config, asientosCargados])

  // ── Exportar Excel ────────────────────────────────────────────────────────
  const exportarExcel = useCallback(async () => {
    setExportando(true)
    setError('')
    try {
      const res = await fetch('/api/exogenas/procesos/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, asientos: asientosCargados }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Error al exportar')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Exogenas_${config.nitDeclarante}_AG${config.anioGravable}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar')
    } finally {
      setExportando(false)
    }
  }, [config, asientosCargados])

  // ── Cargar JSON de asientos ───────────────────────────────────────────────
  const cargarAsientosJson = useCallback(() => {
    try {
      const parsed = JSON.parse(asientosJson)
      const lista = Array.isArray(parsed) ? parsed : parsed.asientos ?? []
      setAsientosCargados(lista)
      setError('')
    } catch {
      setError('JSON inválido. Verifique el formato de los asientos contables.')
    }
  }, [asientosJson])

  const cargarArchivoJson = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setAsientosJson(text)
      try {
        const parsed = JSON.parse(text)
        const lista = Array.isArray(parsed) ? parsed : parsed.asientos ?? []
        setAsientosCargados(lista)
        setError('')
      } catch {
        setError('Archivo JSON inválido.')
      }
    }
    reader.readAsText(file)
  }, [])

  // ── Helpers de resumen ────────────────────────────────────────────────────
  const totalExcepcionesCriticas = resultados.reduce(
    (s, r) => s + r.excepciones.filter(e => e.severidad === 'alta').length, 0
  )
  const totalFilasTotales = resultados.reduce((s, r) => s + r.totalFilas, 0)
  const resultadoActivo = resultados.find(r => r.formatoCodigo === formatoActivo)

  return (
    <div style={{ minHeight: '100vh', background: JA.BG, fontFamily: 'Inter, sans-serif', color: JA.TEXT }}>
      {/* ── Header ── */}
      <div style={{ background: JA.NAVY, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', background: JA.GOLD, borderRadius: '2px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: JA.NAVY }}>
          E
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: JA.WHITE }}>Exógenas Automatizadas</div>
          <div style={{ fontSize: '11px', color: '#94A3B8' }}>
            Res. DIAN 000227/2025 · Año gravable 2025 · Presentación 2026
          </div>
        </div>
        <div style={{ marginLeft: 'auto', padding: '4px 10px', background: 'rgba(184,150,12,0.15)',
          border: `1px solid ${JA.GOLD}`, borderRadius: '2px', fontSize: '11px', color: JA.GOLD_LT }}>
          ⚠ Verificar contra Prevalidador oficial DIAN
        </div>
      </div>

      {/* ── Barra de pasos ── */}
      <div style={{ background: JA.WHITE, borderBottom: `1px solid ${JA.BORDER}`, padding: '0 24px',
        display: 'flex', gap: '0' }}>
        {PASOS.map((p, i) => {
          const activo = p.id === paso
          const completado = PASOS.findIndex(x => x.id === paso) > i
          return (
            <button key={p.id}
              onClick={() => {
                if (completado || activo) setPaso(p.id)
              }}
              style={{
                padding: '12px 20px', border: 'none', background: 'transparent', cursor: completado ? 'pointer' : 'default',
                borderBottom: activo ? `2px solid ${JA.NAVY}` : '2px solid transparent',
                color: activo ? JA.NAVY : completado ? JA.GOLD : JA.GREY,
                fontSize: '12px', fontWeight: activo ? 600 : 400,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
              }}>
              <span>{p.titulo}</span>
              <span style={{ fontSize: '10px', color: JA.GREY }}>{p.desc}</span>
            </button>
          )
        })}
      </div>

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* ── Error global ── */}
        {error && (
          <div style={{ padding: '10px 14px', background: '#FEF2F2', border: `1px solid #FECACA`,
            borderRadius: '2px', color: JA.RED, fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* ═══════════════ PASO 1: CONFIGURACIÓN ═══════════════ */}
        {paso === 'config' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            {/* Panel principal */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '20px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT, textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: '20px' }}>
                Datos del declarante
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Campo label="Año gravable" requerido>
                  <select value={config.anioGravable}
                    onChange={e => setConfig(c => ({ ...c, anioGravable: Number(e.target.value) }))}
                    style={estiloInput}>
                    <option value={2025}>2025</option>
                  </select>
                </Campo>

                <Campo label="Tipo de declarante" requerido>
                  <select value={config.tipoDeclarante}
                    onChange={e => setConfig(c => ({ ...c, tipoDeclarante: e.target.value as TipoDeclarante }))}
                    style={estiloInput}>
                    <option value="contribuyente">Contribuyente</option>
                    <option value="gran_contribuyente">Gran contribuyente</option>
                    <option value="autoretenedor">Autorretenedor</option>
                    <option value="agente_retenedor">Agente retenedor</option>
                  </select>
                </Campo>

                <Campo label="NIT declarante (sin DV)" requerido>
                  <input value={config.nitDeclarante} placeholder="ej. 900123456"
                    onChange={e => setConfig(c => ({ ...c, nitDeclarante: e.target.value.replace(/\D/g, '') }))}
                    style={estiloInput} />
                </Campo>

                <Campo label="DV">
                  <input value={config.dvDeclarante ?? ''} placeholder="Dígito verificación" maxLength={1}
                    onChange={e => setConfig(c => ({ ...c, dvDeclarante: e.target.value.replace(/\D/g, '') }))}
                    style={estiloInput} />
                </Campo>

                <Campo label="Razón social / Nombre" requerido style={{ gridColumn: '1 / -1' }}>
                  <input value={config.razonSocial} placeholder="Nombre completo o razón social"
                    onChange={e => setConfig(c => ({ ...c, razonSocial: e.target.value }))}
                    style={estiloInput} />
                </Campo>

                <Campo label="Municipio DIVIPOLA" requerido>
                  <input value={config.municipioCodigo} placeholder="ej. 11001 (Bogotá)"
                    onChange={e => setConfig(c => ({ ...c, municipioCodigo: e.target.value.replace(/\D/g, '') }))}
                    style={estiloInput} />
                </Campo>
              </div>

              {/* Formatos a generar */}
              <div style={{ marginTop: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: JA.GREY, textTransform: 'uppercase',
                  letterSpacing: '0.05em', marginBottom: '12px' }}>
                  Formatos a generar
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {FORMATOS_DISPONIBLES.map(f => {
                    const seleccionado = config.formatos.includes(f.codigo)
                    return (
                      <label key={f.codigo} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px',
                        border: `1px solid ${seleccionado ? JA.NAVY : JA.BORDER}`,
                        background: seleccionado ? '#EFF6FF' : JA.WHITE,
                        borderRadius: '2px', cursor: 'pointer',
                      }}>
                        <input type="checkbox" checked={seleccionado}
                          onChange={e => setConfig(c => ({
                            ...c,
                            formatos: e.target.checked
                              ? [...c.formatos, f.codigo]
                              : c.formatos.filter(x => x !== f.codigo),
                          }))}
                          style={{ marginTop: '2px', accentColor: JA.NAVY }} />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: JA.TEXT }}>
                            Formato {f.codigo}
                          </div>
                          <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '2px' }}>
                            {f.nombre}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Panel informativo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <InfoCard titulo="Normativa vigente">
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: JA.GREY, lineHeight: '1.8' }}>
                  <li>Resolución DIAN 000227/2025 (RUMT)</li>
                  <li>Resolución DIAN 000233/2025 (Formato 1001 v11)</li>
                  <li>UVT 2025: $49.799 · UVT 2026: $52.374</li>
                  <li>Comunicado DIAN 070/2026 — Retefuente mayo 2026</li>
                </ul>
              </InfoCard>
              <InfoCard titulo="Notas importantes" color={JA.AMBER}>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: JA.GREY, lineHeight: '1.8' }}>
                  <li>Verificar contra el Prevalidador oficial DIAN</li>
                  <li>Formato 1001 v11 (nueva estructura 2025)</li>
                  <li>Umbral Formato 1006/1007: &gt;500 UVT por tercero</li>
                  <li>Persona natural: apellidos + nombres por separado</li>
                  <li>Persona jurídica: solo razón social</li>
                </ul>
              </InfoCard>
              <button onClick={() => setPaso('asientos')}
                disabled={!config.nitDeclarante || !config.razonSocial || !config.formatos.length}
                style={{
                  padding: '12px', background: JA.NAVY, color: JA.WHITE, border: 'none',
                  borderRadius: '2px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  opacity: (!config.nitDeclarante || !config.razonSocial || !config.formatos.length) ? 0.5 : 1,
                }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════ PASO 2: ASIENTOS ═══════════════ */}
        {paso === 'asientos' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '20px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: '16px', color: JA.TEXT }}>
                Cargar asientos contables
              </h2>

              {/* Cargar archivo JSON */}
              <div style={{ padding: '16px', border: `2px dashed ${JA.BORDER}`, borderRadius: '2px',
                textAlign: 'center', marginBottom: '16px', cursor: 'pointer' }}
                onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📂</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>Cargar archivo JSON</div>
                <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '4px' }}>
                  Array de AsientoContable exportado desde Siigo o sistema contable
                </div>
                <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
                  onChange={cargarArchivoJson} />
              </div>

              <div style={{ fontSize: '11px', color: JA.GREY, marginBottom: '8px', textAlign: 'center' }}>
                — o pegue el JSON directamente —
              </div>

              <textarea value={asientosJson}
                onChange={e => setAsientosJson(e.target.value)}
                placeholder={'[\n  {\n    "id": "A001",\n    "fecha": "2025-01-15",\n    "cuentaPuc": "5120",\n    "naturaleza": "debito",\n    "monto": 5000000,\n    "tercero": {\n      "tipoDocumento": "3",\n      "numeroId": "900123456",\n      "dv": "1",\n      "paisCodigo": "CO",\n      "razonSocial": "EMPRESA S.A.S"\n    }\n  }\n]'}
                style={{ ...estiloInput, height: '200px', fontFamily: 'monospace', fontSize: '11px', resize: 'vertical' }} />

              <button onClick={cargarAsientosJson} style={{
                marginTop: '12px', width: '100%', padding: '10px', background: JA.SURFACE,
                border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '12px',
                color: JA.TEXT, cursor: 'pointer', fontWeight: 500,
              }}>
                Validar y cargar JSON
              </button>

              {asientosCargados.length > 0 && (
                <div style={{ marginTop: '12px', padding: '10px 12px', background: '#F0FDF4',
                  border: `1px solid #BBF7D0`, borderRadius: '2px', fontSize: '12px', color: JA.GREEN }}>
                  ✓ {asientosCargados.length} asientos contables cargados
                </div>
              )}
            </div>

            {/* Vista previa y acciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.05em', marginBottom: '12px', color: JA.GREY }}>
                  Estructura esperada del JSON
                </div>
                <pre style={{ fontSize: '10px', color: JA.GREY, overflow: 'auto',
                  background: JA.SURFACE, padding: '12px', borderRadius: '2px', margin: 0, lineHeight: '1.5' }}>
{`{
  "id": "A001",           // ID único
  "fecha": "2025-01-15",  // YYYY-MM-DD
  "cuentaPuc": "5120",    // Cuenta PUC
  "naturaleza": "debito", // debito | credito
  "monto": 5000000,       // COP entero
  "tercero": {
    "tipoDocumento": "3", // 1=CC, 3=NIT
    "numeroId": "...",
    "dv": "1",
    "paisCodigo": "CO",
    "razonSocial": "..."  // PJ
    // O apellidos+nombres // PN
  },
  "retefuente": 0,       // opcional
  "valorIva": 0,         // opcional
  "reteIva": 0,          // opcional
  "reteIca": 0           // opcional
}`}
                </pre>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setPaso('config')} style={{
                  flex: 1, padding: '10px', background: JA.WHITE, border: `1px solid ${JA.BORDER}`,
                  borderRadius: '2px', fontSize: '12px', color: JA.TEXT, cursor: 'pointer',
                }}>
                  ← Atrás
                </button>
                <button onClick={ejecutarProceso}
                  disabled={!asientosCargados.length || procesando}
                  style={{
                    flex: 2, padding: '10px', background: JA.NAVY, color: JA.WHITE, border: 'none',
                    borderRadius: '2px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    opacity: (!asientosCargados.length || procesando) ? 0.6 : 1,
                  }}>
                  {procesando ? 'Procesando…' : `Generar ${config.formatos.length} formatos →`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ PASO 3: REVISIÓN ═══════════════ */}
        {paso === 'revision' && (
          <div>
            {/* KPIs globales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <Kpi label="Formatos generados" valor={resultados.length} />
              <Kpi label="Total registros" valor={totalFilasTotales} />
              <Kpi label="Excepciones críticas" valor={totalExcepcionesCriticas}
                color={totalExcepcionesCriticas > 0 ? JA.RED : JA.GREEN} />
              <Kpi label="Cuentas sin regla"
                valor={resultados.reduce((s, r) => s + r.cuentasSinRegla.length, 0)}
                color={resultados.some(r => r.cuentasSinRegla.length) ? JA.AMBER : JA.GREEN} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px' }}>
              {/* Panel izquierdo: lista de formatos */}
              <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
                overflow: 'hidden', alignSelf: 'start' }}>
                <div style={{ padding: '10px 14px', background: JA.SURFACE, borderBottom: `1px solid ${JA.BORDER}`,
                  fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: JA.GREY }}>
                  Formatos
                </div>
                {resultados.map(r => {
                  const criticas = r.excepciones.filter(e => e.severidad === 'alta').length
                  const alertas = r.excepciones.filter(e => e.severidad === 'media').length
                  const activo = r.formatoCodigo === formatoActivo
                  return (
                    <button key={r.formatoCodigo} onClick={() => setFormatoActivo(r.formatoCodigo)}
                      style={{
                        width: '100%', padding: '12px 14px', border: 'none', textAlign: 'left',
                        background: activo ? '#EFF6FF' : JA.WHITE, borderLeft: activo ? `3px solid ${JA.NAVY}` : '3px solid transparent',
                        cursor: 'pointer', borderBottom: `1px solid ${JA.BORDER}`,
                      }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: activo ? JA.NAVY : JA.TEXT }}>
                        Formato {r.formatoCodigo}
                      </div>
                      <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '2px' }}>
                        {r.totalFilas} registros
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        {criticas > 0 && (
                          <span style={{ fontSize: '10px', padding: '1px 5px', background: '#FEE2E2',
                            color: JA.RED, borderRadius: '2px' }}>
                            {criticas} críticas
                          </span>
                        )}
                        {alertas > 0 && (
                          <span style={{ fontSize: '10px', padding: '1px 5px', background: '#FEF3C7',
                            color: JA.AMBER, borderRadius: '2px' }}>
                            {alertas} alertas
                          </span>
                        )}
                        {criticas === 0 && alertas === 0 && (
                          <span style={{ fontSize: '10px', padding: '1px 5px', background: '#D1FAE5',
                            color: JA.GREEN, borderRadius: '2px' }}>
                            OK
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Panel derecho: detalle del formato activo */}
              {resultadoActivo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Totales */}
                  <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.05em', color: JA.GREY, marginBottom: '12px' }}>
                      Totales — Formato {resultadoActivo.formatoCodigo}
                    </div>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      {Object.entries(resultadoActivo.totales).map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: '10px', color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {k.replace(/([A-Z])/g, ' $1').replace('total', '').trim()}
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: JA.NAVY, marginTop: '2px' }}>
                            {typeof v === 'number' && k !== 'totalFilas'
                              ? `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v)}`
                              : v}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Excepciones */}
                  {resultadoActivo.excepciones.length > 0 && (
                    <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', background: JA.SURFACE, borderBottom: `1px solid ${JA.BORDER}`,
                        fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: JA.GREY }}>
                        Excepciones ({resultadoActivo.excepciones.length})
                      </div>
                      <div style={{ maxHeight: '280px', overflow: 'auto' }}>
                        {resultadoActivo.excepciones.map((e, i) => (
                          <div key={i} style={{ padding: '12px 14px', borderBottom: `1px solid ${JA.BORDER}`,
                            borderLeft: `3px solid ${e.severidad === 'alta' ? JA.RED : e.severidad === 'media' ? JA.AMBER : JA.BLUE}` }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '2px', fontWeight: 600,
                                background: e.severidad === 'alta' ? '#FEE2E2' : e.severidad === 'media' ? '#FEF3C7' : '#DBEAFE',
                                color: e.severidad === 'alta' ? JA.RED : e.severidad === 'media' ? JA.AMBER : JA.BLUE }}>
                                {e.severidad.toUpperCase()}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: JA.TEXT }}>{e.tipo}</span>
                              {e.valorInvolucrado != null && (
                                <span style={{ fontSize: '11px', color: JA.GREY, marginLeft: 'auto' }}>
                                  ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(e.valorInvolucrado)}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: JA.TEXT }}>{e.descripcion}</div>
                            {e.sugerencia && (
                              <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '4px' }}>
                                → {e.sugerencia}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cuentas sin regla */}
                  {resultadoActivo.cuentasSinRegla.length > 0 && (
                    <div style={{ padding: '12px 14px', background: '#FFFBEB', border: `1px solid #FDE68A`,
                      borderRadius: '2px', fontSize: '12px', color: '#92400E' }}>
                      <strong>Cuentas PUC sin regla de mapeo:</strong>{' '}
                      {resultadoActivo.cuentasSinRegla.join(', ')}
                      <div style={{ fontSize: '11px', marginTop: '4px', color: JA.GREY }}>
                        Estas cuentas no se incluirán en ningún formato. Revise las reglas de mapeo.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reconciliación */}
            {reconciliacion.length > 0 && (
              <div style={{ marginTop: '16px', background: JA.WHITE, border: `1px solid ${JA.BORDER}`,
                borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: JA.SURFACE, borderBottom: `1px solid ${JA.BORDER}`,
                  fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: JA.GREY }}>
                  Log de reconciliación
                </div>
                <div style={{ padding: '12px 14px' }}>
                  {reconciliacion.map((linea, i) => (
                    <div key={i} style={{ fontSize: '12px', color: JA.GREY, fontFamily: 'monospace', marginBottom: '4px' }}>
                      {linea}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button onClick={() => setPaso('asientos')} style={{
                padding: '10px 20px', background: JA.WHITE, border: `1px solid ${JA.BORDER}`,
                borderRadius: '2px', fontSize: '12px', color: JA.TEXT, cursor: 'pointer',
              }}>
                ← Atrás
              </button>
              <button onClick={() => setPaso('exportar')} style={{
                padding: '10px 20px', background: JA.NAVY, color: JA.WHITE, border: 'none',
                borderRadius: '2px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}>
                Continuar a exportar →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════ PASO 4: EXPORTAR ═══════════════ */}
        {paso === 'exportar' && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '32px',
              textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: JA.TEXT, marginBottom: '8px' }}>
                Exportar al Prevalidador DIAN
              </h2>
              <p style={{ fontSize: '13px', color: JA.GREY, marginBottom: '24px', lineHeight: '1.6' }}>
                Genera el archivo Excel con la estructura exacta del Prevalidador oficial DIAN.
                Incluye: {resultados.length} formato(s), {totalFilasTotales} registros.
              </p>

              {/* Resumen por formato */}
              <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                {resultados.map(r => {
                  const criticas = r.excepciones.filter(e => e.severidad === 'alta').length
                  return (
                    <div key={r.formatoCodigo} style={{ display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', padding: '10px 0',
                      borderBottom: `1px solid ${JA.BORDER}`, fontSize: '13px' }}>
                      <span style={{ fontWeight: 600, color: JA.TEXT }}>Formato {r.formatoCodigo}</span>
                      <span style={{ color: JA.GREY }}>{r.totalFilas} registros</span>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '2px', fontWeight: 600,
                        background: criticas > 0 ? '#FEE2E2' : '#D1FAE5',
                        color: criticas > 0 ? JA.RED : JA.GREEN,
                      }}>
                        {criticas > 0 ? `${criticas} errores` : 'OK'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {totalExcepcionesCriticas > 0 && (
                <div style={{ padding: '12px', background: '#FEF2F2', border: `1px solid #FECACA`,
                  borderRadius: '2px', fontSize: '12px', color: JA.RED, marginBottom: '20px' }}>
                  Existen {totalExcepcionesCriticas} excepción(es) crítica(s).
                  Se recomienda corregirlas antes de presentar ante la DIAN.
                </div>
              )}

              <button onClick={exportarExcel} disabled={exportando}
                style={{
                  width: '100%', padding: '14px', background: JA.GOLD, color: JA.NAVY,
                  border: 'none', borderRadius: '2px', fontSize: '14px', fontWeight: 700,
                  cursor: exportando ? 'wait' : 'pointer', opacity: exportando ? 0.7 : 1,
                }}>
                {exportando ? 'Generando archivo…' : '⬇ Descargar Excel Prevalidador DIAN'}
              </button>

              <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '12px' }}>
                ⚠ Verificar el archivo contra el Prevalidador oficial de la DIAN antes de presentar.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'center' }}>
              <button onClick={() => setPaso('revision')} style={{
                padding: '10px 20px', background: JA.WHITE, border: `1px solid ${JA.BORDER}`,
                borderRadius: '2px', fontSize: '12px', color: JA.TEXT, cursor: 'pointer',
              }}>
                ← Volver a revisión
              </button>
              <button onClick={() => { setPaso('config'); setResultados([]); setAsientosCargados([]) }}
                style={{
                  padding: '10px 20px', background: JA.WHITE, border: `1px solid ${JA.BORDER}`,
                  borderRadius: '2px', fontSize: '12px', color: JA.GREY, cursor: 'pointer',
                }}>
                Nuevo proceso
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componentes de apoyo ──────────────────────────────────────────────────────

function Campo({ label, requerido, children, style }: {
  label: string; requerido?: boolean; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#4B5563',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        {label} {requerido && <span style={{ color: '#DC2626' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function InfoCard({ titulo, color = '#13213C', children }: {
  titulo: string; color?: string; children: React.ReactNode
}) {
  return (
    <div style={{ background: '#FFFFFF', border: `1px solid #E5E7EB`, borderRadius: '2px',
      overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: color === '#D97706' ? '#FFFBEB' : '#F1F5F9',
        borderBottom: '1px solid #E5E7EB', fontSize: '11px', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em', color }}>
        {titulo}
      </div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  )
}

function Kpi({ label, valor, color = '#13213C' }: { label: string; valor: number; color?: string }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '2px',
      padding: '14px 16px' }}>
      <div style={{ fontSize: '10px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color, marginTop: '4px' }}>
        {valor.toLocaleString('es-CO')}
      </div>
    </div>
  )
}

const estiloInput: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '2px',
  fontSize: '13px', color: '#1C2B45', background: '#FFFFFF', boxSizing: 'border-box',
  outline: 'none', fontFamily: 'Inter, sans-serif',
}
