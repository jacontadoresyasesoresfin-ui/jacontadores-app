/**
 * Formato 1005 — IVA por pagar (IVA descontable en compras)
 * Res. DIAN 000227/2025 — Año gravable 2025
 * ⚠️ Verificar estructura contra el Prevalidador oficial DIAN.
 */
import type { IFormatoExogena, FilaFormato, ColumnaDefinicion, AsientoContable, ExcepcionGenerada } from '../types'
import { RulesEngine } from '../engine/rules-engine'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'
import { buscarMunicipio, DEPARTAMENTOS } from '../config/divipola'

export interface Fila1005 extends FilaFormato {
  tipoDocumento: string
  numeroId: string
  dv: string
  paisCodigo: string
  deptoCodigo: string
  municipioCodigo: string
  primerApellido: string; segundoApellido: string
  primerNombre: string;   otrosNombres: string
  razonSocial: string
  conceptoCodigo: string
  valorCompra: number
  valorIvaDescontable: number
}

export const COLUMNAS_1005: ColumnaDefinicion[] = [
  { campo: 'tipoDocumento',   header: 'Tipo de documento',            ancho: 8,  tipo: 'texto',  obligatorio: true },
  { campo: 'numeroId',        header: 'Número de identificación',     ancho: 22, tipo: 'texto',  obligatorio: true },
  { campo: 'dv',              header: 'DV',                           ancho: 4,  tipo: 'texto',  obligatorio: false },
  { campo: 'paisCodigo',      header: 'País',                         ancho: 6,  tipo: 'texto',  obligatorio: true },
  { campo: 'deptoCodigo',     header: 'Departamento',                 ancho: 6,  tipo: 'texto',  obligatorio: false },
  { campo: 'municipioCodigo', header: 'Municipio',                    ancho: 8,  tipo: 'texto',  obligatorio: false },
  { campo: 'primerApellido',  header: 'Primer apellido',              ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'segundoApellido', header: 'Segundo apellido',             ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'primerNombre',    header: 'Primer nombre',                ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'otrosNombres',    header: 'Otros nombres',                ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'razonSocial',     header: 'Razón social',                 ancho: 60, tipo: 'texto',  obligatorio: false },
  { campo: 'conceptoCodigo',  header: 'Código del concepto',          ancho: 8,  tipo: 'texto',  obligatorio: true },
  { campo: 'valorCompra',     header: 'Valor de las compras',         ancho: 18, tipo: 'moneda', obligatorio: true },
  { campo: 'valorIvaDescontable', header: 'Valor del IVA descontable', ancho: 20, tipo: 'moneda', obligatorio: true },
]

export class Formato1005Strategy implements IFormatoExogena<Fila1005> {
  readonly codigo = '1005'
  readonly version = 'v9'
  readonly nombreOficial = 'Impuesto a las Ventas por Pagar — IVA Descontable'
  readonly columnas = COLUMNAS_1005

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila1005[] {
    const acum = new Map<string, Fila1005>()
    for (const a of asientos) {
      if (a.esSaldoInicial) continue
      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '1005') continue
      if (!a.tercero?.numeroId) continue
      const clave = `${a.tercero.numeroId}|${regla.conceptoCodigo}`
      const fila: Fila1005 = acum.get(clave) ?? this.filaVacia(a, regla.conceptoCodigo)
      fila.valorCompra         += a.monto
      fila.valorIvaDescontable += a.valorIva ?? 0
      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      acum.set(clave, fila)
    }
    return Array.from(acum.values()).filter(f => f.valorIvaDescontable !== 0)
  }

  private filaVacia(a: AsientoContable, concepto: string): Fila1005 {
    const t = a.tercero
    const nombreRaw = t.razonSocial
      ?? [t.primerApellido, t.segundoApellido, t.primerNombre, t.otrosNombres].filter(Boolean).join(' ')
    const esPJ = esPersonaJuridica(nombreRaw)
    const nombres = !esPJ ? parsearNombreColombia(nombreRaw) : null
    const depto = t.deptoCodigo ?? (t.municipioCodigo ? t.municipioCodigo.slice(0, 2) : '')
    const muni  = t.municipioCodigo ?? (t.deptoCodigo ? (buscarMunicipio(DEPARTAMENTOS[t.deptoCodigo] ?? '') ?? '') : '')
    return {
      tipoDocumento:   t.tipoDocumento ?? (esPJ ? '3' : '1'),
      numeroId:        t.numeroId ?? '',
      dv:              t.dv ?? '',
      paisCodigo:      (t.paisCodigo ?? 'CO').toUpperCase(),
      deptoCodigo:     depto,
      municipioCodigo: muni,
      primerApellido:  nombres?.primerApellido  ?? '',
      segundoApellido: nombres?.segundoApellido ?? '',
      primerNombre:    nombres?.primerNombre    ?? '',
      otrosNombres:    nombres?.otrosNombres    ?? '',
      razonSocial:     esPJ ? (t.razonSocial ?? nombreRaw) : '',
      conceptoCodigo:  concepto,
      valorCompra: 0, valorIvaDescontable: 0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }

  validar(filas: Fila1005[]): ExcepcionGenerada[] {
    return filas.filter(f => !f.numeroId).map(f => ({
      fila: f, tipo: 'tercero_sin_identificar', severidad: 'alta' as const,
      descripcion: `Proveedor sin identificación — IVA descontable $${f.valorIvaDescontable.toFixed(0)}`,
      sugerencia: 'Registre el NIT del proveedor.',
    }))
  }

  totalizar(filas: Fila1005[]) {
    return {
      totalFilas:          filas.length,
      totalCompras:        filas.reduce((s, f) => s + f.valorCompra, 0),
      totalIvaDescontable: filas.reduce((s, f) => s + f.valorIvaDescontable, 0),
    }
  }
}
