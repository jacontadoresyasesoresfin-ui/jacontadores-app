/**
 * Humanizador de excepciones — convierte errores técnicos en lenguaje contable claro.
 * La contadora nunca debe ver un código de error o término técnico.
 */
import type { ExcepcionGenerada } from '../types'

export type AccionExcepcion =
  | 'asignar_tercero'
  | 'corregir_dv'
  | 'asignar_concepto'
  | 'excluir'
  | 'confirmar_correcto'
  | 'diferir'

export interface TarjetaExcepcion {
  excepcionOriginal: ExcepcionGenerada
  icono: string
  titulo: string
  explicacion: string
  impacto: string
  acciones: Array<{ tipo: AccionExcepcion; etiqueta: string; primaria?: boolean }>
  dvSugerido?: string
  contexto?: {
    cuenta?: string
    nombreCuenta?: string
    monto?: number
    documentoId?: string
    fecha?: string
    terceroId?: string
  }
}

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmt = (n?: number) => n != null ? COP.format(n) : ''

/**
 * Convierte una lista de excepciones técnicas en tarjetas para la contadora.
 * Las tarjetas se ordenan por severidad: críticas primero.
 */
export function humanizarExcepciones(excepciones: ExcepcionGenerada[]): TarjetaExcepcion[] {
  const orden = { alta: 0, media: 1, baja: 2 }
  return excepciones
    .sort((a, b) => orden[a.severidad] - orden[b.severidad])
    .map(e => construirTarjeta(e))
}

