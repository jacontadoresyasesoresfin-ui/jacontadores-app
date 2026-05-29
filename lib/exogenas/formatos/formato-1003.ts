/**
 * Formato 1003 v8 — Retenciones en la fuente que le practicaron al declarante
 * Res. DIAN 000227/2025 — Año gravable 2025
 *
 * Reporta las retenciones que TERCEROS PRACTICARON al declarante durante el año.
 * Fuente: cuentas 1355xx (Anticipo de impuestos y retenciones a favor).
 *
 * PUC fuente:
 *   13551501 — Anticipo retención renta (salarios y pagos laborales)
 *   13551503 — Anticipo retención renta (honorarios)
 *   13551505 — Anticipo retención 3.5%
 *   13551507 — Anticipo retención 2%
 *   13551509 — Anticipo retención 1%
 *   13551513 — Anticipo retención otros conceptos
 *   13551701 — IVA retenido (retención IVA practicada por clientes)
 *   13551801+ — ReteICA cobrada por municipios
 *
 * Concilia con: Formulario 350 "retenciones practicadas al declarante"
 *               y Formulario 110/210 (anticipo de retenciones — activo corriente).
 */

import type {
  IFormatoExogena, FilaFormato, ColumnaDefinicion,
  AsientoContable, ExcepcionGenerada,
} from '../types'
import { RulesEngine } from '../engine/rules-engine'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'
import { buscarMunicipio, DEPARTAMENTOS } from '../config/divipola'

// ── Conceptos DIAN para F1003 ─────────────────────────────────────────────────
export const CONCEPTOS_1003: Record<string, string> = {
  '1302': 'Retención renta y complementarios',
  '1303': 'Retención a título de ventas (IVA)',
  '1305': 'Retención CREE',
  '1306': 'Retención dividendos y participaciones',
  '1307': 'Retención rendimientos financieros',
  '1308': 'Retención loterías, rifas y similares',
  '1309': 'Retención por timbre',
  '1310': 'Retención ICA (ReteICA)',
  '1399': 'Otras retenciones que le practicaron',
}

export interface Fila1003 extends FilaFormato {
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
  razonSocial: string
  valorRetenido: number
}

export const COLUMNAS_1003: ColumnaDefinicion[] = [
  { campo: 'conceptoCodigo',  header: 'Concepto',                       ancho: 8,  tipo: 'texto',  obligatorio: true  },
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
  { campo: 'valorRetenido',   header: 'Valor retenido',                 ancho: 18, tipo: 'moneda', obligatorio: true  },
]

export class Formato1003Strategy implements IFormatoExogena<Fila1003> {
  readonly codigo = '1003'
  readonly version = 'v8'
  readonly nombreOficial = 'Retenciones en la fuente practicadas al declarante'
  readonly columnas = COLUMNAS_1003

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila1003[] {
    const acum = new Map<string, Fila1003>()

    for (const a of asientos) {
      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '1003') continue
      if (!a.tercero?.numeroId) continue

      const clave = `${a.tercero.numeroId}|${regla.conceptoCodigo}`
      const fila: Fila1003 = acum.get(clave) ?? this.filaVacia(a, regla.conceptoCodigo)

      // Cuentas 1355xx son activos: el saldo DÉBITO representa retenciones acumuladas
      fila.valorRetenido += a.naturaleza === 'debito' ? a.monto : -a.monto

      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      if (a.cuentaPuc)   fila._cuentasOrigen?.push(a.cuentaPuc)
      fila._reglaId = regla.id
      acum.set(clave, fila)
    }

    return Array.from(acum.values()).filter(f => Math.round(f.valorRetenido) !== 0)
  }

  validar(filas: Fila1003[]): ExcepcionGenerada[] {
    const excepciones: ExcepcionGenerada[] = []
    for (const f of filas) {
      if (!f.numeroId || f.numeroId.trim() === '') {
        excepciones.push({
          fila: f, tipo: 'tercero_sin_identificar', severidad: 'alta',
          descripcion: `Retención sin identificación del agente retenedor — valor $${fmt(f.valorRetenido)}`,
          valorInvolucrado: f.valorRetenido,
          sugerencia: 'Identifique el NIT del cliente o entidad que practicó la retención.',
        })
      }
      if (f.valorRetenido < 0) {
        excepciones.push({
          fila: f, tipo: 'retencion_negativa', severidad: 'media',
          descripcion: `Retención negativa $${fmt(f.valorRetenido)} para ${f.razonSocial || f.numeroId} — concepto ${f.conceptoCodigo}`,
          valorInvolucrado: f.valorRetenido,
          sugerencia: 'Las notas de corrección pueden generar saldo negativo. Verifique los comprobantes de retención.',
        })
      }
    }
    return excepciones
  }

  totalizar(filas: Fila1003[]) {
    return {
      totalFilas:    filas.length,
      totalRetenido: filas.reduce((s, f) => s + f.valorRetenido, 0),
    }
  }

  private filaVacia(a: AsientoContable, concepto: string): Fila1003 {
    const t = a.tercero
    const nombreRaw = t.razonSocial
      ?? [t.primerApellido, t.segundoApellido, t.primerNombre, t.otrosNombres].filter(Boolean).join(' ')
    const esPJ = esPersonaJuridica(nombreRaw)
    const nombres = !esPJ ? parsearNombreColombia(nombreRaw) : null
    const depto = t.deptoCodigo ?? (t.municipioCodigo ? t.municipioCodigo.slice(0, 2) : '')
    const muni  = t.municipioCodigo ?? (t.deptoCodigo ? (buscarMunicipio(DEPARTAMENTOS[t.deptoCodigo] ?? '') ?? '') : '')
    return {
      conceptoCodigo:      concepto,
      descripcionConcepto: CONCEPTOS_1003[concepto] ?? 'Retención practicada',
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
      valorRetenido:       0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}
