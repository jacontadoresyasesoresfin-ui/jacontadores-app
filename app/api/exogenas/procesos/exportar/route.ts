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
 * Body: { config, asientos, reglasOverride?, soloFormatos? }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    config: ConfigExogena
    asientos: AsientoContable[]
    reglasOverride?: ReglaMapeo[]
    soloFormatos?: string[]
  }

  const { config, asientos, reglasOverride, soloFormatos } = body
  if (!config || !Array.isArray(asientos)) {
    return NextResponse.json({ error: 'Se requiere config y asientos' }, { status: 400 })
  }

  const reglas: ReglaMapeo[] = [...REGLAS_DEFAULT_2025, ...(reglasOverride ?? [])]
  const engine = new RulesEngine(reglas)
  const formatosAExportar = soloFormatos ?? config.formatos

  const resultados: ResultadoTransformacion<FilaFormato>[] = []

  for (const codigoFormato of formatosAExportar) {
    const estrategia = FormatoRegistry.obtener(codigoFormato)
    if (!estrategia) continue

    const filas = estrategia.transformar(asientos, engine)
    const excepciones = estrategia.validar(filas)
    const totales = estrategia.totalizar(filas)

    resultados.push({ formatoCodigo: codigoFormato, filas, excepciones, totales, cuentasSinRegla: [] })
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
