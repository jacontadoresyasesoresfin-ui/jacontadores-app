import type { ReglaMapeo, ContextoAsiento, AsientoContable } from '../types'

export class RulesEngine {
  private reglas: ReglaMapeo[]

  constructor(reglas: ReglaMapeo[]) {
    // Ordenar de menor a mayor prioridad (menor número = mayor prioridad)
    this.reglas = [...reglas].sort((a, b) => a.prioridad - b.prioridad)
  }

  /** Retorna la primera regla que aplica al asiento, o null si ninguna aplica */
  resolver(asiento: AsientoContable): ReglaMapeo | null {
    const ctx: ContextoAsiento = {
      monto: asiento.monto,
      tipoTercero: asiento.tercero?.tipoTercero,
      naturaleza: asiento.naturaleza,
      tieneRetencion: (asiento.retefuente ?? 0) > 0,
    }
    for (const regla of this.reglas) {
      if (!regla.activo && regla.activo !== undefined) continue
      if (!this.matchCuenta(asiento.cuentaPuc, regla.cuentaPucPatron)) continue
      if (!this.evaluarCondiciones(regla, ctx)) continue
      return regla
    }
    return null
  }

  /** Retorna todas las reglas que aplican a un formato dado */
  reglasParaFormato(formatoCodigo: string): ReglaMapeo[] {
    return this.reglas.filter(r => r.formatoCodigo === formatoCodigo)
  }

  /** Agrupa los asientos por regla (formato + concepto) */
  agrupar(asientos: AsientoContable[]): Map<string, { regla: ReglaMapeo; asientos: AsientoContable[] }> {
    const grupos = new Map<string, { regla: ReglaMapeo; asientos: AsientoContable[] }>()
    const sinRegla: AsientoContable[] = []

    for (const a of asientos) {
      const regla = this.resolver(a)
      if (!regla) { sinRegla.push(a); continue }
      const clave = `${regla.formatoCodigo}|${regla.conceptoCodigo}|${a.tercero.numeroId}`
      const grupo = grupos.get(clave) ?? { regla, asientos: [] }
      grupo.asientos.push(a)
      grupos.set(clave, grupo)
    }

    return grupos
  }

  /** Cuentas PUC sin ninguna regla aplicable */
  cuentasSinRegla(asientos: AsientoContable[]): string[] {
    const sinRegla = new Set<string>()
    for (const a of asientos) {
      if (!this.resolver(a)) sinRegla.add(a.cuentaPuc)
    }
    return [...sinRegla].sort()
  }

  // ── Helpers privados ───────────────────────────────────────────────────

  private matchCuenta(cuenta: string, patron: string): boolean {
    if (!cuenta || !patron) return false
    if (patron.endsWith('%')) {
      // Wildcard: '51%' matchea '5120', '5125', etc.
      return cuenta.startsWith(patron.slice(0, -1))
    }
    if (patron.includes('-') && !patron.startsWith('5') && !patron.startsWith('1')) {
      // Rango: '5120-5199' (solo para cuentas numéricas)
      const [desde, hasta] = patron.split('-')
      return cuenta >= desde && cuenta <= hasta
    }
    // Coincidencia exacta o por inicio (ej: '5120-01' matchea exactamente '5120-01')
    return cuenta === patron || cuenta.startsWith(patron + '-')
  }

  private evaluarCondiciones(regla: ReglaMapeo, ctx: ContextoAsiento): boolean {
    if (regla.tipoTercero && ctx.tipoTercero && ctx.tipoTercero !== regla.tipoTercero) return false
    if (regla.naturaleza && ctx.naturaleza !== regla.naturaleza) return false
    if (regla.montoMinimo && ctx.monto < regla.montoMinimo) return false
    if (regla.incluyeRetencion === true && !ctx.tieneRetencion) return false
    if (regla.incluyeRetencion === false && ctx.tieneRetencion) return false
    return true
  }
}

// Pesos oficiales DIAN (Res. 14465/2011) — dígito más a la derecha × 3, luego × 7, × 13 ...
const DIAN_MULTIPLIERS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]

function _dvCalc(nit: string): number {
  const limpio = nit.replace(/\D/g, '').slice(-9).padStart(9, '0')
  const sum = limpio.split('').reverse().reduce((acc, d, i) => acc + parseInt(d) * DIAN_MULTIPLIERS[i], 0)
  const rem = sum % 11
  return rem <= 1 ? rem : 11 - rem
}

/** Valida el DV de un NIT colombiano (módulo 11 DIAN oficial) */
export function validarDvNit(nit: string, dv: string): boolean {
  const limpio = nit.replace(/\D/g, '')
  if (!limpio || limpio.length < 5) return false
  return String(_dvCalc(limpio)) === String(dv)
}

/** Calcula el DV de un NIT (módulo 11 DIAN oficial) */
export function calcularDvNit(nit: string): string {
  return String(_dvCalc(nit))
}

/** Determina tipo de tercero desde el tipo de documento */
export function inferirTipoTercero(tipoDoc: string, paisCodigo: string): import('../types').TipoTercero {
  if (paisCodigo && paisCodigo !== 'CO') return 'exterior'
  if (tipoDoc === '3') return 'persona_juridica'   // NIT → PJ (aunque puede ser PN)
  return 'persona_natural'
}
