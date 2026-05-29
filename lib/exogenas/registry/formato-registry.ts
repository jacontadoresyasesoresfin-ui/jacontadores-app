/**
 * FormatoRegistry — Fábrica centralizada de estrategias de formato
 * Res. DIAN 000227/2025 — Año gravable 2025
 *
 * Añadir nuevos formatos aquí y en VERSION_POR_ANIO.
 */
import type { IFormatoExogena, FilaFormato } from '../types'
import { Formato1001Strategy } from '../formatos/formato-1001'
import { Formato1003Strategy } from '../formatos/formato-1003'
import { Formato1005Strategy } from '../formatos/formato-1005'
import { Formato1006Strategy } from '../formatos/formato-1006'
import { Formato1007Strategy } from '../formatos/formato-1007'
import { Formato1008Strategy } from '../formatos/formato-1008'
import { Formato1009Strategy } from '../formatos/formato-1009'
import { Formato1010Strategy } from '../formatos/formato-1010'
import { Formato1012Strategy } from '../formatos/formato-1012'
import { Formato2276Strategy } from '../formatos/formato-2276'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFormato = IFormatoExogena<any>

/** Catálogo de formatos disponibles por código */
const FORMATOS: Record<string, () => AnyFormato> = {
  '1001': () => new Formato1001Strategy(),
  '1003': () => new Formato1003Strategy(),
  '1005': () => new Formato1005Strategy(),
  '1006': () => new Formato1006Strategy(),
  '1007': () => new Formato1007Strategy(),
  '1008': () => new Formato1008Strategy(),
  '1009': () => new Formato1009Strategy(),
  '1010': () => new Formato1010Strategy(),
  '1012': () => new Formato1012Strategy(),
  '2276': () => new Formato2276Strategy(),
}

/** Versiones vigentes por año gravable */
export const VERSION_POR_ANIO: Record<number, Record<string, string>> = {
  2025: {
    '1001': 'v11',   // Modificado por Res. 000233/2025
    '1003': 'v8',
    '1005': 'v9',
    '1006': 'v7',
    '1007': 'v7',
    '1008': 'v6',
    '1009': 'v8',
    '1010': 'v7',
    '1012': 'v8',
    '2276': 'v1',
  },
}

/** Descripción oficial de cada formato */
export const INFO_FORMATOS: Record<string, { nombre: string; descripcion: string; prioridad: number }> = {
  '1001': {
    nombre: 'Pagos o abonos en cuenta y retenciones practicadas',
    descripcion: 'Informa pagos a terceros (proveedores, servicios, compras) y retenciones practicadas. Excluye nómina de empleados.',
    prioridad: 1,
  },
  '1003': {
    nombre: 'Retenciones en la fuente practicadas al declarante',
    descripcion: 'Informa las retenciones que clientes y entidades le practicaron durante el año. Fuente: cuentas 1355xx del activo.',
    prioridad: 2,
  },
  '1005': {
    nombre: 'Impuesto a las Ventas por Pagar — IVA Descontable',
    descripcion: 'Informa el IVA descontable originado en compras y adquisiciones. Fuente: cuenta 2408 subcuentas descontable.',
    prioridad: 3,
  },
  '1006': {
    nombre: 'Impuesto a las Ventas por Pagar — IVA Generado',
    descripcion: 'Informa el IVA generado en ventas. Fuente: cuenta 2408 subcuentas generado.',
    prioridad: 4,
  },
  '1007': {
    nombre: 'Información de ingresos recibidos',
    descripcion: 'Detalle de ingresos por cliente superiores a 500 UVT. Fuente: cuentas clase 41 y 42.',
    prioridad: 5,
  },
  '1008': {
    nombre: 'Saldos de cuentas por cobrar a 31 de diciembre',
    descripcion: 'Saldo de deudores al cierre del período. Fuente: cuentas clase 13 (clientes, retenciones a favor).',
    prioridad: 6,
  },
  '1009': {
    nombre: 'Saldos de cuentas por pagar a 31 de diciembre',
    descripcion: 'Saldo de acreedores al cierre del período. Fuente: cuentas clases 22, 23 y 25 (proveedores, nómina, retenciones).',
    prioridad: 7,
  },
  '1010': {
    nombre: 'Socios, accionistas, comuneros, cooperados y asociados',
    descripcion: 'Relación de socios con su participación en el capital social. Fuente: cuentas clase 31.',
    prioridad: 8,
  },
  '1012': {
    nombre: 'Saldos en cuentas bancarias, inversiones y fondos',
    descripcion: 'Saldos al 31-dic en cuentas bancarias (corriente/ahorro), CDT, fondos de inversión y acciones. Fuente: cuentas grupos 11 (efectivo) y 12 (inversiones).',
    prioridad: 9,
  },
  '2276': {
    nombre: 'Información de pagos laborales (Nómina)',
    descripcion: 'Informa pagos a empleados con contrato laboral: sueldos, prima, cesantías, vacaciones y aportes. Cuentas PUC 511x.',
    prioridad: 9,
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
