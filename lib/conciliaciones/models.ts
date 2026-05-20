/**
 * Modelos de datos para el módulo de conciliaciones bancarias.
 * Normatividad DIAN vigente mayo 2026.
 */

// ─── ENUMERACIONES ────────────────────────────────────────────────────────────

export type EstadoConciliacion =
  | 'conciliado'
  | 'no_conciliado'
  | 'parcial'
  | 'revision'
  | 'excluido'

export type TipoMovimiento = 'credito' | 'debito'

export type SeveridadDiscrepancia = 'alta' | 'media' | 'baja'

export type TipoDocumentoDIAN =
  | '01'  // Factura de venta
  | '02'  // Factura de exportación
  | '03'  // Factura por contingencia
  | '05'  // Documento soporte
  | '91'  // Nota débito
  | '92'  // Nota crédito
  | '96'  // Documento equivalente

// ─── MOVIMIENTO BANCARIO ──────────────────────────────────────────────────────

export interface MovimientoBancario {
  id: string
  fecha: string                  // ISO: YYYY-MM-DD
  descripcion: string
  referencia?: string
  tipo: TipoMovimiento
  monto: number                  // Siempre positivo
  saldo?: number
  banco: string
  cuenta?: string
  estado: EstadoConciliacion
  matchIds: string[]
  confianzaMatch: number
  notas?: string
}

// ─── FACTURA ELECTRÓNICA DIAN ─────────────────────────────────────────────────

export interface ImpuestoDetalle {
  nombre: string                 // "IVA", "ReteFuente", "ReteICA", "ReteIVA"
  tarifaPct: number              // 19, 5, 2.5, etc.
  baseGravable: number
  valor: number
}

export interface ItemFactura {
  linea: number
  codigo?: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  descuento: number
  subtotal: number
  tarifaIva: number              // 19, 5, 0
  valorIva: number
  totalLinea: number
}

export interface FacturaElectronica {
  cufe: string
  numero: string
  tipoDocumento: TipoDocumentoDIAN
  fechaEmision: string           // ISO
  fechaVencimiento?: string
  nitEmisor: string
  nombreEmisor: string
  municipioEmisor?: string
  nitReceptor: string
  nombreReceptor: string
  moneda: string
  subtotal: number
  descuentoTotal: number
  baseGravable: number
  impuestos: ImpuestoDetalle[]
  retenciones: ImpuestoDetalle[]
  total: number
  items: ItemFactura[]
  esNota: boolean
  cufeReferenciado?: string
  numeroReferenciado?: string
  razonNota?: string
  estadoDian: string
  xmlPath?: string
  estado: EstadoConciliacion
  matchIds: string[]
  confianzaMatch: number
  notas?: string
}

// ─── MOVIMIENTO SIIGO ─────────────────────────────────────────────────────────

export interface MovimientoSiigo {
  id: string
  tipoExportacion: string        // "factura_venta" | "cartera" | "cxp" | "movimiento"
  fecha: string
  numeroDocumento?: string
  tipoDocumento?: string
  nitTercero?: string
  nombreTercero?: string
  cuentaContable?: string
  descripcion?: string
  debito: number
  credito: number
  monto: number
  iva: number
  retefuente: number
  reteica: number
  saldo?: number
  estado: EstadoConciliacion
  matchIds: string[]
  confianzaMatch: number
}

// ─── RESULTADO DE MATCH ───────────────────────────────────────────────────────

export interface ResultadoMatch {
  idMatch: string
  idsBanco: string[]
  idsFacturas: string[]
  idsSiigo: string[]
  tipoMatch: 'exacto' | 'fuzzy' | 'manual'
  confianza: number
  montoBanco: number
  montoFactura: number
  diferenciaMonto: number
  diferenciaDias: number
  fechaMatch: string
  esPagoParcial: boolean
  esPagoAgrupado: boolean
  observaciones?: string
}

