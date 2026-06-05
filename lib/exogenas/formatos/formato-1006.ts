/**
 * Formato 1006 v7 — Impuesto a las Ventas por Pagar (Generado) e Impuesto al Consumo
 * Res. DIAN 000227/2025 + 000233/2025 — Año gravable 2025
 *
 * Fuente de datos: cuenta 240805xx crédito (IVA cobrado en ventas)
 *   - 24080501 crédito: IVA 19% generado en ventas
 *   - 24080502 crédito: IVA  5% generado en ventas
 *   - 240810xx crédito: IVA recuperado en devoluciones de compras anuladas
 *
 * NO incluir: 240801xx (IVA descontable → va a F1005)
 *
 * Columnas DIAN v7 (sin País/Departamento/Municipio/Concepto):
 *   TipoDoc | NIT | DV | Apellidos | Nombres | RazonSocial |
 *   ImpuestoGenerado | IVARecuperadoEnDevoluciones | ImpNacionalConsumo
 */
import type { IFormatoExogena, FilaFormato, ColumnaDefinicion, AsientoContable, ExcepcionGenerada } from '../types'
import { RulesEngine } from '../engine/rules-engine'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'

export interface Fila1006 extends FilaFormato {
  tipoDocumento:               string
  numeroId:                    string
  dv:                          string
  primerApellido:              string
  segundoApellido:             string
  primerNombre:                string
  otrosNombres:                string
  razonSocial:                 string
  impuestoGenerado:            number   // IVA cobrado en ventas a este tercero
  ivaRecuperadoEnDevoluciones: number   // IVA recuperado en compras anuladas
  impuestoNacionalAlConsumo:   number   // INC (0 en la mayoría de los casos)
}

export const COLUMNAS_1006: ColumnaDefinicion[] = [
  { campo: 'tipoDocumento',               header: 'Tipo de documento',                                                               ancho: 8,  tipo: 'texto',  obligatorio: true  },
  { campo: 'numeroId',                    header: 'Número de identificación',                                                        ancho: 22, tipo: 'texto',  obligatorio: true  },
  { campo: 'dv',                          header: 'Dígito de Verificación',                                                          ancho: 4,  tipo: 'texto',  obligatorio: false },
  { campo: 'primerApellido',              header: 'Primer apellido del informado',                                                   ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'segundoApellido',             header: 'Segundo apellido del informado',                                                  ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'primerNombre',               header: 'Primer nombre del informado',                                                     ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'otrosNombres',               header: 'Otros nombres del informado',                                                     ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'razonSocial',                header: 'Razón social',                                                                    ancho: 60, tipo: 'texto',  obligatorio: false },
  { campo: 'impuestoGenerado',            header: 'Impuesto generado',                                                               ancho: 20, tipo: 'moneda', obligatorio: true  },
  { campo: 'ivaRecuperadoEnDevoluciones', header: 'IVA recuperado en devoluciones en compras anuladas, rescindidas o resueltas',     ancho: 30, tipo: 'moneda', obligatorio: true  },
  { campo: 'impuestoNacionalAlConsumo',   header: 'Impuesto nacional al consumo',                                                    ancho: 20, tipo: 'moneda', obligatorio: true  },
]

// NIT genérico para terceros sin identificar o consumidor final
const NIT_CONSUMIDOR_FINAL = '222222222'

export class Formato1006Strategy implements IFormatoExogena<Fila1006> {
  readonly codigo        = '1006'
  readonly version       = 'v7'
  readonly nombreOficial = 'Impuesto a las Ventas por Pagar — IVA Generado'
  readonly columnas      = COLUMNAS_1006

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila1006[] {
    const acum = new Map<string, Fila1006>()

    for (const a of asientos) {
      if (a.esSaldoInicial) continue

      // Solo procesar cuentas 240805xx y 240810xx
      // 240801xx (IVA descontable) y 240815xx/240820xx van exclusivamente a F1005
      const cta = a.cuentaPuc
      const es240805 = cta.startsWith('240805') || cta.startsWith('24080501') || cta.startsWith('24080502')
      const es240810 = cta.startsWith('240810')
      if (!es240805 && !es240810) continue

      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '1006') continue

      // Usar NIT del tercero o consumidor final si no hay NIT específico
      const nit = a.tercero?.numeroId?.replace(/\D/g, '') || NIT_CONSUMIDOR_FINAL
      const clave = nit

      const fila: Fila1006 = acum.get(clave) ?? this.filaVacia(a, nit)

      if (es240805) {
        if (a.naturaleza === 'credito') {
          // Crédito en 240805 = IVA cobrado en ventas
          fila.impuestoGenerado += a.monto
        } else {
          // Débito en 240805 = ajuste/nota débito al IVA generado
          fila.ivaRecuperadoEnDevoluciones += a.monto
        }
      } else if (es240810 && a.naturaleza === 'credito') {
        // Crédito en 240810 = IVA descontable por compras anuladas (recuperado)
        fila.ivaRecuperadoEnDevoluciones += a.monto
      }

      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      fila._reglaId = regla.id
      acum.set(clave, fila)
    }

