/**
 * Formato 1001 v11 — Pagos o abonos en cuenta y retenciones practicadas
 * Resolución DIAN 000227/2025 (RUMT) + Resolución 000233/2025
 * Año gravable 2025 — presentación 2026
 *
 * ⚠️  VERIFICAR ESTRUCTURA contra el Prevalidador oficial DIAN
 *     antes de producción. Este archivo refleja la estructura conocida
 *     del Formato 1001 v11. La DIAN es la fuente definitiva.
 *
 * Lógica de negocio:
 * - Se agrega por NIT + Concepto (un renglón por tercero/concepto)
 * - Persona natural: llenar primerApellido, segundoApellido, primerNombre, otrosNombres
 * - Persona jurídica: llenar razonSocial (primer/segundo apellido y nombres en blanco)
 * - DV: solo obligatorio para NIT (tipoDocumento = '3')
 * - Operaciones sin tercero identificado → EXCEPCIÓN alta
 * - Retención en la fuente: valor practicado (empresa paga → empresa retiene)
 */

import type {
  IFormatoExogena, FilaFormato, ColumnaDefinicion,
  AsientoContable, ExcepcionGenerada,
} from '../types'
import { RulesEngine, validarDvNit, calcularDvNit } from '../engine/rules-engine'

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
  // Concepto y valores
  conceptoCodigo: string
  valorPago: number
  valorIva: number
  valorRetefuente: number
  valorReteIva: number
  valorReteIca: number
}

// ── Estructura de columnas exacta del Prevalidador DIAN Formato 1001 v11 ──
// Basada en la estructura oficial. Verificar contra el prevalidador vigente.
export const COLUMNAS_1001_V11: ColumnaDefinicion[] = [
  {
    campo: 'tipoDocumento', header: 'Tipo de documento', ancho: 8,
    tipo: 'texto', obligatorio: true,
    validar: v => ['1','2','3','4','5','6','7','8','9','11','12','13','14'].includes(String(v)),
  },
  { campo: 'numeroId',       header: 'Número de identificación',          ancho: 22, tipo: 'texto',  obligatorio: true },
  { campo: 'dv',             header: 'DV',                                 ancho: 4,  tipo: 'texto',  obligatorio: false },
  { campo: 'paisCodigo',     header: 'País',                               ancho: 6,  tipo: 'texto',  obligatorio: true },
  { campo: 'deptoCodigo',    header: 'Departamento',                       ancho: 6,  tipo: 'texto',  obligatorio: false },
  { campo: 'municipioCodigo',header: 'Municipio',                          ancho: 8,  tipo: 'texto',  obligatorio: false },
  { campo: 'primerApellido', header: 'Primer apellido',                    ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'segundoApellido',header: 'Segundo apellido',                   ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'primerNombre',   header: 'Primer nombre',                      ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'otrosNombres',   header: 'Otros nombres',                      ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'razonSocial',    header: 'Razón social',                       ancho: 60, tipo: 'texto',  obligatorio: false },
  {
    campo: 'conceptoCodigo', header: 'Código del concepto', ancho: 8,
    tipo: 'texto', obligatorio: true,
    validar: v => /^5\d{3}$/.test(String(v)),
  },
  { campo: 'valorPago',        header: 'Valor del pago o abono en cuenta',          ancho: 18, tipo: 'moneda', obligatorio: true },
  { campo: 'valorIva',         header: 'Valor del impuesto a las ventas',            ancho: 18, tipo: 'moneda', obligatorio: true },
  { campo: 'valorRetefuente',  header: 'Valor retención en la fuente practicada',    ancho: 20, tipo: 'moneda', obligatorio: true },
  { campo: 'valorReteIva',     header: 'Valor retención en el IVA practicada',       ancho: 20, tipo: 'moneda', obligatorio: true },
  { campo: 'valorReteIca',     header: 'Valor retención en el ICA practicada',       ancho: 20, tipo: 'moneda', obligatorio: true },
]

export class Formato1001Strategy implements IFormatoExogena<Fila1001> {
  readonly codigo = '1001'
  readonly version = 'v11'
  readonly nombreOficial = 'Pagos o abonos en cuenta y retenciones practicadas'
  readonly columnas = COLUMNAS_1001_V11

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila1001[] {
    // Acumula por clave: NIT + concepto
    const acum = new Map<string, Fila1001>()

    for (const a of asientos) {
      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '1001') continue
      if (!a.tercero?.numeroId) continue

      const clave = `${a.tercero.numeroId}|${regla.conceptoCodigo}`
      const fila: Fila1001 = acum.get(clave) ?? this.filaVacia(a, regla.conceptoCodigo)

      fila.valorPago       += a.monto
      fila.valorIva        += a.valorIva       ?? 0
      fila.valorRetefuente += a.retefuente     ?? 0
      fila.valorReteIva    += a.reteIva        ?? 0
      fila.valorReteIca    += a.reteIca        ?? 0

      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      if (a.cuentaPuc)   fila._cuentasOrigen?.push(a.cuentaPuc)
      fila._reglaId = regla.id

      acum.set(clave, fila)
    }

