/**
 * Formato 1005 v9 — Impuesto a las Ventas por Pagar (Descontable)
 * Res. DIAN 000227/2025 + 000233/2025 — Año gravable 2025
 *
 * Fuente de datos: cuenta 240801xx débito (IVA pagado en compras)
 *   - 24080101 débito: IVA 19% pagado en compras
 *   - 24080102 débito: IVA  5% pagado en compras
 *   - 240815xx débito: IVA descontable por servicios
 *   - 240820xx débito: IVA descontable por devoluciones
 *   - 240801xx crédito: IVA devuelto en devoluciones de ventas anuladas
 *
 * NO incluir: 240805xx (IVA generado → va a F1006)
 *
 * Columnas DIAN v9 (sin País/Departamento/Municipio/Concepto):
 *   TipoDoc | NIT | DV | Apellidos | Nombres | RazonSocial |
 *   ImpuestoDescontable | IVAResultanteDevoluciones
 */
import type { IFormatoExogena, FilaFormato, ColumnaDefinicion, AsientoContable, ExcepcionGenerada } from '../types'
import { RulesEngine } from '../engine/rules-engine'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'

export interface Fila1005 extends FilaFormato {
  tipoDocumento:              string
  numeroId:                   string
  dv:                         string
  primerApellido:             string
  segundoApellido:            string
  primerNombre:               string
  otrosNombres:               string
  razonSocial:                string
  impuestoDescontable:        number   // IVA pagado en compras (240801 débito)
  ivaResultanteDevoluciones:  number   // IVA devuelto por ventas anuladas (240801 crédito)
}

export const COLUMNAS_1005: ColumnaDefinicion[] = [
  { campo: 'tipoDocumento',             header: 'Tipo de documento',                                                                ancho: 8,  tipo: 'texto',  obligatorio: true  },
  { campo: 'numeroId',                  header: 'Número de identificación',                                                         ancho: 22, tipo: 'texto',  obligatorio: true  },
  { campo: 'dv',                        header: 'Dígito de Verificación',                                                           ancho: 4,  tipo: 'texto',  obligatorio: false },
  { campo: 'primerApellido',            header: 'Primer apellido del informado',                                                    ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'segundoApellido',           header: 'Segundo apellido del informado',                                                   ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'primerNombre',              header: 'Primer nombre del informado',                                                      ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'otrosNombres',              header: 'Otros nombres del informado',                                                      ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'razonSocial',               header: 'Razón social',                                                                     ancho: 60, tipo: 'texto',  obligatorio: false },
  { campo: 'impuestoDescontable',       header: 'Impuesto descontable',                                                             ancho: 20, tipo: 'moneda', obligatorio: true  },
  { campo: 'ivaResultanteDevoluciones', header: 'IVA resultante por devoluciones en ventas anuladas, rescindidas o resueltas',      ancho: 30, tipo: 'moneda', obligatorio: true  },
]

export class Formato1005Strategy implements IFormatoExogena<Fila1005> {
  readonly codigo        = '1005'
  readonly version       = 'v9'
  readonly nombreOficial = 'Impuesto a las Ventas por Pagar — IVA Descontable'
  readonly columnas      = COLUMNAS_1005

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila1005[] {
    const acum = new Map<string, Fila1005>()

    for (const a of asientos) {
      if (a.esSaldoInicial) continue

      // Rechazar explícitamente 240805xx — esas cuentas son IVA Generado (→ F1006)
      if (a.cuentaPuc.startsWith('240805')) continue

      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '1005') continue
      if (!a.tercero?.numeroId) continue

      const clave = a.tercero.numeroId
      const fila: Fila1005 = acum.get(clave) ?? this.filaVacia(a)

      if (a.naturaleza === 'debito') {
        // Débito en 240801xx/240815xx/240820xx = IVA pagado en compras
        fila.impuestoDescontable += a.monto
      } else {
        // Crédito en 240801xx = IVA devuelto (ventas anuladas/devueltas)
        fila.ivaResultanteDevoluciones += a.monto
      }

      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      fila._reglaId = regla.id
      acum.set(clave, fila)
    }

    return Array.from(acum.values()).filter(f =>
      f.impuestoDescontable !== 0 || f.ivaResultanteDevoluciones !== 0
    )
  }

  validar(filas: Fila1005[]): ExcepcionGenerada[] {
    const excepciones: ExcepcionGenerada[] = []
    for (const f of filas) {
      if (!f.numeroId) {
        excepciones.push({
          fila: f, tipo: 'tercero_sin_identificar', severidad: 'alta',
          descripcion: `Proveedor sin NIT — IVA descontable ${fmt(f.impuestoDescontable)}`,
          sugerencia: 'Registre el NIT del proveedor en Siigo.',
        })
      }
      if (f.impuestoDescontable < 0) {
        excepciones.push({
          fila: f, tipo: 'iva_descontable_negativo', severidad: 'media',
          descripcion: `IVA descontable negativo para ${f.razonSocial || f.numeroId}: ${fmt(f.impuestoDescontable)}`,
          valorInvolucrado: f.impuestoDescontable,
          sugerencia: 'Verifique que las devoluciones de compras no superen el IVA bruto de ese proveedor.',
        })
      }
    }
    return excepciones
  }

  totalizar(filas: Fila1005[]) {
    return {
      totalFilas:                   filas.length,
      totalIvaDescontable:          filas.reduce((s, f) => s + f.impuestoDescontable,       0),
      totalIvaResultanteDevoluciones: filas.reduce((s, f) => s + f.ivaResultanteDevoluciones, 0),
    }
  }

  private filaVacia(a: AsientoContable): Fila1005 {
    const t = a.tercero
    const nombreRaw = t.razonSocial
      ?? [t.primerApellido, t.segundoApellido, t.primerNombre, t.otrosNombres].filter(Boolean).join(' ')
    const esPJ = esPersonaJuridica(nombreRaw)
    const nombres = !esPJ ? parsearNombreColombia(nombreRaw) : null

    return {
      tipoDocumento:             t.tipoDocumento ?? (esPJ ? '3' : '1'),
      numeroId:                  t.numeroId ?? '',
      dv:                        t.dv ?? '',
      primerApellido:            nombres?.primerApellido  ?? '',
      segundoApellido:           nombres?.segundoApellido ?? '',
      primerNombre:              nombres?.primerNombre    ?? '',
      otrosNombres:              nombres?.otrosNombres    ?? '',
      razonSocial:               esPJ ? (t.razonSocial ?? nombreRaw) : '',
      impuestoDescontable:       0,
      ivaResultanteDevoluciones: 0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}
