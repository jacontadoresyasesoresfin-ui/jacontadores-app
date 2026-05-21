/**
 * GET /api/exogenas/ping — Diagnóstico de conectividad y carga de módulos
 * Permite verificar que el módulo de exógenas carga correctamente en producción.
 */
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Verificar que los módulos críticos cargan sin error
    const { parsearSiigoCsv } = await import('@/lib/exogenas/parsers/siigo-csv-parser')
    const { RulesEngine } = await import('@/lib/exogenas/engine/rules-engine')
    const { FormatoRegistry } = await import('@/lib/exogenas/registry/formato-registry')
    const { REGLAS_DEFAULT_2025 } = await import('@/lib/exogenas/config/reglas-default-2025')
    const { humanizarExcepciones } = await import('@/lib/exogenas/engine/humanizador')

    // Test rápido del parser con CSV mínimo
    const csvTest = 'Código;Nombre Cuenta;Tercero;Nombre Tercero;Fecha;Débito;Crédito\n51200101;HONORARIOS;1019009021;PRUEBA;01/01/2025;1000000;0\n'
    const resultado = parsearSiigoCsv(csvTest)

    const formatos = FormatoRegistry.listar()
    const engine = new RulesEngine(REGLAS_DEFAULT_2025)
    const sinRegla = engine.cuentasSinRegla(resultado.asientos)
    void humanizarExcepciones([])

    return NextResponse.json({
      ok: true,
      modulos: ['parsearSiigoCsv', 'RulesEngine', 'FormatoRegistry', 'REGLAS_DEFAULT_2025', 'humanizarExcepciones'],
      testParser: {
        asientos: resultado.asientos.length,
        advertencias: resultado.advertencias.length,
      },
      formatos: formatos.map(f => f.codigo),
      reglas: REGLAS_DEFAULT_2025.length,
      cuentasSinRegla: sinRegla,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    }, { status: 500 })
  }
}
