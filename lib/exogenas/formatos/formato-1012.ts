/**
 * Formato 1012 v8 — Información de saldos en cuentas bancarias, inversiones
 * y fondos de inversión colectiva al 31 de diciembre
 * Res. DIAN 000227/2025 — Año gravable 2025
 *
 * Reporta el saldo al cierre del período en:
 *   Grupo 11 PUC — Efectivo y equivalentes:
 *     1105xx — Caja
 *     1110xx — Bancos (cuentas corrientes y de ahorro)
 *     1115xx — Fondos
 *   Grupo 12 PUC — Inversiones:
 *     1205xx — Acciones y cuotas de interés social
 *     1210xx — Cuotas de interés social
 *     1215xx — Bonos y otros títulos de deuda
 *     1220xx — CDTs y certificados de depósito
 *     1225xx — Fondos de inversión colectiva
 *
 * Concilia con: Formulario 110/210 sección efectivo, bancos e inversiones.
 *
 * TIPOS DE CUENTA (código DIAN):
 *   01 — Cuenta corriente
 *   02 — Cuenta de ahorro
 *   03 — CDT / Certificado de depósito
 *   04 — Fondo fiduciario
 *   05 — Fondo de inversión colectiva
 *   06 — Acciones y cuotas de interés social
 *   07 — Bonos y títulos de deuda
 *   08 — Otros
 */

import type {
  IFormatoExogena, FilaFormato, ColumnaDefinicion,
  AsientoContable, ExcepcionGenerada,
} from '../types'
import { RulesEngine } from '../engine/rules-engine'
import { esPersonaJuridica } from '../utils/nombre-parser'

// ── Conceptos DIAN para F1012 ─────────────────────────────────────────────────
export const CONCEPTOS_1012: Record<string, string> = {
  '1204': 'Efectivo y cuentas bancarias (corriente/ahorros)',
  '1208': 'Fondos fiduciarios y patrimonios autónomos',
  '1209': 'Fondos de inversión colectiva',
  '1210': 'Acciones y cuotas de interés social',
  '1211': 'CDT y certificados de depósito a término',
  '1212': 'Bonos y otros títulos de deuda',
  '1299': 'Otras inversiones y equivalentes',
}

// Tipo de cuenta según código PUC → tipo DIAN
const TIPO_CUENTA_POR_PUC: [RegExp, string][] = [
  [/^1105/,  '01'],  // Caja → corriente (aproximación)
  [/^1110/,  '01'],  // Bancos corriente
  [/^1115/,  '02'],  // Cuentas de ahorro
  [/^1120/,  '05'],  // Fondos de inversión colectiva
  [/^1205/,  '06'],  // Acciones y cuotas
  [/^1210/,  '06'],  // Cuotas de interés social
  [/^1215/,  '07'],  // Bonos
  [/^1220/,  '03'],  // CDT
  [/^1225/,  '05'],  // Fondos inversión colectiva
]

function tipoCuentaDesdePuc(cuentaPuc: string): string {
  for (const [re, tipo] of TIPO_CUENTA_POR_PUC) {
    if (re.test(cuentaPuc)) return tipo
  }
  return '08'
}

export interface Fila1012 extends FilaFormato {
  // Identificación de la entidad financiera / banco
  tipoDocumento: string
  numeroId: string
  dv: string
  paisCodigo: string
  deptoCodigo: string
  municipioCodigo: string
  razonSocial: string
  // Datos de la cuenta / inversión
  numeroCuenta: string        // número de cuenta o referencia del título
  tipoCuenta: string          // 01-08 según tabla DIAN
  conceptoCodigo: string
  valorSaldo: number          // saldo al 31 de diciembre (neto)
}

export const COLUMNAS_1012: ColumnaDefinicion[] = [
  { campo: 'tipoDocumento',  header: 'Tipo de documento',                   ancho: 6,  tipo: 'texto',  obligatorio: true  },
  { campo: 'numeroId',       header: 'Número de identificación',            ancho: 22, tipo: 'texto',  obligatorio: true  },
  { campo: 'dv',             header: 'DV',                                  ancho: 4,  tipo: 'texto',  obligatorio: false },
  { campo: 'paisCodigo',     header: 'País',                                ancho: 6,  tipo: 'texto',  obligatorio: true  },
  { campo: 'deptoCodigo',    header: 'Departamento',                        ancho: 6,  tipo: 'texto',  obligatorio: false },
  { campo: 'municipioCodigo',header: 'Municipio',                           ancho: 8,  tipo: 'texto',  obligatorio: false },
  { campo: 'razonSocial',    header: 'Razón social',                        ancho: 60, tipo: 'texto',  obligatorio: true  },
  { campo: 'numeroCuenta',   header: 'Número de cuenta / referencia',       ancho: 30, tipo: 'texto',  obligatorio: false },
  { campo: 'tipoCuenta',     header: 'Tipo de cuenta',                      ancho: 6,  tipo: 'texto',  obligatorio: true  },
  { campo: 'conceptoCodigo', header: 'Concepto',                            ancho: 8,  tipo: 'texto',  obligatorio: true  },
  { campo: 'valorSaldo',     header: 'Saldo a 31 de diciembre',             ancho: 22, tipo: 'moneda', obligatorio: true  },
]

