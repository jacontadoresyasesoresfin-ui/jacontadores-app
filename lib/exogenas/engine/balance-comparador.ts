/**
 * BalanceComparador — Extrae totales del Balance de Prueba de Siigo
 * y los compara contra los totales generados en cada formato exógena.
 *
 * Uso: cargar el xlsx del Balance de Prueba junto con el Libro Auxiliar
 * para detectar inconsistencias antes de enviar a la DIAN.
 */

import type { AsientoContable } from '../types'

export interface TotalesBalance {
  /** Saldo neto movimiento crédito clase 41/42 (ingresos operacionales + no operacionales) */
  ingresos:        number
  /** Movimiento débito neto cuentas 2408 (IVA descontable en compras) */
  ivaDescontable:  number
  /** Movimiento crédito neto cuentas 2408 (IVA generado cobrado en ventas) */
  ivaGenerado:     number
  /** Movimiento débito neto cuentas 14xx + 6205xx (compras inventarios + costo ventas) */
  compras:         number
  /** Nuevo saldo clase 13 (CxC, excluyendo 1355 que va a F1003) */
  cxcSaldo:        number
  /** Nuevo saldo clase 22/23/25 (CxP proveedores + retenciones) */
  cxpSaldo:        number
  /** Nuevo saldo clase 31 (capital y reservas) */
  capitalSaldo:    number
  /** Nuevo saldo clase 11/12 (bancos e inversiones) */
  bancosSaldo:     number
  /** NIT detectado del encabezado del balance (si está disponible) */
  nitDetectado:    string
  /** Mapa cuenta→saldo para cruces detallados */
  saldosPorCuenta: Map<string, number>
}

/**
 * Extrae totales del balance a partir de los asientos ya parseados.
 * El saldo "neto" de una cuenta = nuevoSaldo (no el movimiento).
 */
export function extraerTotalesBalance(asientos: AsientoContable[], nitDeclarante?: string): TotalesBalance {
  const saldos = new Map<string, number>()

  for (const a of asientos) {
    const cuenta = a.cuentaPuc
    if (!cuenta) continue
    const prev   = saldos.get(cuenta) ?? 0
    const delta  = a.naturaleza === 'debito' ? a.monto : -a.monto
    saldos.set(cuenta, prev + delta)
  }

  let ingresos       = 0   // crédito neto 41xx/42xx
  let ivaDescontable = 0   // débito neto 2408xx (IVA pagado en compras)
  let ivaGenerado    = 0   // crédito neto 2408xx (IVA cobrado en ventas)
  let compras        = 0   // débito neto 14xx + 6205xx/7205xx
  let cxcSaldo       = 0   // saldo 13xx excluyendo 1355xx
  let cxpSaldo       = 0   // saldo 22xx + 23xx + 25xx
  let capitalSaldo   = 0   // saldo 31xx
  let bancosSaldo    = 0   // saldo 11xx + 12xx

  for (const [cuenta, saldo] of saldos) {
    if (cuenta.startsWith('41') || cuenta.startsWith('42')) {
      ingresos += Math.abs(saldo)   // ingresos siempre acumulan crédito → saldo negativo
    } else if (cuenta.startsWith('2408')) {
      if (saldo > 0) {
        ivaDescontable += saldo    // débito dominante = IVA pagado en compras
      } else {
        ivaGenerado += Math.abs(saldo)  // crédito dominante = IVA cobrado en ventas
      }
    } else if (cuenta.startsWith('14') || cuenta.startsWith('6205') || cuenta.startsWith('7205')) {
      compras += saldo > 0 ? saldo : 0
    } else if (cuenta.startsWith('13') && !cuenta.startsWith('1355')) {
      cxcSaldo += saldo > 0 ? saldo : 0
    } else if (cuenta.startsWith('22') || cuenta.startsWith('23') || cuenta.startsWith('25')) {
      cxpSaldo += saldo < 0 ? Math.abs(saldo) : saldo
    } else if (cuenta.startsWith('31')) {
      capitalSaldo += Math.abs(saldo)
    } else if (cuenta.startsWith('11') || cuenta.startsWith('12')) {
      bancosSaldo += saldo > 0 ? saldo : 0
    }
  }

  // NIT detectado: buscar en los primeros asientos cuyo tercero.tipoDocumento === '3'
  // con número de 9–10 dígitos (NIT empresa)
  const nitDetectado = nitDeclarante
    ?? asientos.find(a => {
      const n = (a.tercero?.numeroId ?? '').replace(/\D/g, '')
      return n.length >= 6 && a.tercero?.tipoDocumento === '3'
    })?.tercero?.numeroId?.replace(/\D/g, '')
    ?? ''

  return { ingresos, ivaDescontable, ivaGenerado, compras, cxcSaldo, cxpSaldo, capitalSaldo, bancosSaldo, nitDetectado, saldosPorCuenta: saldos }
}

/** Calcula la diferencia porcentual absoluta entre dos montos */
export function diffPct(real: number, generado: number): number {
  if (real === 0 && generado === 0) return 0
  if (real === 0) return 100
  return Math.abs((generado - real) / real) * 100
}
