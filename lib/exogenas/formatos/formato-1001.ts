/**
 * Formato 1001 v11 — Pagos o abonos en cuenta y retenciones practicadas
 * Resolución DIAN 000227/2025 (RUMT) + Resolución 000233/2025
 * Año gravable 2025 — presentación 2026
 *
 * Cambios v11 (Res. 000233/2025):
 *   - Pago separado en deducible / no deducible (Art. 107 E.T.)
 *   - IVA separado en deducible / no deducible
 *   - Nueva columna: Retención asumida renta
 *   - Nueva columna: Retención IVA a no residentes o no domiciliados
 *   - Nueva columna: Dirección del informado
 *
 * Lógica de negocio:
 *   - Se agrega por NIT + Concepto (un renglón por tercero/concepto)
 *   - Persona natural: primerApellido, segundoApellido, primerNombre, otrosNombres
 *   - Persona jurídica: razonSocial (nombres en blanco)
 *   - Por defecto, todos los pagos se clasifican como deducibles.
 *     La contadora debe reclasificar los no deducibles si aplica.
 *   - DV: solo obligatorio para NIT (tipoDocumento = '3')
 */

import type {
  IFormatoExogena, FilaFormato, ColumnaDefinicion,
  AsientoContable, ExcepcionGenerada,
} from '../types'
import { RulesEngine, validarDvNit, calcularDvNit } from '../engine/rules-engine'

// ── Conceptos que pueden tener porción no deducible ──────────────────────────
const CONCEPTOS_REVISAR_DEDUCIBILIDAD = new Set(['5013', '5016', '5098'])

export interface Fila1001 extends FilaFormato {
  // Identificación del tercero
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
  direccion: string
  // Concepto
  conceptoCodigo: string
  // Valores v11 — deducible y no deducible por separado (Res. 000233/2025)
  valorPagoDeducible: number
  valorPagoNoDeducible: number
  valorIvaDeducible: number
  valorIvaNoDeducible: number
  valorRetefuente: number          // retención en la fuente practicada
  valorRetefuenteAsumida: number   // retención asumida por el pagador
  valorReteIva: number             // retención IVA a responsables de IVA
  valorReteIvaNoResidentes: number // retención IVA a no residentes/no domiciliados
  valorReteIca: number             // retención ICA practicada
  // Campos computados — suma de deducible + no deducible (uso interno y totales)
  valorPago: number
  valorIva: number
}

// ── Columnas exactas del Prevalidador DIAN — Formato 1001 v11 ────────────────
// Orden y nombres según Resolución 000233/2025 + Prevalidador oficial.
export const COLUMNAS_1001_V11: ColumnaDefinicion[] = [
  {
    campo: 'conceptoCodigo',
    header: 'Concepto',
    ancho: 8, tipo: 'texto', obligatorio: true,
    validar: v => /^5\d{3}$/.test(String(v)),
  },
  {
    campo: 'tipoDocumento',
    header: 'Tipo de documento',
    ancho: 8, tipo: 'texto', obligatorio: true,
    validar: v => ['1','2','3','4','5','6','7','8','9','11','12','13','14'].includes(String(v)),
  },
  { campo: 'numeroId',                 header: 'Número de identificación',                                          ancho: 22, tipo: 'texto',  obligatorio: true  },
  { campo: 'dv',                       header: 'DV',                                                                ancho: 4,  tipo: 'texto',  obligatorio: false },
  { campo: 'primerApellido',           header: 'Primer apellido del informado',                                     ancho: 22, tipo: 'texto',  obligatorio: false },
  { campo: 'segundoApellido',          header: 'Segundo apellido del informado',                                    ancho: 22, tipo: 'texto',  obligatorio: false },
  { campo: 'primerNombre',             header: 'Primer nombre del informado',                                       ancho: 22, tipo: 'texto',  obligatorio: false },
  { campo: 'otrosNombres',             header: 'Otros nombres del informado',                                       ancho: 22, tipo: 'texto',  obligatorio: false },
  { campo: 'razonSocial',              header: 'Razón social informado',                                            ancho: 60, tipo: 'texto',  obligatorio: false },
  { campo: 'direccion',                header: 'Dirección',                                                         ancho: 40, tipo: 'texto',  obligatorio: false },
  { campo: 'deptoCodigo',              header: 'Código departamento',                                               ancho: 6,  tipo: 'texto',  obligatorio: false },
  { campo: 'municipioCodigo',          header: 'Código municipio',                                                  ancho: 8,  tipo: 'texto',  obligatorio: false },
  { campo: 'paisCodigo',               header: 'País de residencia o domicilio',                                    ancho: 6,  tipo: 'texto',  obligatorio: true  },
  { campo: 'valorPagoDeducible',       header: 'Pago o abono en cuenta deducible',                                  ancho: 22, tipo: 'moneda', obligatorio: true  },
  { campo: 'valorPagoNoDeducible',     header: 'Pago o abono en cuenta no deducible',                               ancho: 22, tipo: 'moneda', obligatorio: true  },
  { campo: 'valorIvaDeducible',        header: 'IVA mayor valor del costo o gasto deducible',                       ancho: 24, tipo: 'moneda', obligatorio: true  },
  { campo: 'valorIvaNoDeducible',      header: 'IVA mayor valor del costo o gasto no deducible',                    ancho: 24, tipo: 'moneda', obligatorio: true  },
  { campo: 'valorRetefuente',          header: 'Retención en la fuente practicada renta',                           ancho: 26, tipo: 'moneda', obligatorio: true  },
  { campo: 'valorRetefuenteAsumida',   header: 'Retención en la fuente asumida renta',                              ancho: 26, tipo: 'moneda', obligatorio: true  },
  { campo: 'valorReteIva',             header: 'Retención en la fuente practicada IVA a responsables de IVA',       ancho: 28, tipo: 'moneda', obligatorio: true  },
  { campo: 'valorReteIvaNoResidentes', header: 'Retención en la fuente practicada IVA a no residentes o no domiciliados', ancho: 30, tipo: 'moneda', obligatorio: true },
  { campo: 'valorReteIca',             header: 'Retención ICA practicada',                                          ancho: 22, tipo: 'moneda', obligatorio: true  },
]

