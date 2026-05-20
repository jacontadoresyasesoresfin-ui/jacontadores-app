/**
 * Conceptos del Formato 1001 v11
 * Fuente: Resolución DIAN 000227/2025 (RUMT) + Resolución 000233/2025
 * Año gravable 2025 — presentación 2026
 *
 * NOTA: Verificar contra el Prevalidador oficial DIAN antes de producción.
 * El prevalidador es la fuente definitiva de validación.
 */

export interface ConceptoInfo {
  codigo: string
  nombre: string              // Nombre oficial DIAN
  nombreCorto: string         // Para UI
  cuentasPucSugeridas: string[]   // Cuentas PUC que típicamente aplican
  requiereRetencion: boolean  // Si normalmente genera retención en la fuente
  tarifaReteDefault?: number  // Tarifa porcentual referencial (no normativa)
  baseUvtMinimo?: number      // Base mínima en UVT (0 = sin base mínima)
  aplica: 'pagos' | 'exterior' | 'ambos'
  notas?: string
}

export const CONCEPTOS_1001: Record<string, ConceptoInfo> = {
  // ── Honorarios ────────────────────────────────────────────────────────
  '5001': {
    codigo: '5001',
    nombre: 'Honorarios — Personas Naturales',
    nombreCorto: 'Honorarios PN',
    cuentasPucSugeridas: ['5120', '5120-01', '5120-02'],
    requiereRetencion: true,
    tarifaReteDefault: 10,
    baseUvtMinimo: 0,
    aplica: 'pagos',
    notas: 'PN que no ha declarado renta: 10%. Con declaración de renta: tarifa varía.',
  },
  '5017': {
    codigo: '5017',
    nombre: 'Honorarios — Personas Jurídicas',
    nombreCorto: 'Honorarios PJ',
    cuentasPucSugeridas: ['5120', '5120-03'],
    requiereRetencion: true,
    tarifaReteDefault: 11,
    baseUvtMinimo: 0,
    aplica: 'pagos',
  },
  // ── Comisiones ────────────────────────────────────────────────────────
  '5002': {
    codigo: '5002',
    nombre: 'Comisiones',
    nombreCorto: 'Comisiones',
    cuentasPucSugeridas: ['5125'],
    requiereRetencion: true,
    tarifaReteDefault: 11,
    baseUvtMinimo: 0,
    aplica: 'pagos',
  },
  // ── Servicios ─────────────────────────────────────────────────────────
  '5003': {
    codigo: '5003',
    nombre: 'Servicios en general',
    nombreCorto: 'Servicios',
    cuentasPucSugeridas: ['5130', '5135', '5150', '5155', '5195', '5196'],
    requiereRetencion: true,
    tarifaReteDefault: 4,
    baseUvtMinimo: 4,
    aplica: 'pagos',
  },
  '5018': {
    codigo: '5018',
    nombre: 'Servicios técnicos, asistencia técnica y consultoría',
    nombreCorto: 'Servicios técnicos',
    cuentasPucSugeridas: ['5135-02', '5135-03'],
    requiereRetencion: true,
    tarifaReteDefault: 4,
    baseUvtMinimo: 0,
    aplica: 'pagos',
  },
  // ── Arrendamientos ────────────────────────────────────────────────────
  '5004': {
    codigo: '5004',
    nombre: 'Arrendamientos de bienes inmuebles',
    nombreCorto: 'Arrend. inmuebles',
    cuentasPucSugeridas: ['5140-01'],
    requiereRetencion: true,
    tarifaReteDefault: 3.5,
    baseUvtMinimo: 0,
    aplica: 'pagos',
  },
  '5005': {
    codigo: '5005',
    nombre: 'Arrendamientos de bienes muebles',
    nombreCorto: 'Arrend. muebles',
    cuentasPucSugeridas: ['5140-02'],
    requiereRetencion: true,
    tarifaReteDefault: 4,
    baseUvtMinimo: 0,
    aplica: 'pagos',
  },
  // ── Intereses y rendimientos financieros ─────────────────────────────
  '5006': {
    codigo: '5006',
    nombre: 'Intereses y rendimientos financieros',
    nombreCorto: 'Intereses',
    cuentasPucSugeridas: ['5310', '5315', '5320'],
    requiereRetencion: true,
    tarifaReteDefault: 7,
    baseUvtMinimo: 0,
    aplica: 'pagos',
  },
  // ── Compras ───────────────────────────────────────────────────────────
  '5007': {
    codigo: '5007',
    nombre: 'Compras de bienes y servicios no clasificados',
    nombreCorto: 'Compras generales',
    cuentasPucSugeridas: ['14%', '6205', '6210', '6215', '7205'],
    requiereRetencion: true,
    tarifaReteDefault: 2.5,
    baseUvtMinimo: 27,
    aplica: 'pagos',
    notas: 'Base mínima: 27 UVT = $1.414.098 (UVT 2026: $52.374)',
  },
  // ── Contratos de construcción ─────────────────────────────────────────
  '5008': {
    codigo: '5008',
    nombre: 'Contratos de construcción y urbanización',
    nombreCorto: 'Construcción',
    cuentasPucSugeridas: ['5195-05'],
    requiereRetencion: true,
    tarifaReteDefault: 2,
    baseUvtMinimo: 0,
    aplica: 'pagos',
  },
  // ── Regalías ─────────────────────────────────────────────────────────
  '5009': {
    codigo: '5009',
    nombre: 'Regalías y explotación de la propiedad industrial',
    nombreCorto: 'Regalías',
    cuentasPucSugeridas: ['5175'],
    requiereRetencion: true,
    tarifaReteDefault: 11,
    baseUvtMinimo: 0,
    aplica: 'pagos',
  },
  // ── Explotación de imagen ─────────────────────────────────────────────
  '5010': {
    codigo: '5010',
    nombre: 'Explotación de imagen, nombre, marca o patentes',
    nombreCorto: 'Imagen / Marca',
    cuentasPucSugeridas: ['5175-02'],
    requiereRetencion: true,
    tarifaReteDefault: 11,
    baseUvtMinimo: 0,
    aplica: 'pagos',
  },
  // ── Enajenación de activos ────────────────────────────────────────────
  '5011': {
    codigo: '5011',
    nombre: 'Enajenación de activos fijos de personas naturales',
    nombreCorto: 'Activos fijos PN',
    cuentasPucSugeridas: ['1520', '1540', '1592'],
    requiereRetencion: true,
    tarifaReteDefault: 1,
    baseUvtMinimo: 0,
    aplica: 'pagos',
  },
  // ── Ingresos de terceros ──────────────────────────────────────────────
  '5012': {
    codigo: '5012',
    nombre: 'Ingresos recibidos para terceros',
    nombreCorto: 'Ingresos terceros',
    cuentasPucSugeridas: ['2805'],
    requiereRetencion: false,
    aplica: 'pagos',
  },
  // ── Donaciones ────────────────────────────────────────────────────────
  '5013': {
    codigo: '5013',
    nombre: 'Donaciones y similares',
    nombreCorto: 'Donaciones',
    cuentasPucSugeridas: ['5810'],
    requiereRetencion: false,
    aplica: 'pagos',
  },
  // ── Loterías y rifas ─────────────────────────────────────────────────
  '5016': {
    codigo: '5016',
    nombre: 'Loterías, rifas, apuestas y similares',
    nombreCorto: 'Loterías / Rifas',
    cuentasPucSugeridas: [],
    requiereRetencion: true,
    tarifaReteDefault: 20,
    baseUvtMinimo: 48,
    aplica: 'pagos',
  },
  // ── Transporte ────────────────────────────────────────────────────────
  '5029': {
    codigo: '5029',
    nombre: 'Transporte nacional de carga',
    nombreCorto: 'Transporte carga',
    cuentasPucSugeridas: ['5160-01'],
    requiereRetencion: true,
    tarifaReteDefault: 1,
    baseUvtMinimo: 27,
    aplica: 'pagos',
  },
  '5030': {
    codigo: '5030',
    nombre: 'Transporte nacional de pasajeros',
    nombreCorto: 'Transporte pasajeros',
    cuentasPucSugeridas: ['5160-02'],
    requiereRetencion: true,
    tarifaReteDefault: 3.5,
    baseUvtMinimo: 27,
    aplica: 'pagos',
  },
  // ── Servicios de aseo y vigilancia ───────────────────────────────────
  '5028': {
    codigo: '5028',
    nombre: 'Servicio de aseo y vigilancia',
    nombreCorto: 'Aseo / Vigilancia',
    cuentasPucSugeridas: ['5165'],
    requiereRetencion: true,
    tarifaReteDefault: 2,
    baseUvtMinimo: 4,
    aplica: 'pagos',
  },
  // ── Publicidad ────────────────────────────────────────────────────────
  '5039': {
    codigo: '5039',
    nombre: 'Publicidad, propaganda y relaciones públicas',
    nombreCorto: 'Publicidad',
    cuentasPucSugeridas: ['5130-05'],
    requiereRetencion: true,
    tarifaReteDefault: 3.5,
    baseUvtMinimo: 4,
    aplica: 'pagos',
  },
  // ── Seguros ───────────────────────────────────────────────────────────
  '5040': {
    codigo: '5040',
    nombre: 'Seguros (primas)',
    nombreCorto: 'Seguros',
    cuentasPucSugeridas: ['5150'],
    requiereRetencion: true,
    tarifaReteDefault: 1,
    baseUvtMinimo: 0,
    aplica: 'pagos',
  },
  // ── Contribuciones ────────────────────────────────────────────────────
  '5027': {
    codigo: '5027',
    nombre: 'Contribuciones y afiliaciones',
    nombreCorto: 'Contribuciones',
    cuentasPucSugeridas: ['5105'],
    requiereRetencion: false,
    aplica: 'pagos',
    notas: 'Aportes parafiscales, seguridad social',
  },
  // ── Mantenimiento ─────────────────────────────────────────────────────
  '5051': {
    codigo: '5051',
    nombre: 'Mantenimiento y reparaciones',
    nombreCorto: 'Mantenimiento',
    cuentasPucSugeridas: ['5196'],
    requiereRetencion: true,
    tarifaReteDefault: 4,
    baseUvtMinimo: 4,
    aplica: 'pagos',
  },
  // ── Pagos al exterior ─────────────────────────────────────────────────
  '5019': {
    codigo: '5019',
    nombre: 'Prestación de servicios desde el exterior',
    nombreCorto: 'Servicios exterior',
    cuentasPucSugeridas: ['5130-10', '5135-10'],
    requiereRetencion: true,
    tarifaReteDefault: 15,
    baseUvtMinimo: 0,
    aplica: 'exterior',
    notas: 'Art. 408 ET. Verificar CDI (Convenio Doble Imposición)',
  },
  '5020': {
    codigo: '5020',
    nombre: 'Pagos al exterior — rentas de trabajo',
    nombreCorto: 'Exterior — trabajo',
    cuentasPucSugeridas: ['5110-10'],
    requiereRetencion: true,
    tarifaReteDefault: 15,
    baseUvtMinimo: 0,
    aplica: 'exterior',
  },
  '5021': {
    codigo: '5021',
    nombre: 'Pagos al exterior — rentas de capital e inversión',
    nombreCorto: 'Exterior — capital',
    cuentasPucSugeridas: ['5310-10', '5320-10'],
    requiereRetencion: true,
    tarifaReteDefault: 15,
    baseUvtMinimo: 0,
    aplica: 'exterior',
  },
  // ── Otros ─────────────────────────────────────────────────────────────
  '5098': {
    codigo: '5098',
    nombre: 'Otros pagos y abonos no clasificados',
    nombreCorto: 'Otros pagos',
    cuentasPucSugeridas: ['5%'],
    requiereRetencion: false,
    aplica: 'ambos',
    notas: 'Concepto residual. Revisar si no aplica otro código más específico.',
  },
  '5099': {
    codigo: '5099',
    nombre: 'Pagos al exterior — otros conceptos',
    nombreCorto: 'Exterior — otros',
    cuentasPucSugeridas: [],
    requiereRetencion: true,
    tarifaReteDefault: 15,
    baseUvtMinimo: 0,
    aplica: 'exterior',
  },
}

export const CONCEPTOS_1001_LISTA = Object.values(CONCEPTOS_1001)
  .sort((a, b) => a.codigo.localeCompare(b.codigo))
