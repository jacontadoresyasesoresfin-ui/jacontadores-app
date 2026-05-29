/**
 * Formato 2276 — Información de pagos laborales (Nómina)
 * Resolución DIAN 000227/2025 — Año gravable 2025
 *
 * Informa los pagos realizados a trabajadores vinculados mediante
 * contrato laboral (asalariados). NO incluye honorarios a independientes
 * (esos van en Formato 1001 concepto 5001/5017).
 *
 * Cuentas PUC fuente:
 *   511005 Sueldos y jornales
 *   511010 Prima de servicios
 *   511015 Cesantías
 *   511020 Intereses sobre cesantías
 *   511025 Vacaciones
 *   511030 Horas extras y recargos
 *   511035 Incapacidades reconocidas por la empresa
 *   511040 Bonificaciones
 *   511095 Otros pagos laborales
 *   511%   Gastos de personal (fallback)
 */

import type {
  IFormatoExogena, FilaFormato, ColumnaDefinicion,
  AsientoContable, ExcepcionGenerada,
} from '../types'
import { RulesEngine } from '../engine/rules-engine'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'
import { buscarMunicipio, DEPARTAMENTOS } from '../config/divipola'

// ── Conceptos de nómina ───────────────────────────────────────────────────────
export const CONCEPTOS_2276: Record<string, string> = {
  '6001': 'Sueldos y jornales',
  '6002': 'Prima de servicios',
  '6003': 'Cesantías e intereses sobre cesantías',
  '6004': 'Vacaciones',
  '6005': 'Horas extras y recargos nocturnos',
  '6006': 'Bonificaciones y auxilios no salariales',
  '6007': 'Auxilio de transporte',
  '6008': 'Incapacidades (empresa)',
  '6009': 'Aportes seguridad social (parte empleador)',
  '6010': 'Aportes parafiscales (SENA, ICBF, Caja)',
  '6099': 'Otros pagos laborales',
}

// Mapeo cuenta PUC → concepto 2276
const CUENTA_A_CONCEPTO: [RegExp, string][] = [
  [/^511005/, '6001'],  // sueldos
  [/^511010/, '6002'],  // prima
  [/^511015|^511020/, '6003'],  // cesantías e intereses
  [/^511025/, '6004'],  // vacaciones
  [/^511030/, '6005'],  // horas extras
  [/^511040/, '6006'],  // bonificaciones
  [/^5105/,   '6009'],  // aportes seguridad social empleador
  [/^5110/,   '6099'],  // otros gastos de personal (fallback genérico)
]

function conceptoDesdeCuenta(cuentaPuc: string): string {
  for (const [re, concepto] of CUENTA_A_CONCEPTO) {
    if (re.test(cuentaPuc)) return concepto
  }
  return '6099'
}

export interface Fila2276 extends FilaFormato {
  conceptoCodigo: string
  descripcionConcepto: string
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
  totalPagado: number       // total bruto pagado al trabajador
  aportesSalud: number      // descuentos salud (empleado + empleador)
  aportesPension: number    // descuentos pensión + solidaridad
  otrasDeducciones: number  // libranzas, fondos, etc.
  retefuente: number        // retención en la fuente practicada
  netoPagado: number        // totalPagado - deducciones - retefuente
}

export const COLUMNAS_2276: ColumnaDefinicion[] = [
  { campo: 'conceptoCodigo',      header: 'Concepto',                             ancho: 8,  tipo: 'texto',  obligatorio: true  },
  { campo: 'tipoDocumento',       header: 'Tipo de documento',                    ancho: 6,  tipo: 'texto',  obligatorio: true  },
  { campo: 'numeroId',            header: 'Número de identificación',             ancho: 22, tipo: 'texto',  obligatorio: true  },
  { campo: 'dv',                  header: 'DV',                                   ancho: 4,  tipo: 'texto',  obligatorio: false },
  { campo: 'primerApellido',      header: 'Primer apellido',                      ancho: 22, tipo: 'texto',  obligatorio: false },
  { campo: 'segundoApellido',     header: 'Segundo apellido',                     ancho: 22, tipo: 'texto',  obligatorio: false },
  { campo: 'primerNombre',        header: 'Primer nombre',                        ancho: 22, tipo: 'texto',  obligatorio: false },
  { campo: 'otrosNombres',        header: 'Otros nombres',                        ancho: 22, tipo: 'texto',  obligatorio: false },
  { campo: 'paisCodigo',          header: 'País de residencia',                   ancho: 6,  tipo: 'texto',  obligatorio: true  },
  { campo: 'deptoCodigo',         header: 'Código departamento',                  ancho: 6,  tipo: 'texto',  obligatorio: false },
  { campo: 'municipioCodigo',     header: 'Código municipio',                     ancho: 8,  tipo: 'texto',  obligatorio: false },
  { campo: 'totalPagado',         header: 'Total pagado (devengado bruto)',        ancho: 22, tipo: 'moneda', obligatorio: true  },
  { campo: 'aportesSalud',        header: 'Aportes a salud',                      ancho: 22, tipo: 'moneda', obligatorio: true  },
  { campo: 'aportesPension',      header: 'Aportes a pensión',                    ancho: 22, tipo: 'moneda', obligatorio: true  },
  { campo: 'otrasDeducciones',    header: 'Otras deducciones',                    ancho: 22, tipo: 'moneda', obligatorio: true  },
  { campo: 'retefuente',          header: 'Retención en la fuente',               ancho: 22, tipo: 'moneda', obligatorio: true  },
  { campo: 'netoPagado',          header: 'Neto pagado al trabajador',            ancho: 22, tipo: 'moneda', obligatorio: true  },
]