export class Formato1001Strategy implements IFormatoExogena<Fila1001> {
  readonly codigo = '1001'
  readonly version = 'v11'
  readonly nombreOficial = 'Pagos o abonos en cuenta y retenciones practicadas'
  readonly columnas = COLUMNAS_1001_V11

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila1001[] {
    const acum = new Map<string, Fila1001>()

    for (const a of asientos) {
      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '1001') continue
      if (!a.tercero?.numeroId) continue

      const clave = `${a.tercero.numeroId}|${regla.conceptoCodigo}`
      const fila: Fila1001 = acum.get(clave) ?? this.filaVacia(a, regla.conceptoCodigo)

      // Por defecto todo el pago se clasifica como deducible (Art. 107 E.T.).
      // La contadora puede reclasificar los no deducibles en el módulo de excepciones.
      fila.valorPagoDeducible       += a.monto
      fila.valorPagoNoDeducible     += 0
      fila.valorIvaDeducible        += a.valorIva               ?? 0
      fila.valorIvaNoDeducible      += 0
      fila.valorRetefuente          += a.retefuente             ?? 0
      fila.valorRetefuenteAsumida   += a.retefuenteAsumida      ?? 0
      fila.valorReteIva             += a.reteIva                ?? 0
      fila.valorReteIvaNoResidentes += a.reteIvaNoResidentes    ?? 0
      fila.valorReteIca             += a.reteIca                ?? 0

      // Mantener campos computados sincronizados
      fila.valorPago = fila.valorPagoDeducible + fila.valorPagoNoDeducible
      fila.valorIva  = fila.valorIvaDeducible  + fila.valorIvaNoDeducible

      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      if (a.cuentaPuc)   fila._cuentasOrigen?.push(a.cuentaPuc)
      fila._reglaId = regla.id

      acum.set(clave, fila)
    }

