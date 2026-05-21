/**
 * POST /api/exogenas/generar
 *
 * Acepta un archivo CSV de Siigo (multipart/form-data), lo parsea,
 * ejecuta el motor de reglas, humaniza las excepciones y devuelve
 * el resultado listo para mostrar en la UI de la contadora.
 *
 * También acepta JSON puro con asientos pre-procesados (retrocompatibilidad).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { parsearSiigoCsv } from '@/lib/exogenas/parsers/siigo-csv-parser'
import { humanizarExcepciones, resumirExcepciones } from '@/lib/exogenas/engine/humanizador'
import { RulesEngine } from '@/lib/exogenas/engine/rules-engine'
import { FormatoRegistry } from '@/lib/exogenas/registry/formato-registry'
import { REGLAS_DEFAULT_2025 } from '@/lib/exogenas/config/reglas-default-2025'
import type { AsientoContable, ConfigExogena, FilaFormato, ResultadoTransformacion } from '@/lib/exogenas/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''

  let asientos: AsientoContable[] = []
  let config: ConfigExogena
  let advertenciasCsv: string[] = []
  let metaCsv: { empresa?: string; periodo?: string } = {}

  // ── Modo 1: CSV de Siigo (multipart/form-data) ────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const archivo = formData.get('archivo') as File | null

    if (!archivo) return NextResponse.json({ error: 'Se requiere el archivo CSV de Siigo.' }, { status: 400 })

    const buffer = Buffer.from(await archivo.arrayBuffer())

    // Intentar UTF-8 primero, luego latin1 si hay caracteres raros
    let texto = buffer.toString('utf-8')
    if (texto.includes('�')) texto = buffer.toString('latin1')

    const resultado = parsearSiigoCsv(texto)
    asientos = resultado.asientos
    advertenciasCsv = resultado.advertencias
    metaCsv = { empresa: resultado.empresaDetectada, periodo: resultado.periodoDetectado }

    const configRaw = formData.get('config')
    config = configRaw
      ? JSON.parse(configRaw as string) as ConfigExogena
      : {
          anioGravable: 2025,
          nitDeclarante: '',
          razonSocial: resultado.empresaDetectada ?? '',
          tipoDeclarante: 'contribuyente',
          municipioCodigo: '11001',
          formatos: ['1001', '1005', '1006', '1007', '1010'],
        }
  }
  // ── Modo 2: JSON directo (retrocompatibilidad con flujo anterior) ─────────
  else {
    const body = await req.json() as { config: ConfigExogena; asientos: AsientoContable[] }
    asientos = body.asientos ?? []
    config = body.config
  }

  if (!asientos.length) {
    return NextResponse.json({
      error: 'No se encontraron movimientos contables en el archivo. Verifique que exportó el Libro Auxiliar de Siigo con la opción de detalle completo.',
      advertencias: advertenciasCsv,
    }, { status: 422 })
  }

  // ── Cargar reglas override del tenant ─────────────────────────────────────
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
  let reglasExtra = []
  if (profile?.tenant_id) {
    const { data } = await supabase
      .from('exogenas_reglas_mapeo')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('activo', true)
    reglasExtra = data ?? []
  }

  // ── Ejecutar motor ────────────────────────────────────────────────────────
  const engine = new RulesEngine([...REGLAS_DEFAULT_2025, ...reglasExtra])
  const resultados: ResultadoTransformacion<FilaFormato>[] = []

  for (const codigoFormato of (config.formatos ?? ['1001', '1005', '1006', '1007', '1010'])) {
    const estrategia = FormatoRegistry.obtener(codigoFormato)
    if (!estrategia) continue

    const filas = estrategia.transformar(asientos, engine)
    const excepciones = estrategia.validar(filas)
    const totales = estrategia.totalizar(filas)

    resultados.push({ formatoCodigo: codigoFormato, filas, excepciones, totales, cuentasSinRegla: [] })
  }

  // Cuentas que no cayeron en ningún formato
  const cuentasSinRegla = engine.cuentasSinRegla(asientos)

  // ── Humanizar excepciones ─────────────────────────────────────────────────
  const todasExcepciones = resultados.flatMap(r =>
    r.excepciones.map(e => ({ ...e, formatoCodigo: r.formatoCodigo }))
  )
  const tarjetas = humanizarExcepciones(todasExcepciones)
  const resumenExcepciones = resumirExcepciones(tarjetas)

  // ── Construir resumen por formato para la UI ──────────────────────────────
  const resumenFormatos = resultados.map(r => ({
    codigo: r.formatoCodigo,
    nombre: FormatoRegistry.listar().find(f => f.codigo === r.formatoCodigo)?.nombre ?? '',
    totalFilas: r.totales.totalFilas,
    totales: r.totales,
    excepcionesCriticas: r.excepciones.filter(e => e.severidad === 'alta').length,
    excepcionesMedia: r.excepciones.filter(e => e.severidad === 'media').length,
  }))

  // ── Persistir en DB ───────────────────────────────────────────────────────
  if (profile?.tenant_id && config.nitDeclarante) {
    await supabase.from('exogenas_procesos').insert({
      tenant_id: profile.tenant_id,
      creado_por: user.id,
      anio_gravable: config.anioGravable,
      periodo_inicio: new Date(`${config.anioGravable}-01-01`).toISOString(),
      periodo_fin: new Date(`${config.anioGravable}-12-31`).toISOString(),
      nit_declarante: config.nitDeclarante,
      tipo_declarante: config.tipoDeclarante,
      formatos_incluidos: config.formatos,
      estado: resumenExcepciones.criticas > 0 ? 'revision' : 'revision',
      total_registros: resumenFormatos.reduce((s, r) => s + r.totalFilas, 0),
      total_excepciones: tarjetas.length,
      log_proceso: advertenciasCsv,
    }).select().single()
  }

  return NextResponse.json({
    ok: true,
    asientosProcesados: asientos.length,
    advertenciasCsv,
    metaCsv,
    cuentasSinRegla,
    resumenFormatos,
    tarjetasExcepciones: tarjetas,
    resumenExcepciones,
    // Serializar asientos mínimos para la exportación posterior
    asientosParaExportar: asientos,
    configParaExportar: config,
  })
}