    return Array.from(acum.values()).filter(f =>
      f.impuestoGenerado !== 0 ||
      f.ivaRecuperadoEnDevoluciones !== 0 ||
      f.impuestoNacionalAlConsumo !== 0
    )
  }

  validar(filas: Fila1006[]): ExcepcionGenerada[] {
    const excepciones: ExcepcionGenerada[] = []
    for (const f of filas) {
      if (!f.numeroId) {
        excepciones.push({
          fila: f, tipo: 'tercero_sin_identificar', severidad: 'media',
          descripcion: `IVA generado sin NIT de cliente — ${fmt(f.impuestoGenerado)}`,
          valorInvolucrado: f.impuestoGenerado,
          sugerencia: 'Verifique que la cuenta 240805 tenga el NIT del cliente en el Libro Auxiliar de Siigo.',
        })
      }
      if (f.impuestoGenerado < 0) {
        excepciones.push({
          fila: f, tipo: 'iva_generado_negativo', severidad: 'media',
          descripcion: `IVA generado negativo para ${f.razonSocial || f.numeroId}: ${fmt(f.impuestoGenerado)}`,
          valorInvolucrado: f.impuestoGenerado,
          sugerencia: 'Verifique que las notas débito de ventas no superen el IVA generado bruto.',
        })
      }
    }
    return excepciones
  }

  totalizar(filas: Fila1006[]) {
    return {
      totalFilas:                    filas.length,
      totalIvaGenerado:              filas.reduce((s, f) => s + f.impuestoGenerado,            0),
      totalIvaRecuperadoDevoluciones: filas.reduce((s, f) => s + f.ivaRecuperadoEnDevoluciones, 0),
      totalImpConsumo:               filas.reduce((s, f) => s + f.impuestoNacionalAlConsumo,    0),
    }
  }

  private filaVacia(a: AsientoContable, nitEfectivo: string): Fila1006 {
    // Si el NIT es genérico, crear entrada de consumidor final
    if (nitEfectivo === NIT_CONSUMIDOR_FINAL) {
      return {
        tipoDocumento: '13', numeroId: NIT_CONSUMIDOR_FINAL, dv: '',
        primerApellido: 'CONSUMIDOR', segundoApellido: '', primerNombre: 'FINAL', otrosNombres: '',
        razonSocial: '',
        impuestoGenerado: 0, ivaRecuperadoEnDevoluciones: 0, impuestoNacionalAlConsumo: 0,
        _documentosIds: [], _cuentasOrigen: [],
      }
    }

    const t = a.tercero
    const nombreRaw = t?.razonSocial
      ?? [t?.primerApellido, t?.segundoApellido, t?.primerNombre, t?.otrosNombres].filter(Boolean).join(' ')
      ?? ''
    const esPJ = esPersonaJuridica(nombreRaw)
    const nombres = !esPJ ? parsearNombreColombia(nombreRaw) : null

    return {
      tipoDocumento:               t?.tipoDocumento ?? (esPJ ? '3' : '13'),
      numeroId:                    nitEfectivo,
      dv:                          t?.dv ?? '',
      primerApellido:              nombres?.primerApellido  ?? '',
      segundoApellido:             nombres?.segundoApellido ?? '',
      primerNombre:                nombres?.primerNombre    ?? '',
      otrosNombres:                nombres?.otrosNombres    ?? '',
      razonSocial:                 esPJ ? (t?.razonSocial ?? nombreRaw) : '',
      impuestoGenerado:            0,
      ivaRecuperadoEnDevoluciones: 0,
      impuestoNacionalAlConsumo:   0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}