    // No informar filas con cero en pago total y cero en retención
    return Array.from(acum.values()).filter(f =>
      Math.round(f.valorPago) !== 0 ||
      Math.round(f.valorRetefuente) !== 0 ||
      Math.round(f.valorRetefuenteAsumida) !== 0
    )
  }

  validar(filas: Fila1001[]): ExcepcionGenerada[] {
    const excepciones: ExcepcionGenerada[] = []

    for (const f of filas) {
      // Tercero sin identificar
      if (!f.numeroId || f.numeroId.trim() === '') {
        excepciones.push({
          fila: f, tipo: 'tercero_sin_identificar', severidad: 'alta',
          descripcion: `Tercero sin número de identificación. Concepto ${f.conceptoCodigo}, valor ${fmtCOP(f.valorPago)}`,
          valorInvolucrado: f.valorPago,
          sugerencia: 'Identifique al tercero en la contabilidad y asigne el NIT o documento.',
        })
        continue
      }

      // DV inválido para NIT
      if (f.tipoDocumento === '3' && f.dv) {
        if (!validarDvNit(f.numeroId, f.dv)) {
          const dvCorrecto = calcularDvNit(f.numeroId)
          excepciones.push({
            fila: f, tipo: 'dv_incorrecto', severidad: 'media',
            descripcion: `DV ${f.dv} del NIT ${f.numeroId} no es válido (correcto: ${dvCorrecto})`,
            sugerencia: `Corrija el DV a ${dvCorrecto}`,
          })
        }
      }

      // NIT sin DV — auto-calcular y avisar
      if (f.tipoDocumento === '3' && !f.dv) {
        const dvCorrecto = calcularDvNit(f.numeroId)
        excepciones.push({
          fila: f, tipo: 'dv_faltante', severidad: 'media',
          descripcion: `NIT ${f.numeroId} sin dígito de verificación`,
          sugerencia: `DV calculado: ${dvCorrecto}`,
        })
        f.dv = dvCorrecto
      }

      // Retención total (practicada + asumida) no puede superar el pago
      const totalRete = f.valorRetefuente + f.valorRetefuenteAsumida
      if (totalRete > f.valorPago * 1.01) {
        excepciones.push({
          fila: f, tipo: 'retencion_inconsistente', severidad: 'alta',
          descripcion: `Retención total ${fmtCOP(totalRete)} supera el pago ${fmtCOP(f.valorPago)} para ${f.razonSocial || f.numeroId}`,
          valorInvolucrado: totalRete,
          sugerencia: 'Revise los asientos de retención en la fuente y los abonos asociados.',
        })
      }

      // Tercero del exterior sin código de país
      if (f.paisCodigo !== 'CO' && (!f.paisCodigo || f.paisCodigo.trim() === '')) {
        excepciones.push({
          fila: f, tipo: 'pais_exterior_sin_datos', severidad: 'media',
          descripcion: `Tercero ${f.numeroId} del exterior sin código de país`,
          sugerencia: 'Registre el código ISO del país de residencia del tercero (ej: US, ES, MX).',
        })
      }

      // Sin nombre ni razón social
      if (!f.razonSocial && !f.primerApellido && !f.primerNombre) {
        excepciones.push({
          fila: f, tipo: 'tercero_sin_nombre', severidad: 'baja',
          descripcion: `NIT/documento ${f.numeroId} sin nombre registrado`,
          sugerencia: 'Complete el nombre o razón social del tercero.',
        })
      }

      // Código de concepto inválido para Formato 1001
      if (!/^5\d{3}$/.test(f.conceptoCodigo)) {
        excepciones.push({
          fila: f, tipo: 'concepto_invalido', severidad: 'alta',
          descripcion: `Código de concepto "${f.conceptoCodigo}" no válido para Formato 1001`,
          sugerencia: 'Los conceptos válidos son del 5001 al 5099. Revise las reglas de mapeo.',
        })
      }

      // Aviso de deducibilidad no verificada en conceptos sensibles
      if (CONCEPTOS_REVISAR_DEDUCIBILIDAD.has(f.conceptoCodigo) && f.valorPagoNoDeducible === 0 && f.valorPago > 0) {
        excepciones.push({
          fila: f, tipo: 'deducibilidad_no_confirmada', severidad: 'baja',
          descripcion: `Concepto ${f.conceptoCodigo}: verifique si el pago ${fmtCOP(f.valorPago)} es deducible (Art. 107 E.T.)`,
          valorInvolucrado: f.valorPago,
          sugerencia: 'Si el gasto no cumple Art. 107 E.T., mueva el valor al campo "no deducible".',
        })
      }
    }

    return excepciones
  }

  totalizar(filas: Fila1001[]) {
    return {
      totalFilas:                filas.length,
      totalPagos:                filas.reduce((s, f) => s + f.valorPago,               0),
      totalPagoDeducible:        filas.reduce((s, f) => s + f.valorPagoDeducible,      0),
      totalPagoNoDeducible:      filas.reduce((s, f) => s + f.valorPagoNoDeducible,    0),
      totalIva:                  filas.reduce((s, f) => s + f.valorIva,                0),
      totalRetefuente:           filas.reduce((s, f) => s + f.valorRetefuente,         0),
      totalRetefuenteAsumida:    filas.reduce((s, f) => s + f.valorRetefuenteAsumida,  0),
      totalReteIva:              filas.reduce((s, f) => s + f.valorReteIva,            0),
      totalReteIvaNoResidentes:  filas.reduce((s, f) => s + f.valorReteIvaNoResidentes, 0),
      totalReteIca:              filas.reduce((s, f) => s + f.valorReteIca,            0),
    }
  }

  private filaVacia(a: AsientoContable, concepto: string): Fila1001 {
    const t = a.tercero
    const esPN = t.tipoTercero === 'persona_natural' || t.tipoDocumento !== '3'
    return {
      tipoDocumento:   t.tipoDocumento ?? '3',
      numeroId:        t.numeroId      ?? '',
      dv:              t.dv            ?? '',
      paisCodigo:      t.paisCodigo    ?? 'CO',
      deptoCodigo:     t.deptoCodigo   ?? '',
      municipioCodigo: t.municipioCodigo ?? '',
      primerApellido:  esPN ? (t.primerApellido  ?? '') : '',
      segundoApellido: esPN ? (t.segundoApellido ?? '') : '',
      primerNombre:    esPN ? (t.primerNombre    ?? '') : '',
      otrosNombres:    esPN ? (t.otrosNombres    ?? '') : '',
      razonSocial:    !esPN ? (t.razonSocial     ?? '') : '',
      direccion:       t.direccion     ?? '',
      conceptoCodigo:  concepto,
      valorPagoDeducible: 0, valorPagoNoDeducible: 0,
      valorIvaDeducible:  0, valorIvaNoDeducible:  0,
      valorRetefuente: 0, valorRetefuenteAsumida: 0,
      valorReteIva:    0, valorReteIvaNoResidentes: 0,
      valorReteIca:    0,
      valorPago: 0, valorIva: 0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }
}

function fmtCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}
