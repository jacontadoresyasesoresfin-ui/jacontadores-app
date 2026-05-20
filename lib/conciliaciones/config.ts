/**
 * Configuración y normatividad DIAN vigente a mayo 2026.
 */

// ─── UVT 2026 ─────────────────────────────────────────────────────────────────
// Resolución DIAN 000238 de 2025
export const UVT_2026 = 52_374

// ─── CONCEPTOS DE RETEFUENTE ──────────────────────────────────────────────────
// Decreto 1625/2016 + Comunicado DIAN No. 070/2026
// (restablece tarifas previas al Decreto 572/2025 desde el 8 de mayo de 2026)

export interface ConceptoRteConfig {
  nombre: string
  tarifa: number       // decimal: 0.025 = 2.5%
  baseUvt: number      // UVTs mínimos para aplicar retención
  codigoFormato1001: string
  palabrasClave: string[]
}

export const CONCEPTOS_RETEFUENTE: Record<string, ConceptoRteConfig> = {
  compras_generales: {
    nombre: 'Compras generales (bienes)',
    tarifa: 0.025,
    baseUvt: 27,
    codigoFormato1001: '5001',
    palabrasClave: ['compra', 'mercancía', 'producto', 'inventario', 'suministro', 'bien'],
  },
  honorarios_pn: {
    nombre: 'Honorarios — Persona Natural (sin declaración)',
    tarifa: 0.10,
    baseUvt: 0,
    codigoFormato1001: '5002',
    palabrasClave: ['honorario', 'consultoría', 'asesoría', 'profesional'],
  },
  honorarios_pj: {
    nombre: 'Honorarios — Persona Jurídica',
    tarifa: 0.11,
    baseUvt: 0,
    codigoFormato1001: '5002',
    palabrasClave: ['honorario'],
  },
  servicios_generales: {
    nombre: 'Servicios generales',
    tarifa: 0.04,
    baseUvt: 4,
    codigoFormato1001: '5003',
    palabrasClave: ['servicio', 'mantenimiento', 'soporte', 'limpieza', 'aseo'],
  },
  arrendamiento_muebles: {
    nombre: 'Arrendamiento bienes muebles',
    tarifa: 0.04,
    baseUvt: 0,
    codigoFormato1001: '5004',
    palabrasClave: ['arrendamiento', 'alquiler', 'mueble', 'equipo', 'vehículo'],
  },
  arrendamiento_inmuebles: {
    nombre: 'Arrendamiento bienes inmuebles',
    tarifa: 0.035,
    baseUvt: 0,
    codigoFormato1001: '5004',
    palabrasClave: ['arriendo', 'arrendamiento', 'local', 'oficina', 'bodega', 'inmueble'],
  },
  comisiones: {
    nombre: 'Comisiones',
    tarifa: 0.11,
    baseUvt: 0,
    codigoFormato1001: '5007',
    palabrasClave: ['comisión', 'intermediación', 'agencia'],
  },
  transporte_carga: {
    nombre: 'Transporte de carga nacional',
    tarifa: 0.01,
    baseUvt: 27,
    codigoFormato1001: '5006',
    palabrasClave: ['transporte', 'flete', 'carga', 'envío', 'mensajería'],
  },
  transporte_pasajeros: {
    nombre: 'Transporte nacional de pasajeros',
    tarifa: 0.035,
    baseUvt: 27,
    codigoFormato1001: '5006',
    palabrasClave: ['tiquete', 'pasaje', 'viaje', 'aéreo', 'terrestre'],
  },
  construccion: {
    nombre: 'Contratos de construcción',
    tarifa: 0.02,
    baseUvt: 27,
    codigoFormato1001: '5009',
    palabrasClave: ['construcción', 'obra', 'adecuación', 'instalación', 'remodelación'],
  },
  publicidad: {
    nombre: 'Publicidad y propaganda',
    tarifa: 0.035,
    baseUvt: 4,
    codigoFormato1001: '5003',
    palabrasClave: ['publicidad', 'propaganda', 'marketing', 'pauta', 'diseño'],
  },
  sin_retencion: {
    nombre: 'Sin retención (exento / régimen simple / monto inferior a base)',
    tarifa: 0,
    baseUvt: 0,
    codigoFormato1001: '0000',
    palabrasClave: [],
  },
}

// ─── TARIFAS ICA BOGOTÁ D.C. ─────────────────────────────────────────────────
// Acuerdo 065/2002 + actualizaciones. Tarifa en por mil (‰).

export interface TarifaIcaConfig {
  nombre: string
  tarifaPorMil: number
  ciuuPrefijos: string[]
}

