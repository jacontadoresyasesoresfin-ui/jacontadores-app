/**
 * ExcelGenerator — Genera archivos Excel compatibles con el Prevalidador DIAN
 * Resolución DIAN 000227/2025 — Año gravable 2025
 *
 * Cada formato se exporta en una hoja con el nombre exacto requerido por el
 * Prevalidador DIAN. Los encabezados y el orden de columnas deben coincidir
 * exactamente con la plantilla oficial.
 *
 * ⚠️ Verificar encabezados contra el Prevalidador oficial antes de producción.
 */
import * as XLSX from 'xlsx'
import type { ResultadoTransformacion, FilaFormato, ColumnaDefinicion, ConfigExogena } from '../types'
import { FormatoRegistry } from '../registry/formato-registry'

export interface OpcionesExcel {
  incluirPortada?: boolean
  incluirExcepciones?: boolean
  incluirResumen?: boolean
  soloFormatos?: string[]
}

export class ExcelGenerator {
  /**
   * Genera un workbook completo con todos los formatos del proceso.
   * Retorna el buffer listo para enviar al cliente.
   */
  generarWorkbook(
    resultados: ResultadoTransformacion<FilaFormato>[],
    config: ConfigExogena,
    opciones: OpcionesExcel = {},
  ): Buffer {
    const wb = XLSX.utils.book_new()

    const resultadosFiltrados = opciones.soloFormatos
      ? resultados.filter(r => opciones.soloFormatos!.includes(r.formatoCodigo))
      : resultados

    // Portada siempre va primero
    if (opciones.incluirPortada !== false) {
      this.agregarHojaPortada(wb, config, resultadosFiltrados)
    }

    // Una hoja por formato, en orden de prioridad
    const ordenados = [...resultadosFiltrados].sort((a, b) =>
      Number(a.formatoCodigo) - Number(b.formatoCodigo)
    )

    for (const resultado of ordenados) {
      const estrategia = FormatoRegistry.obtener(resultado.formatoCodigo)
      if (!estrategia) continue
      this.agregarHojaFormato(wb, resultado, estrategia.columnas, config.anioGravable)
    }

    // Hoja de excepciones consolidada
    if (opciones.incluirExcepciones !== false) {
      const todasExcepciones = resultadosFiltrados.flatMap(r => r.excepciones)
      if (todasExcepciones.length > 0) {
        this.agregarHojaExcepciones(wb, resultadosFiltrados)
      }
    }

    // Hoja de resumen/totales
    if (opciones.incluirResumen !== false) {
      this.agregarHojaResumen(wb, resultadosFiltrados, config)
    }

    const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    return Buffer.from(raw)
  }

  // ── Hojas privadas ────────────────────────────────────────────────────────

  private agregarHojaPortada(
    wb: XLSX.WorkBook,
    config: ConfigExogena,
    resultados: ResultadoTransformacion<FilaFormato>[],
  ) {
    const filas = [
      ['INFORMACIÓN EXÓGENA — MEDIOS MAGNÉTICOS'],
      [],
      ['NIT Declarante', config.nitDeclarante],
      ['DV', config.dvDeclarante],
      ['Razón social / Nombre', config.razonSocial],
      ['Año gravable', config.anioGravable],
      ['Tipo de declarante', config.tipoDeclarante],
      [],
      ['FORMATOS INCLUIDOS'],
      ['Formato', 'Nombre oficial', 'Registros', 'Total principal'],
    ]

    for (const r of resultados) {
      const info = FormatoRegistry.listar().find(f => f.codigo === r.formatoCodigo)
      const totalPrincipal = Object.values(r.totales)[1] ?? 0
      filas.push([
        `Formato ${r.formatoCodigo}`,
        info?.nombre ?? '',
        r.totales.totalFilas,
        totalPrincipal,
      ])
    }

    filas.push(
      [],
      [`Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`],
      ['Norma: Resolución DIAN 000227/2025 + 000233/2025'],
    )

    const ws = XLSX.utils.aoa_to_sheet(filas)
    this.aplicarEstiloPortada(ws)
    XLSX.utils.book_append_sheet(wb, ws, 'Portada')
  }