function construirTarjeta(e: ExcepcionGenerada): TarjetaExcepcion {
  const fila = e.fila as Record<string, unknown> | undefined
  const contexto = {
    cuenta: (fila?.cuentaPuc ?? fila?.conceptoCodigo ?? '') as string,
    nombreCuenta: (fila?.nombreCuenta ?? '') as string,
    monto: e.valorInvolucrado,
    documentoId: (fila?.documentoId ?? (fila?._documentosIds as string[] | undefined)?.[0] ?? '') as string,
    fecha: (fila?.fecha ?? '') as string,
    terceroId: (fila?.numeroId ?? '') as string,
  }

  switch (e.tipo) {
    case 'tercero_sin_identificar':
      return {
        excepcionOriginal: e,
        icono: 'question-circle',
        titulo: 'No sé a quién se le pagó este dinero',
        explicacion: [
          fmt(e.valorInvolucrado) && `Encontré un pago de ${fmt(e.valorInvolucrado)}`,
          contexto.cuenta && `registrado en la cuenta ${contexto.cuenta}${contexto.nombreCuenta ? ` (${contexto.nombreCuenta})` : ''}`,
          contexto.documentoId && `— comprobante ${contexto.documentoId}`,
          '— pero el registro contable no tiene un NIT o documento de identidad asignado.',
        ].filter(Boolean).join(' '),
        impacto: 'La DIAN exige que todo pago esté identificado con el NIT o cédula de quien lo recibió. Sin este dato, el pago no puede incluirse en la exógena y quedaría sin reportar.',
        acciones: [
          { tipo: 'asignar_tercero', etiqueta: 'Decirle quién recibió este pago', primaria: true },
          { tipo: 'excluir', etiqueta: 'Excluir (gasto sin obligación de reportar)' },
          { tipo: 'diferir', etiqueta: 'Revisar después' },
        ],
        contexto,
      }

    case 'dv_incorrecto': {
      const dvCorrecto = e.sugerencia?.match(/DV calculado:\s*(\d)/)?.[1] ?? e.sugerencia?.match(/corrija el DV a (\d)/i)?.[1]
      return {
        excepcionOriginal: e,
        icono: 'hashtag',
        titulo: `El NIT ${contexto.terceroId} tiene el dígito de verificación incorrecto`,
        explicacion: `El dígito de verificación registrado no coincide con el que calcula la DIAN para ese NIT. ${dvCorrecto ? `El correcto es ${dvCorrecto}.` : ''} Esto puede causar que la DIAN rechace el archivo.`,
        impacto: 'Si el dígito de verificación está mal, la DIAN puede invalidar el reporte de este tercero.',
        acciones: [
          { tipo: 'corregir_dv', etiqueta: dvCorrecto ? `Corregir al dígito ${dvCorrecto} (recomendado)` : 'Corregir dígito de verificación', primaria: true },
          { tipo: 'confirmar_correcto', etiqueta: 'Dejarlo así (sé que es correcto)' },
        ],
        dvSugerido: dvCorrecto,
        contexto,
      }
    }

    case 'dv_faltante': {
      const dvCalculado = e.sugerencia?.match(/DV calculado:\s*(\d)/)?.[1]
      return {
        excepcionOriginal: e,
        icono: 'hashtag',
        titulo: `El NIT ${contexto.terceroId} no tiene dígito de verificación`,
        explicacion: `Este NIT está registrado sin el dígito de verificación. ${dvCalculado ? `Según el cálculo de la DIAN, el dígito correcto es ${dvCalculado}.` : 'Necesito el dígito para completar el reporte.'}`,
        impacto: 'La DIAN valida el dígito de verificación. Un NIT incompleto puede ser rechazado.',
        acciones: [
          { tipo: 'corregir_dv', etiqueta: dvCalculado ? `Agregar el dígito ${dvCalculado} (calculado automáticamente)` : 'Agregar el dígito de verificación', primaria: true },
          { tipo: 'diferir', etiqueta: 'Revisar después' },
        ],
        dvSugerido: dvCalculado,
        contexto,
      }
    }

    case 'concepto_invalido':
      return {
        excepcionOriginal: e,
        icono: 'tag',
        titulo: `No sé cómo clasificar la cuenta ${contexto.cuenta} para la DIAN`,
        explicacion: `La cuenta ${contexto.cuenta}${contexto.nombreCuenta ? ` — ${contexto.nombreCuenta}` : ''} tiene movimientos por ${fmt(e.valorInvolucrado)} que no están asociados a ninguna categoría del formulario de exógenas. El sistema no sabe en qué renglón del reporte incluirlos.`,
        impacto: 'Estos valores no se incluirán en ningún formato de la exógena hasta que se defina la categoría.',
        acciones: [
          { tipo: 'asignar_concepto', etiqueta: 'Elegir la categoría correcta de la DIAN', primaria: true },
          { tipo: 'excluir', etiqueta: 'No reportar esta cuenta' },
        ],
        contexto,
      }

    case 'retencion_inconsistente':
      return {
        excepcionOriginal: e,
        icono: 'triangle-warning',
        titulo: 'La retención parece más alta de lo normal',
        explicacion: `Para ${fila?.razonSocial ?? fila?.numeroId ?? 'este tercero'}, la retención registrada es ${fmt(e.valorInvolucrado)}, que supera el valor del pago. Esto no es posible — la retención nunca puede ser mayor que el valor del servicio o compra.`,
        impacto: 'Un dato de retención incorrecto puede generar inconsistencias frente a la declaración de retención en la fuente.',
        acciones: [
          { tipo: 'confirmar_correcto', etiqueta: 'Está bien, así lo registré yo' },
          { tipo: 'excluir', etiqueta: 'Excluir este registro para revisarlo' },
          { tipo: 'diferir', etiqueta: 'Revisar en contabilidad' },
        ],
        contexto,
      }

    case 'tercero_sin_nombre':
      return {
        excepcionOriginal: e,
        icono: 'user-circle',
        titulo: `El NIT ${contexto.terceroId} no tiene nombre registrado`,
        explicacion: `Encontré movimientos por ${fmt(e.valorInvolucrado)} para el NIT ${contexto.terceroId} pero no hay un nombre o razón social registrado en la contabilidad. El archivo de la DIAN debe incluir el nombre del tercero.`,
        impacto: 'La DIAN puede rechazar registros sin nombre del tercero identificado.',
        acciones: [
          { tipo: 'asignar_tercero', etiqueta: 'Buscar el nombre de este NIT automáticamente', primaria: true },
          { tipo: 'diferir', etiqueta: 'Completar el nombre manualmente después' },
        ],
        contexto,
      }

    case 'compra_negativa':
    case 'ingreso_negativo':
      return {
        excepcionOriginal: e,
        icono: 'arrows-rotate',
        titulo: 'Las devoluciones superan el valor registrado',
        explicacion: `Para ${fila?.razonSocial ?? fila?.numeroId ?? 'este tercero'}, el valor neto después de devoluciones y descuentos es negativo: ${fmt(e.valorInvolucrado)}. Esto generalmente indica que hay devoluciones registradas sin su compra o venta original.`,
        impacto: 'Un valor neto negativo no se puede reportar a la DIAN. Este registro será excluido automáticamente.',
        acciones: [
          { tipo: 'confirmar_correcto', etiqueta: 'Es correcto, excluir del reporte' },
          { tipo: 'diferir', etiqueta: 'Revisar en el libro auxiliar' },
        ],
        contexto,
      }

    default:
      return {
        excepcionOriginal: e,
        icono: 'triangle-warning',
        titulo: 'Situación que requiere revisión',
        explicacion: e.descripcion,
        impacto: e.sugerencia ?? 'Revise este registro antes de enviar a la DIAN.',
        acciones: [
          { tipo: 'confirmar_correcto', etiqueta: 'Está bien, continuar' },
          { tipo: 'excluir', etiqueta: 'Excluir del reporte' },
          { tipo: 'diferir', etiqueta: 'Revisar después' },
        ],
        contexto,
      }
  }
}

/**
 * Agrupa tarjetas por tipo para mostrar un resumen a la contadora
 * antes de que empiece a resolverlas una por una.
 */
export function resumirExcepciones(tarjetas: TarjetaExcepcion[]): {
  criticas: number
  alertas: number
  informativas: number
  descripcionResumen: string
} {
  const criticas = tarjetas.filter(t => t.excepcionOriginal.severidad === 'alta').length
  const alertas = tarjetas.filter(t => t.excepcionOriginal.severidad === 'media').length
  const informativas = tarjetas.filter(t => t.excepcionOriginal.severidad === 'baja').length

  const partes: string[] = []
  if (criticas > 0) partes.push(`${criticas} ${criticas === 1 ? 'situación crítica' : 'situaciones críticas'} que deben resolverse`)
  if (alertas > 0) partes.push(`${alertas} ${alertas === 1 ? 'alerta' : 'alertas'} que conviene revisar`)
  if (informativas > 0) partes.push(`${informativas} ${informativas === 1 ? 'nota informativa' : 'notas informativas'}`)

  return {
    criticas,
    alertas,
    informativas,
    descripcionResumen: partes.length > 0 ? partes.join(' y ') + '.' : 'Todo está en orden.',
  }
}
