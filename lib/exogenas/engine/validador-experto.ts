/**
 * ValidadorExperto — Auditoría cruzada de exógenas (Res. 000227/2025 + 000233/2025)
 *
 * Reglas en orden de prioridad:
 *  1.  Empresa correcta: los datos deben corresponder al NIT declarante
 *  2.  F1006 = IVA Generado (ventas/concepto 9998) — NUNCA compras/inventarios
 *  3.  Coherencia F1006 vs F1007: IVA generado ≈ ingresos × tarifa IVA aplicable
 *  4.  NIT declarante en F1007 como fuente de ingresos → empresa equivocada
 *  5.  F1010 solo socios/accionistas — sin bancos ni proveedores
 *  6.  F1005 vs F1006: IVA descontable ≤ 19% de compras
 *  7.  Saldos negativos F1008/F1009 con reclasificación contable
 *  8.  DV de todos los terceros (módulo 11 DIAN)
 *  9.  Retenciones F1001 no exceden los pagos
 *  10. NIT declarante: longitud, DV y coincidencia con CSV
 */

import type { ConfigExogena, FilaFormato, ResultadoTransformacion } from '../types'
import { validarDvNit, calcularDvNit } from './rules-engine'
import { type TotalesBalance, diffPct } from './balance-comparador'

// ─── Tipos del Informe ────────────────────────────────────────────────────────

export type NivelValidacion = 'critico' | 'alto' | 'medio' | 'observacion'

export interface HallazgoValidacion {
  nivel:      NivelValidacion
  codigo:     string
  formato?:   string
  titulo:     string
  detalle:    string
  accion:     string
  valorRef?:  number
  terceroId?: string
}

export interface TotalFormato {
  formatoCodigo:     string
  nombreFormato:     string
  totalFilas:        number
  montosPrincipales: { etiqueta: string; valor: number }[]
  estado:            'ok' | 'alerta' | 'critico'
}

export type RecomendacionExportar = 'si' | 'no' | 'corregir_primero'

export interface InformeValidacion {
  timestamp:         string
  nitDeclarante:     string
  anioGravable:      number
  criticos:          HallazgoValidacion[]
  altos:             HallazgoValidacion[]
  medios:            HallazgoValidacion[]
  observaciones:     HallazgoValidacion[]
  totalesPorFormato: TotalFormato[]
  puedeExportar:     boolean
  recomendacion:     RecomendacionExportar
  resumenTexto:      string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const NOMBRES_FORMATO: Record<string, string> = {
  '1001': 'Pagos o abonos en cuenta y retenciones practicadas',
  '1003': 'Retenciones en la fuente practicadas al declarante',
  '1005': 'IVA Descontable (compras)',
  '1006': 'IVA Generado — Ingresos/Ventas (concepto 9998)',
  '1007': 'Ingresos recibidos',
  '1008': 'Saldos Cuentas por Cobrar (31-dic)',
  '1009': 'Saldos Cuentas por Pagar (31-dic)',
  '1010': 'Socios, accionistas y/o asociados',
  '1012': 'Saldos cuentas bancarias e inversiones',
  '2276': 'Pagos laborales',
}

// Conceptos que indican compras/inventarios (NO deben estar en F1006)
const CONCEPTOS_COMPRA = new Set(['compra_bienes', 'compra_materia_prima', 'compra_servicios'])

// Prefijos de cuentas de ingresos (deben ser la fuente de F1006)
const PREFIJOS_INGRESO = ['41', '42']
// Prefijos de cuentas que NUNCA deben estar en F1006
const PREFIJOS_PROHIBIDOS_F1006 = ['14', '62', '72', '51', '52', '53', '24']

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmt = (n: number) => COP.format(Math.abs(n))

// ─── Clase principal ──────────────────────────────────────────────────────────

export class ValidadorExperto {
  private hallazgos: HallazgoValidacion[] = []

