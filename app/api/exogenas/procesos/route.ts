import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { RulesEngine } from '@/lib/exogenas/engine/rules-engine'
import { Reconciliador } from '@/lib/exogenas/engine/reconciliador'
import { FormatoRegistry } from '@/lib/exogenas/registry/formato-registry'
import { REGLAS_DEFAULT_2025 } from '@/lib/exogenas/config/reglas-default-2025'
import type { AsientoContable, ConfigExogena, ReglaMapeo, ResultadoTransformacion, FilaFormato } from '@/lib/exogenas/types'

// GET /api/exogenas/procesos — Lista procesos del tenant
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) return NextResponse.json({ error: 'Sin tenant' }, { status: 403 })

  const url = new URL(req.url)
  const anio = url.searchParams.get('anio') ?? '2025'
  const limite = Math.min(Number(url.searchParams.get('limite') ?? '20'), 50)

  const { data, error } = await supabase
    .from('exogenas_procesos')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .eq('anio_gravable', anio)
    .order('created_at', { ascending: false })
    .limit(limite)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ procesos: data ?? [] })
}

// POST /api/exogenas/procesos — Crea un nuevo proceso y lo ejecuta
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) return NextResponse.json({ error: 'Sin tenant' }, { status: 403 })

  const body = await req.json() as {
    config: ConfigExogena
    asientos: AsientoContable[]
    reglasOverride?: ReglaMapeo[]
  }

  const { config, asientos, reglasOverride } = body
  if (!config || !Array.isArray(asientos)) {
    return NextResponse.json({ error: 'Se requiere config y asientos' }, { status: 400 })
  }

  // Combinar reglas default + overrides del tenant
  const reglasBase: ReglaMapeo[] = [...REGLAS_DEFAULT_2025]
  if (reglasOverride?.length) {
    // Las reglas del tenant toman prioridad sobre el default
    reglasBase.push(...reglasOverride)
  }

  const engine = new RulesEngine(reglasBase)
  const reconciliador = new Reconciliador()

  // Ejecutar transformación por formato
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resultados: ResultadoTransformacion<FilaFormato>[] = []

  for (const codigoFormato of config.formatos) {
    const estrategia = FormatoRegistry.obtener(codigoFormato)
    if (!estrategia) continue

    const filas = estrategia.transformar(asientos, engine)
    const excepciones = estrategia.validar(filas)
    const totales = estrategia.totalizar(filas)
    const cuentasSinRegla = engine.cuentasSinRegla(
      asientos.filter(a => !engine.resolver(a))
    )

    resultados.push({
      formatoCodigo: codigoFormato,
      filas,
      excepciones,
      totales,
      cuentasSinRegla,
    })
  }

  // Reconciliación contra saldos contables (si se proveen)
  const reconciliacion = reconciliador.resumir(
    reconciliador.comparar(resultados, [])
  )

  // Persistir el proceso en base de datos
  const totalExcepciones = resultados.reduce((s, r) => s + r.excepciones.length, 0)
  const tieneCriticas = resultados.some(r => r.excepciones.some(e => e.severidad === 'alta'))

  const { data: proceso, error: errProceso } = await supabase
    .from('exogenas_procesos')
    .insert({
      tenant_id: profile.tenant_id,
      creado_por: user.id,
      anio_gravable: config.anioGravable,
      periodo_inicio: new Date(`${config.anioGravable}-01-01`).toISOString(),
      periodo_fin: new Date(`${config.anioGravable}-12-31`).toISOString(),
      nit_declarante: config.nitDeclarante,
      tipo_declarante: config.tipoDeclarante,
      formatos_incluidos: config.formatos,
      estado: tieneCriticas ? 'revision' : 'revision',
      total_registros: resultados.reduce((s, r) => s + r.totales.totalFilas, 0),
      total_excepciones: totalExcepciones,
      log_proceso: reconciliacion,
    })
    .select()
    .single()

  if (errProceso) {
    return NextResponse.json({ error: errProceso.message }, { status: 500 })
  }

  return NextResponse.json({
    proceso,
    resultados: resultados.map(r => ({
      formatoCodigo: r.formatoCodigo,
      totalFilas: r.totales.totalFilas,
      totalExcepciones: r.excepciones.length,
      totales: r.totales,
      excepciones: r.excepciones.map(e => ({
        tipo: e.tipo,
        severidad: e.severidad,
        descripcion: e.descripcion,
        sugerencia: e.sugerencia,
        valorInvolucrado: e.valorInvolucrado,
      })),
      cuentasSinRegla: r.cuentasSinRegla,
    })),
    reconciliacion,
  })
}
