/**
 * AutocorrectorDV — Maneja el Dígito de Verificación en los asientos contables.
 *
 * REGLA DE ORO: el DV del RUES (Registro Único Empresarial) tiene PRIORIDAD ABSOLUTA.
 * El módulo 11 es solo un cálculo matemático; el RUES es la fuente oficial DIAN.
 *
 * Lo que hace este módulo en la etapa de generación (servidor):
 *   1. Recopila todos los NITs únicos del archivo de Siigo.
 *   2. Para NITs con DV VACÍO → aplica módulo 11 como valor provisional.
 *   3. Para NITs con DV EXISTENTE → NO lo toca (puede ser el del RUES).
 *   4. Retorna la lista de NITs para que la UI haga la verificación RUES en lotes.
 *
 * La corrección RUES definitiva ocurre en el cliente (post-generación) usando
 * /api/nit-verify → campo digitoVerificacion (RUES > módulo 11).
 */

import type { AsientoContable } from '../types'
import { calcularDvNit } from './rules-engine'

export interface AutoCorreccionDV {
  nit:          string
  dvOriginal:   string
  dvCorregido:  string     // Provisional (módulo 11); el cliente lo reemplazará con RUES
  nombre:       string
  tipo:         'dv_faltante' | 'pendiente_rues'
  asientosAfectados: number
}

export interface ResultadoAutocorreccion {
  correcciones:    AutoCorreccionDV[]   // DVs faltantes completados con módulo 11
  nitsParaRUES:    string[]             // TODOS los NITs únicos — el cliente verificará con RUES
  totalCorregidos: number
  totalAsientos:   number
}

/**
 * Fase servidor: solo completa DVs vacíos. NUNCA cambia DVs existentes.
 * Devuelve la lista completa de NITs únicos para que el cliente consulte RUES.
 */
export function autocorregirDv(asientos: AsientoContable[]): ResultadoAutocorreccion {
  const corrMap   = new Map<string, AutoCorreccionDV>()
  const todosNits = new Set<string>()

  for (const a of asientos) {
    const t = a.tercero
    if (!t || t.tipoDocumento !== '3' || !t.numeroId) continue

    const nit = t.numeroId.replace(/\D/g, '')
    if (nit.length < 5 || nit.length > 12) continue

    todosNits.add(nit)

    const dvActual = (t.dv ?? '').trim()

    // Solo actuar si el DV está completamente vacío
    if (dvActual !== '') continue

    const dvProvisional = calcularDvNit(nit)
    t.dv = dvProvisional   // Provisional hasta que RUES confirme

    const entrada = corrMap.get(nit)
    if (entrada) {
      entrada.asientosAfectados++
    } else {
      const nombreRaw = t.razonSocial
        ?? [t.primerApellido, t.segundoApellido, t.primerNombre, t.otrosNombres].filter(Boolean).join(' ')
      corrMap.set(nit, {
        nit,
        dvOriginal:  '',
        dvCorregido: dvProvisional,
        nombre:      nombreRaw || `NIT ${nit}`,
        tipo:        'dv_faltante',
        asientosAfectados: 1,
      })
    }
  }

  const correcciones = [...corrMap.values()].sort((a, b) => a.nit.localeCompare(b.nit))

  return {
    correcciones,
    nitsParaRUES:    [...todosNits].sort(),
    totalCorregidos: correcciones.length,
    totalAsientos:   correcciones.reduce((s, c) => s + c.asientosAfectados, 0),
  }
}