  validar(
    config: ConfigExogena,
    resultados: ResultadoTransformacion<FilaFormato>[],
    empresaDetectada?: string,
    balance?: TotalesBalance,
  ): InformeValidacion {
    this.hallazgos = []
    const porFormato = new Map(resultados.map(r => [r.formatoCodigo, r]))

    // Orden: crítico primero
    this.validarNitDeclarante(config, empresaDetectada)
    this.validarDeclaranteNoEsClientePropio(config, porFormato)
    this.validarF1006EsIvaGenerado(porFormato)
    this.validarCoherenciaF1006vsF1007(porFormato)
    if (balance) this.validarContraBalance(config, porFormato, balance)
    this.validarF1010SoloSocios(porFormato)
    this.validarCoherenciaIvaDescontable(porFormato)
    this.validarSaldosNegativos(porFormato)
    this.validarDvTerceros(resultados)
    this.validarRetencionesF1001(porFormato)

    const criticos      = this.hallazgos.filter(h => h.nivel === 'critico')
    const altos         = this.hallazgos.filter(h => h.nivel === 'alto')
    const medios        = this.hallazgos.filter(h => h.nivel === 'medio')
    const observaciones = this.hallazgos.filter(h => h.nivel === 'observacion')

    // Recomendación de tres vías
    const recomendacion: RecomendacionExportar =
      criticos.length > 0 ? 'no' :
      altos.length    > 0 ? 'corregir_primero' :
      'si'

    return {
      timestamp:         new Date().toISOString(),
      nitDeclarante:     config.nitDeclarante,
      anioGravable:      config.anioGravable,
      criticos, altos, medios, observaciones,
      totalesPorFormato: resultados.map(r => this.construirTotalFormato(r)),
      puedeExportar:     criticos.length === 0,
      recomendacion,
      resumenTexto:      this.construirResumenTexto(criticos, altos, medios, recomendacion),
    }
  }

  // ─── Regla 1: NIT Declarante ─────────────────────────────────────────────

  private validarNitDeclarante(config: ConfigExogena, empresaDetectada?: string) {
    const nit = (config.nitDeclarante ?? '').replace(/\D/g, '')

    if (!nit) {
      this.add({
        nivel: 'critico', codigo: 'NIT_DECLARANTE_VACIO',
        titulo: 'NIT del declarante no configurado',
        detalle: 'La portada del archivo exógena quedará sin NIT. La DIAN rechazará la presentación.',
        accion:  'Configure el NIT del declarante en "Datos del declarante" antes de generar.',
      }); return
    }

    if (nit.length < 6 || nit.length > 10) {
      this.add({
        nivel: 'critico', codigo: 'NIT_DECLARANTE_LONGITUD',
        titulo: `NIT del declarante con longitud inválida (${nit.length} dígitos)`,
        detalle: `NIT ingresado: ${nit}. Los NITs colombianos tienen entre 6 y 10 dígitos sin DV.`,
        accion:  'Verifique el NIT en el RUT de la empresa declarante.',
        terceroId: nit,
      }); return
    }

    if (config.dvDeclarante) {
      if (!validarDvNit(nit, config.dvDeclarante)) {
        const dvCorrecto = calcularDvNit(nit)
        this.add({
          nivel: 'critico', codigo: 'NIT_DECLARANTE_DV_INCORRECTO',
          titulo: `DV del declarante incorrecto — NIT ${nit}-${config.dvDeclarante}`,
          detalle: `DV informado: ${config.dvDeclarante}, correcto según módulo 11: ${dvCorrecto}. El RUES es la fuente definitiva si hay discrepancia.`,
          accion:  `Verifique el DV en https://app.jacontadores.com/dashboard/nit buscando ${nit}. Use el valor del cuadro "Copiar".`,
          terceroId: nit,
        })
      }
    }

    if (empresaDetectada) {
      const nitEnEmpresa = empresaDetectada.replace(/\D/g, '').slice(-10)
      if (nitEnEmpresa.length >= 6 && !nitEnEmpresa.includes(nit) && !nit.includes(nitEnEmpresa)) {
        this.add({
          nivel: 'alto', codigo: 'NIT_DECLARANTE_NO_COINCIDE_CSV',
          titulo: 'El NIT declarante puede no coincidir con la empresa del archivo',
          detalle: `El archivo menciona "${empresaDetectada}" pero el NIT configurado es ${nit}. Si está procesando la contabilidad de otra empresa, los datos del F1001–F1007 serán de la empresa equivocada.`,
          accion:  'Confirme que el Libro Auxiliar de Siigo corresponde exactamente al NIT declarante. Si usa Siigo multiempresa, asegúrese de exportar la empresa correcta.',
          terceroId: nit,
        })
      }
    }
  }

  // ─── Regla 2: El NIT declarante NO debe aparecer como cliente en F1007 ────