  private agregarHojaFormato(
    wb: XLSX.WorkBook,
    resultado: ResultadoTransformacion<FilaFormato>,
    columnas: ColumnaDefinicion[],
    anioGravable: number,
  ) {
    const nombreHoja = `F${resultado.formatoCodigo}`

    // Fila 1: nombre oficial del formato (coincide con Prevalidador DIAN)
    const encabezados = columnas.map(c => c.header)
    const filas: unknown[][] = [encabezados]

    for (const fila of resultado.filas) {
      filas.push(columnas.map(c => {
        const val = (fila as Record<string, unknown>)[c.campo]
        if (c.tipo === 'moneda' && typeof val === 'number') {
          return Math.round(val)  // DIAN exige enteros (sin decimales)
        }
        return val ?? ''
      }))
    }

    // Fila de totales
    const totalRow: unknown[] = columnas.map(c => {
      if (c.tipo === 'moneda') {
        const sum = resultado.filas.reduce((s, f) => s + ((f as Record<string, number>)[c.campo] ?? 0), 0)
        return Math.round(sum)
      }
      return c.campo === columnas[0].campo ? 'TOTAL' : ''
    })
    filas.push(totalRow)

    const ws = XLSX.utils.aoa_to_sheet(filas)
    this.aplicarEstiloFormato(ws, columnas, resultado.filas.length)
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja)
  }

  private agregarHojaExcepciones(
    wb: XLSX.WorkBook,
    resultados: ResultadoTransformacion<FilaFormato>[],
  ) {
    const encabezados = [
      'Formato', 'NIT/Documento', 'Tipo excepción', 'Severidad',
      'Descripción', 'Valor involucrado', 'Sugerencia',
    ]
    const filas: unknown[][] = [encabezados]

    for (const r of resultados) {
      for (const e of r.excepciones) {
        const fila = e.fila as Record<string, unknown>
        filas.push([
          `Formato ${r.formatoCodigo}`,
          fila.numeroId ?? '',
          e.tipo,
          e.severidad.toUpperCase(),
          e.descripcion,
          e.valorInvolucrado ? Math.round(e.valorInvolucrado as number) : '',
          e.sugerencia,
        ])
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(filas)
    XLSX.utils.book_append_sheet(wb, ws, 'Excepciones')
  }

  private agregarHojaResumen(
    wb: XLSX.WorkBook,
    resultados: ResultadoTransformacion<FilaFormato>[],
    config: ConfigExogena,
  ) {
    const filas: unknown[][] = [
      ['RESUMEN DEL PROCESO DE EXÓGENAS'],
      [],
      ['NIT declarante', `${config.nitDeclarante}-${config.dvDeclarante}`],
      ['Año gravable', config.anioGravable],
      [],
      ['Formato', 'Versión', 'Registros', 'Alertas', 'Criticas', 'Estado'],
    ]

    for (const r of resultados) {
      const alertas = r.excepciones.filter(e => e.severidad === 'media').length
      const criticas = r.excepciones.filter(e => e.severidad === 'alta').length
      const estado = criticas > 0 ? 'CON ERRORES' : alertas > 0 ? 'CON ALERTAS' : 'LISTO'
      filas.push([
        `Formato ${r.formatoCodigo}`,
        FormatoRegistry.version(r.formatoCodigo),
        r.totales.totalFilas,
        alertas,
        criticas,
        estado,
      ])
    }

    const totalExcepciones = resultados.reduce((s, r) => s + r.excepciones.length, 0)
    filas.push(
      [],
      ['Total excepciones', totalExcepciones],
      ['Fecha generación', new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })],
    )

    const ws = XLSX.utils.aoa_to_sheet(filas)
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen')
  }

  // ── Estilos ───────────────────────────────────────────────────────────────

  private aplicarEstiloPortada(ws: XLSX.WorkSheet) {
    ws['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 20 }]
  }

  private aplicarEstiloFormato(
    ws: XLSX.WorkSheet,
    columnas: ColumnaDefinicion[],
    numFilas: number,
  ) {
    ws['!cols'] = columnas.map(c => ({ wch: Math.max(c.ancho, c.header.length + 2) }))

    // Congelar primera fila (encabezados)
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }

    // Rango total de la hoja
    ws['!ref'] = XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: columnas.length - 1, r: numFilas + 1 },
    })
  }
}