export class Formato1012Strategy implements IFormatoExogena<Fila1012> {
  readonly codigo = '1012'
  readonly version = 'v8'
  readonly nombreOficial = 'Saldos en cuentas bancarias, inversiones y fondos al 31 de diciembre'
  readonly columnas = COLUMNAS_1012

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila1012[] {
    const acum = new Map<string, Fila1012>()

    for (const a of asientos) {
      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '1012') continue
      if (!a.tercero?.numeroId) continue

      const tipoCuenta  = tipoCuentaDesdePuc(a.cuentaPuc)
      const clave       = `${a.tercero.numeroId}|${regla.conceptoCodigo}|${a.cuentaPuc.slice(0, 8)}`
      const fila: Fila1012 = acum.get(clave) ?? this.filaVacia(a, regla.conceptoCodigo, tipoCuenta, a.cuentaPuc)

      // Activos (11xx, 12xx): débito aumenta, crédito disminuye
      fila.valorSaldo += a.naturaleza === 'debito' ? a.monto : -a.monto

      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      if (a.cuentaPuc)   fila._cuentasOrigen?.push(a.cuentaPuc)
      fila._reglaId = regla.id
      acum.set(clave, fila)
    }

    return Array.from(acum.values()).filter(f => Math.round(f.valorSaldo) !== 0)
  }

  validar(filas: Fila1012[]): ExcepcionGenerada[] {
    const excepciones: ExcepcionGenerada[] = []
    for (const f of filas) {
      if (!f.numeroId || f.numeroId.trim() === '') {
        excepciones.push({
          fila: f, tipo: 'entidad_sin_identificar', severidad: 'alta',
          descripcion: `Cuenta bancaria/inversión sin NIT de la entidad — saldo $${fmt(f.valorSaldo)}`,
          valorInvolucrado: f.valorSaldo,
          sugerencia: 'Registre el NIT del banco o entidad financiera en el auxiliar contable.',
        })
      }
      if (!f.razonSocial || f.razonSocial.trim() === '') {
        excepciones.push({
          fila: f, tipo: 'entidad_sin_nombre', severidad: 'media',
          descripcion: `NIT ${f.numeroId} sin nombre de entidad financiera registrado`,
          sugerencia: 'Complete el nombre del banco o entidad en el sistema contable.',
        })
      }
      if (f.valorSaldo < 0) {
        excepciones.push({
          fila: f, tipo: 'saldo_negativo_banco', severidad: 'media',
          descripcion: `Saldo negativo $${fmt(f.valorSaldo)} en ${f.razonSocial || f.numeroId} — cuenta ${f.cuentasOrigen}`,
          valorInvolucrado: f.valorSaldo,
          sugerencia: 'Un saldo negativo en banco es inusual. Verifique que los débitos y créditos estén bien registrados.',
        })
      }
    }
    return excepciones
  }

  totalizar(filas: Fila1012[]) {
    return {
      totalFilas:    filas.length,
      totalSaldoBancos: filas.filter(f => ['01','02'].includes(f.tipoCuenta))
        .reduce((s, f) => s + f.valorSaldo, 0),
      totalSaldoInversiones: filas.filter(f => !['01','02'].includes(f.tipoCuenta))
        .reduce((s, f) => s + f.valorSaldo, 0),
      totalSaldo: filas.reduce((s, f) => s + f.valorSaldo, 0),
    }
  }

  private filaVacia(a: AsientoContable, concepto: string, tipoCuenta: string, cuentaPuc: string): Fila1012 {
    const t = a.tercero
    const nombreRaw = t.razonSocial ?? t.primerApellido ?? ''
    const esPJ = t.tipoDocumento === '3' || esPersonaJuridica(nombreRaw)
    const depto = t.deptoCodigo ?? (t.municipioCodigo ? t.municipioCodigo.slice(0, 2) : '')
    const muni  = t.municipioCodigo ?? ''
    return {
      tipoDocumento:  t.tipoDocumento ?? (esPJ ? '3' : '1'),
      numeroId:       t.numeroId ?? '',
      dv:             t.dv ?? '',
      paisCodigo:     (t.paisCodigo ?? 'CO').toUpperCase(),
      deptoCodigo:    depto,
      municipioCodigo: muni,
      razonSocial:    t.razonSocial ?? nombreRaw,
      numeroCuenta:   cuentaPuc,
      tipoCuenta,
      conceptoCodigo: concepto,
      valorSaldo:     0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }

  // Getter auxiliar para el validar()
  private get cuentasOrigen() { return '' }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}