  private validarDeclaranteNoEsClientePropio(
    config: ConfigExogena,
    porFormato: Map<string, ResultadoTransformacion<FilaFormato>>
  ) {
    const r1007 = porFormato.get('1007')
    if (!r1007 || !config.nitDeclarante) return

    const nitDec = config.nitDeclarante.replace(/\D/g, '')
    const totalIngresos = r1007.totales.totalNetaIngresos ?? r1007.totales.totalIngresos ?? 0

    for (const fila of r1007.filas) {
      const nit = String(fila.numeroId ?? '').replace(/\D/g, '')
      if (nit !== nitDec) continue

      const monto = (fila.valorNetoIngreso as number | undefined)
        ?? (fila.valorIngreso as number | undefined)
        ?? 0

      if (monto <= 0) continue

      const pct = totalIngresos > 0 ? (monto / totalIngresos * 100).toFixed(1) : '?'

      this.add({
        nivel: 'critico', codigo: 'DECLARANTE_COMO_CLIENTE',
        formato: '1007',
        titulo: `ERROR CRÍTICO: el NIT declarante ${nitDec} aparece como cliente en F1007`,
        detalle: `El NIT declarante (${config.razonSocial || nitDec}) figura como fuente de ingresos por ${fmt(monto)} (${pct}% del total). Esto indica que está procesando datos de otra empresa — posiblemente la firma contable J&A Contadores u otra empresa del multiempresa de Siigo. Los datos del F1001–F1007 corresponden a una empresa diferente al declarante.`,
        accion:  'DETENGA la generación. En Siigo, exporte el Libro Auxiliar exclusivamente de la empresa con NIT declarante. NO use el auxiliar de la firma contable ni de otra empresa del mismo Siigo.',
        valorRef: monto, terceroId: nit,
      })
    }
  }

  // ─── Regla 3: F1006 debe ser IVA Generado (ventas) — NO compras ──────────

  private validarF1006EsIvaGenerado(porFormato: Map<string, ResultadoTransformacion<FilaFormato>>) {
    const r1006 = porFormato.get('1006')
    if (!r1006 || r1006.filas.length === 0) return

    // ── 3a. Detectar conceptos de compra que NO deben estar en F1006 ─────────
    const filasConceptoCompra = r1006.filas.filter(f =>
      CONCEPTOS_COMPRA.has(String(f.conceptoCodigo ?? ''))
    )

    if (filasConceptoCompra.length > 0) {
      const terceros = [...new Set(filasConceptoCompra.map(f => f.numeroId as string).filter(Boolean))].slice(0, 4)
      this.add({
        nivel: 'critico', codigo: 'F1006_CONCEPTO_COMPRA',
        formato: '1006',
        titulo: `F1006 contiene conceptos de COMPRAS — debe ser IVA Generado (ventas)`,
        detalle: `Se detectaron ${filasConceptoCompra.length} fila(s) con conceptos compra_bienes / compra_servicios / compra_materia_prima. F1006 debe construirse EXCLUSIVAMENTE desde cuentas de ingresos (41xx, 42xx) usando el concepto Siigo 9998 (IVA Generado), no desde inventarios (14x), costos (62x) ni servicios comprados (5x). Terceros afectados: ${terceros.join(', ')}.`,
        accion:  'En Siigo: Configurar → Medios Magnéticos → asigne las cuentas 41xx/42xx al concepto 9998 para F1006. Retire del F1006 cualquier cuenta de inventarios (grupo 14), costos de ventas (grupo 6-7) o gastos (grupo 5). Si está usando el concepto 9997 para F1006, ese es el error — 9997 es IVA Descontable (compras) que va a F1005.',
      })
    }

    // ── 3b. Detectar cuentas de origen prohibidas ─────────────────────────────
    const cuentasProhibidas = new Set<string>()
    for (const fila of r1006.filas) {
      const cuentas = (fila._cuentasOrigen ?? []) as string[]
      for (const c of cuentas) {
        if (PREFIJOS_PROHIBIDOS_F1006.some(p => c.startsWith(p))) {
          cuentasProhibidas.add(c.slice(0, 4))
        }
      }
    }

    if (cuentasProhibidas.size > 0) {
      this.add({
        nivel: 'critico', codigo: 'F1006_CUENTAS_PROHIBIDAS',
        formato: '1006',
        titulo: `F1006 toma datos de cuentas incorrectas: ${[...cuentasProhibidas].join(', ')}`,
        detalle: `F1006 (IVA Generado) solo debe tomar cuentas 41xx o 42xx. Se detectaron cuentas de: ${[...cuentasProhibidas].map(c => c + 'xx').join(', ')} — estas corresponden a compras, inventarios, gastos o IVA descontable.`,
        accion:  'Corrija el mapeo PUC en Configuración → Mapeo PUC: las cuentas listadas no deben apuntar a F1006. Revise especialmente que ninguna cuenta del grupo 24 (IVA) esté mapeada a F1006.',
      })
    }
  }

  // ─── Regla 4: Coherencia F1006 (IVA Generado) vs F1007 (Ingresos) ────────

