/**
 * ValidadorExperto — Auditoría cruzada de exógenas antes de entrega al cliente
 *
 * Aplica las reglas del Contador Público DIAN (Res. 000227/2025 + 000233/2025):
 *  1. Validación del NIT declarante (módulo 11)
 *  2. Coherencia F1005 (IVA descontable) vs F1006 (compras netas): IVA ≤ 19%
 *  3. Coherencia F1007 (ingresos) vs F1006 (compras): margen implícito razonable
 *  4. F1006 contaminado con cuentas IVA o ingresos (2408x, 41x, 42x)
 *  5. Saldos negativos F1008 (CxC) → reclasificar a cta 28 Anticipos clientes
 *  6. Saldos negativos F1009 (CxP) → reclasificar a cta 13 Anticipos proveedores
 *  7. Validación DV de todos los terceros en todos los formatos
 *  8. Resumen de totales por formato
 */

import type { ConfigExogena, FilaFormato, ResultadoTransformacion } from '../types'
import { validarDvNit, calcularDvNit } from './rules-engine'

// ─── Tipos del Informe ────────────────────────────────────────────────────────

export type NivelValidacion = 'critico' | 'alto' | 'medio' | 'observacion'

export interface HallazgoValidacion {
  nivel:        NivelValidacion
  codigo:       string           // Código único del hallazgo (ej: 'NIT_DV_INCORRECTO')
  formato?:     string           // Formato afectado si aplica
  titulo:       string
  detalle:      string
  accion:       string           // Qué debe hacer el contador
  valorRef?:    number           // Monto involucrado si aplica
  terceroId?:   string
}

export interface TotalFormato {
  formatoCodigo:   string
  nombreFormato:   string
  totalFilas:      number
  montosPrincipales: { etiqueta: string; valor: number }[]
  estado:          'ok' | 'alerta' | 'critico'
}

export interface InformeValidacion {
  timestamp:         string
  nitDeclarante:     string
  anioGravable:      number
  criticos:          HallazgoValidacion[]
  altos:             HallazgoValidacion[]
  medios:            HallazgoValidacion[]
  observaciones:     HallazgoValidacion[]
  totalesPorFormato: TotalFormato[]
  puedeExportar:     boolean     // false si hay hallazgos CRÍTICOS sin resolver
  resumenTexto:      string      // Texto para mostrar al contador
}

// ─── Nombres legibles por formato ─────────────────────────────────────────────

const NOMBRES_FORMATO: Record<string, string> = {
  '1001': 'Pagos o abonos en cuenta y retenciones practicadas',
  '1003': 'Retenciones en la fuente practicadas al declarante',
  '1005': 'IVA Descontable (compras)',
  '1006': 'Información de compras',
  '1007': 'Ingresos recibidos',
  '1008': 'Saldos Cuentas por Cobrar (31-dic)',
  '1009': 'Saldos Cuentas por Pagar (31-dic)',
  '1010': 'Información de terceros',
  '1012': 'Saldos cuentas bancarias e inversiones',
  '2276': 'Pagos laborales',
}

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmt = (n: number) => COP.format(Math.abs(n))

// ─── Clase principal ──────────────────────────────────────────────────────────

export class ValidadorExperto {
  private hallazgos: HallazgoValidacion[] = []

