/**
 * AutocorrectorDV — Corrige automáticamente el Dígito de Verificación (DV)
 * de todos los terceros en los asientos contables ANTES de transformar los formatos.
 *
 * Flujo:
 *   1. Recorre cada AsientoContable.
 *   2. Para NITs (tipoDocumento === '3'), calcula el DV correcto (módulo 11).
 *   3. Si el DV almacenado en Siigo es incorrecto o falta, lo reemplaza.
 *   4. Registra cada corrección para mostrarla al contador.
 *
 * Resultado: todos los formatos heredan DVs correctos y sus validar() no
 * generarán excepciones dv_incorrecto / dv_faltante para estos NITs.
 */

import type { AsientoContable } from '../types'
import { calcularDvNit, validarDvNit } from './rules-engine'

export interface AutoCorreccionDV {
  nit:          string
  dvOriginal:   string     // DV que venía de Siigo (puede ser '' si faltaba)
  dvCorregido:  string     // DV calculado por módulo 11
  nombre:       string     // Nombre del tercero para mostrar al contador
  tipo:         'dv_incorrecto' | 'dv_faltante'
  asientosAfectados: number
}

export interface ResultadoAutocorreccion {
  correcciones:   AutoCorreccionDV[]
  totalCorregidos: number
  totalAsientos:   number
}

/**
 * Corrige los DVs en el array de asientos (muta los objetos in-place).
 * Retorna el resumen de lo que se cambió.
 */
export function autocorregirDv(asientos: AsientoContable[]): ResultadoAutocorreccion {
  // Mapa NIT → corrección (para no duplicar entradas del mismo tercero)
  const corrMap = new Map<string, AutoCorreccionDV>()

  for (const a of asientos) {
    const t = a.tercero
    if (!t || t.tipoDocumento !== '3' || !t.numeroId) continue

    const nit     = t.numeroId.replace(/\D/g, '')
    if (nit.length < 5 || nit.length > 12) continue  // NIT fuera de rango — no tocar

    const dvCorrecto = calcularDvNit(nit)
    const dvActual   = (t.dv ?? '').trim()

    const esCorrecto = dvActual !== '' && validarDvNit(nit, dvActual)
    if (esCorrecto) continue    // Ya está bien — no hacer nada

    const tipo: AutoCorreccionDV['tipo'] = dvActual === '' ? 'dv_faltante' : 'dv_incorrecto'

    // Aplicar corrección al objeto directamente
    t.dv = dvCorrecto

    // Registrar
    const entrada = corrMap.get(nit)
    if (entrada) {
      entrada.asientosAfectados++
    } else {
      const nombreRaw = t.razonSocial
        ?? [t.primerApellido, t.segundoApellido, t.primerNombre, t.otrosNombres].filter(Boolean).join(' ')
      corrMap.set(nit, {
        nit,
        dvOriginal:  dvActual,
        dvCorregido: dvCorrecto,
        nombre:      nombreRaw || `NIT ${nit}`,
        tipo,
        asientosAfectados: 1,
      })
    }
  }

  const correcciones = [...corrMap.values()].sort((a, b) => a.nit.localeCompare(b.nit))

  return {
    correcciones,
    totalCorregidos: correcciones.length,
    totalAsientos:   correcciones.reduce((s, c) => s + c.asientosAfectados, 0),
  }
}
