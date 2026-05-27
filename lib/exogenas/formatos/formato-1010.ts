/**
 * Formato 1010 v7 — Información de socios, accionistas, comuneros, cooperados y asociados
 * Res. DIAN 000227/2025 — Año gravable 2025
 * ⚠️ Verificar estructura contra el Prevalidador oficial DIAN.
 *
 * Reporta terceros con quienes el declarante tiene relaciones económicas:
 * proveedores (ctas 2%), clientes (ctas 13%), empleados (5110%), socios.
 * No tiene umbral mínimo — se informa la totalidad de los terceros.
 */
import type { IFormatoExogena, FilaFormato, ColumnaDefinicion, AsientoContable, ExcepcionGenerada } from '../types'
import { RulesEngine } from '../engine/rules-engine'
import { parsearNombreColombia, esPersonaJuridica } from '../utils/nombre-parser'
import { buscarMunicipio, DEPARTAMENTOS } from '../config/divipola'

export interface Fila1010 extends FilaFormato {
  tipoDocumento: string
  numeroId: string
  dv: string
  paisCodigo: string
  deptoCodigo: string
  municipioCodigo: string
  primerApellido: string; segundoApellido: string
  primerNombre: string;   otrosNombres: string
  razonSocial: string
  conceptoCodigo: string        // proveedor | cliente | empleado | socio
  valorSaldo: number            // Saldo de la cuenta al cierre del período
}

export const COLUMNAS_1010: ColumnaDefinicion[] = [
  { campo: 'tipoDocumento',   header: 'Tipo de documento',          ancho: 8,  tipo: 'texto',  obligatorio: true },
  { campo: 'numeroId',        header: 'Número de identificación',   ancho: 22, tipo: 'texto',  obligatorio: true },
  { campo: 'dv',              header: 'DV',                         ancho: 4,  tipo: 'texto',  obligatorio: false },
  { campo: 'paisCodigo',      header: 'País',                       ancho: 6,  tipo: 'texto',  obligatorio: true },
  { campo: 'deptoCodigo',     header: 'Departamento',               ancho: 6,  tipo: 'texto',  obligatorio: false },
  { campo: 'municipioCodigo', header: 'Municipio',                  ancho: 8,  tipo: 'texto',  obligatorio: false },
  { campo: 'primerApellido',  header: 'Primer apellido',            ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'segundoApellido', header: 'Segundo apellido',           ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'primerNombre',    header: 'Primer nombre',              ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'otrosNombres',    header: 'Otros nombres',              ancho: 20, tipo: 'texto',  obligatorio: false },
  { campo: 'razonSocial',     header: 'Razón social',               ancho: 60, tipo: 'texto',  obligatorio: false },
  { campo: 'conceptoCodigo',  header: 'Código del concepto',        ancho: 8,  tipo: 'texto',  obligatorio: true },
  { campo: 'valorSaldo',      header: 'Valor del saldo',            ancho: 18, tipo: 'moneda', obligatorio: true },
]

export class Formato1010Strategy implements IFormatoExogena<Fila1010> {
  readonly codigo = '1010'
  readonly version = 'v7'
  readonly nombreOficial = 'Socios, accionistas, comuneros, cooperados y asociados'
  readonly columnas = COLUMNAS_1010

  transformar(asientos: AsientoContable[], reglas: RulesEngine): Fila1010[] {
    const acum = new Map<string, Fila1010>()

    for (const a of asientos) {
      const regla = reglas.resolver(a)
      if (!regla || regla.formatoCodigo !== '1010') continue
      if (!a.tercero?.numeroId) continue

      const clave = `${a.tercero.numeroId}|${regla.conceptoCodigo}`
      const fila: Fila1010 = acum.get(clave) ?? this.filaVacia(a, regla.conceptoCodigo)

      // Para terceros: acumular movimientos netos del período
      fila.valorSaldo += a.naturaleza === 'debito' ? a.monto : -a.monto
      if (a.documentoId) fila._documentosIds?.push(a.documentoId)
      fila._reglaId = regla.id
      acum.set(clave, fila)
    }

    // Reportar todos los terceros identificados (sin umbral)
    return Array.from(acum.values()).filter(f => f.numeroId && f.valorSaldo !== 0)
  }

  validar(filas: Fila1010[]): ExcepcionGenerada[] {
    const excepciones: ExcepcionGenerada[] = []
    for (const f of filas) {
      if (!f.numeroId || f.numeroId.trim() === '') {
        excepciones.push({
          fila: f, tipo: 'tercero_sin_identificar', severidad: 'alta',
          descripcion: `Tercero sin identificación — concepto ${f.conceptoCodigo}, saldo $${fmt(f.valorSaldo)}`,
          valorInvolucrado: f.valorSaldo,
          sugerencia: 'Identifique al tercero en la contabilidad.',
        })
      }
      if (!f.razonSocial && !f.primerApellido && !f.primerNombre) {
        excepciones.push({
          fila: f, tipo: 'tercero_sin_nombre', severidad: 'baja',
          descripcion: `NIT ${f.numeroId} sin nombre registrado`,
          sugerencia: 'Complete el nombre o razón social del tercero.',
        })
      }
    }
    return excepciones
  }

  totalizar(filas: Fila1010[]) {
    return {
      totalFilas:      filas.length,
      totalProveedores: filas.filter(f => f.conceptoCodigo === 'proveedor').length,
      totalClientes:    filas.filter(f => f.conceptoCodigo === 'cliente').length,
      totalEmpleados:   filas.filter(f => f.conceptoCodigo === 'empleado').length,
      totalSaldo:       filas.reduce((s, f) => s + Math.abs(f.valorSaldo), 0),
    }
  }

  private filaVacia(a: AsientoContable, concepto: string): Fila1010 {
    const t = a.tercero
    const nombreRaw = t.razonSocial
      ?? [t.primerApellido, t.segundoApellido, t.primerNombre, t.otrosNombres].filter(Boolean).join(' ')
    const esPJ = t.tipoDocumento === '3' || esPersonaJuridica(nombreRaw)
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
      valorSaldo: 0,
      _documentosIds: [], _cuentasOrigen: [],
    }
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
}