  private validarCoherenciaF1006vsF1007(porFormato: Map<string, ResultadoTransformacion<FilaFormato>>) {
    const r1006 = porFormato.get('1006')
    const r1007 = porFormato.get('1007')
    if (!r1006 || !r1007) return

    const ivaGenerado  = r1006.totales.totalNetaCompras ?? r1006.totales.totalCompras ?? 0
    const ingresos     = r1007.totales.totalNetaIngresos ?? r1007.totales.totalIngresos ?? 0

    if (ingresos <= 0 || ivaGenerado <= 0) return

    const tasaImplicita = (ivaGenerado / ingresos) * 100

    // El IVA generado no puede ser mayor al 19% de los ingresos (tasa máxima)
    if (tasaImplicita > 21) {
      this.add({
        nivel: 'critico', codigo: 'F1006_IVA_EXCEDE_INGRESOS',
        formato: '1006',
        titulo: `F1006 (IVA Generado) supera el 19% de los ingresos — monto imposible`,
        detalle: `F1007 Ingresos netos: ${fmt(ingresos)} | F1006 IVA Generado: ${fmt(ivaGenerado)} | Tasa implícita: ${tasaImplicita.toFixed(1)}%. El IVA generado no puede superar el 19% de los ingresos gravados. Este resultado indica que F1006 está tomando montos de compras en lugar de IVA de ventas, o que hay un error grave de mapeo.`,
        accion:  'Verifique que F1006 recibe únicamente el IVA que la empresa cobra a sus clientes (cuentas 2408 de ventas o la base de ingresos gravados). Si F1006 muestra montos similares o mayores a los ingresos, el concepto Siigo asignado es incorrecto.',
        valorRef: ivaGenerado,
      })
    } else if (tasaImplicita < 0.5 && ingresos > 100_000_000) {
      this.add({
        nivel: 'medio', codigo: 'F1006_IVA_MUY_BAJO',
        formato: '1006',
        titulo: `F1006 (IVA Generado) es muy bajo respecto a los ingresos (${tasaImplicita.toFixed(1)}%)`,
        detalle: `F1007: ${fmt(ingresos)} | F1006: ${fmt(ivaGenerado)}. Si la empresa vende bienes/servicios gravados al 19%, el IVA esperado sería ${fmt(ingresos * 0.19)}. Un porcentaje tan bajo puede indicar que algunas ventas gravadas no están siendo incluidas en F1006.`,
        accion:  'Confirme que todas las cuentas de ingresos gravados (41xx con IVA) están mapeadas al concepto 9998 en la Configuración Siigo. Si la empresa solo tiene ingresos exentos o excluidos, el monto bajo puede ser correcto.',
        valorRef: ivaGenerado,
      })
    } else {
      this.add({
        nivel: 'observacion', codigo: 'F1006_F1007_COHERENTE',
        formato: '1006/1007',
        titulo: `F1006 coherente con F1007 — Tasa IVA implícita: ${tasaImplicita.toFixed(1)}%`,
        detalle: `Ingresos F1007: ${fmt(ingresos)} | IVA Generado F1006: ${fmt(ivaGenerado)} | Tasa: ${tasaImplicita.toFixed(1)}%. Dentro del rango esperado (0–19%).`,
        accion:  'Sin acción requerida.',
      })
    }
  }

  // ─── Regla 5: F1010 debe contener solo socios / accionistas ──────────────

  private validarF1010SoloSocios(porFormato: Map<string, ResultadoTransformacion<FilaFormato>>) {
    const r1010 = porFormato.get('1010')
    if (!r1010 || r1010.filas.length === 0) return

    // Conceptos válidos para F1010
    const conceptosValidos = new Set(['socio', 'accionista', 'cooperado', 'comunero', 'asociado'])

    const filasInvalidas = r1010.filas.filter(f => {
      const concepto = String(f.conceptoCodigo ?? '').toLowerCase()
      return !conceptosValidos.has(concepto) && concepto !== ''
    })

    if (filasInvalidas.length > 0) {
      const conceptosEncontrados = [...new Set(filasInvalidas.map(f => f.conceptoCodigo as string).filter(Boolean))]
      this.add({
        nivel: 'alto', codigo: 'F1010_CONCEPTO_INCORRECTO',
        formato: '1010',
        titulo: `F1010 contiene terceros que no son socios/accionistas (${conceptosEncontrados.join(', ')})`,
        detalle: `F1010 "Socios, Accionistas y/o Asociados" solo debe reportar personas con participación en el capital social. Se encontraron ${filasInvalidas.length} fila(s) con conceptos "${conceptosEncontrados.join('", "')}". Si hay bancos, proveedores u otros terceros con saldo negativo clasificados como "proveedor", es un error de mapeo de las cuentas 22xx.`,
        accion:  'Revise el mapeo PUC de F1010: solo deben apuntar aquí las cuentas de capital (clase 31) y aporte de socios. Las cuentas 22xx (proveedores) deben ir a F1009, no a F1010.',
      })
    }

    // Detectar saldos negativos en F1010 (inusual — posible error)
    const negativos = r1010.filas.filter(f => {
      const saldo = (f.valorSaldo as number | undefined) ?? 0
      return saldo < 0
    })
    if (negativos.length > 0) {
      const totalNeg = negativos.reduce((s, f) => s + ((f.valorSaldo as number) ?? 0), 0)
      this.add({
        nivel: 'medio', codigo: 'F1010_SALDO_NEGATIVO',
        formato: '1010',
        titulo: `F1010 — ${negativos.length} socio(s) con saldo negativo (${fmt(totalNeg)})`,
        detalle: 'Un saldo negativo en F1010 puede indicar dividendos o retiros no contabilizados correctamente, o un error de mapeo de cuentas.',
        accion:  'Verifique los movimientos de la cuenta de capital del socio con saldo negativo. Si corresponde a anticipos de dividendos, reclasifique a una cuenta de deudores.',
        valorRef: Math.abs(totalNeg),
      })
    }
  }

