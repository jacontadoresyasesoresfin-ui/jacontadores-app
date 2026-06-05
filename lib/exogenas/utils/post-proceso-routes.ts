/**
 * Post-proceso de rutas exógenas (generar + exportar).
 *
 * Reglas invariantes aplicadas después de transformar los formatos:
 *
 * F1007 — El declarante NO puede ser su propio cliente.
 *   Si Siigo registra las cuentas de ingreso (41xx) con el NIT del declarante
 *   como tercero (ventas sin NIT de cliente), los montos son CORRECTOS pero
 *   la atribución es incorrecta. Se redirigen a "Consumidor Final" 222222222,
 *   preservando el total de ingresos que debe coincidir con el Balance.
 *
 * F1006 — El declarante y entidades de gobierno no pueden ser "clientes" de IVA.
 *   Mismo caso: si 240805 usa el NIT propio como tercero, los montos son correctos
 *   pero deben mostrarse como consumidor final, no como clientes identificados.
 *
 * F1010 — Entidades de gobierno no son socios/accionistas.
 *   La DIAN, UGPP, SENA, etc. aparecen en clase 31 por errores contables en
 *   Siigo. Se excluyen del formato con advertencia al contador.
 */

import type { FilaFormato, ResultadoTransformacion } from '../types'
import { FormatoRegistry } from '../registry/formato-registry'

// ── NITs de entidades del Estado que NUNCA son socios ni clientes ─────────────
export const NITS_GOBIERNO = new Set([
  '800197268',  // DIAN
  '900167858',  // UGPP
  '800140883',  // ICBF
  '803014469',  // SENA
  '899999274',  // ADRES / FOSYGA
  '800250119',  // Ministerio de Hacienda
  '800099860',  // Supersociedades
])

const NIT_CONSUMIDOR_FINAL = '222222222'

type FilaGeneric = Record<string, unknown>

function getNit(f: FilaFormato): string {
  return String((f as FilaGeneric).numeroId ?? '').replace(/\D/g, '')
}

function recalcularTotales(resultado: ResultadoTransformacion<FilaFormato>) {
  const estrategia = FormatoRegistry.obtener(resultado.formatoCodigo)
  if (estrategia) resultado.totales = estrategia.totalizar(resultado.filas)
}

