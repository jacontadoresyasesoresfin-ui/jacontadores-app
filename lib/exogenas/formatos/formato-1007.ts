/**
 * Formato 1007 v7 — Información de ingresos recibidos
 * Res. DIAN 000227/2025 — Año gravable 2025
 * ⚠️ Verificar estructura contra el Prevalidador oficial DIAN.
 *
 * Umbral: > 500 UVT por tercero ($24.899.500 a UVT 2025=$49.799)
 * Informa lo que el declarante RECIBIÓ (ventas) por cada cliente.
 */
import type { IFormatoExogena, FilaFormato, ColumnaDefinicion, AsientoContable, ExcepcionGenerada } from '../types'
import { RulesEngine } from '../engine/rules-engine'
import { UVT_2025 } from '../config/reglas-default-2025'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'
import { buscarMunicipio, DEPARTAMENTOS } from '../config/divipola'

export interface Fila1007 extends FilaFormato {
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
  valorIngreso: number
  valorDevolucion: number
  valorDescuento: number
  valorNetoIngreso: number
}

export const COLUMNAS_1007: ColumnaDefinicion[] = [
  { campo: 'tipoDocumento',    header: 'Tipo de documento',              ancho: 8,  tipo: 'texto',  obligatorio: true },
  { campo: 'numeroId',         header: 'Número de identificación',       ancho: 22, tipo: 'texto',  obligatorio: true },
  { campo: 'dv',               header: 'DV',                             ancho: 4,  tipo: 'texto',  obligatorio: false },
  { campo: 'paisCodigo',       header: 'País',                           ancho: 6,  tipo: 'texto',  obligatorio: true },
  { campo: 'deptoCodigo',      header: 'Departamento',                   ancho: 6,  tipo: 'texto',  obligatorio: false },
  { campo: 'municipioCodigo',  header: 'Municipio',                      ancho: 8,  tipo: 'texto',  obligatorio: false },
  { campo: 'primerApellido',   header: 'Primer apellido',                ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'segundoApellido',  header: 'Segundo apellido',               ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'primerNombre',     header: 'Primer nombre',                  ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'otrosNombres',     header: 'Otros nombres',                  ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'razonSocial',      header: 'Razón social',                   ancho: 60, tipo: 'texto',  obligatorio: false },
  { campo: 'conceptoCodigo',   header: 'Código del concepto',            ancho: 8,  tipo: 'texto',  obligatorio: true },
  { campo: 'valorIngreso',     header: 'Valor de los ingresos',          ancho: 18, tipo: 'moneda', obligatorio: true },
  { campo: 'valorDevolucion',  header: 'Valor devoluciones en ventas',   ancho: 18, tipo: 'moneda', obligatorio: true },
  { campo: 'valorDescuento',   header: 'Valor descuentos en ventas',     ancho: 18, tipo: 'moneda', obligatorio: true },
  { campo: 'valorNetoIngreso', header: 'Valor neto de los ingresos',     ancho: 18, tipo: 'moneda', obligatorio: true },
]

const UMBRAL_1007 = 500 * UVT_2025

export class Formato1007Strategy implements IFormatoExogena<Fila1007> {
  readonly codigo = '1007'
  readonly version = 'v7'
  readonly nombreOficial = 'Información de ingresos recibidos'
  readonly columnas = COLUMNAS_1007

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila1007[] {
    const acum = new Map<string, Fila1007>()

    for (const a of asientos) {
      if (a.esSaldoInicial) continue
      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '1007') continue
      if (!a.tercero?.numeroId) continue

      const clave = `${a.tercero.numeroId}|${regla.conceptoCodigo}`
      const fila: Fila1007 = acum.get(clave) ?? this.filaVacia(a, regla.conceptoCodigo)

      // Cuentas 41%/42% tienen naturaleza crédito como ingreso normal
      if (a.naturaleza === 'debito') {
        // Nota débito = devolución en ventas
        fila.valorDevolucion += a.monto
      } else {
        fila.valorIngreso += a.monto
      }

      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      fila._reglaId = regla.id
      acum.set(clave, fila)
    }

    const filasFinales: Fila1007[] = []
    const cuantiasMenoresPorConcepto = new Map<string, Fila1007>()

    for (const f of acum.values()) {
      const neto = f.valorIngreso - f.valorDevolucion - f.valorDescuento
      f.valorNetoIngreso = neto

      if (neto >= UMBRAL_1007 || f.numeroId === '222222222') {
        if (Math.round(neto) !== 0) {
          filasFinales.push(f)
        }
        continue
      }

      // Cuantías menores
      if (Math.round(neto) === 0) continue
      const cm = cuantiasMenoresPorConcepto.get(f.conceptoCodigo) ?? this.filaVaciaGenericaCM(f.conceptoCodigo)
      cm.valorIngreso += f.valorIngreso
      cm.valorDevolucion += f.valorDevolucion
      cm.valorDescuento += f.valorDescuento
      cm.valorNetoIngreso += neto
      cuantiasMenoresPorConcepto.set(f.conceptoCodigo, cm)
    }

    for (const cm of cuantiasMenoresPorConcepto.values()) {
      if (Math.round(cm.valorNetoIngreso) !== 0) filasFinales.push(cm)
    }

    return filasFinales
  }

  validar(filas: Fila1007[]): ExcepcionGenerada[] {
    const excepciones: ExcepcionGenerada[] = []
    for (const f of filas) {
      if (!f.numeroId) {
        excepciones.push({
          fila: f, tipo: 'tercero_sin_identificar', severidad: 'alta',
          descripcion: `Cliente sin NIT — ingresos netos $${fmt(f.valorNetoIngreso)}`,
          valorInvolucrado: f.valorNetoIngreso,
          sugerencia: 'Identifique al cliente. Para consumidores finales use documento de identidad.',
        })
      }
      if (f.valorNetoIngreso < 0) {
        excepciones.push({
          fila: f, tipo: 'ingreso_negativo', severidad: 'media',
          descripcion: `Ingreso neto negativo para ${f.razonSocial || f.numeroId}: $${fmt(f.valorNetoIngreso)}`,
          valorInvolucrado: f.valorNetoIngreso,
          sugerencia: 'Verifique que las devoluciones en ventas no superen los ingresos brutos.',
        })
      }
    }
    return excepciones
  }

  totalizar(filas: Fila1007[]) {
    return {
      totalFilas:        filas.length,
      totalIngresos:     filas.reduce((s, f) => s + f.valorIngreso,     0),
      totalDevoluciones: filas.reduce((s, f) => s + f.valorDevolucion,  0),
      totalDescuentos:   filas.reduce((s, f) => s + f.valorDescuento,   0),
      totalNetaIngresos: filas.reduce((s, f) => s + f.valorNetoIngreso, 0),
    }
  }

  private filaVacia(a: AsientoContable, concepto: string): Fila1007 {
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
      valorIngreso: 0, valorDevolucion: 0, valorDescuento: 0, valorNetoIngreso: 0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }

  private filaVaciaGenericaCM(concepto: string): Fila1007 {
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
      valorIngreso: 0, valorDevolucion: 0, valorDescuento: 0, valorNetoIngreso: 0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}
