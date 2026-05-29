/**
 * Formato 1009 v8 — Saldos de cuentas por pagar a 31 de diciembre
 * Res. DIAN 000227/2025 — Año gravable 2025
 *
 * Reporta el SALDO al cierre del período fiscal (31-dic) de las cuentas del
 * pasivo corriente (clases 22, 23, 25 PUC). No informa movimientos del año.
 *
 * PUC fuente:
 *   22050501 — Proveedores nacionales
 *   22060501 — Proveedores del exterior
 *   23650501 — Salarios y prestaciones por pagar
 *   23651501 — Honorarios por pagar
 *   23652501 — Servicios por pagar
 *   23654001 — Retenciones por pagar (agente retenedor)
 *   23680501+ — ReteICA por pagar
 *   23700501 — Aportes a entidades promotoras de salud (EPS)
 *   23700601 — Aportes administradoras de pensiones (AFP)
 *   23701001 — Aportes al ICBF / SENA / CCF
 *   23701501 — Aportes ARL
 *   23803001 — Fondos de cesantías
 *   25050501 — Salarios por pagar (nómina)
 *   2510100101 — Cesantías consolidadas
 *   2510100202 — Intereses sobre cesantías
 *   2510100302 — Vacaciones consolidadas
 *   2510100402 — Prima de servicios
 *
 * Concilia con: Balance general Formulario 110/210 (pasivos corrientes y laborales).
 */

import type {
  IFormatoExogena, FilaFormato, ColumnaDefinicion,
  AsientoContable, ExcepcionGenerada,
} from '../types'
import { RulesEngine } from '../engine/rules-engine'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'
import { buscarMunicipio, DEPARTAMENTOS } from '../config/divipola'

// ── Conceptos DIAN para F1009 ─────────────────────────────────────────────────
export const CONCEPTOS_1009: Record<string, string> = {
  '2201': 'Proveedores nacionales',
  '2202': 'Proveedores del exterior',
  '2203': 'Socios, accionistas y comuneros',
  '2204': 'Costos y gastos por pagar',
  '2205': 'Retenciones y aportes de nómina por pagar',
  '2206': 'Dividendos y participaciones por pagar',
  '2207': 'Retenciones laborales por pagar',
  '2208': 'Acreedores varios',
  '2209': 'Deudas con entidades gubernamentales',
  '2210': 'Impuesto a la renta y complementarios por pagar',
  '2211': 'Impuesto industria y comercio por pagar',
  '2212': 'IVA por pagar',
  '2214': 'Prestaciones sociales y aportes parafiscales',
  '2215': 'Salarios por pagar',
  '2299': 'Otros pasivos corrientes',
}

export interface Fila1009 extends FilaFormato {
  tipoDocumento: string
  numeroId: string
  dv: string
  paisCodigo: string
  deptoCodigo: string
  municipioCodigo: string
  primerApellido: string
  segundoApellido: string
  primerNombre: string
  otrosNombres: string
  razonSocial: string
  conceptoCodigo: string
  descripcionConcepto: string
  valorSaldo: number      // Saldo neto al 31-dic (crédito = positivo para pasivos)
}

export const COLUMNAS_1009: ColumnaDefinicion[] = [
  { campo: 'tipoDocumento',   header: 'Tipo de documento',              ancho: 6,  tipo: 'texto',  obligatorio: true  },
  { campo: 'numeroId',        header: 'Número de identificación',       ancho: 22, tipo: 'texto',  obligatorio: true  },
  { campo: 'dv',              header: 'DV',                             ancho: 4,  tipo: 'texto',  obligatorio: false },
  { campo: 'paisCodigo',      header: 'País',                           ancho: 6,  tipo: 'texto',  obligatorio: true  },
  { campo: 'deptoCodigo',     header: 'Departamento',                   ancho: 6,  tipo: 'texto',  obligatorio: false },
  { campo: 'municipioCodigo', header: 'Municipio',                      ancho: 8,  tipo: 'texto',  obligatorio: false },
  { campo: 'primerApellido',  header: 'Primer apellido',                ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'segundoApellido', header: 'Segundo apellido',               ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'primerNombre',    header: 'Primer nombre',                  ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'otrosNombres',    header: 'Otros nombres',                  ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'razonSocial',     header: 'Razón social',                   ancho: 60, tipo: 'texto',  obligatorio: false },
  { campo: 'conceptoCodigo',  header: 'Código del concepto',            ancho: 8,  tipo: 'texto',  obligatorio: true  },
  { campo: 'valorSaldo',      header: 'Saldo a 31 de diciembre',        ancho: 18, tipo: 'moneda', obligatorio: true  },
]