// ─── DISCREPANCIAS ────────────────────────────────────────────────────────────

export interface Discrepancia {
  id: string
  tipo: string
  severidad: SeveridadDiscrepancia
  descripcion: string
  montoInvolucrado?: number
  idsRelacionados: string[]
  recomendacion: string
  fechaDeteccion: string
}

// ─── RESÚMENES TRIBUTARIOS ────────────────────────────────────────────────────

export interface LineaIVA {
  tipo: 'generado' | 'descontable'
  tarifa: string
  numFacturas: number
  baseGravable: number
  valorIva: number
}

export interface ResumenIVA {
  periodo: string
  nitEmpresa: string
  lineasGenerado: LineaIVA[]
  totalBaseVentas: number
  totalIvaGenerado: number
  lineasDescontable: LineaIVA[]
  totalBaseCompras: number
  totalIvaDescontable: number
  saldoAPagar: number
  saldoAFavor: number
  ivaBimestral: number
  ivaCuatrimestral: number
}

export interface ConceptoRetefuente {
  codigoConcepto: string
  nombre: string
  tarifaPct: number
  baseMinimaUvt: number
  baseMinimaCop: number
  basePracticada: number
  valorPracticado: number
  numTransPracticadas: number
  baseSufrida: number
  valorSufrido: number
  numTransSufridas: number
}

export interface ResumenRetefuente {
  periodo: string
  nitEmpresa: string
  uvtVigente: number
  conceptos: ConceptoRetefuente[]
  totalPracticado: number
  totalSufrido: number
  saldoNeto: number
}

export interface ActividadICA {
  ciiu: string
  descripcion: string
  municipio: string
  tarifaPorMil: number
  baseGravable: number
  impuestoEstimado: number
  numFacturas: number
}

export interface ResumenICA {
  periodo: string
  nitEmpresa: string
  municipio: string
  actividades: ActividadICA[]
  totalIngresosBrutos: number
  totalBaseGravable: number
  totalIngresosExcluidos: number
  totalImpuestoEstimado: number
}

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

export interface ConfiguracionConciliacion {
  periodoInicio: string
  periodoFin: string
  nitEmpresa: string
  nombreEmpresa: string
  banco: string
  numeroCuenta?: string
  municipioIca: string
  ciuuPrincipal?: string
  toleranciaMontosPct: number    // 0.001 = 0.1%
  toleranciaDias: number
  umbralConfianzaMin: number     // 0.50
  incluirNotasCredito: boolean
  calcularIva: boolean
  calcularRfte: boolean
  calcularIca: boolean
}

// ─── RESULTADO COMPLETO ───────────────────────────────────────────────────────

export interface KpisConciliacion {
  totalBancoCreditos: number
  totalBancoDebitos: number
  totalFacturasVentas: number
  numBancoConciliados: number
  numBancoNoConciliados: number
  numFacturasConciliadas: number
  numFacturasNoConciliadas: number
  porcentajeConciliadoBanco: number
  porcentajeConciliadoFacturas: number
}

export interface ResultadoConciliacion {
  config: ConfiguracionConciliacion
  fechaProceso: string
  version: string
  movimientosBanco: MovimientoBancario[]
  facturasDian: FacturaElectronica[]
  movimientosSiigo: MovimientoSiigo[]
  matches: ResultadoMatch[]
  discrepancias: Discrepancia[]
  resumenIva?: ResumenIVA
  resumenRetefuente?: ResumenRetefuente
  resumenIca?: ResumenICA
  kpis: KpisConciliacion
  logProceso: string[]
}

// ─── FORMATOS DE BANCO ────────────────────────────────────────────────────────

export interface FormatoBanco {
  nombre: string
  colFecha: string
  colDescripcion: string
  colReferencia?: string
  colDebito?: string
  colCredito?: string
  colSaldo?: string
  colMonto?: string             // Para bancos con una sola columna de monto
  formatoFecha: string
  filasEncabezado: number
}