  validar(
    config: ConfigExogena,
    resultados: ResultadoTransformacion<FilaFormato>[],
    empresaDetectada?: string,
  ): InformeValidacion {
    this.hallazgos = []

    // Mapa rápido por formato
    const porFormato = new Map(resultados.map(r => [r.formatoCodigo, r]))

    // ── 1. NIT Declarante ───────────────────────────────────────────────────
    this.validarNitDeclarante(config, empresaDetectada)

    // ── 2. Coherencia F1005 vs F1006 ───────────────────────────────────────
    this.validarCoherenciaIvaCompras(porFormato)

    // ── 3. Coherencia F1006 vs F1007 ───────────────────────────────────────
    this.validarCoherenciaComprasIngresos(porFormato)

    // ── 4. Contaminación F1006 con cuentas IVA ─────────────────────────────
    this.validarContaminacionF1006(porFormato)

    // ── 5 y 6. Saldos negativos F1008 / F1009 ─────────────────────────────
    this.validarSaldosNegativos(porFormato)

    // ── 7. DV de terceros en todos los formatos ────────────────────────────
    this.validarDvTerceros(resultados)

    // ── 8. Consistencia interna F1001: retenciones ≤ pagos ─────────────────
    this.validarRetencionesF1001(porFormato)

    // ── Clasificar hallazgos ───────────────────────────────────────────────
    const criticos     = this.hallazgos.filter(h => h.nivel === 'critico')
    const altos        = this.hallazgos.filter(h => h.nivel === 'alto')
    const medios       = this.hallazgos.filter(h => h.nivel === 'medio')
    const observaciones = this.hallazgos.filter(h => h.nivel === 'observacion')

    const puedeExportar = criticos.length === 0

    const totalesPorFormato = resultados.map(r => this.construirTotalFormato(r))

    const resumenTexto = this.construirResumenTexto(criticos, altos, medios, puedeExportar)

    return {
      timestamp:         new Date().toISOString(),
      nitDeclarante:     config.nitDeclarante,
      anioGravable:      config.anioGravable,
      criticos,
      altos,
      medios,
      observaciones,
      totalesPorFormato,
      puedeExportar,
      resumenTexto,
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
        accion: 'Configure el NIT del declarante en la sección "Datos del declarante" antes de generar.',
      })
      return
    }

    if (nit.length < 6 || nit.length > 10) {
      this.add({
        nivel: 'critico', codigo: 'NIT_DECLARANTE_LONGITUD',
        titulo: `NIT del declarante con longitud inválida (${nit.length} dígitos)`,
        detalle: `NIT ingresado: ${nit}. Los NITs colombianos tienen entre 6 y 10 dígitos (sin DV).`,
        accion: 'Verifique el NIT en el RUT de la empresa declarante.',
        terceroId: nit,
      })
      return
    }

    if (config.dvDeclarante) {
      const dvOk = validarDvNit(nit, config.dvDeclarante)
      if (!dvOk) {
        const dvCorrecto = calcularDvNit(nit)
        this.add({
          nivel: 'critico', codigo: 'NIT_DECLARANTE_DV_INCORRECTO',
          titulo: `DV del declarante incorrecto — NIT ${nit}-${config.dvDeclarante}`,
          detalle: `El dígito de verificación informado es ${config.dvDeclarante} pero según módulo 11 debe ser ${dvCorrecto}.`,
          accion: `Corrija el DV del declarante a ${dvCorrecto} en la configuración.`,
          terceroId: nit,
        })
      }
    }

    // Comparar con empresa detectada del CSV si tiene NIT embebido
    if (empresaDetectada) {
      const nitEnEmpresa = empresaDetectada.replace(/\D/g, '').slice(-10)
      if (nitEnEmpresa.length >= 6 && !nitEnEmpresa.includes(nit) && !nit.includes(nitEnEmpresa)) {
        this.add({
          nivel: 'alto', codigo: 'NIT_DECLARANTE_NO_COINCIDE_CSV',
          titulo: 'NIT declarante puede no coincidir con la empresa del archivo',
          detalle: `El archivo CSV menciona "${empresaDetectada}" y el NIT declarante configurado es ${nit}. Verifique que está procesando la contabilidad correcta.`,
          accion: 'Confirme que el archivo Siigo corresponde exactamente al NIT declarante. Si son empresas distintas, detenga el proceso.',
          terceroId: nit,
        })
      }
    }
  }

  // ─── Regla 2: Coherencia IVA descontable (F1005) vs compras netas (F1006) ─

  private validarCoherenciaIvaCompras(porFormato: Map<string, ResultadoTransformacion<FilaFormato>>) {
    const r1005 = porFormato.get('1005')
    const r1006 = porFormato.get('1006')
    if (!r1005 || !r1006) return

    const totalIva     = r1005.totales.totalIvaDescontable ?? 0
    const totalCompras = r1006.totales.totalNetaCompras ?? r1006.totales.totalCompras ?? 0

    if (totalCompras <= 0) return

    // IVA descontable no puede exceder 19% de las compras netas
    const ivaMaxEsperado = totalCompras * 0.19
    const ivaMinimo      = totalCompras * 0.01  // Si hay compras, debe haber algo de IVA

    if (totalIva > ivaMaxEsperado * 1.05) {
      const exceso = totalIva - ivaMaxEsperado
      this.add({
        nivel: 'critico', codigo: 'IVA_EXCEDE_COMPRAS',
        titulo: 'IVA descontable (F1005) supera el 19% de las compras netas (F1006)',
        detalle: `F1005 IVA descontable: ${fmt(totalIva)} | F1006 Compras netas: ${fmt(totalCompras)} | IVA esperado máx. (19%): ${fmt(ivaMaxEsperado)} | Exceso: ${fmt(exceso)}. Esto indica que cuentas de IVA de ventas (grupo 24) o cuentas incorrectas están siendo incluidas en F1005.`,
        accion: 'Revise el mapeo PUC: solo las subcuentas de 2408 (IVA descontable en compras) deben ir a F1005. Excluya cuentas 2408 de ventas, provisiones o ajustes.',
        valorRef: exceso,
      })
    } else if (totalIva < ivaMinimo && totalCompras > 5_000_000) {
      this.add({
        nivel: 'medio', codigo: 'IVA_MUY_BAJO_VS_COMPRAS',
        titulo: 'IVA descontable (F1005) es muy bajo respecto a las compras (F1006)',
        detalle: `F1005 IVA: ${fmt(totalIva)} | F1006 Compras: ${fmt(totalCompras)} | Relación: ${((totalIva / totalCompras) * 100).toFixed(2)}%. Si todas las compras son gravadas al 19%, el IVA esperado sería ${fmt(ivaMaxEsperado)}.`,
        accion: 'Verifique que todas las facturas de compra con IVA tienen la cuenta 2408 correctamente registrada en Siigo y que el mapeo PUC incluye las subcuentas de 2408 en F1005.',
        valorRef: totalIva,
      })
    }
  }

  // ─── Regla 3: Coherencia F1006 (compras) vs F1007 (ingresos) ────────────

  private validarCoherenciaComprasIngresos(porFormato: Map<string, ResultadoTransformacion<FilaFormato>>) {
    const r1006 = porFormato.get('1006')
    const r1007 = porFormato.get('1007')
    if (!r1006 || !r1007) return

    const totalCompras  = r1006.totales.totalNetaCompras ?? r1006.totales.totalCompras ?? 0
    const totalIngresos = r1007.totales.totalNetaIngresos ?? r1007.totales.totalIngresos ?? 0

    if (totalIngresos <= 0 || totalCompras <= 0) return

    const margen = ((totalIngresos - totalCompras) / totalIngresos) * 100

    // Margen bruto negativo: las compras superan los ingresos → posible error de mapeo
    if (margen < -5) {
      this.add({
        nivel: 'critico', codigo: 'COMPRAS_SUPERAN_INGRESOS',
        titulo: 'Compras F1006 superan significativamente los Ingresos F1007',
        detalle: `F1007 Ingresos netos: ${fmt(totalIngresos)} | F1006 Compras netas: ${fmt(totalCompras)} | Relación compras/ingresos: ${(totalCompras / totalIngresos * 100).toFixed(1)}%. Un margen bruto negativo implica que cuentas que NO son compras de mercancía (costos de nómina, gastos, IVA) están siendo incluidas en F1006.`,
        accion: 'Revise el mapeo PUC de F1006. Solo deben incluirse cuentas 14xx (inventarios), 620x (costo de ventas) y excepcionalmente algunos servicios. Excluya nómina (51xx), gastos operativos (52xx), IVA (24xx) y retenciones (23xx).',
        valorRef: totalCompras - totalIngresos,
      })
    } else if (margen < 5 && totalIngresos > 50_000_000) {
      this.add({
        nivel: 'alto', codigo: 'MARGEN_BRUTO_MUY_BAJO',
        titulo: `Margen bruto implícito muy bajo: ${margen.toFixed(1)}%`,
        detalle: `F1007 Ingresos: ${fmt(totalIngresos)} | F1006 Compras: ${fmt(totalCompras)}. Un margen del ${margen.toFixed(1)}% es inusualmente bajo. Puede indicar que gastos generales están siendo clasificados como compras de bienes/servicios en F1006.`,
        accion: 'Valide con el contador que este margen corresponde a la actividad real de la empresa. Si no es correcto, revise el mapeo de cuentas 5xx en F1006.',
        valorRef: totalIngresos - totalCompras,
      })
    }
  }

  // ─── Regla 4: F1006 contaminado con cuentas de IVA o ingresos ────────────

  private validarContaminacionF1006(porFormato: Map<string, ResultadoTransformacion<FilaFormato>>) {
    const r1006 = porFormato.get('1006')
    if (!r1006) return

    const filasContaminadas = r1006.filas.filter(f => {
      const cuentas = (f._cuentasOrigen ?? []) as string[]
      return cuentas.some(c =>
        c.startsWith('2408') ||   // IVA descontable — NO debe estar en compras
        c.startsWith('41')   ||   // Ingresos operacionales
        c.startsWith('42')   ||   // Ingresos no operacionales
        c.startsWith('2405') ||   // IVA por pagar
      false)
    })

    if (filasContaminadas.length > 0) {
      const nits = [...new Set(filasContaminadas.map(f => f.numeroId as string).filter(Boolean))].slice(0, 5)
      this.add({
        nivel: 'critico', codigo: 'F1006_CONTAMINADO',
        titulo: `F1006 contiene cuentas incorrectas (IVA o ingresos) — ${filasContaminadas.length} fila(s) afectadas`,
        detalle: `Se detectaron filas en F1006 originadas en cuentas 2408x (IVA), 41x o 42x (ingresos). Esto distorsiona el total de compras. NITs afectados: ${nits.join(', ')}.`,
        accion: 'Corrija el mapeo PUC: las cuentas 2408 deben ir a F1005, las cuentas 41-42 a F1007. Ninguna cuenta de ingresos o de IVA debe aparecer en F1006.',
      })
    }
  }

  // ─── Reglas 5 y 6: Saldos negativos F1008/F1009 ──────────────────────────

  private validarSaldosNegativos(porFormato: Map<string, ResultadoTransformacion<FilaFormato>>) {
    // F1008 — CxC negativo → reclasificar a Anticipos clientes (cuenta 28)
    const r1008 = porFormato.get('1008')
    if (r1008) {
      const negativos = r1008.filas.filter(f => (f.valorSaldo as number) < 0)
      if (negativos.length > 0) {
        const totalNeg = negativos.reduce((s, f) => s + (f.valorSaldo as number), 0)
        const ejemplos = negativos.slice(0, 3).map(f =>
          `${(f.razonSocial || f.numeroId) as string}: ${fmt(f.valorSaldo as number)}`
        ).join(' | ')
        this.add({
          nivel: 'alto', codigo: 'CXC_SALDO_NEGATIVO',
          formato: '1008',
          titulo: `F1008 — ${negativos.length} tercero(s) con saldo CxC negativo (${fmt(totalNeg)})`,
          detalle: `Un saldo negativo en Cuentas por Cobrar significa que el cliente tiene un crédito a favor (pagó de más o hay una nota crédito sin aplicar). Ejemplos: ${ejemplos}.`,
          accion: 'En Siigo, reclasifique estos saldos a la cuenta 2808 (Anticipos de clientes). Use un comprobante de egreso o nota de ajuste para mover el saldo. Esto garantiza que F1008 solo tenga saldos positivos (deudas a favor del declarante).',
          valorRef: Math.abs(totalNeg),
        })
      }

      const totalCxC = r1008.totales.totalSaldoCxC ?? 0
      if (totalCxC > 0) {
        this.add({
          nivel: 'observacion', codigo: 'F1008_TOTAL',
          formato: '1008',
          titulo: `F1008 — Total CxC al 31-dic: ${fmt(totalCxC)}`,
          detalle: `Verifique que este saldo coincide con el balance de prueba en la cuenta 13 (excepto las cuentas 1355 que van a F1003).`,
          accion: 'Cruce el total de F1008 con el saldo en el balance de la clase 13, excluyendo 1355xx.',
          valorRef: totalCxC,
        })
      }
    }

    // F1009 — CxP negativo → reclasificar a Anticipos proveedores (cuenta 13)
    const r1009 = porFormato.get('1009')
    if (r1009) {
      const negativos = r1009.filas.filter(f => (f.valorSaldo as number) < 0)
      if (negativos.length > 0) {
        const totalNeg = negativos.reduce((s, f) => s + (f.valorSaldo as number), 0)
        const ejemplos = negativos.slice(0, 3).map(f =>
          `${(f.razonSocial || f.numeroId) as string}: ${fmt(f.valorSaldo as number)}`
        ).join(' | ')
        this.add({
          nivel: 'alto', codigo: 'CXP_SALDO_NEGATIVO',
          formato: '1009',
          titulo: `F1009 — ${negativos.length} tercero(s) con saldo CxP negativo (${fmt(totalNeg)})`,
          detalle: `Un saldo negativo en Cuentas por Pagar indica que se pagó de más a un proveedor, hay una nota débito pendiente de aplicar, o falta contabilizar una factura de compra. Ejemplos: ${ejemplos}.`,
          accion: 'Reclasifique en Siigo a la cuenta 1330 o 1355 (Anticipos a proveedores). Si corresponde a un error contable, aplique la nota débito o la factura pendiente antes de presentar la información exógena.',
          valorRef: Math.abs(totalNeg),
        })
      }

      const totalCxP = r1009.totales.totalSaldoCxP ?? 0
      if (totalCxP > 0) {
        this.add({
          nivel: 'observacion', codigo: 'F1009_TOTAL',
          formato: '1009',
          titulo: `F1009 — Total CxP al 31-dic: ${fmt(totalCxP)}`,
          detalle: `Verifique que este saldo coincide con el balance de prueba en las cuentas 22 (proveedores) y 23 (retenciones).`,
          accion: 'Cruce el total de F1009 con el saldo en el balance de las cuentas 22xx y 23xx.',
          valorRef: totalCxP,
        })
      }
    }
  }

  // ─── Regla 7: Validación DV de todos los terceros ────────────────────────

  private validarDvTerceros(resultados: ResultadoTransformacion<FilaFormato>[]) {
    // Acumular NITs únicos con DV para no repetir el mismo error
    const auditados = new Map<string, { dvInformado: string; dvCorrecto: string; formatos: string[] }>()

    for (const r of resultados) {
      for (const fila of r.filas) {
        const nit = (fila.numeroId as string | undefined) ?? ''
        const dv  = (fila.dv  as string | undefined) ?? ''
        if (!nit || nit === '222222222' || nit.length < 6) continue
        if (!dv) continue   // DV vacío → otro tipo de error, no este

        if (auditados.has(nit)) {
          auditados.get(nit)!.formatos.push(r.formatoCodigo)
          continue
        }

        const dvOk = validarDvNit(nit, dv)
        if (!dvOk) {
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
        ? 'alto'
        : 'medio'

      this.add({
        nivel,
        codigo:    'DV_INCORRECTO',
        formato:   info.formatos.join('/'),
        titulo:    `DV incorrecto — NIT ${nit}-${info.dvInformado} (correcto: ${info.dvCorrecto})`,
        detalle:   `El NIT ${nit} aparece en los formatos ${info.formatos.join(', ')} con DV=${info.dvInformado}. El módulo 11 indica que el DV correcto es ${info.dvCorrecto}. La DIAN rechazará las filas con DV incorrecto.`,
        accion:    `Corrija el DV del tercero ${nit} en el maestro de terceros de Siigo: Contabilidad → Terceros → buscar NIT ${nit} → cambiar DV a ${info.dvCorrecto}.`,
        terceroId: nit,
      })
    }

    if (auditados.size === 0 && resultados.some(r => r.filas.length > 0)) {
      this.add({
        nivel: 'observacion', codigo: 'DV_TODOS_OK',
        titulo: 'DV verificado — todos los NITs con dígito de verificación son válidos',
        detalle: 'Módulo 11 aplicado a todos los terceros con DV informado. No se encontraron errores.',
        accion:  'Sin acción requerida.',
      })
    }
  }

  // ─── Regla 8: Retenciones F1001 no deben exceder los pagos ───────────────

  private validarRetencionesF1001(porFormato: Map<string, ResultadoTransformacion<FilaFormato>>) {
    const r1001 = porFormato.get('1001')
    if (!r1001) return

    const totalPago      = (r1001.totales.totalPagoDeducible ?? 0) + (r1001.totales.totalPagoNoDeducible ?? 0)
    const totalRete      = r1001.totales.totalRetefuente ?? 0
    const totalReteIva   = r1001.totales.totalReteIva    ?? 0
    const totalReteIca   = r1001.totales.totalReteIca    ?? 0

    if (totalPago <= 0) return

    // Retefuente no puede superar el 15% del pago total (la tarifa máxima es 15%)
    if (totalRete > totalPago * 0.16) {
      this.add({
        nivel: 'alto', codigo: 'RETEFUENTE_EXCESIVA',
        formato: '1001',
        titulo:  `F1001 — Retefuente (${fmt(totalRete)}) supera el 15% del total pagado (${fmt(totalPago)})`,
        detalle: `La tasa máxima de retefuente es 15%. Relación actual: ${(totalRete / totalPago * 100).toFixed(2)}%. Esto puede indicar que la retención está siendo duplicada o que se están sumando retenciones de períodos anteriores.`,
        accion:  'Verifique en Siigo que las cuentas de retención (2365xx) están correctamente mapeadas y que no se están tomando saldos iniciales. Sólo los movimientos del año gravable deben incluirse.',
        valorRef: totalRete,
      })
    }

    if (totalReteIva > 0) {
      this.add({
        nivel: 'observacion', codigo: 'F1001_RETE_IVA_PRESENTE',
        formato: '1001',
        titulo:  `F1001 — ReteIVA reportado: ${fmt(totalReteIva)}`,
        detalle: 'Se detectó ReteIVA en los pagos. Confirme que corresponde exclusivamente a retenciones de IVA practicadas (cuenta 236701), no a IVA asumido.',
        accion:  'Verifique que la cuenta 236701 esté correctamente separada del IVA descontable (2408).',
        valorRef: totalReteIva,
      })
    }

    if (totalReteIca > 0) {
      this.add({
        nivel: 'observacion', codigo: 'F1001_RETE_ICA_PRESENTE',
        formato: '1001',
        titulo:  `F1001 — ReteICA reportado: ${fmt(totalReteIca)}`,
        detalle: 'Se detectó retención de ICA. Verifique que corresponde a retenciones de ICA practicadas sobre pagos de la vigencia (cuenta 236801).',
        accion:  'Confirme que las tarjetas de ReteICA corresponden al municipio correcto según la actividad económica del tercero.',
        valorRef: totalReteIca,
      })
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private add(h: HallazgoValidacion) {
    this.hallazgos.push(h)
  }

  private construirTotalFormato(r: ResultadoTransformacion<FilaFormato>): TotalFormato {
    const nombre = NOMBRES_FORMATO[r.formatoCodigo] ?? r.formatoCodigo
    const criticos = r.excepciones.filter(e => e.severidad === 'alta').length
    const medios   = r.excepciones.filter(e => e.severidad === 'media').length
    const estado   = criticos > 0 ? 'critico' : medios > 0 ? 'alerta' : 'ok'

    const montosPrincipales: { etiqueta: string; valor: number }[] = []
    for (const [k, v] of Object.entries(r.totales)) {
      if (k === 'totalFilas') continue
      if (Math.abs(v) > 0) {
        const etiqueta = k
          .replace(/^total/, '')
          .replace(/([A-Z])/g, ' $1')
          .trim()
        montosPrincipales.push({ etiqueta, valor: v })
      }
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
    criticos: HallazgoValidacion[],
    altos: HallazgoValidacion[],
    medios: HallazgoValidacion[],
    puedeExportar: boolean,
  ): string {
    if (criticos.length === 0 && altos.length === 0 && medios.length === 0) {
      return '✅ Archivo validado sin hallazgos. Puede proceder a la exportación.'
    }

    const partes: string[] = []
    if (criticos.length > 0) partes.push(`🔴 ${criticos.length} error(es) CRÍTICO(S) que deben resolverse antes de exportar`)
    if (altos.length > 0)    partes.push(`🟠 ${altos.length} hallazgo(s) ALTO(S) recomendados corregir`)
    if (medios.length > 0)   partes.push(`🟡 ${medios.length} alerta(s) MEDIA(S)`)

    const bloqueo = puedeExportar
      ? 'El archivo PUEDE exportarse pero se recomienda revisar los hallazgos altos primero.'
      : 'El archivo NO puede exportarse hasta resolver los errores críticos.'

    return partes.join(' | ') + '. ' + bloqueo
  }
}

// ─── Función helper para usar directamente ───────────────────────────────────

export function auditarExogenas(
  config: ConfigExogena,
  resultados: ResultadoTransformacion<FilaFormato>[],
  empresaDetectada?: string,
): InformeValidacion {
  return new ValidadorExperto().validar(config, resultados, empresaDetectada)
}
