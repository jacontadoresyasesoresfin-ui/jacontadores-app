/**
 * Tipos base del módulo Exógenas Automatizadas v1
 * Normativa: Resolución DIAN 000227/2025 (RUMT) + 000233/2025
 * Año gravable 2025 — presentación 2026
 */

// ─── Tipos de documento (tabla oficial DIAN) ──────────────────────────────
export type TipoDocumentoDIAN =
  | '1'   // Cédula de ciudadanía
  | '2'   // Cédula de extranjería
  | '3'   // NIT
  | '4'   // Tarjeta de identidad
  | '5'   // Pasaporte
  | '6'   // Tarjeta de extranjería
  | '7'   // PEP (Permiso Especial de Permanencia)
  | '8'   // NI (Número de Identificación Extranjero)
  | '9'   // NUIP
  | '11'  // Registro civil
  | '12'  // Documento de identificación extranjero
  | '13'  // Documento extranjero
  | '14'  // Carnet de afiliado

// ─── Tipo de declarante ───────────────────────────────────────────────────
export type TipoDeclarante =
  | 'contribuyente'
  | 'gran_contribuyente'
  | 'autoretenedor'
  | 'agente_retenedor'

// ─── Tipo de tercero (para reglas de mapeo) ───────────────────────────────
export type TipoTercero =
  | 'persona_natural'
  | 'persona_juridica'
  | 'exterior'

// ─── Severidad de excepción ───────────────────────────────────────────────
export type Severidad = 'alta' | 'media' | 'baja'

// ─── Estado de proceso ────────────────────────────────────────────────────
export type EstadoProceso =
  | 'borrador'
  | 'procesando'
  | 'revision'
  | 'aprobado'
  | 'exportado'
  | 'anulado'

// ─── Tercero informado ────────────────────────────────────────────────────
export interface TerceroExogena {
  tipoDocumento: TipoDocumentoDIAN
  numeroId: string
  dv?: string
  paisCodigo: string          // ISO 3166-1 alpha-2 per DIAN (CO, US, etc.)
  deptoCodigo?: string        // DIVIPOLA 2 dígitos
  municipioCodigo?: string    // DIVIPOLA 5 dígitos
  primerApellido?: string
  segundoApellido?: string
  primerNombre?: string
  otrosNombres?: string
  razonSocial?: string
  tipoTercero?: TipoTercero
  correo?: string
  telefono?: string
  direccion?: string
}

// ─── Asiento contable (insumo del motor) ─────────────────────────────────
export interface AsientoContable {
  id: string
  fecha: string               // YYYY-MM-DD
  cuentaPuc: string           // Cuenta PUC del movimiento
  nombreCuenta?: string
  naturaleza: 'debito' | 'credito'
  monto: number               // Valor absoluto en COP
  tercero: TerceroExogena
  valorIva?: number
  retefuente?: number
  retefuenteAsumida?: number  // retención que el pagador asume por el beneficiario
  reteIva?: number
  reteIvaNoResidentes?: number // retención IVA a proveedores del exterior
  reteIca?: number
  documentoId?: string        // CUFE, ID Siigo, referencia interna
  descripcion?: string
  tipoDocSoporte?: string
}

// ─── Regla de mapeo (motor declarativo) ──────────────────────────────────
export interface ReglaMapeo {
  id?: string
  formatoCodigo: string
  cuentaPucPatron: string     // '5120', '51%', '5120-5199'
  conceptoCodigo: string
  prioridad: number           // menor = mayor prioridad
  tipoTercero?: TipoTercero
  naturaleza?: 'debito' | 'credito'
  montoMinimo?: number
  incluyeRetencion?: boolean
  deducible?: boolean         // false = gasto no deducible Art. 107 E.T. (default true)
  activo?: boolean
  notas?: string
}

// ─── Contexto para evaluar condiciones de reglas ──────────────────────────
export interface ContextoAsiento {
  monto: number
  tipoTercero?: TipoTercero
  naturaleza: 'debito' | 'credito'
  tieneRetencion: boolean
}

// ─── Fila base de cualquier formato ──────────────────────────────────────
export interface FilaFormato {
  _filaId?: string
  _documentosIds?: string[]
  _cuentasOrigen?: string[]
  _reglaId?: string
  _estadoFila?: 'ok' | 'excepcion' | 'corregido' | 'omitido' | 'manual'
  _excepcionTipo?: string
  [key: string]: unknown
}

// ─── Excepción generada por validación ───────────────────────────────────
export interface ExcepcionGenerada {
  fila?: FilaFormato
  filaId?: string
  formatoCodigo?: string
  tipo: string
  severidad: Severidad
  descripcion: string
  valorInvolucrado?: number
  sugerencia?: string
  documentosRefs?: string[]
}

// ─── Definición de columna del prevalidador ───────────────────────────────
export interface ColumnaDefinicion {
  campo: string
  header: string              // Nombre exacto en el prevalidador DIAN
  ancho: number               // Ancho de columna Excel
  tipo: 'texto' | 'moneda' | 'entero' | 'fecha'
  obligatorio: boolean
  validar?: (valor: unknown) => boolean
  transformar?: (valor: unknown) => unknown
}

// ─── Contrato de cualquier formato exógena ────────────────────────────────
export interface IFormatoExogena<T extends FilaFormato> {
  readonly codigo: string
  readonly version: string
  readonly nombreOficial: string
  readonly columnas: ColumnaDefinicion[]
  transformar(asientos: AsientoContable[], reglas: import('./engine/rules-engine').RulesEngine): T[]
  validar(filas: T[]): ExcepcionGenerada[]
  totalizar(filas: T[]): Record<string, number>
}

// ─── Resultado de una transformación ─────────────────────────────────────
export interface ResultadoTransformacion<T extends FilaFormato> {
  formatoCodigo: string
  filas: T[]
  excepciones: ExcepcionGenerada[]
  totales: Record<string, number>
  cuentasSinRegla: string[]
}

// ─── Configuración del declarante ────────────────────────────────────────
export interface ConfigExogena {
  anioGravable: number
  nitDeclarante: string
  dvDeclarante?: string
  razonSocial: string
  tipoDeclarante: TipoDeclarante
  municipioCodigo: string
  formatos: string[]
}

// ─── Línea de reconciliación ─────────────────────────────────────────────
export interface LineaReconciliacion {
  formatoCodigo: string
  conceptoCodigo?: string
  cuentaPucRef?: string
  descripcion: string
  montoGenerado: number
  montoContable: number
  diferencia: number
  porcentajeDiff: number
  estado: 'ok' | 'alerta' | 'critico'
}

// ─── Parámetros para generar proceso ─────────────────────────────────────
export interface ParametrosGeneracion {
  periodoInicio: string        // YYYY-MM-DD
  periodoFin: string
  formatos: string[]
  umbralAlerta: number         // % diferencia para alertar (default 1%)
  umbralCritico: number        // % diferencia para crítico (default 5%)
  incluirOperacionesExentas: boolean
  montoMinimoInformar: number  // UVT base para algunos conceptos
}