  // ─── Regla 6: Coherencia IVA Descontable (F1005) vs compras reales ────────

  private validarCoherenciaIvaDescontable(porFormato: Map<string, ResultadoTransformacion<FilaFormato>>) {
    const r1005 = porFormato.get('1005')
    const r1001 = porFormato.get('1001')
    if (!r1005) return

    const totalIvaDesc = r1005.totales.totalIvaDescontable ?? 0
    const totalPagos   = (r1001?.totales.totalPagoDeducible ?? 0) + (r1001?.totales.totalPagoNoDeducible ?? 0)

    if (totalPagos > 0 && totalIvaDesc > totalPagos * 0.20) {
      this.add({
        nivel: 'alto', codigo: 'F1005_IVA_EXCEDE_PAGOS',
        formato: '1005',
        titulo: `F1005 IVA Descontable (${fmt(totalIvaDesc)}) supera el 20% de los pagos F1001`,
        detalle: `F1001 Pagos totales: ${fmt(totalPagos)} | F1005 IVA descontable: ${fmt(totalIvaDesc)} | Relación: ${(totalIvaDesc / totalPagos * 100).toFixed(1)}%. Si todas las compras fueran gravadas al 19%, el IVA máximo esperado sería ${fmt(totalPagos * 0.19)}.`,
        accion:  'Verifique que solo las cuentas 2408 (IVA descontable en compras) están mapeadas a F1005. Excluya IVA de ventas, ajustes o provisiones.',
        valorRef: totalIvaDesc,
      })
    }

    if (totalIvaDesc > 0) {
      this.add({
        nivel: 'observacion', codigo: 'F1005_TOTAL',
        formato: '1005',
        titulo: `F1005 IVA Descontable total: ${fmt(totalIvaDesc)}`,
        detalle: 'Verifique que coincide con el saldo acumulado de la cuenta 2408 en el balance de prueba.',
        accion:  'Cruce el total de F1005 con el movimiento débito neto de las cuentas 2408xx del período.',
        valorRef: totalIvaDesc,
      })
    }
  }

  // ─── Regla 7: Saldos negativos F1008 / F1009 ─────────────────────────────

  private validarSaldosNegativos(porFormato: Map<string, ResultadoTransformacion<FilaFormato>>) {
    const r1008 = porFormato.get('1008')
    if (r1008) {
      const negativos = r1008.filas.filter(f => (f.valorSaldo as number) < 0)
      if (negativos.length > 0) {
        const totalNeg = negativos.reduce((s, f) => s + (f.valorSaldo as number), 0)
        const ejemplos = negativos.slice(0, 3).map(f =>
          `${(f.razonSocial || f.numeroId) as string}: ${fmt(f.valorSaldo as number)}`
        ).join(' | ')
        this.add({
          nivel: 'alto', codigo: 'CXC_SALDO_NEGATIVO', formato: '1008',
          titulo: `F1008 — ${negativos.length} tercero(s) con saldo CxC negativo (${fmt(totalNeg)})`,
          detalle: `Un saldo negativo en Cuentas por Cobrar significa que el cliente tiene crédito a favor. Ejemplos: ${ejemplos}.`,
          accion:  'Reclasifique en Siigo a la cuenta 2808 (Anticipos de clientes). Comprobante de egreso o nota de ajuste para mover el saldo.',
          valorRef: Math.abs(totalNeg),
        })
      }
    }

    const r1009 = porFormato.get('1009')
    if (r1009) {
      const negativos = r1009.filas.filter(f => (f.valorSaldo as number) < 0)
      if (negativos.length > 0) {
        const totalNeg = negativos.reduce((s, f) => s + (f.valorSaldo as number), 0)
        const ejemplos = negativos.slice(0, 3).map(f =>
          `${(f.razonSocial || f.numeroId) as string}: ${fmt(f.valorSaldo as number)}`
        ).join(' | ')
        this.add({
          nivel: 'alto', codigo: 'CXP_SALDO_NEGATIVO', formato: '1009',
          titulo: `F1009 — ${negativos.length} tercero(s) con saldo CxP negativo (${fmt(totalNeg)})`,
          detalle: `Saldo negativo en CxP = se pagó de más o falta contabilizar una factura. Ejemplos: ${ejemplos}.`,
          accion:  'Reclasifique en Siigo a la cuenta 1330 o 1355 (Anticipos a proveedores). Si es error, aplique la nota débito o la factura pendiente.',
          valorRef: Math.abs(totalNeg),
        })
      }
    }
  }

