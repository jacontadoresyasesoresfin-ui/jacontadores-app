/**
 * POST /api/exogenas/generar — Streaming NDJSON
 *
 * Emite eventos JSON line-by-line para que la UI muestre cada etapa
 * en tiempo real. El cliente lee el stream con fetch + ReadableStream.
 *
 * Eventos emitidos:
 *   etapa_inicio  — etapa N arranca
 *   etapa_ok      — etapa N completó con datos
 *   formato_inicio — un formato específico empieza
 *   formato_ok    — un formato específico terminó con totales
 *   fin           — proceso completo, lleva el resultado completo
 *   error         — falla irrecuperable
 */
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { parsearSiigoCsv } from '@/lib/exogenas/parsers/siigo-csv-parser'
import { humanizarExcepciones, resumirExcepciones } from '@/lib/exogenas/engine/humanizador'
import { RulesEngine } from '@/lib/exogenas/engine/rules-engine'
import { FormatoRegistry } from '@/lib/exogenas/registry/formato-registry'
import { REGLAS_DEFAULT_2025 } from '@/lib/exogenas/config/reglas-default-2025'
import type { ConfigExogena, FilaFormato, ResultadoTransformacion } from '@/lib/exogenas/types'

const DEFAULT_FORMATOS = ['1001', '1005', '1006', '1007', '1010']
const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export async function POST(req: NextRequest) {
  // ── Auth + datos del request (ANTES del stream) ────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ tipo: 'error', mensaje: 'No autorizado' }) + '\n', { status: 401 })
  }

  const contentType = req.headers.get('content-type') ?? ''
  let csvTexto = ''
  let config: ConfigExogena = {
    anioGravable: 2025, nitDeclarante: '', razonSocial: '',
    tipoDeclarante: 'contribuyente', municipioCodigo: '11001',
    formatos: DEFAULT_FORMATOS,
  }

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const archivo = formData.get('archivo') as File | null
    if (!archivo) {
      return new Response(JSON.stringify({ tipo: 'error', mensaje: 'Se requiere el archivo CSV de Siigo.' }) + '\n', { status: 400 })
    }
    const buffer = Buffer.from(await archivo.arrayBuffer())
    csvTexto = buffer.toString('utf-8')
    if (csvTexto.includes('�')) csvTexto = buffer.toString('latin1')
    const configStr = formData.get('config') as string | null
    if (configStr) config = { ...config, ...JSON.parse(configStr) }
  } else {
    const body = await req.json() as { config?: ConfigExogena }
    if (body.config) config = body.config
  }

  // ── Cargar reglas del tenant ───────────────────────────────────────────
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
  const reglasExtra: typeof REGLAS_DEFAULT_2025 = []
  if (profile?.tenant_id) {
    const { data } = await supabase.from('exogenas_reglas_mapeo').select('*').eq('tenant_id', profile.tenant_id).eq('activo', true)
    if (data) reglasExtra.push(...(data as typeof REGLAS_DEFAULT_2025))
  }

  // ── Stream ─────────────────────────────────────────────────────────────
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: object) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')) } catch { /* closed */ }
      }

      try {
        // ══ ETAPA 1: Leer CSV ════════════════════════════════════════════
        emit({ tipo: 'etapa_inicio', etapa: 1 })

        const parseado = parsearSiigoCsv(csvTexto)
        const { asientos, advertencias, empresaDetectada, periodoDetectado, totalFilas, filasFallidas } = parseado

        if (!asientos.length) {
          emit({ tipo: 'error', mensaje: 'No se encontraron movimientos. Verifique que exportó el Libro Auxiliar con detalle de movimientos.' })
          controller.close(); return
        }

        emit({
          tipo: 'etapa_ok', etapa: 1,
          datos: { asientosCont: asientos.length, empresa: empresaDetectada, periodo: periodoDetectado, totalFilas, filasFallidas, advertencias },
        })

        // ══ ETAPA 2: Cargar reglas ═══════════════════════════════════════
        emit({ tipo: 'etapa_inicio', etapa: 2 })
        const engine = new RulesEngine([...REGLAS_DEFAULT_2025, ...reglasExtra])
        const totalReglas = REGLAS_DEFAULT_2025.length + reglasExtra.length
        emit({ tipo: 'etapa_ok', etapa: 2, datos: { totalReglas, reglasPersonalizadas: reglasExtra.length } })

        // ══ ETAPA 3: Analizar movimientos ════════════════════════════════
        emit({ tipo: 'etapa_inicio', etapa: 3 })
        const cuentasUnicas = new Set(asientos.map(a => a.cuentaPuc)).size
        const tercerosUnicos = new Set(asientos.map(a => a.tercero.numeroId).filter(Boolean)).size
        // Pequeña pausa artificial para que la contadora vea esta etapa
        await new Promise(r => setTimeout(r, 120))
        emit({ tipo: 'etapa_ok', etapa: 3, datos: { cuentasUnicas, tercerosUnicos } })

        // ══ ETAPA 4: Generar formatos ════════════════════════════════════
        emit({ tipo: 'etapa_inicio', etapa: 4 })
        const formatos = config.formatos?.length ? config.formatos : DEFAULT_FORMATOS
        const resultados: ResultadoTransformacion<FilaFormato>[] = []

        for (const codigo of formatos) {
          emit({ tipo: 'formato_inicio', codigo })
          await new Promise(r => setTimeout(r, 80)) // visible progress

          const estrategia = FormatoRegistry.obtener(codigo)
          if (!estrategia) continue

          const filas = estrategia.transformar(asientos, engine)
          const excepciones = estrategia.validar(filas)
          const totales = estrategia.totalizar(filas)
          resultados.push({ formatoCodigo: codigo, filas, excepciones, totales, cuentasSinRegla: [] })

          // Primer campo monetario del formato como total principal
          const campoMonto = Object.keys(totales).find(k => k !== 'totalFilas' && k.startsWith('total'))
          const montoPrincipal = campoMonto ? totales[campoMonto] : 0

          emit({
            tipo: 'formato_ok', codigo,
            datos: {
              totalFilas: totales.totalFilas,
              montoPrincipal,
              montoFormateado: COP.format(montoPrincipal),
              excepcionesCnt: excepciones.length,
              nombre: FormatoRegistry.listar().find(f => f.codigo === codigo)?.nombre ?? '',
            },
          })
        }

        emit({ tipo: 'etapa_ok', etapa: 4, datos: { formatosGenerados: resultados.length } })

        // ══ ETAPA 5: Validar excepciones ════════════════════════════════
        emit({ tipo: 'etapa_inicio', etapa: 5 })
        await new Promise(r => setTimeout(r, 100))

        const todasExcepciones = resultados.flatMap(r =>
          r.excepciones.map(e => ({ ...e, formatoCodigo: r.formatoCodigo }))
        )
        const tarjetas = humanizarExcepciones(todasExcepciones)
        const resumenExcepciones = resumirExcepciones(tarjetas)
        const cuentasSinRegla = engine.cuentasSinRegla(asientos)

        emit({
          tipo: 'etapa_ok', etapa: 5,
          datos: { totalExcepciones: tarjetas.length, criticas: resumenExcepciones.criticas, alertas: resumenExcepciones.alertas, cuentasSinRegla: cuentasSinRegla.length },
        })

        // ══ Persistir proceso en DB ══════════════════════════════════════
        if (profile?.tenant_id && config.nitDeclarante) {
          await supabase.from('exogenas_procesos').insert({
            tenant_id: profile.tenant_id, creado_por: user.id,
            anio_gravable: config.anioGravable,
            periodo_inicio: new Date(`${config.anioGravable}-01-01`).toISOString(),
            periodo_fin: new Date(`${config.anioGravable}-12-31`).toISOString(),
            nit_declarante: config.nitDeclarante, tipo_declarante: config.tipoDeclarante,
            formatos_incluidos: config.formatos, estado: 'revision',
            total_registros: resultados.reduce((s, r) => s + r.totales.totalFilas, 0),
            total_excepciones: tarjetas.length, log_proceso: advertencias,
          })
        }

        // ══ FIN — resultado completo ═════════════════════════════════════
        emit({
          tipo: 'fin',
          datos: {
            asientosProcesados: asientos.length,
            advertenciasCsv: advertencias,
            metaCsv: { empresa: empresaDetectada, periodo: periodoDetectado },
            cuentasSinRegla,
            resumenFormatos: resultados.map(r => ({
              codigo: r.formatoCodigo,
              nombre: FormatoRegistry.listar().find(f => f.codigo === r.formatoCodigo)?.nombre ?? '',
              totalFilas: r.totales.totalFilas,
              totales: r.totales,
              excepcionesCriticas: r.excepciones.filter(e => e.severidad === 'alta').length,
              excepcionesMedia: r.excepciones.filter(e => e.severidad === 'media').length,
            })),
            tarjetasExcepciones: tarjetas,
            resumenExcepciones,
            asientosParaExportar: asientos,
            configParaExportar: config,
          },
        })

      } catch (err) {
        emit({ tipo: 'error', mensaje: err instanceof Error ? err.message : 'Error inesperado al generar las exógenas.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',   // evitar buffering en nginx/cPanel
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
