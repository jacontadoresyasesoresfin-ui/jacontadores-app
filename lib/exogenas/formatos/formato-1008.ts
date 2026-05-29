/**
 * Formato 1008 v6 — Saldos de cuentas por cobrar a 31 de diciembre
 * Res. DIAN 000227/2025 — Año gravable 2025
 *
 * Reporta el SALDO al cierre del período fiscal (31-dic) de las cuentas del
 * activo corriente — deudores (clase 13 PUC). No informa movimientos del año.
 *
 * PUC fuente:
 *   13050501 — Clientes nacionales
 *   13050502 — Clientes del exterior
 *   13550501 — Anticipos a proveedores
 *   135505   — Anticipo de impuestos (genérico)
 *   13551501+ — Anticipo retenciones (se incluye en 1008 según Siigo)
 *   13551801+ — ReteICA a favor
 *   13650501 — Préstamos a trabajadores
 *   13700501 — Deudores varios
 *   13951501 — Provisiones para deudores
 *
 * Concilia con: Balance general Formulario 110/210 (activo corriente — deudores).
 */

import type {
  IFormatoExogena, FilaFormato, ColumnaDefinicion,
  AsientoContable, ExcepcionGenerada,
} from '../types'
import { RulesEngine } from '../engine/rules-engine'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'
import { buscarMunicipio, DEPARTAMENTOS } from '../config/divipola'

// ── Conceptos DIAN para F1008 ─────────────────────────────────────────────────
export const CONCEPTOS_1008: Record<string, string> = {
  '1315': 'Deudores clientes nacionales',
  '1316': 'Deudores clientes del exterior',
  '1317': 'Anticipos e impuestos a favor (retenciones)',
  '1318': 'Provisiones para deudores de difícil cobro',
  '1399': 'Otras cuentas por cobrar',
}

export interface Fila1008 extends FilaFormato {
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
  valorSaldo: number      // Saldo neto al 31-dic (débito = positivo para activos)
}

export const COLUMNAS_1008: ColumnaDefinicion[] = [
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

export class Formato1008Strategy implements IFormatoExogena<Fila1008> {
  readonly codigo = '1008'
  readonly version = 'v6'
  readonly nombreOficial = 'Saldos de cuentas por cobrar a 31 de diciembre'
  readonly columnas = COLUMNAS_1008

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila1008[] {
    const acum = new Map<string, Fila1008>()

    for (const a of asientos) {
      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '1008') continue
      if (!a.tercero?.numeroId) continue

      const clave = `${a.tercero.numeroId}|${regla.conceptoCodigo}`
      const fila: Fila1008 = acum.get(clave) ?? this.filaVacia(a, regla.conceptoCodigo)

      // Activos PUC clase 13: débito aumenta (saldo a favor), crédito disminuye
      fila.valorSaldo += a.naturaleza === 'debito' ? a.monto : -a.monto

      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      if (a.cuentaPuc)   fila._cuentasOrigen?.push(a.cuentaPuc)
      fila._reglaId = regla.id
      acum.set(clave, fila)
    }

    // Reportar todos los terceros con saldo distinto de cero
    return Array.from(acum.values()).filter(f => Math.round(f.valorSaldo) !== 0)
  }

  validar(filas: Fila1008[]): ExcepcionGenerada[] {
    const excepciones: ExcepcionGenerada[] = []
    for (const f of filas) {
      if (!f.numeroId || f.numeroId.trim() === '') {
        excepciones.push({
          fila: f, tipo: 'deudor_sin_identificar', severidad: 'alta',
          descripcion: `Deudor sin NIT — saldo CxC $${fmt(f.valorSaldo)}`,
          valorInvolucrado: f.valorSaldo,
          sugerencia: 'Identifique el NIT del deudor en el sistema contable.',
        })
      }
      if (f.valorSaldo < 0) {
        excepciones.push({
          fila: f, tipo: 'saldo_cxc_negativo', severidad: 'media',
          descripcion: `Saldo CxC negativo $${fmt(f.valorSaldo)} para ${f.razonSocial || f.numeroId} — concepto ${f.conceptoCodigo}`,
          valorInvolucrado: f.valorSaldo,
          sugerencia: 'Un saldo negativo en CxC indica que le pagaron de más o hay una nota crédito sin aplicar. Verifique los comprobantes.',
        })
      }
    }
    return excepciones
  }

  totalizar(filas: Fila1008[]) {
    return {
      totalFilas:    filas.length,
      totalSaldoCxC: filas.reduce((s, f) => s + f.valorSaldo, 0),
    }
  }

  private filaVacia(a: AsientoContable, concepto: string): Fila1008 {
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
      descripcionConcepto: CONCEPTOS_1008[concepto] ?? 'Cuenta por cobrar',
      valorSaldo:          0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}