  // ─── Regla Balance: Comparación obligatoria contra Balance de Prueba ────────

  private validarContraBalance(
    config: ConfigExogena,
    porFormato: Map<string, ResultadoTransformacion<FilaFormato>>,
    bal: TotalesBalance,
  ) {
    const UMBRAL_CRITICO = 5    // > 5% diferencia = CRÍTICO
    const UMBRAL_ALTO    = 2    // > 2% = ALTO

    const check = (
      etiqueta: string, codigo: string, formato: string,
      balTotal: number, exoTotal: number,
    ) => {
      if (balTotal === 0 && exoTotal === 0) return
      const pct = diffPct(balTotal, exoTotal)
      if (pct < 0.5) {
        this.add({
          nivel: 'observacion', codigo: `BALANCE_${codigo}_OK`, formato,
          titulo: `Balance ✓ ${etiqueta}: ${fmt(balTotal)} ≈ Exógena ${fmt(exoTotal)}`,
          detalle: `Diferencia: ${pct.toFixed(2)}% — dentro del margen aceptable.`,
          accion:  'Sin acción requerida.',
          valorRef: Math.abs(exoTotal - balTotal),
        })
        return
      }
      const nivel: 'critico' | 'alto' | 'medio' =
        pct > UMBRAL_CRITICO ? 'critico' :
        pct > UMBRAL_ALTO    ? 'alto'    : 'medio'
      this.add({
        nivel, codigo: `BALANCE_${codigo}_DIFF`, formato,
        titulo: `Diferencia ${etiqueta}: Balance ${fmt(balTotal)} vs Exógena ${fmt(exoTotal)} (${pct.toFixed(1)}%)`,
        detalle: `El Balance de Prueba reporta ${fmt(balTotal)} y la exógena generada muestra ${fmt(exoTotal)}. Diferencia de ${fmt(Math.abs(exoTotal - balTotal))} (${pct.toFixed(1)}%). ${pct > UMBRAL_CRITICO ? 'Esta diferencia supera el 5% — probable error grave de mapeo o contabilidad de empresa incorrecta.' : 'Diferencia relevante que debe revisarse antes de presentar.'}`,
        accion:  pct > UMBRAL_CRITICO
          ? `Detenga la generación. Verifique: (1) que el Libro Auxiliar es de NIT ${config.nitDeclarante}, (2) que las cuentas PUC están correctamente mapeadas en Configuración, (3) que no faltan movimientos en el período.`
          : `Revise las cuentas del grupo correspondiente en Siigo y confirme que el mapeo PUC es correcto para el período ${config.anioGravable}.`,
        valorRef: Math.abs(exoTotal - balTotal),
      })
    }

    // 1. Ingresos: Balance clase 41/42 vs F1007
    const r1007 = porFormato.get('1007')
    if (r1007 && bal.ingresos > 0) {
      const exoIngresos = r1007.totales.totalNetaIngresos ?? r1007.totales.totalIngresos ?? 0
      check('Ingresos F1007', 'INGRESOS', '1007', bal.ingresos, exoIngresos)
    }

    // 2. IVA Descontable: Balance 2408 vs F1005
    const r1005 = porFormato.get('1005')
    if (r1005 && bal.ivaDescontable > 0) {
      const exoIva = r1005.totales.totalIvaDescontable ?? 0
      check('IVA Descontable F1005', 'IVA_DESC', '1005', bal.ivaDescontable, exoIva)
    }

    // 3. CxC: Balance clase 13 vs F1008
    const r1008 = porFormato.get('1008')
    if (r1008 && bal.cxcSaldo > 0) {
      const exoCxC = r1008.totales.totalSaldoCxC ?? 0
      check('Saldo CxC F1008', 'CXC', '1008', bal.cxcSaldo, exoCxC)
    }

    // 4. CxP: Balance clase 22/23 vs F1009
    const r1009 = porFormato.get('1009')
    if (r1009 && bal.cxpSaldo > 0) {
      const exoCxP = r1009.totales.totalSaldoCxP ?? 0
      check('Saldo CxP F1009', 'CXP', '1009', bal.cxpSaldo, exoCxP)
    }

    // 5. NIT del balance vs declarante (si se detectó NIT en el balance)
    if (bal.nitDetectado) {
      const nitDec = config.nitDeclarante.replace(/\D/g, '')
      const nitBal = bal.nitDetectado.replace(/\D/g, '')
      if (nitBal && nitDec && !nitBal.includes(nitDec) && !nitDec.includes(nitBal)) {
        this.add({
          nivel: 'critico', codigo: 'BALANCE_NIT_DIFERENTE',
          titulo: `El Balance pertenece a NIT ${nitBal} pero el declarante es NIT ${nitDec}`,
          detalle: `El archivo de Balance de Prueba corresponde a una empresa diferente al declarante configurado. Los datos del balance NO son comparables con los de la exógena.`,
          accion:  `Cargue el Balance de Prueba del NIT declarante (${nitDec}). Si la empresa declarante no tiene balance en este Siigo, verifique que está procesando la empresa correcta.`,
          terceroId: nitBal,
        })
      }
    }

    // 6. Resumen comparativo siempre visible
    this.add({
      nivel: 'observacion', codigo: 'BALANCE_RESUMEN',
      titulo: 'Balance de Prueba cargado — Comparación activa',
      detalle: [
        `Ingresos balance: ${fmt(bal.ingresos)} | IVA Descontable: ${fmt(bal.ivaDescontable)}`,
        `Compras/Inventario: ${fmt(bal.compras)} | CxC: ${fmt(bal.cxcSaldo)} | CxP: ${fmt(bal.cxpSaldo)}`,
        `Bancos/Inversiones: ${fmt(bal.bancosSaldo)} | Capital: ${fmt(bal.capitalSaldo)}`,
      ].join(' ‖ '),
      accion: 'El sistema comparó los totales del Balance contra cada formato. Revise los hallazgos específicos arriba.',
    })
  }

