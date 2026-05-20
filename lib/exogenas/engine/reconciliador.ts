import type { LineaReconciliacion, ResultadoTransformacion, FilaFormato } from '../types'

interface SaldoContable {
  cuentaPuc: string
  nombre: string
  saldo: number
}

export class Reconciliador {
  /**
   * Compara los totales generados contra los saldos contables de referencia.
   * umbralAlerta: % diferencia para marcar como alerta (default 1%)
   * umbralCritico: % diferencia para marcar como crítico (default 5%)
   */
  comparar(
    resultados: ResultadoTransformacion<FilaFormato>[],
    saldosContables: SaldoContable[],
    umbralAlerta = 1,
    umbralCritico = 5,
  ): LineaReconciliacion[] {
    const lineas: LineaReconciliacion[] = []
    const saldoMap = new Map(saldosContables.map(s => [s.cuentaPuc, s]))

    for (const res of resultados) {
      const lineasFormato = this.reconciliarFormato(
        res, saldoMap, umbralAlerta, umbralCritico,
      )
      lineas.push(...lineasFormato)
    }

    return lineas
  }

  private reconciliarFormato(
    resultado: ResultadoTransformacion<FilaFormato>,
    saldoMap: Map<string, SaldoContable>,
    umbralAlerta: number,
    umbralCritico: number,
  ): LineaReconciliacion[] {
    const lineas: LineaReconciliacion[] = []

    // Reglas de reconciliación por formato
    const PUNTOS_CONTROL: Record<string, { cuentaRef: string; campoTotal: string; desc: string }[]> = {
      '1001': [
        { cuentaRef: '2365', campoTotal: 'totalRetefuente', desc: 'Retención fuente practicada vs cta 2365' },
        { cuentaRef: '2367', campoTotal: 'totalReteIva', desc: 'ReteIVA practicada vs cta 2367' },
        { cuentaRef: '2368', campoTotal: 'totalReteIca', desc: 'ReteICA practicada vs cta 2368' },
        { cuentaRef: '5%',   campoTotal: 'totalPagos', desc: 'Total pagos y abonos vs gastos clase 5' },
      ],
      '1005': [
        { cuentaRef: '2408', campoTotal: 'totalIvaDescontable', desc: 'IVA descontable vs cta 2408' },
      ],
      '1006': [
        { cuentaRef: '14%',  campoTotal: 'totalCompras', desc: 'Compras informadas vs inventarios clase 14' },
      ],
      '1007': [
        { cuentaRef: '41%',  campoTotal: 'totalIngresos', desc: 'Ingresos informados vs ingresos operacionales' },
      ],
    }

    const puntos = PUNTOS_CONTROL[resultado.formatoCodigo] ?? []
    for (const punto of puntos) {
      const montoGenerado = resultado.totales[punto.campoTotal] ?? 0
      const saldo = saldoMap.get(punto.cuentaRef)
      const montoContable = saldo?.saldo ?? 0

      const diferencia = montoGenerado - montoContable
      const base = Math.max(Math.abs(montoGenerado), Math.abs(montoContable), 1)
      const porcentaje = Math.abs(diferencia) / base * 100

      let estado: 'ok' | 'alerta' | 'critico' = 'ok'
      if (porcentaje > umbralCritico) estado = 'critico'
      else if (porcentaje > umbralAlerta) estado = 'alerta'

      lineas.push({
        formatoCodigo: resultado.formatoCodigo,
        cuentaPucRef: punto.cuentaRef,
        descripcion: punto.desc,
        montoGenerado,
        montoContable,
        diferencia,
        porcentajeDiff: porcentaje,
        estado,
      })
    }

    return lineas
  }

  /** Genera resumen textual para el log del proceso */
  resumir(lineas: LineaReconciliacion[]): string[] {
    const log: string[] = []
    const criticas = lineas.filter(l => l.estado === 'critico')
    const alertas  = lineas.filter(l => l.estado === 'alerta')
    const ok       = lineas.filter(l => l.estado === 'ok')

    log.push(`Reconciliación: ${ok.length} OK, ${alertas.length} alertas, ${criticas.length} críticas`)
    for (const l of criticas) {
      log.push(`🔴 CRÍTICO [${l.formatoCodigo}] ${l.descripcion}: generado $${fmt(l.montoGenerado)} vs contable $${fmt(l.montoContable)} (${l.porcentajeDiff.toFixed(1)}%)`)
    }
    for (const l of alertas) {
      log.push(`🟡 ALERTA [${l.formatoCodigo}] ${l.descripcion}: diferencia $${fmt(Math.abs(l.diferencia))} (${l.porcentajeDiff.toFixed(1)}%)`)
    }
    return log
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO').format(Math.round(n))
}
