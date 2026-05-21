import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ExcelGenerator } from '@/lib/exogenas/excel/excel-generator'
import { RulesEngine } from '@/lib/exogenas/engine/rules-engine'
import { FormatoRegistry } from '@/lib/exogenas/registry/formato-registry'
import { REGLAS_DEFAULT_2025 } from '@/lib/exogenas/config/reglas-default-2025'
import type { AsientoContable, ConfigExogena, ReglaMapeo, FilaFormato, ResultadoTransformacion } from '@/lib/exogenas/types'

/**
 * POST /api/exogenas/procesos/exportar
 * Genera el archivo Excel del Prevalidador DIAN con todos los formatos.
 *
 * Flujo CSV:   { config, asientos }   → re-transforma desde Siigo asientos
 * Flujo xlsx:  { config, filasFormato } → usa las filas ya estructuradas
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    config: ConfigExogena
    asientos?: AsientoContable[]
    filasFormato?: Array<{ formatoCodigo: string; filas: FilaFormato[] }>
    reglasOverride?: ReglaMapeo[]
    soloFormatos?: string[]
  }

  const { config, asientos, filasFormato, reglasOverride, soloFormatos } = body
  if (!config) {
    return NextResponse.json({ error: 'Se requiere config' }, { status: 400 })
  }

  const resultados: ResultadoTransformacion<FilaFormato>[] = []

  if (filasFormato?.length) {
    // ── Flujo xlsx: las filas ya vienen estructuradas, solo validar y totalizar ──
    for (const { formatoCodigo, filas } of filasFormato) {
      const estrategia = FormatoRegistry.obtener(formatoCodigo)
      if (!estrategia) continue
      const excepciones = estrategia.validar(filas)
      const totales = estrategia.totalizar(filas)
      resultados.push({ formatoCodigo, filas, excepciones, totales, cuentasSinRegla: [] })
    }
  } else {
    // ── Flujo CSV: re-transformar desde Siigo asientos con RulesEngine ──────────
    if (!Array.isArray(asientos)) {
      return NextResponse.json({ error: 'Se requiere asientos (flujo CSV) o filasFormato (flujo xlsx)' }, { status: 400 })
    }
    const reglas: ReglaMapeo[] = [...REGLAS_DEFAULT_2025, ...(reglasOverride ?? [])]
    const engine = new RulesEngine(reglas)
    const formatosAExportar = soloFormatos ?? config.formatos

    for (const codigoFormato of formatosAExportar) {
      const estrategia = FormatoRegistry.obtener(codigoFormato)
      if (!estrategia) continue
      const filas = estrategia.transformar(asientos, engine)
      const excepciones = estrategia.validar(filas)
      const totales = estrategia.totalizar(filas)
      resultados.push({ formatoCodigo: codigoFormato, filas, excepciones, totales, cuentasSinRegla: [] })
    }
  }

  const generator = new ExcelGenerator()
  const buffer = generator.generarWorkbook(resultados, config, {
    incluirPortada: true,
    incluirExcepciones: true,
    incluirResumen: true,
    soloFormatos,
  })

  const nombreArchivo = `Exogenas_${config.nitDeclarante}_AG${config.anioGravable}_${
    new Date().toISOString().slice(0, 10)
  }.xlsx`

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