  // ─── Regla 8: DV de todos los terceros ───────────────────────────────────

  private validarDvTerceros(resultados: ResultadoTransformacion<FilaFormato>[]) {
    const auditados = new Map<string, { dvInformado: string; dvCorrecto: string; formatos: string[] }>()

    for (const r of resultados) {
      for (const fila of r.filas) {
        const nit = (fila.numeroId as string | undefined) ?? ''
        const dv  = (fila.dv  as string | undefined) ?? ''
        if (!nit || nit === '222222222' || nit.length < 6) continue
        if (!dv) continue

        if (auditados.has(nit)) {
          auditados.get(nit)!.formatos.push(r.formatoCodigo)
          continue
        }
        if (!validarDvNit(nit, dv)) {
          auditados.set(nit, {
            dvInformado: dv,
            dvCorrecto:  calcularDvNit(nit),
            formatos:    [r.formatoCodigo],
          })
        }
      }
    }

    for (const [nit, info] of auditados) {
      const nivel: NivelValidacion = info.formatos.some(f => ['1001','1005','1006','1007'].includes(f))
        ? 'alto' : 'medio'
      this.add({
        nivel, codigo: 'DV_INCORRECTO', formato: info.formatos.join('/'),
        titulo: `DV incorrecto (módulo 11) — NIT ${nit}-${info.dvInformado}`,
        detalle: `NIT ${nit} en formatos ${info.formatos.join(', ')} tiene DV=${info.dvInformado}. Módulo 11 da ${info.dvCorrecto}. Verifique en el verificador RUES — el DV del RUES tiene prioridad sobre el módulo 11.`,
        accion:  `Verifique en https://app.jacontadores.com/dashboard/nit → buscar ${nit} → use el valor del cuadro "Copiar". Corrija en Siigo: Terceros → NIT ${nit} → campo Dígito de Verificación.`,
        terceroId: nit,
      })
    }

    if (auditados.size === 0 && resultados.some(r => r.filas.length > 0)) {
      this.add({
        nivel: 'observacion', codigo: 'DV_TODOS_OK',
        titulo: 'DVs verificados — todos los NITs son válidos según módulo 11',
        detalle: 'Módulo 11 aplicado a todos los terceros con DV informado. Recuerde que el RUES tiene prioridad; el sistema realiza verificación RUES en lotes automáticamente.',
        accion:  'Sin acción requerida.',
      })
    }
  }

  // ─── Regla 9: Retenciones F1001 ≤ pagos ──────────────────────────────────

