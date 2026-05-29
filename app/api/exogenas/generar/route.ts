/**
 * POST /api/exogenas/generar — Streaming NDJSON
 *
 * Acepta dos tipos de archivo:
 *   - CSV Libro Auxiliar de Siigo  → parsea + aplica RulesEngine → genera formatos DIAN
 *   - xlsx prevalidador DIAN       → ya viene estructurado por hoja; solo valida y totaliza
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
import { parsearSiigoXlsx, esDianPrevalidador } from '@/lib/exogenas/parsers/siigo-xlsx-parser'
import { parsearXlsxFormato } from '@/lib/exogenas/parsers/xlsx-formato-parser'
import { humanizarExcepciones, resumirExcepciones } from '@/lib/exogenas/engine/humanizador'
import { RulesEngine } from '@/lib/exogenas/engine/rules-engine'
import { FormatoRegistry } from '@/lib/exogenas/registry/formato-registry'
import { REGLAS_DEFAULT_2025 } from '@/lib/exogenas/config/reglas-default-2025'
import type { ConfigExogena, FilaFormato, ResultadoTransformacion } from '@/lib/exogenas/types'

export const dynamic = 'force-dynamic'

const DEFAULT_FORMATOS = ['1001', '1005', '1006', '1007', '1010']
const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export async function POST(req: NextRequest) {
  // ── Auth + datos del request (ANTES del stream) ────────────────────────
  let supabase: Awaited<ReturnType<typeof createClient>>
  try {
    supabase = await createClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exogenas/generar] Error al crear cliente Supabase:', msg)
    return new Response(
      JSON.stringify({ tipo: 'error', mensaje: `Error de configuración del servidor: ${msg}` }) + '\n',
      { status: 500, headers: { 'Content-Type': 'application/x-ndjson' } }
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ tipo: 'error', mensaje: 'No autorizado' }) + '\n', { status: 401 })
  }

  const contentType = req.headers.get('content-type') ?? ''
  let csvTexto = ''
  let archivoBuffer: Buffer = Buffer.alloc(0)
  let nombreArchivo = ''
  let esXlsx = false        // true solo para el Prevalidador DIAN (hojas 1001, 1005…)
  let esSiigoXlsx = false   // true para Libro Auxiliar de Siigo en formato xlsx
  let config: ConfigExogena = {
    anioGravable: 2025, nitDeclarante: '', razonSocial: '',
    tipoDeclarante: 'contribuyente', municipioCodigo: '11001',
    formatos: DEFAULT_FORMATOS,
  }

  // ── Parsear request (multipart/form-data o JSON) — envolver en try/catch ──
  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const archivo = formData.get('archivo') as File | null
      if (!archivo) {
        return new Response(JSON.stringify({ tipo: 'error', mensaje: 'Se requiere el archivo (CSV de Siigo o xlsx del prevalidador DIAN).' }) + '\n', { status: 400 })
      }
      archivoBuffer = Buffer.from(await archivo.arrayBuffer())
      nombreArchivo = archivo.name.toLowerCase()
      const esArchivoXlsx = nombreArchivo.endsWith('.xlsx') || nombreArchivo.endsWith('.xls')

      if (esArchivoXlsx) {
        // Distinguir: ¿es el Prevalidador DIAN (hojas 1001, 1005…) o el Libro Auxiliar de Siigo?
        if (esDianPrevalidador(archivoBuffer)) {
          esXlsx = true           // Flujo DIAN prevalidador (sin RulesEngine)
        } else {
          esSiigoXlsx = true      // Flujo Siigo xlsx → parsear a AsientoContable[] → RulesEngine
        }
      } else {
        csvTexto = archivoBuffer.toString('utf-8')
        if (csvTexto.includes('')) csvTexto = archivoBuffer.toString('latin1')
      }
      const configStr = formData.get('config') as string | null
      if (configStr) config = { ...config, ...JSON.parse(configStr) }
    } else {
      const body = await req.json() as { config?: ConfigExogena }
      if (body.config) config = body.config
    }
  } catch (initErr) {
    const msg = initErr instanceof Error ? initErr.message : String(initErr)
    console.error('[exogenas/generar] Error al parsear request:', msg)
    return new Response(
      JSON.stringify({ tipo: 'error', mensaje: `Error al leer el archivo: ${msg}` }) + '\n',
      { status: 400, headers: { 'Content-Type': 'application/x-ndjson' } }
    )
  }

  // ── Cargar reglas del tenant (flujo CSV y Siigo xlsx — no en Prevalidador DIAN) ──
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
  const reglasExtra: typeof REGLAS_DEFAULT_2025 = []
  if (!esXlsx && profile?.tenant_id && config.usarConfiguracionPersonalizada !== false) {
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

      // Helper compartido: cerrar etapa 4 + emitir etapa 5 con excepciones
      const emitirEtapas45 = async (
        resultados: ResultadoTransformacion<FilaFormato>[],
        cuentasSinReglaCount: number,
      ) => {
        emit({ tipo: 'etapa_ok', etapa: 4, datos: { formatosGenerados: resultados.length } })

        // ══ ETAPA 5: Validar excepciones ═════════════════════════════════
        emit({ tipo: 'etapa_inicio', etapa: 5 })
        await new Promise(r => setTimeout(r, 100))

        const todasExcepciones = resultados.flatMap(r =>
          r.excepciones.map(e => ({ ...e, formatoCodigo: r.formatoCodigo }))
        )
        const tarjetas = humanizarExcepciones(todasExcepciones)
        const resumenExcepciones = resumirExcepciones(tarjetas)

        emit({
          tipo: 'etapa_ok', etapa: 5,
          datos: {
            totalExcepciones: tarjetas.length,
            criticas: resumenExcepciones.criticas,
            alertas: resumenExcepciones.alertas,
            cuentasSinRegla: cuentasSinReglaCount,
          },
        })

        return { tarjetas, resumenExcepciones }
      }

      try {
        if (esXlsx) {
          // ══════════════════════════════════════════════════════════════
          // FLUJO xlsx — Prevalidador DIAN (ya estructurado por hoja)
          // ══════════════════════════════════════════════════════════════

          // ══ ETAPA 1: Leer xlsx ════════════════════════════════════════
          emit({ tipo: 'etapa_inicio', etapa: 1 })
          const xlsxResult = parsearXlsxFormato(archivoBuffer)

          if (!xlsxResult.formatosDetectados.length) {
            emit({ tipo: 'error', mensaje: xlsxResult.advertencias[0] ?? 'No se encontraron hojas con formato DIAN en el archivo xlsx. Las hojas deben llamarse "1001", "1005", etc.' })
            controller.close(); return
          }

          const totalRegistrosXlsx = xlsxResult.formatos.reduce((s, f) => s + f.totalRegistros, 0)
          emit({
            tipo: 'etapa_ok', etapa: 1,
            datos: {
              asientosCont: totalRegistrosXlsx,
              empresa: xlsxResult.softwareDetectado ?? 'Archivo xlsx DIAN',
              periodo: String(config.anioGravable),
              totalFilas: xlsxResult.formatos.reduce((s, f) => s + f.totalFilas, 0),
              filasFallidas: 0,
              advertencias: xlsxResult.advertencias,
            },
          })

          // ══ ETAPA 2: Detectar formatos ════════════════════════════════
          emit({ tipo: 'etapa_inicio', etapa: 2 })
          await new Promise(r => setTimeout(r, 100))
          emit({
            tipo: 'etapa_ok', etapa: 2,
            datos: {
              formatosXlsx: xlsxResult.formatosDetectados,
              totalReglas: xlsxResult.formatosDetectados.length,
              reglasPersonalizadas: 0,
            },
          })

          // ══ ETAPA 3: Validar registros ════════════════════════════════
          emit({ tipo: 'etapa_inicio', etapa: 3 })
          const tercerosXlsx = new Set(
            xlsxResult.formatos.flatMap(f => f.filas.map(r => r.numeroId).filter(Boolean))
          ).size
          await new Promise(r => setTimeout(r, 120))
          emit({
            tipo: 'etapa_ok', etapa: 3,
            datos: { registrosValidados: totalRegistrosXlsx, tercerosUnicos: tercerosXlsx },
          })

          // ══ ETAPA 4: Generar formatos ══════════════════════════════════
          emit({ tipo: 'etapa_inicio', etapa: 4 })
          const resultadosXlsx: ResultadoTransformacion<FilaFormato>[] = []

          for (const formatoXlsx of xlsxResult.formatos) {
            const codigo = formatoXlsx.codigo
            emit({ tipo: 'formato_inicio', codigo })
            await new Promise(r => setTimeout(r, 80))

            const estrategia = FormatoRegistry.obtener(codigo)
            if (!estrategia) continue

            const filas = formatoXlsx.filas as unknown as FilaFormato[]
            const excepciones = estrategia.validar(filas)
            const totales = estrategia.totalizar(filas)
            resultadosXlsx.push({ formatoCodigo: codigo, filas, excepciones, totales, cuentasSinRegla: [] })

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

          const { tarjetas: tarjetasXlsx, resumenExcepciones: resumenXlsx } =
            await emitirEtapas45(resultadosXlsx, 0)

          if (profile?.tenant_id && config.nitDeclarante) {
            await supabase.from('exogenas_procesos').insert({
              tenant_id: profile.tenant_id, creado_por: user.id,
              anio_gravable: config.anioGravable,
              periodo_inicio: new Date(`${config.anioGravable}-01-01`).toISOString(),
              periodo_fin: new Date(`${config.anioGravable}-12-31`).toISOString(),
              nit_declarante: config.nitDeclarante, tipo_declarante: config.tipoDeclarante,
              formatos_incluidos: xlsxResult.formatosDetectados, estado: 'revision',
              total_registros: totalRegistrosXlsx,
              total_excepciones: tarjetasXlsx.length, log_proceso: xlsxResult.advertencias,
            })
          }

          emit({
            tipo: 'fin',
            datos: {
              asientosProcesados: totalRegistrosXlsx,
              advertenciasCsv: xlsxResult.advertencias,
              metaCsv: { empresa: xlsxResult.softwareDetectado ?? 'Prevalidador DIAN', periodo: String(config.anioGravable) },
              cuentasSinRegla: [],
              resumenFormatos: resultadosXlsx.map(r => ({
                codigo: r.formatoCodigo,
                nombre: FormatoRegistry.listar().find(f => f.codigo === r.formatoCodigo)?.nombre ?? '',
                totalFilas: r.totales.totalFilas,
                totales: r.totales,
                excepcionesCriticas: r.excepciones.filter(e => e.severidad === 'alta').length,
                excepcionesMedia: r.excepciones.filter(e => e.severidad === 'media').length,
              })),
              tarjetasExcepciones: tarjetasXlsx,
              resumenExcepciones: resumenXlsx,
              asientosParaExportar: [],
              filasFormatoParaExportar: resultadosXlsx.map(r => ({ formatoCodigo: r.formatoCodigo, filas: r.filas })),
              configParaExportar: config,
            },
          })

        } else {
          // ══════════════════════════════════════════════════════════════
          // FLUJO CSV — Libro Auxiliar Siigo
          // ══════════════════════════════════════════════════════════════

          // ══ ETAPA 1: Leer archivo (CSV o xlsx de Siigo) ═══════════════
          emit({ tipo: 'etapa_inicio', etapa: 1 })

          const parseado = esSiigoXlsx
            ? parsearSiigoXlsx(archivoBuffer)
            : parsearSiigoCsv(csvTexto)
          const { asientos, advertencias, empresaDetectada, periodoDetectado, totalFilas, filasFallidas } = parseado

          // Resolver de forma fabulosa los municipios faltantes: 
          // Heredan el municipio del declarante por defecto si no lo tienen.
          if (config.municipioCodigo) {
            for (const a of asientos) {
              if (a.tercero && a.tercero.paisCodigo === 'CO' && !a.tercero.municipioCodigo) {
                a.tercero.municipioCodigo = config.municipioCodigo
              }
            }
          }

          if (!asientos.length) {
            emit({
              tipo: 'error',
              mensaje: advertencias[0] ?? 'No se encontraron movimientos. Verifique que exportó el Libro Auxiliar con detalle de movimientos.',
            })
            controller.close(); return
          }

          emit({
            tipo: 'etapa_ok', etapa: 1,
            datos: { asientosCont: asientos.length, empresa: empresaDetectada, periodo: periodoDetectado, totalFilas, filasFallidas, advertencias },
          })

          // ══ ETAPA 2: Cargar reglas ════════════════════════════════════
          emit({ tipo: 'etapa_inicio', etapa: 2 })
          const engine = new RulesEngine([...REGLAS_DEFAULT_2025, ...reglasExtra])
          const totalReglas = REGLAS_DEFAULT_2025.length + reglasExtra.length
          emit({ tipo: 'etapa_ok', etapa: 2, datos: { totalReglas, reglasPersonalizadas: reglasExtra.length } })

          // ══ ETAPA 3: Analizar movimientos ═════════════════════════════
          emit({ tipo: 'etapa_inicio', etapa: 3 })
          const cuentasUnicas = new Set(asientos.map(a => a.cuentaPuc)).size
          const tercerosUnicos = new Set(asientos.map(a => a.tercero.numeroId).filter(Boolean)).size
          await new Promise(r => setTimeout(r, 120))
          emit({ tipo: 'etapa_ok', etapa: 3, datos: { cuentasUnicas, tercerosUnicos } })

          // ══ ETAPA 4: Generar formatos ═════════════════════════════════
          emit({ tipo: 'etapa_inicio', etapa: 4 })
          const formatos = config.formatos?.length ? config.formatos : DEFAULT_FORMATOS
          const resultados: ResultadoTransformacion<FilaFormato>[] = []

          for (const codigo of formatos) {
            emit({ tipo: 'formato_inicio', codigo })
            await new Promise(r => setTimeout(r, 80))

            const estrategia = FormatoRegistry.obtener(codigo)
            if (!estrategia) continue

            const filas = estrategia.transformar(asientos, engine)
            const excepciones = estrategia.validar(filas)
            const totales = estrategia.totalizar(filas)
            resultados.push({ formatoCodigo: codigo, filas, excepciones, totales, cuentasSinRegla: [] })

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

          const cuentasSinRegla = engine.cuentasSinRegla(asientos)
          const { tarjetas, resumenExcepciones } = await emitirEtapas45(resultados, cuentasSinRegla.length)

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
        }

      } catch (err) {
        emit({ tipo: 'error', mensaje: err instanceof Error ? err.message : 'Error inesperado al generar las exógenas.' })
      } finally {
        try { controller.close() } catch {}
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
