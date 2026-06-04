/**
 * Formato 1006 v7 — Información de compras
 * Res. DIAN 000227/2025 — Año gravable 2025
 * ⚠️ Verificar estructura contra el Prevalidador oficial DIAN.
 *
 * Umbral de reporte: > 500 UVT por NIT ($24.899.500 a UVT 2025=$49.799)
 * Artículo 631 E.T. — compradores obligados a informar.
 */
import type { IFormatoExogena, FilaFormato, ColumnaDefinicion, AsientoContable, ExcepcionGenerada } from '../types'
import { RulesEngine } from '../engine/rules-engine'
import { UVT_2025 } from '../config/reglas-default-2025'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'
import { buscarMunicipio, DEPARTAMENTOS } from '../config/divipola'

export interface Fila1006 extends FilaFormato {
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
  valorDevolucion: number
  valorDescuento: number
  valorNetoCompra: number
}

export const COLUMNAS_1006: ColumnaDefinicion[] = [
  { campo: 'tipoDocumento',    header: 'Tipo de documento',            ancho: 8,  tipo: 'texto',  obligatorio: true },
  { campo: 'numeroId',         header: 'Número de identificación',     ancho: 22, tipo: 'texto',  obligatorio: true },
  { campo: 'dv',               header: 'DV',                           ancho: 4,  tipo: 'texto',  obligatorio: false },
  { campo: 'paisCodigo',       header: 'País',                         ancho: 6,  tipo: 'texto',  obligatorio: true },
  { campo: 'deptoCodigo',      header: 'Departamento',                 ancho: 6,  tipo: 'texto',  obligatorio: false },
  { campo: 'municipioCodigo',  header: 'Municipio',                    ancho: 8,  tipo: 'texto',  obligatorio: false },
  { campo: 'primerApellido',   header: 'Primer apellido',              ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'segundoApellido',  header: 'Segundo apellido',             ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'primerNombre',     header: 'Primer nombre',                ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'otrosNombres',     header: 'Otros nombres',                ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'razonSocial',      header: 'Razón social',                 ancho: 60, tipo: 'texto',  obligatorio: false },
  { campo: 'conceptoCodigo',   header: 'Código del concepto',          ancho: 8,  tipo: 'texto',  obligatorio: true },
  { campo: 'valorCompra',      header: 'Valor de las compras',         ancho: 18, tipo: 'moneda', obligatorio: true },
  { campo: 'valorDevolucion',  header: 'Valor devoluciones en compras', ancho: 18, tipo: 'moneda', obligatorio: true },
  { campo: 'valorDescuento',   header: 'Valor descuentos en compras',   ancho: 18, tipo: 'moneda', obligatorio: true },
  { campo: 'valorNetoCompra',  header: 'Valor neto de compras',         ancho: 18, tipo: 'moneda', obligatorio: true },
]

const UMBRAL_1006 = 500 * UVT_2025   // 500 UVT en pesos

export class Formato1006Strategy implements IFormatoExogena<Fila1006> {
  readonly codigo = '1006'
  readonly version = 'v7'
  readonly nombreOficial = 'Información de compras'
  readonly columnas = COLUMNAS_1006

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila1006[] {
    const acum = new Map<string, Fila1006>()

    for (const a of asientos) {
      if (a.esSaldoInicial) continue
      // Cuentas 2408x = IVA descontable → pertenecen exclusivamente a F1005, nunca a F1006
      if (a.cuentaPuc.startsWith('2408')) continue
      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '1006') continue
      if (!a.tercero?.numeroId) continue

      const clave = `${a.tercero.numeroId}|${regla.conceptoCodigo}`
      const fila: Fila1006 = acum.get(clave) ?? this.filaVacia(a, regla.conceptoCodigo)

      if (a.naturaleza === 'credito') {
        // Devolución o nota crédito
        fila.valorDevolucion += Math.abs(a.monto)
      } else {
        fila.valorCompra += a.monto
      }

      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      fila._reglaId = regla.id
      acum.set(clave, fila)
    }

    const filasFinales: Fila1006[] = []
    const cuantiasMenoresPorConcepto = new Map<string, Fila1006>()

    for (const f of acum.values()) {
      const neto = f.valorCompra - f.valorDevolucion - f.valorDescuento
      f.valorNetoCompra = neto

      if (neto >= UMBRAL_1006 || f.numeroId === '222222222') {
        if (Math.round(neto) !== 0) {
          filasFinales.push(f)
        }
        continue
      }

      // Cuantías menores
      if (Math.round(neto) === 0) continue
      const cm = cuantiasMenoresPorConcepto.get(f.conceptoCodigo) ?? this.filaVaciaGenericaCM(f.conceptoCodigo)
      cm.valorCompra += f.valorCompra
      cm.valorDevolucion += f.valorDevolucion
      cm.valorDescuento += f.valorDescuento
      cm.valorNetoCompra += neto
      cuantiasMenoresPorConcepto.set(f.conceptoCodigo, cm)
    }

    for (const cm of cuantiasMenoresPorConcepto.values()) {
      if (Math.round(cm.valorNetoCompra) !== 0) filasFinales.push(cm)
    }

    return filasFinales
  }

  validar(filas: Fila1006[]): ExcepcionGenerada[] {
    const excepciones: ExcepcionGenerada[] = []
    for (const f of filas) {
      if (!f.numeroId) {
        excepciones.push({
          fila: f, tipo: 'tercero_sin_identificar', severidad: 'alta',
          descripcion: `Proveedor sin NIT — compras netas $${fmt(f.valorNetoCompra)}`,
          sugerencia: 'Registre el NIT del proveedor para que la compra sea reportada.',
        })
      }
      if (f.valorNetoCompra < 0) {
        excepciones.push({
          fila: f, tipo: 'compra_negativa', severidad: 'media',
          descripcion: `Compra neta negativa para ${f.razonSocial || f.numeroId}: $${fmt(f.valorNetoCompra)}`,
          valorInvolucrado: f.valorNetoCompra,
          sugerencia: 'Verifique que las devoluciones no superen las compras brutas.',
        })
      }
    }
    return excepciones
  }

  totalizar(filas: Fila1006[]) {
    return {
      totalFilas:          filas.length,
      totalCompras:        filas.reduce((s, f) => s + f.valorCompra,     0),
      totalDevoluciones:   filas.reduce((s, f) => s + f.valorDevolucion, 0),
      totalDescuentos:     filas.reduce((s, f) => s + f.valorDescuento,  0),
      totalNetaCompras:    filas.reduce((s, f) => s + f.valorNetoCompra, 0),
    }
  }

  private filaVacia(a: AsientoContable, concepto: string): Fila1006 {
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
      valorCompra: 0, valorDevolucion: 0, valorDescuento: 0, valorNetoCompra: 0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }

  private filaVaciaGenericaCM(concepto: string): Fila1006 {
    return {
      tipoDocumento:   '3',
      numeroId:        '222222222',
      dv:              '7',
      paisCodigo:      'CO',
      deptoCodigo:     '',
      municipioCodigo: '',
      primerApellido:  '',
      segundoApellido: '',
      primerNombre:    '',
      otrosNombres:    '',
      razonSocial:     'CUANTIAS MENORES',
      conceptoCodigo:  concepto,
      valorCompra: 0, valorDevolucion: 0, valorDescuento: 0, valorNetoCompra: 0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}