// ─────────────────────────────────────────────────────────────────────────────
// F1007 — Redirigir declarante → consumidor final (preserva el total)
// ─────────────────────────────────────────────────────────────────────────────
export function redirigirDeclaranteF1007(
  resultados: ResultadoTransformacion<FilaFormato>[],
  nitDeclarante: string,
  advertencias: string[],
) {
  const nitDec = nitDeclarante.replace(/\D/g, '')
  const r1007  = resultados.find(r => r.formatoCodigo === '1007')
  if (!r1007 || !nitDec) return

  const filasDeclarante = r1007.filas.filter(f => getNit(f) === nitDec)
  if (filasDeclarante.length === 0) return

  // Acumular montos del declarante por conceptoCodigo
  const porConcepto = new Map<string, {
    ingreso: number; devolucion: number; descuento: number; neto: number
  }>()

  for (const f of filasDeclarante) {
    const g = f as FilaGeneric
    const concepto = String(g.conceptoCodigo ?? 'ingreso_operacional')
    const prev = porConcepto.get(concepto) ?? { ingreso: 0, devolucion: 0, descuento: 0, neto: 0 }
    prev.ingreso    += (g.valorIngreso    as number) ?? 0
    prev.devolucion += (g.valorDevolucion as number) ?? 0
    prev.descuento  += (g.valorDescuento  as number) ?? 0
    prev.neto       += (g.valorNetoIngreso as number) ?? 0
    porConcepto.set(concepto, prev)
  }

  // Eliminar filas del declarante
  r1007.filas = r1007.filas.filter(f => getNit(f) !== nitDec)

  // Para cada concepto, buscar o crear la fila de consumidor final y sumar
  let montoTotalRedirigido = 0
  for (const [concepto, montos] of porConcepto) {
    montoTotalRedirigido += montos.neto

    const existente = r1007.filas.find(
      f => getNit(f) === NIT_CONSUMIDOR_FINAL &&
           String((f as FilaGeneric).conceptoCodigo ?? '') === concepto
    ) as FilaGeneric | undefined

    if (existente) {
      existente.valorIngreso    = ((existente.valorIngreso    as number) ?? 0) + montos.ingreso
      existente.valorDevolucion = ((existente.valorDevolucion as number) ?? 0) + montos.devolucion
      existente.valorDescuento  = ((existente.valorDescuento  as number) ?? 0) + montos.descuento
      existente.valorNetoIngreso = ((existente.valorNetoIngreso as number) ?? 0) + montos.neto
    } else {
      r1007.filas.push({
        tipoDocumento: '13', numeroId: NIT_CONSUMIDOR_FINAL, dv: '',
        paisCodigo: 'CO', deptoCodigo: '', municipioCodigo: '',
        primerApellido: 'CONSUMIDOR', segundoApellido: '', primerNombre: 'FINAL', otrosNombres: '',
        razonSocial: '', conceptoCodigo: concepto,
        valorIngreso:     montos.ingreso,
        valorDevolucion:  montos.devolucion,
        valorDescuento:   montos.descuento,
        valorNetoIngreso: montos.neto,
        _documentosIds: [], _cuentasOrigen: [],
      } as FilaFormato)
    }
  }

  recalcularTotales(r1007)

  const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
  advertencias.push(
    `⚠️ F1007 CORREGIDO: El declarante NIT ${nitDec} fue redirigido a Consumidor Final ` +
    `(${COP.format(montoTotalRedirigido)} neto). ` +
    `CAUSA: En Siigo las cuentas de ingreso (41xx) usan el NIT del declarante como tercero — ` +
    `las ventas no tienen NIT de cliente registrado. Configure el NIT del cliente en cada factura de venta.`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// F1006 — Redirigir declarante y gobierno → consumidor final (preserva el total)
// ─────────────────────────────────────────────────────────────────────────────
export function redirigirDeclaranteYGobiernoF1006(
  resultados: ResultadoTransformacion<FilaFormato>[],
  nitDeclarante: string,
  advertencias: string[],
) {
  const nitDec = nitDeclarante.replace(/\D/g, '')
  const r1006  = resultados.find(r => r.formatoCodigo === '1006')
  if (!r1006) return

  const esRedirigible = (nit: string) =>
    nit === nitDec || NITS_GOBIERNO.has(nit)

  const filasRedirigir = r1006.filas.filter(f => esRedirigible(getNit(f)))
  if (filasRedirigir.length === 0) return

  let sumaGenerado    = 0
  let sumaRecuperado  = 0
  let sumaConsumo     = 0

  for (const f of filasRedirigir) {
    const g = f as FilaGeneric
    sumaGenerado   += (g.impuestoGenerado            as number) ?? 0
    sumaRecuperado += (g.ivaRecuperadoEnDevoluciones as number) ?? 0
    sumaConsumo    += (g.impuestoNacionalAlConsumo   as number) ?? 0
  }

  // Eliminar filas a redirigir
  r1006.filas = r1006.filas.filter(f => !esRedirigible(getNit(f)))

  // Buscar o crear consumidor final en F1006
  const existente = r1006.filas.find(f => getNit(f) === NIT_CONSUMIDOR_FINAL) as FilaGeneric | undefined

  if (existente) {
    existente.impuestoGenerado            = ((existente.impuestoGenerado            as number) ?? 0) + sumaGenerado
    existente.ivaRecuperadoEnDevoluciones = ((existente.ivaRecuperadoEnDevoluciones as number) ?? 0) + sumaRecuperado
    existente.impuestoNacionalAlConsumo   = ((existente.impuestoNacionalAlConsumo   as number) ?? 0) + sumaConsumo
  } else {
    r1006.filas.push({
      tipoDocumento: '13', numeroId: NIT_CONSUMIDOR_FINAL, dv: '',
      primerApellido: 'CONSUMIDOR', segundoApellido: '', primerNombre: 'FINAL', otrosNombres: '',
      razonSocial: '',
      impuestoGenerado:            sumaGenerado,
      ivaRecuperadoEnDevoluciones: sumaRecuperado,
      impuestoNacionalAlConsumo:   sumaConsumo,
      _documentosIds: [], _cuentasOrigen: [],
    } as FilaFormato)
  }

  recalcularTotales(r1006)

  const nitsMencionados = [...new Set(filasRedirigir.map(f => getNit(f)))].join(', ')
  const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
  advertencias.push(
    `⚠️ F1006 CORREGIDO: NITs ${nitsMencionados} redirigidos a Consumidor Final ` +
    `(${COP.format(sumaGenerado)} IVA generado). ` +
    `CAUSA: La cuenta 240805 en Siigo usa el NIT propio o de entidades del Estado como tercero. ` +
    `El total de IVA Generado es correcto — solo la atribución por cliente estaba incorrecta.`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// F1010 — Excluir entidades de gobierno (no son socios/accionistas)
// ─────────────────────────────────────────────────────────────────────────────
export function excluirGobiernoF1010(
  resultados: ResultadoTransformacion<FilaFormato>[],
  advertencias: string[],
) {
  const r1010 = resultados.find(r => r.formatoCodigo === '1010')
  if (!r1010) return

  const filasGobierno = r1010.filas.filter(f => NITS_GOBIERNO.has(getNit(f)))
  if (filasGobierno.length === 0) return

  const nitsExcluidos = [...new Set(filasGobierno.map(f => getNit(f)))].join(', ')
  r1010.filas = r1010.filas.filter(f => !NITS_GOBIERNO.has(getNit(f)))
  recalcularTotales(r1010)

  advertencias.push(
    `⚠️ F1010 CORREGIDO: Entidades del Estado (${nitsExcluidos}) excluidas de socios/accionistas. ` +
    `CAUSA: Alguna cuenta PUC del grupo 31 (capital) tiene una entidad de gobierno como tercero en Siigo. ` +
    `Corrija la causación contable: reclasifique esos movimientos a las cuentas correctas (24xx/23xx).`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Aplicar TODOS los post-procesos en orden
// ─────────────────────────────────────────────────────────────────────────────
export function aplicarPostProceso(
  resultados: ResultadoTransformacion<FilaFormato>[],
  nitDeclarante: string,
  advertencias: string[],
) {
  redirigirDeclaranteF1007(resultados, nitDeclarante, advertencias)
  redirigirDeclaranteYGobiernoF1006(resultados, nitDeclarante, advertencias)
  excluirGobiernoF1010(resultados, advertencias)
  // F1010: excluir declarante (persona natural no puede ser socio de sí misma)
  const nitDec = nitDeclarante.replace(/\D/g, '')
  const r1010  = resultados.find(r => r.formatoCodigo === '1010')
  if (r1010 && nitDec) {
    const antes = r1010.filas.length
    r1010.filas = r1010.filas.filter(f => getNit(f) !== nitDec)
    if (r1010.filas.length < antes) {
      recalcularTotales(r1010)
      advertencias.push(
        `⚠️ F1010 CORREGIDO: El declarante NIT ${nitDec} fue excluido de socios/accionistas. ` +
        `Una persona natural no puede ser accionista de sí misma.`
      )
    }
  }
}