export const TARIFAS_ICA_BOGOTA: Record<string, TarifaIcaConfig> = {
  industria: {
    nombre: 'Industria manufacturera',
    tarifaPorMil: 4.14,
    ciuuPrefijos: ['10','11','12','13','14','15','16','17','18','19','20',
                   '21','22','23','24','25','26','27','28','29','30','31','32','33'],
  },
  comercio_minorista: {
    nombre: 'Comercio al por menor',
    tarifaPorMil: 4.14,
    ciuuPrefijos: ['47'],
  },
  comercio_mayorista: {
    nombre: 'Comercio al por mayor y vehículos',
    tarifaPorMil: 4.14,
    ciuuPrefijos: ['45', '46'],
  },
  telecomunicaciones: {
    nombre: 'Telecomunicaciones',
    tarifaPorMil: 5.18,
    ciuuPrefijos: ['61'],
  },
  servicios_financieros: {
    nombre: 'Actividades financieras y de seguros',
    tarifaPorMil: 11.04,
    ciuuPrefijos: ['64', '65', '66'],
  },
  salud: {
    nombre: 'Actividades de atención a la salud',
    tarifaPorMil: 6.9,
    ciuuPrefijos: ['86', '87', '88'],
  },
  servicios_generales: {
    nombre: 'Demás servicios',
    tarifaPorMil: 9.66,
    ciuuPrefijos: [],
  },
}

// CIIU excluidos de ICA — Art. 39 Ley 14/1983
export const CIIU_EXCLUIDOS_ICA = ['01','02','03','05','06','07','08','09','35','36','84','85']

// ─── FORMATOS DE BANCO ────────────────────────────────────────────────────────

export const FORMATOS_BANCO = {
  bancolombia: {
    nombre: 'Bancolombia',
    colFecha: 'Fecha',
    colDescripcion: 'Descripción',
    colReferencia: 'Referencia',
    colDebito: 'Débitos',
    colCredito: 'Créditos',
    colSaldo: 'Saldo',
    formatoFecha: 'DD/MM/YYYY',
    filasEncabezado: 0,
  },
  davivienda: {
    nombre: 'Davivienda',
    colFecha: 'Fecha',
    colDescripcion: 'Descripción',
    colReferencia: 'N° Transacción',
    colDebito: 'Débito',
    colCredito: 'Crédito',
    colSaldo: 'Saldo',
    formatoFecha: 'YYYY-MM-DD',
    filasEncabezado: 0,
  },
  bbva: {
    nombre: 'BBVA Colombia',
    colFecha: 'Fecha Operación',
    colDescripcion: 'Concepto',
    colReferencia: 'Referencia',
    colDebito: 'Cargo',
    colCredito: 'Abono',
    colSaldo: 'Saldo',
    formatoFecha: 'DD/MM/YYYY',
    filasEncabezado: 0,
  },
  bogota: {
    nombre: 'Banco de Bogotá',
    colFecha: 'FECHA',
    colDescripcion: 'DESCRIPCIÓN',
    colReferencia: 'REFERENCIA',
    colDebito: 'DÉBITO',
    colCredito: 'CRÉDITO',
    colSaldo: 'SALDO',
    formatoFecha: 'DD/MM/YYYY',
    filasEncabezado: 0,
  },
  personalizado: {
    nombre: 'Formato personalizado',
    colFecha: '',
    colDescripcion: '',
    colReferencia: '',
    colDebito: '',
    colCredito: '',
    colSaldo: '',
    formatoFecha: 'DD/MM/YYYY',
    filasEncabezado: 0,
  },
} as const

// ─── NAMESPACES XML DIAN ──────────────────────────────────────────────────────

export const DIAN_NS = {
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
}

// ─── MATCHING ─────────────────────────────────────────────────────────────────

export const MATCHING_DEFAULTS = {
  toleranciaMontosPct: 0.001,   // 0.1%
  toleranciaDias: 5,
  umbralConfianzaExacto: 0.97,
  umbralConfianzaFuzzy: 0.75,
  umbralConfianzaRevision: 0.50,
  pesosScore: { monto: 0.5, fecha: 0.3, descripcion: 0.2 },
}

// ─── COLORES EXCEL ────────────────────────────────────────────────────────────

export const COLORES_EXCEL = {
  navy: '1A2F5A',
  gold: 'B8960C',
  verdeConc: 'D1FAE5',
  verdeOsc:  '059669',
  rojoAlerta:'FEE2E2',
  rojoOsc:   'DC2626',
  naranja:   'FEF3C7',
  naranjaOsc:'D97706',
  azul:      'DBEAFE',
  grisClaro: 'F9FAFB',
  blanco:    'FFFFFF',
}
