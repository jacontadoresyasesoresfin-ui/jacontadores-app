export const dynamic = 'force-dynamic'
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
 * Flujo CSV:   { config, asientos }     → re-transforma desde Siigo asientos
 * Flujo xlsx:  { config, filasFormato } → usa las filas ya estructuradas
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
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
      // ── Flujo xlsx: filas ya estructuradas, solo validar y totalizar ─────────
      for (const { formatoCodigo, filas } of filasFormato) {
        const estrategia = FormatoRegistry.obtener(formatoCodigo)
        if (!estrategia) continue
        const excepciones = estrategia.validar(filas)
        const totales = estrategia.totalizar(filas)
        resultados.push({ formatoCodigo, filas, excepciones, totales, cuentasSinRegla: [] })
      }
    } else if (Array.isArray(asientos) && asientos.length > 0) {
      // Detectar si son filas xlsx pasadas como asientos (compatibilidad con versiones anteriores)
      const primero = asientos[0] as unknown as Record<string, unknown>
      const sonFilasXlsx = 'conceptoCodigo' in primero && !('cuentaPuc' in primero) && !('naturaleza' in primero)

      if (sonFilasXlsx) {
        // ── Fallback xlsx: agrupar las filas por código de formato detectado ─
        // Las filas xlsx ya vienen estructuradas con conceptoCodigo propio de su formato
        const filasPorFormato = new Map<string, FilaFormato[]>()
        for (const fila of asientos as unknown as FilaFormato[]) {
          // Inferir formato del concepto: 5xxx → 1001, 4xxx → 1007, etc.
          const concepto = String((fila as Record<string, unknown>).conceptoCodigo ?? '')
          const codigo = concepto.startsWith('5') ? '1001'
            : concepto.startsWith('4') ? '1007'
            : concepto.startsWith('1') || concepto.startsWith('2') ? '1010'
            : '1001'
          const grupo = filasPorFormato.get(codigo) ?? []
          grupo.push(fila)
          filasPorFormato.set(codigo, grupo)
        }
        for (const [codigo, filas] of filasPorFormato) {
          const estrategia = FormatoRegistry.obtener(codigo)
          if (!estrategia) continue
          const excepciones = estrategia.validar(filas)
          const totales = estrategia.totalizar(filas)
          resultados.push({ formatoCodigo: codigo, filas, excepciones, totales, cuentasSinRegla: [] })
        }
      } else {
        // ── Flujo CSV: re-transformar desde Siigo asientos con RulesEngine ──
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
    } else {
      return NextResponse.json({ error: 'Se requiere filasFormato (xlsx) o asientos (CSV) con datos.' }, { status: 400 })
    }

    if (!resultados.length) {
      return NextResponse.json({ error: 'No se generaron formatos. Verifique que los datos contengan registros válidos.' }, { status: 400 })
    }

    // ── Post-proceso idéntico al de generar/route.ts ──────────────────────────
    // CRÍTICO: aplicar SIEMPRE al exportar, no solo al generar
    if (config.nitDeclarante) {
      const nitDec = config.nitDeclarante.replace(/\D/g, '')

      // F1007: el declarante no puede aparecer como su propio cliente
      const r1007 = resultados.find(r => r.formatoCodigo === '1007')
      if (r1007) {
        const antes1007 = r1007.filas.length
        r1007.filas = r1007.filas.filter(f =>
          String((f as Record<string, unknown>).numeroId ?? '').replace(/\D/g, '') !== nitDec
        )
        if (r1007.filas.length < antes1007) {
          const est = FormatoRegistry.obtener('1007')
          if (est) r1007.totales = est.totalizar(r1007.filas)
        }
      }

      // F1010: el declarante no puede ser socio de sí mismo
      const r1010 = resultados.find(r => r.formatoCodigo === '1010')
      if (r1010) {
        const antes1010 = r1010.filas.length
        r1010.filas = r1010.filas.filter(f =>
          String((f as Record<string, unknown>).numeroId ?? '').replace(/\D/g, '') !== nitDec
        )
        if (r1010.filas.length < antes1010) {
          const est = FormatoRegistry.obtener('1010')
          if (est) r1010.totales = est.totalizar(r1010.filas)
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

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
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err)
    const linea = err instanceof Error
      ? (err.stack ?? '').split('\n').slice(1, 4).map(l => l.trim()).join(' → ')
      : ''
    console.error('[exportar] Error:', mensaje, linea)
    return NextResponse.json({ error: `${mensaje} | ${linea}` }, { status: 500 })
  }
}