export class Formato2276Strategy implements IFormatoExogena<Fila2276> {
  readonly codigo = '2276'
  readonly version = 'v1'
  readonly nombreOficial = 'Información de pagos laborales (Nómina)'
  readonly columnas = COLUMNAS_2276

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila2276[] {
    const acum = new Map<string, Fila2276>()

    for (const a of asientos) {
      if (a.esSaldoInicial) continue
      // Solo procesar cuentas de nómina (511x) dirigidas a formato 2276
      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '2276') continue
      if (!a.tercero?.numeroId) continue

      const concepto = conceptoDesdeCuenta(a.cuentaPuc)
      const clave = `${a.tercero.numeroId}|${concepto}`

      const fila = acum.get(clave) ?? this.filaVacia(a, concepto)
      fila.totalPagado       += a.monto
      fila.retefuente        += a.retefuente ?? 0
      fila.aportesSalud      += 0   // se extrae de cuentas 2365/2370 si existen
      fila.aportesPension    += 0   // se extrae de cuentas 2360 si existen
      fila.otrasDeducciones  += 0
      fila.netoPagado = fila.totalPagado - fila.aportesSalud - fila.aportesPension - fila.otrasDeducciones - fila.retefuente

      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      if (a.cuentaPuc)   fila._cuentasOrigen?.push(a.cuentaPuc)
      fila._reglaId = regla.id

      acum.set(clave, fila)
    }

    return Array.from(acum.values()).filter(f => Math.round(f.totalPagado) !== 0)
  }

  validar(filas: Fila2276[]): ExcepcionGenerada[] {
    const excepciones: ExcepcionGenerada[] = []

    for (const f of filas) {
      if (!f.numeroId || f.numeroId.trim() === '') {
        excepciones.push({
          fila: f, tipo: 'trabajador_sin_identificar', severidad: 'alta',
          descripcion: `Trabajador sin número de identificación en nómina. Valor: ${fmtCOP(f.totalPagado)}`,
          sugerencia: 'Registre el documento de identidad del trabajador en la contabilidad.',
        })
      }
      if (!f.primerApellido && !f.primerNombre) {
        excepciones.push({
          fila: f, tipo: 'trabajador_sin_nombre', severidad: 'media',
          descripcion: `Trabajador ${f.numeroId} sin nombre registrado`,
          sugerencia: 'Complete el nombre del trabajador en el sistema contable.',
        })
      }
      if (f.retefuente > f.totalPagado) {
        excepciones.push({
          fila: f, tipo: 'retencion_inconsistente', severidad: 'alta',
          descripcion: `Retención ${fmtCOP(f.retefuente)} supera total nómina ${fmtCOP(f.totalPagado)} del trabajador ${f.primerApellido} ${f.primerNombre}`,
          sugerencia: 'Verifique los asientos de retención de nómina.',
        })
      }
    }
    return excepciones
  }

  totalizar(filas: Fila2276[]) {
    return {
      totalFilas:          filas.length,
      totalPagado:         filas.reduce((s, f) => s + f.totalPagado,       0),
      totalAportesSalud:   filas.reduce((s, f) => s + f.aportesSalud,      0),
      totalAportesPension: filas.reduce((s, f) => s + f.aportesPension,    0),
      totalOtrasDed:       filas.reduce((s, f) => s + f.otrasDeducciones,  0),
      totalRetefuente:     filas.reduce((s, f) => s + f.retefuente,        0),
      totalNeto:           filas.reduce((s, f) => s + f.netoPagado,        0),
    }
  }

  private filaVacia(a: AsientoContable, concepto: string): Fila2276 {
    const t = a.tercero
    // F2276 = nómina = siempre personas naturales (empleados con contrato laboral).
    // Reconstruir en orden DIAN: primerApellido segundoApellido primerNombre otrosNombres.
    const nombreRaw = t.razonSocial
      ?? [t.primerApellido, t.segundoApellido, t.primerNombre, t.otrosNombres].filter(Boolean).join(' ')
    const nombres = parsearNombreColombia(nombreRaw)

    const depto = t.deptoCodigo ?? (t.municipioCodigo ? t.municipioCodigo.slice(0, 2) : '')
    const muni  = t.municipioCodigo ?? (t.deptoCodigo ? buscarMunicipio(DEPARTAMENTOS[t.deptoCodigo] ?? '') ?? '' : '')

    return {
      conceptoCodigo:      concepto,
      descripcionConcepto: CONCEPTOS_2276[concepto] ?? 'Pago laboral',
      tipoDocumento:       t.tipoDocumento ?? '1',
      numeroId:            t.numeroId ?? '',
      dv:                  t.dv ?? '',
      paisCodigo:          (t.paisCodigo ?? 'CO').toUpperCase(),
      deptoCodigo:         depto,
      municipioCodigo:     muni,
      primerApellido:  nombres.primerApellido,
      segundoApellido: nombres.segundoApellido,
      primerNombre:    nombres.primerNombre,
      otrosNombres:    nombres.otrosNombres,
      totalPagado:      0, aportesSalud:   0,
      aportesPension:   0, otrasDeducciones: 0,
      retefuente:       0, netoPagado:     0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }
}

function fmtCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
}
