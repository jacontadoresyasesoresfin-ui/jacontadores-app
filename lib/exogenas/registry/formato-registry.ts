/**
 * FormatoRegistry — Fábrica centralizada de estrategias de formato
 * Res. DIAN 000227/2025 — Año gravable 2025
 *
 * Añadir nuevos formatos aquí y en VERSION_POR_ANIO.
 */
import type { IFormatoExogena, FilaFormato } from '../types'
import { Formato1001Strategy } from '../formatos/formato-1001'
import { Formato1005Strategy } from '../formatos/formato-1005'
import { Formato1006Strategy } from '../formatos/formato-1006'
import { Formato1007Strategy } from '../formatos/formato-1007'
import { Formato1010Strategy } from '../formatos/formato-1010'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFormato = IFormatoExogena<any>

/** Catálogo de formatos disponibles por código */
const FORMATOS: Record<string, () => AnyFormato> = {
  '1001': () => new Formato1001Strategy(),
  '1005': () => new Formato1005Strategy(),
  '1006': () => new Formato1006Strategy(),
  '1007': () => new Formato1007Strategy(),
  '1010': () => new Formato1010Strategy(),
}

/** Versiones vigentes por año gravable */
export const VERSION_POR_ANIO: Record<number, Record<string, string>> = {
  2025: {
    '1001': 'v11',   // Modificado por Res. 000233/2025
    '1005': 'v9',
    '1006': 'v7',
    '1007': 'v7',
    '1010': 'v7',
  },
}

/** Descripción oficial de cada formato */
export const INFO_FORMATOS: Record<string, { nombre: string; descripcion: string; prioridad: number }> = {
  '1001': {
    nombre: 'Pagos o abonos en cuenta y retenciones practicadas',
    descripcion: 'Informa pagos a terceros y retenciones en la fuente, IVA e ICA practicadas.',
    prioridad: 1,
  },
  '1005': {
    nombre: 'Impuesto a las Ventas por Pagar — IVA Descontable',
    descripcion: 'Informa el IVA descontable originado en compras y adquisiciones.',
    prioridad: 2,
  },
  '1006': {
    nombre: 'Información de compras',
    descripcion: 'Detalle de compras de bienes y servicios por tercero (umbral > 500 UVT).',
    prioridad: 3,
  },
  '1007': {
    nombre: 'Información de ingresos recibidos',
    descripcion: 'Detalle de ingresos por cliente (umbral > 500 UVT).',
    prioridad: 4,
  },
  '1010': {
    nombre: 'Socios, accionistas, comuneros, cooperados y asociados',
    descripcion: 'Relación de terceros con quienes se tienen saldos en cuentas de balance.',
    prioridad: 5,
  },
}

export class FormatoRegistry {
  /** Obtiene la estrategia para un código de formato */
  static obtener<T extends FilaFormato>(codigo: string): IFormatoExogena<T> | null {
    const factory = FORMATOS[codigo]
    if (!factory) return null
    return factory() as IFormatoExogena<T>
  }

  /** Lista todos los formatos disponibles con su metadata */
  static listar(): Array<{ codigo: string; nombre: string; descripcion: string; prioridad: number }> {
    return Object.entries(INFO_FORMATOS)
      .sort((a, b) => a[1].prioridad - b[1].prioridad)
      .map(([codigo, info]) => ({ codigo, ...info }))
  }

  /** Verifica si un código de formato está soportado */
  static soporta(codigo: string): boolean {
    return codigo in FORMATOS
  }

  /** Obtiene la versión vigente para un año gravable */
  static version(codigo: string, anioGravable = 2025): string {
    return VERSION_POR_ANIO[anioGravable]?.[codigo] ?? 'v1'
  }
}