  private validarRetencionesF1001(porFormato: Map<string, ResultadoTransformacion<FilaFormato>>) {
    const r1001 = porFormato.get('1001')
    if (!r1001) return

    const totalPago    = (r1001.totales.totalPagoDeducible ?? 0) + (r1001.totales.totalPagoNoDeducible ?? 0)
    const totalRete    = r1001.totales.totalRetefuente ?? 0
    const totalReteIva = r1001.totales.totalReteIva    ?? 0
    const totalReteIca = r1001.totales.totalReteIca    ?? 0

    if (totalPago <= 0) return

    if (totalRete > totalPago * 0.16) {
      this.add({
        nivel: 'alto', codigo: 'RETEFUENTE_EXCESIVA', formato: '1001',
        titulo:  `F1001 — Retefuente (${fmt(totalRete)}) supera el 15% del total pagado`,
        detalle: `Pagos: ${fmt(totalPago)} | Retefuente: ${fmt(totalRete)} | Relación: ${(totalRete / totalPago * 100).toFixed(2)}%. La tasa máxima de retefuente es 15%.`,
        accion:  'Verifique que las cuentas 2365xx no incluyen saldos iniciales ni retenciones de períodos anteriores.',
        valorRef: totalRete,
      })
    }

    if (totalReteIva > 0) {
      this.add({
        nivel: 'observacion', codigo: 'F1001_RETE_IVA', formato: '1001',
        titulo:  `F1001 — ReteIVA reportado: ${fmt(totalReteIva)}`,
        detalle: 'Confirme que corresponde a retenciones de IVA practicadas (cuenta 236701).',
        accion:  'Verifique que la cuenta 236701 está separada del IVA descontable (2408).',
        valorRef: totalReteIva,
      })
    }

    if (totalReteIca > 0) {
      this.add({
        nivel: 'observacion', codigo: 'F1001_RETE_ICA', formato: '1001',
        titulo:  `F1001 — ReteICA reportado: ${fmt(totalReteIca)}`,
        detalle: 'Verifique que corresponde a retenciones de ICA del municipio de actividad (cuenta 236801).',
        accion:  'Confirme la tarifa de ReteICA del municipio correcto según la actividad económica del tercero.',
        valorRef: totalReteIca,
      })
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private add(h: HallazgoValidacion) { this.hallazgos.push(h) }

  private construirTotalFormato(r: ResultadoTransformacion<FilaFormato>): TotalFormato {
    const nombre   = NOMBRES_FORMATO[r.formatoCodigo] ?? r.formatoCodigo
    const criticos = r.excepciones.filter(e => e.severidad === 'alta').length
    const medios   = r.excepciones.filter(e => e.severidad === 'media').length
    const estado   = criticos > 0 ? 'critico' : medios > 0 ? 'alerta' : 'ok'

    const montosPrincipales: { etiqueta: string; valor: number }[] = []
    for (const [k, v] of Object.entries(r.totales)) {
      if (k === 'totalFilas' || Math.abs(v) === 0) continue
      montosPrincipales.push({
        etiqueta: k.replace(/^total/, '').replace(/([A-Z])/g, ' $1').trim(),
        valor:    v,
      })
    }

    return {
      formatoCodigo:    r.formatoCodigo,
      nombreFormato:    nombre,
      totalFilas:       r.totales.totalFilas ?? r.filas.length,
      montosPrincipales,
      estado,
    }
  }

  private construirResumenTexto(
    criticos:       HallazgoValidacion[],
    altos:          HallazgoValidacion[],
    medios:         HallazgoValidacion[],
    recomendacion:  RecomendacionExportar,
  ): string {
    const RECO: Record<RecomendacionExportar, string> = {
      si:              '✅ RECOMENDACIÓN: Generar archivo — datos coherentes y sin errores críticos.',
      no:              '🚫 RECOMENDACIÓN: NO generar — existen errores críticos que la DIAN rechazará o glosará.',
      corregir_primero:'⚠️ RECOMENDACIÓN: Corregir primero — hay hallazgos altos que pueden afectar la exactitud del informe.',
    }

    if (!criticos.length && !altos.length && !medios.length)
      return RECO.si

    const partes: string[] = []
    if (criticos.length) partes.push(`🔴 ${criticos.length} CRÍTICO(S)`)
    if (altos.length)    partes.push(`🟠 ${altos.length} ALTO(S)`)
    if (medios.length)   partes.push(`🟡 ${medios.length} MEDIO(S)`)

    return partes.join(' · ') + ' — ' + RECO[recomendacion]
  }
}

export function auditarExogenas(
  config: ConfigExogena,
  resultados: ResultadoTransformacion<FilaFormato>[],
  empresaDetectada?: string,
  balance?: TotalesBalance,
): InformeValidacion {
  return new ValidadorExperto().validar(config, resultados, empresaDetectada, balance)
}