    // Filtrar filas con $0 en todo (no informar)
    return Array.from(acum.values()).filter(f =>
      Math.round(f.valorPago) !== 0 ||
      Math.round(f.valorRetefuente) !== 0
    )
  }

  validar(filas: Fila1001[]): ExcepcionGenerada[] {
    const excepciones: ExcepcionGenerada[] = []

    for (const f of filas) {
      // Tercero sin identificar
      if (!f.numeroId || f.numeroId.trim() === '') {
        excepciones.push({
          fila: f, tipo: 'tercero_sin_identificar', severidad: 'alta',
          descripcion: `Tercero sin número de identificación. Concepto ${f.conceptoCodigo}, valor $${fmt(f.valorPago)}`,
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
            descripcion: `DV ${f.dv} del NIT ${f.numeroId} no es válido (DV correcto: ${dvCorrecto})`,
            sugerencia: `Corrija el DV a ${dvCorrecto}`,
          })
        }
      }

      // NIT sin DV
      if (f.tipoDocumento === '3' && !f.dv) {
        const dvCorrecto = calcularDvNit(f.numeroId)
        excepciones.push({
          fila: f, tipo: 'dv_faltante', severidad: 'media',
          descripcion: `NIT ${f.numeroId} sin dígito de verificación`,
          sugerencia: `DV calculado: ${dvCorrecto}`,
        })
        f.dv = dvCorrecto // auto-corrección
      }

      // Retención mayor al pago (imposible)
      if (f.valorRetefuente > f.valorPago * 1.01) {
        excepciones.push({
          fila: f, tipo: 'retencion_inconsistente', severidad: 'alta',
          descripcion: `Retención $${fmt(f.valorRetefuente)} supera el pago $${fmt(f.valorPago)} para ${f.razonSocial || f.numeroId}`,
          valorInvolucrado: f.valorRetefuente,
          sugerencia: 'Revise los asientos de retención en la fuente y los abonos asociados.',
        })
      }

      // Tercero del exterior sin código de país
      if (f.paisCodigo !== 'CO' && (!f.paisCodigo || f.paisCodigo.trim() === '')) {
        excepciones.push({
          fila: f, tipo: 'pais_exterior_sin_datos', severidad: 'media',
          descripcion: `Tercero ${f.numeroId} del exterior sin código de país`,
          sugerencia: 'Registre el código ISO del país de residencia del tercero.',
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

      // Código de concepto inválido
      if (!/^5\d{3}$/.test(f.conceptoCodigo)) {
        excepciones.push({
          fila: f, tipo: 'concepto_invalido', severidad: 'alta',
          descripcion: `Código de concepto "${f.conceptoCodigo}" no válido para Formato 1001`,
          sugerencia: 'Los conceptos válidos son del 5001 al 5099. Revise las reglas de mapeo.',
        })
      }
    }

    return excepciones
  }

  totalizar(filas: Fila1001[]) {
    return {
      totalFilas:        filas.length,
      totalPagos:        filas.reduce((s, f) => s + f.valorPago,       0),
      totalIva:          filas.reduce((s, f) => s + f.valorIva,         0),
      totalRetefuente:   filas.reduce((s, f) => s + f.valorRetefuente,  0),
      totalReteIva:      filas.reduce((s, f) => s + f.valorReteIva,     0),
      totalReteIca:      filas.reduce((s, f) => s + f.valorReteIca,     0),
    }
  }

  private filaVacia(a: AsientoContable, concepto: string): Fila1001 {
    const t = a.tercero
    const esPN = t.tipoTercero === 'persona_natural' || t.tipoDocumento !== '3'
    return {
      tipoDocumento:   t.tipoDocumento ?? '3',
      numeroId:        t.numeroId ?? '',
      dv:              t.dv ?? '',
      paisCodigo:      t.paisCodigo ?? 'CO',
      deptoCodigo:     t.deptoCodigo ?? '',
      municipioCodigo: t.municipioCodigo ?? '',
      primerApellido:  esPN ? (t.primerApellido ?? '') : '',
      segundoApellido: esPN ? (t.segundoApellido ?? '') : '',
      primerNombre:    esPN ? (t.primerNombre ?? '') : '',
      otrosNombres:    esPN ? (t.otrosNombres ?? '') : '',
      razonSocial:     !esPN ? (t.razonSocial ?? '') : '',
      conceptoCodigo:  concepto,
      valorPago: 0, valorIva: 0, valorRetefuente: 0, valorReteIva: 0, valorReteIca: 0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}