export class Formato1009Strategy implements IFormatoExogena<Fila1009> {
  readonly codigo = '1009'
  readonly version = 'v8'
  readonly nombreOficial = 'Saldos de cuentas por pagar a 31 de diciembre'
  readonly columnas = COLUMNAS_1009

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila1009[] {
    const acum = new Map<string, Fila1009>()

    for (const a of asientos) {
      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '1009') continue
      if (!a.tercero?.numeroId) continue

      const clave = `${a.tercero.numeroId}|${regla.conceptoCodigo}`
      const fila: Fila1009 = acum.get(clave) ?? this.filaVacia(a, regla.conceptoCodigo)

      // Pasivos PUC clases 22-25: crédito aumenta (lo que debemos), débito disminuye
      fila.valorSaldo += a.naturaleza === 'credito' ? a.monto : -a.monto

      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      if (a.cuentaPuc)   fila._cuentasOrigen?.push(a.cuentaPuc)
      fila._reglaId = regla.id
      acum.set(clave, fila)
    }

    // Reportar todos los terceros con saldo distinto de cero
    return Array.from(acum.values()).filter(f => Math.round(f.valorSaldo) !== 0)
  }

  validar(filas: Fila1009[]): ExcepcionGenerada[] {
    const excepciones: ExcepcionGenerada[] = []
    for (const f of filas) {
      if (!f.numeroId || f.numeroId.trim() === '') {
        excepciones.push({
          fila: f, tipo: 'acreedor_sin_identificar', severidad: 'alta',
          descripcion: `Acreedor sin NIT — saldo CxP $${fmt(f.valorSaldo)}`,
          valorInvolucrado: f.valorSaldo,
          sugerencia: '¡Atención! Vaya al módulo de Terceros en Siigo y asigne el NIT correcto a este proveedor o acreedor.',
        })
      }
      if (f.valorSaldo < 0) {
        excepciones.push({
          fila: f, tipo: 'saldo_cxp_negativo', severidad: 'baja',
          descripcion: `Saldo CxP negativo $${fmt(f.valorSaldo)} para ${f.razonSocial || f.numeroId} — concepto ${f.conceptoCodigo}`,
          valorInvolucrado: f.valorSaldo,
          sugerencia: '¡Revisión contable urgente! Un saldo negativo en Cuentas por Pagar significa que se le pagó de más a un proveedor o falta contabilizar una factura. Reclasifique a la cuenta 13 (Anticipos a proveedores) en Siigo.',
        })
      }
    }
    return excepciones
  }

  totalizar(filas: Fila1009[]) {
    return {
      totalFilas:    filas.length,
      totalSaldoCxP: filas.reduce((s, f) => s + f.valorSaldo, 0),
    }
  }

  private filaVacia(a: AsientoContable, concepto: string): Fila1009 {
    const t = a.tercero
    const nombreRaw = t.razonSocial
      ?? [t.primerApellido, t.segundoApellido, t.primerNombre, t.otrosNombres].filter(Boolean).join(' ')
    const esPJ = esPersonaJuridica(nombreRaw)
    const nombres = !esPJ ? parsearNombreColombia(nombreRaw) : null
    const depto = t.deptoCodigo ?? (t.municipioCodigo ? t.municipioCodigo.slice(0, 2) : '')
    const muni  = t.municipioCodigo ?? (t.deptoCodigo ? (buscarMunicipio(DEPARTAMENTOS[t.deptoCodigo] ?? '') ?? '') : '')
    return {
      tipoDocumento:       t.tipoDocumento ?? (esPJ ? '3' : '1'),
      numeroId:            t.numeroId ?? '',
      dv:                  t.dv ?? '',
      paisCodigo:          (t.paisCodigo ?? 'CO').toUpperCase(),
      deptoCodigo:         depto,
      municipioCodigo:     muni,
      primerApellido:      nombres?.primerApellido  ?? '',
      segundoApellido:     nombres?.segundoApellido ?? '',
      primerNombre:        nombres?.primerNombre    ?? '',
      otrosNombres:        nombres?.otrosNombres    ?? '',
      razonSocial:         esPJ ? (t.razonSocial ?? nombreRaw) : '',
      conceptoCodigo:      concepto,
      descripcionConcepto: CONCEPTOS_1009[concepto] ?? 'Cuenta por pagar',
      valorSaldo:          0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}
