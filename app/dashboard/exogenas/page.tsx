'use client'
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useClient } from '../ClientContext'
import { MUNICIPIOS_LISTA, DEPARTAMENTOS } from '@/lib/exogenas/config/divipola'
import { INFO_FORMATOS, VERSION_POR_ANIO } from '@/lib/exogenas/registry/formato-registry'
import ConfiguracionMagnetica from './ConfiguracionMagnetica'
import type { TarjetaExcepcion, AccionExcepcion } from '@/lib/exogenas/engine/humanizador'
import { InformacionLegal } from './components/InformacionLegal'

// ── Paleta J&A ────────────────────────────────────────────────────────────────
const JA = {
  NAVY: '#13213C', GOLD: '#B8960C', GOLD_LT: '#D4A843',
  TEXT: '#1C2B45', GREY: '#4B5563', BORDER: '#E5E7EB', BG: '#F8FAFC',
  WHITE: '#FFFFFF', RED: '#DC2626', GREEN: '#059669', AMBER: '#D97706',
  BLUE: '#2563EB', SURFACE: '#F1F5F9',
  RED_BG: '#FEF2F2', GREEN_BG: '#F0FDF4', AMBER_BG: '#FFFBEB', BLUE_BG: '#EFF6FF',
}
const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const fmtCOP = (n: number) => COP.format(n)

// ── Tipos de eventos del stream ───────────────────────────────────────────────
type TipoEvento = 'etapa_inicio' | 'etapa_ok' | 'formato_inicio' | 'formato_ok' | 'fin' | 'error'
interface Evento { tipo: TipoEvento; etapa?: number; codigo?: string; datos?: Record<string, unknown>; mensaje?: string }

// ── Estado de una etapa ───────────────────────────────────────────────────────
type EstadoEtapa = 'pendiente' | 'activa' | 'ok' | 'error'
interface EtapaUI {
  num: number
  titulo: string
  icono: string
  estado: EstadoEtapa
  detalles: string[]
  subformatos: FormatoItem[]
}
interface FormatoItem {
  codigo: string
  nombre: string
  estado: 'pendiente' | 'activa' | 'ok'
  detalle?: string
}

// ── Resultado final ───────────────────────────────────────────────────────────
interface ResultadoFinal {
  asientosProcesados: number
  advertenciasCsv: string[]
  metaCsv: { empresa?: string; periodo?: string }
  cuentasSinRegla: string[]
  resumenFormatos: Array<{
    codigo: string; nombre: string; totalFilas: number
    totales: Record<string, number>
    excepcionesCriticas: number; excepcionesMedia: number
  }>
  tarjetasExcepciones: TarjetaExcepcion[]
  resumenExcepciones: { criticas: number; alertas: number; informativas: number; descripcionResumen: string }
  autoCorrecciones?: {
    totalCorregidos: number
    totalAsientos:   number
    correcciones: Array<{
      nit: string; dvOriginal: string; dvCorregido: string
      nombre: string; tipo: 'dv_incorrecto' | 'dv_faltante'; asientosAfectados: number
    }>
  }
  informeValidacion?: {
    puedeExportar: boolean
    resumenTexto: string
    criticos:      Array<{ codigo: string; titulo: string; detalle: string; accion: string; formato?: string; valorRef?: number; terceroId?: string }>
    altos:         Array<{ codigo: string; titulo: string; detalle: string; accion: string; formato?: string; valorRef?: number; terceroId?: string }>
    medios:        Array<{ codigo: string; titulo: string; detalle: string; accion: string; formato?: string; valorRef?: number }>
    observaciones: Array<{ codigo: string; titulo: string; detalle: string; accion: string }>
    totalesPorFormato: Array<{ formatoCodigo: string; nombreFormato: string; totalFilas: number; montosPrincipales: Array<{ etiqueta: string; valor: number }>; estado: string }>
  }
  asientosParaExportar: unknown[]
  filasFormatoParaExportar?: Array<{ formatoCodigo: string; filas: unknown[] }>
  configParaExportar: unknown
}

// ── Vista de la página ────────────────────────────────────────────────────────
type Vista = 'inicio' | 'procesando' | 'resumen' | 'excepciones' | 'listo'

const ETAPAS_INICIALES: EtapaUI[] = [
  { num: 1, titulo: 'Leer archivo de Siigo',   icono: 'folder-open',       estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 2, titulo: 'Cargar reglas DIAN 2025', icono: 'document-list',     estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 3, titulo: 'Analizar movimientos',     icono: 'magnifying-glass',  estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 4, titulo: 'Generar formatos DIAN',    icono: 'chart-bar',         estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 5, titulo: 'Validar excepciones',      icono: 'shield-check',      estado: 'pendiente', detalles: [], subformatos: [] },
]

const ETAPAS_XLSX_INICIALES: EtapaUI[] = [
  { num: 1, titulo: 'Leer archivo xlsx',        icono: 'folder-open',       estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 2, titulo: 'Detectar formatos DIAN',   icono: 'document-list',     estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 3, titulo: 'Validar registros',         icono: 'magnifying-glass',  estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 4, titulo: 'Generar formatos DIAN',    icono: 'chart-bar',         estado: 'pendiente', detalles: [], subformatos: [] },
  { num: 5, titulo: 'Validar excepciones',      icono: 'shield-check',      estado: 'pendiente', detalles: [], subformatos: [] },
]

const STORAGE_KEY = 'ja_exogenas_config_v2'
const FORMATOS_DISPONIBLES = ['1001', '1003', '1005', '1006', '1007', '1008', '1009', '1010', '1012', '2276']

// ── Conceptos por formato para la pantalla de configuración ───────────────────
const CONCEPTOS_POR_FORMATO: Record<string, { valor: string; label: string }[]> = {
  '1001': [
    { valor: '5001', label: '5001 — Honorarios personas naturales' },
    { valor: '5002', label: '5002 — Comisiones' },
    { valor: '5003', label: '5003 — Servicios generales' },
    { valor: '5004', label: '5004 — Arrendamiento inmuebles' },
    { valor: '5005', label: '5005 — Arrendamiento muebles y equipos' },
    { valor: '5006', label: '5006 — Intereses y rendimientos financieros' },
    { valor: '5007', label: '5007 — Compras de bienes (inventario/activos)' },
    { valor: '5009', label: '5009 — Regalías y patentes' },
    { valor: '5011', label: '5011 — Consultoría y administración delegada' },
    { valor: '5017', label: '5017 — Honorarios personas jurídicas' },
    { valor: '5018', label: '5018 — Servicios técnicos y asistencia técnica' },
    { valor: '5019', label: '5019 — Pagos al exterior' },
    { valor: '5027', label: '5027 — Contribuciones y afiliaciones (parafiscales)' },
    { valor: '5028', label: '5028 — Aseo y vigilancia' },
    { valor: '5029', label: '5029 — Transporte de carga' },
    { valor: '5030', label: '5030 — Transporte de pasajeros' },
    { valor: '5039', label: '5039 — Publicidad y propaganda' },
    { valor: '5040', label: '5040 — Seguros (primas)' },
    { valor: '5051', label: '5051 — Mantenimiento y reparaciones' },
    { valor: '5098', label: '5098 — Otros pagos (incluye no deducibles)' },
    { valor: '5099', label: '5099 — Otros pagos o abonos en cuenta' },
  ],
  '1003': [
    { valor: '1302', label: '1302 — Retención renta y complementarios' },
    { valor: '1303', label: '1303 — Retención a título de ventas (IVA)' },
    { valor: '1305', label: '1305 — Retención CREE' },
    { valor: '1307', label: '1307 — Retención rendimientos financieros' },
    { valor: '1310', label: '1310 — Retención ICA (ReteICA)' },
    { valor: '1399', label: '1399 — Otras retenciones practicadas al declarante' },
  ],
  '1005': [
    { valor: '9997', label: '9997 — IVA descontable (compras)' },
  ],
  '1006': [
    { valor: '9998', label: '9998 — IVA generado (ventas)' },
  ],
  '1007': [
    { valor: '4001', label: '4001 — Ingresos operacionales (ventas)' },
    { valor: '4002', label: '4002 — Ingresos no operacionales' },
  ],
  '1008': [
    { valor: '1315', label: '1315 — Clientes nacionales (CxC)' },
    { valor: '1316', label: '1316 — Clientes del exterior' },
    { valor: '1317', label: '1317 — Anticipos e impuestos a favor' },
    { valor: '1318', label: '1318 — Provisiones cartera' },
    { valor: '1399', label: '1399 — Otras cuentas por cobrar' },
  ],
  '1009': [
    { valor: '2201', label: '2201 — Proveedores nacionales' },
    { valor: '2202', label: '2202 — Proveedores del exterior' },
    { valor: '2203', label: '2203 — Socios y accionistas (CxP)' },
    { valor: '2204', label: '2204 — Costos y gastos por pagar' },
    { valor: '2205', label: '2205 — Retenciones y aportes de nómina por pagar' },
    { valor: '2208', label: '2208 — Acreedores varios' },
    { valor: '2214', label: '2214 — Prestaciones sociales y aportes parafiscales' },
    { valor: '2215', label: '2215 — Salarios por pagar' },
    { valor: '2299', label: '2299 — Otros pasivos corrientes' },
  ],
  '1010': [
    { valor: 'proveedor', label: 'Proveedor' },
    { valor: 'cliente', label: 'Cliente' },
    { valor: 'empleado', label: 'Empleado' },
    { valor: 'socio', label: 'Socio / Accionista' },
  ],
  '1012': [
    { valor: '1204', label: '1204 — Efectivo y cuentas bancarias (corriente/ahorro)' },
    { valor: '1208', label: '1208 — Fondos fiduciarios y patrimonios autónomos' },
    { valor: '1209', label: '1209 — Fondos de inversión colectiva' },
    { valor: '1210', label: '1210 — Acciones y cuotas de interés social' },
    { valor: '1211', label: '1211 — CDT y certificados de depósito a término' },
    { valor: '1212', label: '1212 — Bonos y otros títulos de deuda' },
    { valor: '1299', label: '1299 — Otras inversiones y equivalentes' },
  ],
  '2276': [
    { valor: '6001', label: '6001 — Sueldos y jornales' },
    { valor: '6002', label: '6002 — Prima de servicios' },
    { valor: '6003', label: '6003 — Cesantías e intereses' },
    { valor: '6004', label: '6004 — Vacaciones' },
    { valor: '6005', label: '6005 — Horas extras y recargos' },
    { valor: '6006', label: '6006 — Bonificaciones y auxilios' },
    { valor: '6007', label: '6007 — Auxilio de transporte' },
    { valor: '6008', label: '6008 — Incapacidades' },
    { valor: '6009', label: '6009 — Aportes seguridad social empleador' },
    { valor: '6010', label: '6010 — Aportes parafiscales (SENA, ICBF, CCF)' },
    { valor: '9996', label: '9996 — Aportes obligatorios por nómina (agrupado)' },
    { valor: '6099', label: '6099 — Otros pagos laborales' },
  ],
}

// Descripciones + documentos recomendados por formato (guía práctica)
const GUIA_FORMATOS: Record<string, { fuente: string; concilia: string; tip: string }> = {
  '1001': {
    fuente: 'Libro Auxiliar Siigo — cuentas clase 5 (gastos) y clase 6 (costos)',
    concilia: 'Formulario 350 (retenciones practicadas) y Formulario 110/210 (deducciones renta)',
    tip: 'Incluye honorarios, servicios, arrendamientos, compras de bienes y otros pagos a terceros. Excluye nómina de empleados.',
  },
  '1003': {
    fuente: 'Libro Auxiliar Siigo — cuentas 1355xx (Anticipo de impuestos y retenciones a favor)',
    concilia: 'Formulario 350 sección "retenciones que le practicaron" y Formulario 110/210 activo corriente',
    tip: 'Informe las retenciones que SUS CLIENTES le descontaron. Estas son activos de la empresa que se recuperan al declarar renta.',
  },
  '1005': {
    fuente: 'Libro Auxiliar Siigo — cuenta 2408 subcuentas IVA descontable (compras)',
    concilia: 'Formulario 300 sección de compras y servicios gravados con IVA',
    tip: 'Solo IVA que la empresa puede descontar (compras con derecho a descuento). Excluye IVA no descontable.',
  },
  '1006': {
    fuente: 'Libro Auxiliar Siigo — cuenta 2408 subcuentas IVA generado (ventas)',
    concilia: 'Formulario 300 sección de ingresos y operaciones gravadas',
    tip: 'Ingresos sobre los que cobró IVA a sus clientes. La base debe coincidir con el F1007.',
  },
  '1007': {
    fuente: 'Libro Auxiliar Siigo — cuentas clase 41 (ingresos operacionales) y 42 (no operacionales)',
    concilia: 'Formulario 110/210 (ingresos brutos) y Formulario 300 (total ingresos)',
    tip: 'Solo informar clientes con ingresos superiores a 500 UVT (~$24.9M). Menores se consolidan en NIT 222222222.',
  },
  '1008': {
    fuente: 'Libro Auxiliar Siigo — cuentas clase 13 (deudores, clientes, retenciones a favor)',
    concilia: 'Formulario 110/210 activo corriente — deudores al 31 de diciembre',
    tip: 'Reporta el SALDO al cierre del año, no los movimientos. Debe coincidir con el balance general.',
  },
  '1009': {
    fuente: 'Libro Auxiliar Siigo — cuentas clases 22, 23 y 25 (proveedores, CxP, pasivos laborales)',
    concilia: 'Formulario 110/210 pasivos corrientes y laborales al 31 de diciembre',
    tip: 'Reporta el SALDO al cierre del año. Incluye proveedores, retenciones por pagar, nómina, prestaciones y aportes.',
  },
  '1010': {
    fuente: 'Libro Auxiliar Siigo — cuentas clase 31 (capital social) y 31xx (socios/accionistas)',
    concilia: 'Formulario 110 — patrimonio neto, capital suscrito y pagado',
    tip: 'Reporta la participación de socios y accionistas. Para empresas unipersonales informar el único socio.',
  },
  '1012': {
    fuente: 'Libro Auxiliar Siigo — grupos 11 (caja y bancos) y 12 (inversiones). Fuente: 1110xx cuentas bancarias, 1120xx fondos, 1205xx acciones, 1220xx CDT',
    concilia: 'Formulario 110/210 — sección efectivo y equivalentes de efectivo + inversiones a corto y largo plazo',
    tip: 'Reporta saldo al 31-dic en cada cuenta bancaria y de inversión. El tercero es el banco o entidad financiera (por NIT). Concilia con el extracto bancario del cierre.',
  },
  '2276': {
    fuente: 'Libro Auxiliar Siigo — cuentas 511xxx (gastos de personal) y 5105xx (aportes empleador)',
    concilia: 'Declaración de renta — salarios y prestaciones como deducción de renta',
    tip: 'Solo empleados con CONTRATO LABORAL. Honorarios a independientes van en F1001 concepto 5001.',
  },
}

interface ConfigGuardada {
  nitDeclarante: string
  dvDeclarante: string
  razonSocial: string
  tipoDeclarante: string
  municipioCodigo: string
  formatosSeleccionados: string[]
  anioGravable: number
  usarConfiguracionPersonalizada: boolean
}

const CONFIG_DEFECTO: ConfigGuardada = {
  nitDeclarante: '',
  dvDeclarante: '',
  razonSocial: '',
  tipoDeclarante: 'contribuyente',
  municipioCodigo: '11001',
  formatosSeleccionados: FORMATOS_DISPONIBLES,
  anioGravable: 2025,
  usarConfiguracionPersonalizada: true,
}

// ── Algoritmo DV módulo 11 (DIAN) ────────────────────────────────────────────
function calcularDV(nit: string): string {
  const digits = nit.replace(/\D/g, '')
  if (!digits || digits.length < 5) return ''
  const primos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[digits.length - 1 - i]) * primos[i]
  }
  const r = sum % 11
  return String(r === 0 || r === 1 ? r : 11 - r)
}

// ── Municipios agrupados por departamento ─────────────────────────────────────
const MUNICIPIOS_POR_DEPTO: Record<string, { codigo: string; nombre: string }[]> = {}
MUNICIPIOS_LISTA.forEach(m => {
  if (!MUNICIPIOS_POR_DEPTO[m.depto]) MUNICIPIOS_POR_DEPTO[m.depto] = []
  MUNICIPIOS_POR_DEPTO[m.depto].push({ codigo: m.codigo, nombre: m.nombre })
})
const DEPTOS_CON_MUNICIPIOS = Object.entries(DEPARTAMENTOS)
  .filter(([cod]) => MUNICIPIOS_POR_DEPTO[cod]?.length)
  .sort(([, a], [, b]) => a.localeCompare(b))

export default function ExogenasPage() {
  const { tenant } = useClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'generar' | 'configuracion'>('generar')
  const [vista, setVista] = useState<Vista>('inicio')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [tipoArchivo, setTipoArchivo] = useState<'csv' | 'xlsx' | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [exportando, setExportando] = useState(false)

  // Stepper state
  const [etapas, setEtapas] = useState<EtapaUI[]>(ETAPAS_INICIALES)
  const [porcentaje, setPorcentaje] = useState(0)
  const [resultado, setResultado] = useState<ResultadoFinal | null>(null)

  // Asistente excepciones
  const [indiceExcepcion, setIndiceExcepcion] = useState(0)
  const [excepcionesResueltas, setExcepcionesResueltas] = useState<Map<number, { accion: AccionExcepcion; datos?: string }>>(new Map())
  const [busquedaTercero, setBusquedaTercero] = useState('')
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false)
  // Cache de resultados de verificación de NIT (por NIT → resultado RUES)
  const [nitVerifyCache, setNitVerifyCache] = useState<Map<string, { dv: string; razonSocial: string | null; ciuu: string | null; valid: boolean }>>(new Map())
  const [nitVerifyLoading, setNitVerifyLoading] = useState<string | null>(null)
  const [mostrarDvCorregidos, setMostrarDvCorregidos] = useState(false)

  const [config, setConfig] = useState<ConfigGuardada>(CONFIG_DEFECTO)
  const [dvAuto, setDvAuto] = useState('')   // DV calculado automáticamente

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ConfigGuardada>
        setConfig(prev => ({ ...CONFIG_DEFECTO, ...prev, ...parsed }))
      } else if (tenant?.name) {
        setConfig(prev => ({ ...prev, razonSocial: tenant.name }))
      }
    } catch { /* ignorar */ }
  }, [tenant])

  // Auto-calcular DV cuando cambia el NIT
  useEffect(() => {
    const dv = calcularDV(config.nitDeclarante)
    setDvAuto(dv)
    if (dv && !config.dvDeclarante) {
      const next = { ...config, dvDeclarante: dv }
      setConfig(next)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
  }, [config.nitDeclarante]) // eslint-disable-line react-hooks/exhaustive-deps

  const actualizarConfig = (campo: keyof ConfigGuardada, valor: string | string[] | number | boolean) => {
    setConfig(prev => {
      const next = { ...prev, [campo]: valor }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const toggleFormato = (codigo: string) => {
    const actual = config.formatosSeleccionados
    const next = actual.includes(codigo) ? actual.filter(f => f !== codigo) : [...actual, codigo]
    if (next.length === 0) return  // al menos uno requerido
    actualizarConfig('formatosSeleccionados', next)
  }

  // ── Detectar tipo de archivo ────────────────────────────────────────────────
  const detectarTipo = (nombre: string): 'csv' | 'xlsx' | null => {
    if (nombre.match(/\.(xlsx|xls)$/i)) return 'xlsx'
    if (nombre.match(/\.(csv|txt)$/i)) return 'csv'
    return null
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = () => setDragOver(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    const tipo = detectarTipo(f.name)
    if (tipo) { setArchivo(f); setTipoArchivo(tipo); setError('') }
    else setError('Cargue un archivo .csv o .xlsx del Libro Auxiliar de Siigo, o el .xlsx del prevalidador DIAN.')
  }
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setArchivo(f); setTipoArchivo(detectarTipo(f.name)); setError('') }
  }

  // ── Validación ───────────────────────────────────────────────────────────────
  const errNit = config.nitDeclarante && config.nitDeclarante.replace(/\D/g, '').length < 5
    ? 'El NIT debe tener al menos 5 dígitos' : ''
  const errDv = config.dvDeclarante && dvAuto && config.dvDeclarante !== dvAuto
    ? `El DV calculado es ${dvAuto} — verifique` : ''
  const puedeGenerar = !!archivo
    && config.nitDeclarante.replace(/\D/g, '').length >= 5
    && !!config.razonSocial.trim()
    && config.formatosSeleccionados.length > 0

  // ── Actualizar etapa en el stepper ─────────────────────────────────────────
  const actualizarEtapa = useCallback((num: number, cambios: Partial<EtapaUI>) => {
    setEtapas(prev => prev.map(e => e.num === num ? { ...e, ...cambios } : e))
  }, [])
  const agregarDetalle = useCallback((num: number, detalle: string) => {
    setEtapas(prev => prev.map(e => e.num === num ? { ...e, detalles: [...e.detalles, detalle] } : e))
  }, [])
  const actualizarFormato = useCallback((codigo: string, cambios: Partial<FormatoItem>) => {
    setEtapas(prev => prev.map(e =>
      e.num === 4 ? { ...e, subformatos: e.subformatos.map(f => f.codigo === codigo ? { ...f, ...cambios } : f) } : e
    ))
  }, [])

  // ── Procesar evento del stream ─────────────────────────────────────────────
  const procesarEvento = useCallback((ev: Evento) => {
    const d = ev.datos ?? {}
    if (ev.tipo === 'etapa_inicio' && ev.etapa) {
      actualizarEtapa(ev.etapa, { estado: 'activa' })
      setPorcentaje((ev.etapa - 1) * 18 + 5)
    }
    if (ev.tipo === 'etapa_ok' && ev.etapa) {
      const e = ev.etapa
      actualizarEtapa(e, { estado: 'ok' })
      if (e === 1) {
        if (d.empresa) agregarDetalle(1, `Empresa detectada: ${d.empresa}`)
        if (d.periodo) agregarDetalle(1, `Período: ${d.periodo}`)
        agregarDetalle(1, `${Number(d.asientosCont).toLocaleString('es-CO')} movimientos contables`)
        if (Number(d.filasFallidas) > 0) agregarDetalle(1, `${d.filasFallidas} filas de encabezado/totales omitidas`)
        setPorcentaje(20)
      }
      if (e === 2) {
        if (Array.isArray(d.formatosXlsx)) {
          // xlsx mode
          const fmts = d.formatosXlsx as string[]
          agregarDetalle(2, `${fmts.length} formato(s) DIAN detectado(s): ${fmts.join(', ')}`)
        } else {
          agregarDetalle(2, `${d.totalReglas} reglas PUC → Formato DIAN cargadas`)
          if (Number(d.reglasPersonalizadas) > 0) agregarDetalle(2, `${d.reglasPersonalizadas} reglas personalizadas de su empresa`)
        }
        setPorcentaje(35)
      }
      if (e === 3) {
        if (d.registrosValidados != null) {
          // xlsx mode
          agregarDetalle(3, `${Number(d.registrosValidados).toLocaleString('es-CO')} registros validados`)
          agregarDetalle(3, `${d.tercerosUnicos} terceros únicos identificados`)
        } else {
          agregarDetalle(3, `${d.cuentasUnicas} cuentas PUC distintas en el período`)
          agregarDetalle(3, `${d.tercerosUnicos} terceros únicos identificados`)
        }
        setPorcentaje(45)
      }
      if (e === 4) setPorcentaje(85)
      if (e === 5) {
        const criticas = Number(d.criticas), alertas = Number(d.alertas), sinRegla = Number(d.cuentasSinRegla)
        if (criticas === 0 && alertas === 0) agregarDetalle(5, 'Todo está en orden — sin situaciones pendientes')
        if (criticas > 0) agregarDetalle(5, `${criticas} situación(es) crítica(s) que requieren revisión`)
        if (alertas > 0) agregarDetalle(5, `${alertas} alerta(s) para revisar antes de enviar`)
        if (sinRegla > 0) agregarDetalle(5, `${sinRegla} cuenta(s) sin clasificación DIAN asignada`)
        setPorcentaje(100)
      }
    }
    if (ev.tipo === 'formato_inicio' && ev.codigo) {
      setEtapas(prev => prev.map(e =>
        e.num === 4
          ? { ...e, subformatos: e.subformatos.some(f => f.codigo === ev.codigo)
              ? e.subformatos.map(f => f.codigo === ev.codigo ? { ...f, estado: 'activa' as const } : f)
              : [...e.subformatos, { codigo: ev.codigo!, nombre: '', estado: 'activa' as const }] }
          : e
      ))
    }
    if (ev.tipo === 'formato_ok' && ev.codigo) {
      const totalFilas = Number(d.totalFilas ?? 0)
      const montoStr = d.montoFormateado as string ?? ''
      const excepciones = Number(d.excepcionesCnt ?? 0)
      const nombre = d.nombre as string ?? ''
      actualizarFormato(ev.codigo, {
        estado: 'ok', nombre,
        detalle: `${totalFilas.toLocaleString('es-CO')} ${totalFilas === 1 ? 'tercero' : 'terceros'}${montoStr ? ` · ${montoStr}` : ''}${excepciones > 0 ? ` · ⚠ ${excepciones} excep.` : ''}`,
      })
    }
    if (ev.tipo === 'fin' && d) { setResultado(d as unknown as ResultadoFinal); setVista('resumen') }
    if (ev.tipo === 'error') {
      setEtapas(prev => prev.map(e => e.estado === 'activa' ? { ...e, estado: 'error' } : e))
      setError(ev.mensaje ?? 'Error al procesar.')
      setVista('inicio')
    }
  }, [actualizarEtapa, agregarDetalle, actualizarFormato])

  // ── Generar exógenas ────────────────────────────────────────────────────────
  const generarExogenas = useCallback(async () => {
    if (!puedeGenerar || !archivo) return
    setVista('procesando')
    setError('')
    setEtapas(tipoArchivo === 'xlsx' ? ETAPAS_XLSX_INICIALES : ETAPAS_INICIALES)
    setPorcentaje(0)
    setResultado(null)
    setIndiceExcepcion(0)
    setExcepcionesResueltas(new Map())

    const fd = new FormData()
    fd.append('archivo', archivo)
    fd.append('config', JSON.stringify({
      anioGravable: config.anioGravable,
      nitDeclarante: config.nitDeclarante.replace(/\D/g, ''),
      dvDeclarante: config.dvDeclarante,
      razonSocial: config.razonSocial,
      tipoDeclarante: config.tipoDeclarante,
      municipioCodigo: config.municipioCodigo,
      formatos: config.formatosSeleccionados,
      usarConfiguracionPersonalizada: config.usarConfiguracionPersonalizada,
    }))

    let recibiFinEvent = false
    try {
      const res = await fetch('/api/exogenas/generar', { method: 'POST', body: fd })

      // Si el servidor responde con error HTTP, mostrar el mensaje real
      if (!res.ok) {
        let detalle = `Error del servidor (${res.status})`
        try {
          const texto = await res.text()
          // Intentar parsear como NDJSON (el servidor podría enviar {tipo:'error',...})
          const lineas = texto.split('\n').filter(l => l.trim())
          for (const linea of lineas) {
            try {
              const ev = JSON.parse(linea) as Evento
              if (ev.tipo === 'error' && ev.mensaje) { detalle = ev.mensaje; break }
            } catch { /* no es JSON */ }
          }
          // Si no había JSON, mostrar los primeros caracteres del texto
          if (detalle.startsWith('Error del servidor') && texto) {
            detalle += ': ' + texto.replace(/<[^>]*>/g, '').trim().slice(0, 200)
          }
        } catch { /* ignorar */ }
        throw new Error(detalle)
      }

      if (!res.body) throw new Error('El servidor no devolvió datos (sin stream).')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lineas = buffer.split('\n')
        buffer = lineas.pop() ?? ''
        for (const linea of lineas) {
          if (!linea.trim()) continue
          try {
            const ev = JSON.parse(linea) as Evento
            if (ev.tipo === 'fin') recibiFinEvent = true
            procesarEvento(ev)
          } catch { /* ignorar línea malformada */ }
        }
      }
      // Procesar residuo final
      if (buffer.trim()) {
        try {
          const ev = JSON.parse(buffer) as Evento
          if (ev.tipo === 'fin') recibiFinEvent = true
          procesarEvento(ev)
        } catch { /* ignorar */ }
      }

      // Stream terminó sin evento 'fin' ni 'error' → informar al usuario
      if (!recibiFinEvent) {
        const hint = tipoArchivo === 'xlsx'
          ? 'El proceso terminó sin generar resultados. Si es un Libro Auxiliar de Siigo (.xlsx), verifique que tenga la columna COMPROBANTE con movimientos. Si es el prevalidador DIAN, las hojas deben llamarse "1001", "1005", etc.'
          : 'El proceso terminó sin generar resultados. Verifique que el archivo CSV sea el Libro Auxiliar completo de Siigo con movimientos del período.'
        throw new Error(hint)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión con el servidor.')
      setVista('inicio')
    }
  }, [puedeGenerar, archivo, config, procesarEvento])

  // ── Exportar Excel ──────────────────────────────────────────────────────────
  const exportarExcel = useCallback(async () => {
    if (!resultado) return
    setExportando(true)
    try {
      const res = await fetch('/api/exogenas/procesos/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: resultado.configParaExportar,
          asientos: resultado.asientosParaExportar,
          filasFormato: resultado.filasFormatoParaExportar,
        }),
      })
      if (!res.ok) {
        let msg = `Error al exportar (${res.status})`
        try {
          const texto = await res.text()
          try { msg = (JSON.parse(texto) as { error?: string }).error ?? msg } catch { if (texto) msg += ': ' + texto.replace(/<[^>]*>/g, '').trim().slice(0, 200) }
        } catch { /* ignorar */ }
        throw new Error(msg)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Exogenas_${config.nitDeclarante}_AG${config.anioGravable}_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar.')
    } finally { setExportando(false) }
  }, [resultado, config])

  // Consulta el verificador de NIT del sistema (RUES + módulo 11) y cachea el resultado
  const verificarNitRUES = async (nit: string) => {
    const nitLimpio = nit.replace(/\D/g, '')
    if (!nitLimpio || nitVerifyCache.has(nitLimpio) || nitVerifyLoading === nitLimpio) return
    setNitVerifyLoading(nitLimpio)
    try {
      const res = await fetch(`/api/nit-verify?nit=${nitLimpio}`)
      if (!res.ok) return
      const d = await res.json() as { checkDigit?: number; razonSocial?: string | null; ciuuPrincipal?: string | null; valid?: boolean }
      setNitVerifyCache(prev => {
        const n = new Map(prev)
        n.set(nitLimpio, {
          dv:          String(d.checkDigit ?? ''),
          razonSocial: d.razonSocial ?? null,
          ciuu:        d.ciuuPrincipal ?? null,
          valid:       d.valid ?? false,
        })
        return n
      })
    } catch { /* silencioso */ } finally { setNitVerifyLoading(null) }
  }

  const resolverExcepcion = (accion: AccionExcepcion, datos?: string) => {
    // ── Corrección de DV: aplica el DV correcto a la fila real en filasFormatoParaExportar ──
    if (accion === 'corregir_dv' && datos && resultado) {
      const tarjeta = resultado.tarjetasExcepciones[indiceExcepcion]
      const nitObjetivo = tarjeta?.contexto?.terceroId as string | undefined
      const dvNuevo = datos.trim()

      if (nitObjetivo && dvNuevo && resultado.filasFormatoParaExportar) {
        // Aplicar el DV corregido a TODAS las filas del mismo NIT en todos los formatos
        setResultado(prev => {
          if (!prev) return prev
          const filasActualizadas = (prev.filasFormatoParaExportar ?? []).map(grupo => ({
            ...grupo,
            filas: (grupo.filas as Record<string, unknown>[]).map(fila => {
              if ((fila.numeroId as string | undefined) === nitObjetivo) {
                return { ...fila, dv: dvNuevo, _estadoFila: 'corregido' }
              }
              return fila
            }),
          }))

          // Re-validar: si el DV ahora es correcto, quitar la tarjeta de excepciones
          const dvCorrecto = (() => {
            const nit = nitObjetivo.replace(/\D/g, '')
            const pesos = [71,67,59,53,47,43,41,37,29,23,19,17,13,7,3]
            const digitos = nit.split('').map(Number).reverse()
            let suma = 0; for (let i = 0; i < digitos.length; i++) suma += digitos[i] * pesos[i]
            const resto = suma % 11; return String(resto > 1 ? 11 - resto : resto)
          })()
          const dvValido = dvNuevo === dvCorrecto

          // Actualizar tarjeta: si DV ahora válido → marcarla como resuelta
          const tarjetasActualizadas = prev.tarjetasExcepciones.map((t, i) => {
            if (i !== indiceExcepcion) return t
            return {
              ...t,
              _resuelta: dvValido,
              _estadoResolucion: dvValido ? 'Corregido por usuario ✓' : 'DV aplicado — verificación pendiente',
            }
          })

          return {
            ...prev,
            filasFormatoParaExportar: filasActualizadas,
            tarjetasExcepciones: tarjetasActualizadas,
          }
        })
      }
    }

    setExcepcionesResueltas(prev => { const n = new Map(prev); n.set(indiceExcepcion, { accion, datos }); return n })
    setMostrarBusqueda(false); setBusquedaTercero('')
    const tarjetas = resultado?.tarjetasExcepciones ?? []
    let sig = indiceExcepcion + 1
    while (sig < tarjetas.length && excepcionesResueltas.has(sig)) sig++
    if (sig < tarjetas.length) setIndiceExcepcion(sig)
    else setVista('listo')
  }

  const reiniciar = () => {
    setVista('inicio'); setArchivo(null); setTipoArchivo(null); setResultado(null); setError('')
    setEtapas(ETAPAS_INICIALES); setPorcentaje(0)
    setExcepcionesResueltas(new Map()); setIndiceExcepcion(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  const excepcionesPendientes = (resultado?.tarjetasExcepciones.length ?? 0) - excepcionesResueltas.size

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: JA.BG, fontFamily: 'Inter, sans-serif', color: JA.TEXT }}>

      {/* ── Header ── */}
      <div style={{ background: JA.NAVY, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: '14px',
        position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ width: '36px', height: '36px', background: JA.GOLD, borderRadius: '2px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="file-spreadsheet" size={20} style={{ color: JA.NAVY }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: JA.WHITE }}>Exógenas DIAN 2025</div>
          <div style={{ fontSize: '11px', color: '#94A3B8' }}>Medios magnéticos · Res. 000227/2025 · AG {config.anioGravable}</div>
        </div>
        {(vista === 'resumen' || vista === 'excepciones' || vista === 'listo') && (
          <button onClick={reiniciar} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2px', color: JA.WHITE, fontSize: '12px', cursor: 'pointer' }}>
            ← Nueva empresa
          </button>
        )}
      </div>

      {/* ── Barra de pestañas ── */}
      <div style={{ background: JA.NAVY, borderBottom: '1px solid rgba(255,255,255,0.12)', paddingLeft: '28px',
        display: 'flex', gap: '4px' }}>
        {([
          { id: 'generar',       label: 'Generar Exógenas',          icon: 'bolt' },
          { id: 'configuracion', label: 'Configuración de mapeo PUC', icon: 'hashtag' },
        ] as { id: 'generar' | 'configuracion'; label: string; icon: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: '12px', fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? JA.WHITE : '#94A3B8',
              borderBottom: `2px solid ${tab === t.id ? JA.GOLD : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: tab === 'configuracion' ? '1100px' : '820px', margin: '0 auto', padding: '28px 20px' }}>

        {/* ══════════════════════════════════════════════════════════
            TAB: CONFIGURACIÓN DE MAPEO PUC
            Siempre montado (display none cuando inactivo) para conservar
            los cambios sin guardar al cambiar de tab.
        ══════════════════════════════════════════════════════════ */}
        <div style={{ display: tab === 'configuracion' ? 'block' : 'none' }}>
          <ConfiguracionMagnetica
            anioInicial={config.anioGravable}
            onVolver={() => setTab('generar')}
          />
        </div>

        {tab !== 'configuracion' && <>

        {/* Error global */}
        {error && (
          <div style={{ padding: '12px 16px', background: JA.RED_BG, border: '1px solid #FECACA',
            borderRadius: '2px', color: JA.RED, fontSize: '13px', marginBottom: '20px',
            display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <Icon name="triangle-warning" size={16} style={{ color: JA.RED, flexShrink: 0, marginTop: '1px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA: INICIO — Formulario completo
        ══════════════════════════════════════════════════════════ */}
        {vista === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div style={{ alignSelf: 'flex-start', marginTop: '-8px' }}>
              <InformacionLegal />
            </div>

            {/* ─── BANNER: Flujo recomendado ─── */}
            <div style={{ padding: '12px 16px', background: '#EFF6FF', border: '1px solid #BFDBFE',
              borderRadius: '2px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '20px', flexShrink: 0 }}>💡</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: JA.BLUE, marginBottom: '4px' }}>
                  Flujo recomendado para la mejor precisión en su exógena
                </div>
                <div style={{ fontSize: '11px', color: JA.GREY, lineHeight: '1.7' }}>
                  <strong>Paso 1:</strong> Configure su mapeo PUC en la pestaña{' '}
                  <button onClick={() => setTab('configuracion')}
                    style={{ background: 'none', border: 'none', color: JA.BLUE, cursor: 'pointer',
                      fontWeight: 700, fontSize: '11px', textDecoration: 'underline', padding: 0 }}>
                    "Configuración de mapeo PUC"
                  </button>
                  {' '}— asigne cada cuenta a su formato y concepto DIAN.
                  <br/>
                  <strong>Paso 2:</strong> Vuelva aquí, complete los datos del declarante y genere.
                  <br/>
                  <strong>Principio DIAN:</strong> Grupos 11-12 → F1012 · Grupo 13 → F1008 · Grupos 21-28 → F1009 ·
                  Grupos 41-42 → F1007 · Grupos 51-53/61-65/71-74 → F1001 · Grupos 1355xx → F1003.
                  Pagos &lt; $100.000 sin retención → se consolidan bajo NIT 222.222.222 (cuantías menores).
                </div>
              </div>
            </div>

            {/* ─── SECCIÓN 1: Datos del declarante ─── */}
            <Seccion num="1" titulo="Datos del declarante" requerido>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
                {/* NIT */}
                <Campo label="NIT del declarante" requerido>
                  <input
                    value={config.nitDeclarante}
                    onChange={e => actualizarConfig('nitDeclarante', e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="900123456"
                    maxLength={12}
                    style={{ ...inputSt, borderColor: errNit ? JA.RED : JA.BORDER }}
                  />
                  {errNit && <span style={{ fontSize: '11px', color: JA.RED, marginTop: '3px', display: 'block' }}>{errNit}</span>}
                </Campo>
                {/* DV */}
                <Campo label="Dígito de verificación" requerido>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={config.dvDeclarante}
                      onChange={e => actualizarConfig('dvDeclarante', e.target.value.replace(/\D/g, '').slice(0, 1))}
                      placeholder={dvAuto || '0'}
                      maxLength={1}
                      style={{ ...inputSt, borderColor: errDv ? JA.AMBER : JA.BORDER }}
                    />
                    {dvAuto && (
                      <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                        fontSize: '10px', color: config.dvDeclarante === dvAuto ? JA.GREEN : JA.GREY }}>
                        {config.dvDeclarante === dvAuto ? '✓' : `auto: ${dvAuto}`}
                      </span>
                    )}
                  </div>
                  {errDv && <span style={{ fontSize: '11px', color: JA.AMBER, marginTop: '3px', display: 'block' }}>{errDv}</span>}
                  {dvAuto && !config.dvDeclarante && (
                    <button onClick={() => actualizarConfig('dvDeclarante', dvAuto)}
                      style={{ fontSize: '10px', color: JA.BLUE, background: 'none', border: 'none',
                        cursor: 'pointer', padding: '2px 0', textDecoration: 'underline', marginTop: '2px' }}>
                      Usar {dvAuto} (calculado)
                    </button>
                  )}
                </Campo>
              </div>

              <div style={{
                background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px',
                padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px'
              }}>
                <input type="checkbox"
                  checked={config.usarConfiguracionPersonalizada}
                  onChange={e => actualizarConfig('usarConfiguracionPersonalizada', e.target.checked)}
                  style={{ marginTop: '2px', cursor: 'pointer' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#333' }}>
                    Aplicar Configuración de Mapeo PUC
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    Si se activa, el motor de reglas utilizará las reglas personalizadas que definiste en la pantalla de "Configuración de Mapeo PUC" para asignar cuentas a conceptos DIAN. Si lo desactivas, solo se usará el mapeo estándar por defecto de Siigo.
                  </div>
                </div>
              </div>

              {/* Razón social */}
              <Campo label="Razón social / Nombre" requerido>
                <input
                  value={config.razonSocial}
                  onChange={e => actualizarConfig('razonSocial', e.target.value)}
                  placeholder="Ej: EMPRESA EJEMPLO S.A.S"
                  style={inputSt}
                />
              </Campo>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Tipo declarante */}
                <Campo label="Tipo de declarante">
                  <select value={config.tipoDeclarante}
                    onChange={e => actualizarConfig('tipoDeclarante', e.target.value)}
                    style={inputSt}>
                    <option value="contribuyente">Contribuyente</option>
                    <option value="gran_contribuyente">Gran contribuyente</option>
                    <option value="autoretenedor">Autorretenedor</option>
                    <option value="agente_retenedor">Agente retenedor</option>
                    <option value="persona_natural">Persona natural obligada</option>
                    <option value="entidad_sin_animo">Entidad sin ánimo de lucro</option>
                  </select>
                </Campo>

                {/* Año gravable */}
                <Campo label="Año gravable">
                  <select value={config.anioGravable}
                    onChange={e => actualizarConfig('anioGravable', Number(e.target.value))}
                    style={inputSt}>
                    <option value={2025}>2025 (presentación 2026)</option>
                    <option value={2024}>2024 (presentación 2025)</option>
                  </select>
                </Campo>
              </div>

              {/* Municipio */}
              <Campo label="Municipio de la empresa (DIVIPOLA)">
                <select value={config.municipioCodigo}
                  onChange={e => actualizarConfig('municipioCodigo', e.target.value)}
                  style={inputSt}>
                  {DEPTOS_CON_MUNICIPIOS.map(([codDepto, nombreDepto]) => (
                    <optgroup key={codDepto} label={nombreDepto}>
                      {(MUNICIPIOS_POR_DEPTO[codDepto] ?? []).map(m => (
                        <option key={m.codigo} value={m.codigo}>{m.nombre} ({m.codigo})</option>
                      ))}
                    </optgroup>
                  ))}
                  <optgroup label="EXTRANJERO">
                    <option value="00000">EXTRANJERO (00000)</option>
                  </optgroup>
                </select>
              </Campo>
            </Seccion>

            {/* ─── SECCIÓN 2: Archivo de entrada ─── */}
            <Seccion num="2" titulo="Archivo contable" requerido>
              <div
                onClick={() => !archivo && fileRef.current?.click()}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                style={{ border: `2px dashed ${dragOver ? JA.NAVY : archivo ? JA.GREEN : JA.BORDER}`,
                  borderRadius: '4px', padding: '28px 20px', textAlign: 'center',
                  background: dragOver ? JA.BLUE_BG : archivo ? JA.GREEN_BG : JA.WHITE,
                  cursor: archivo ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                <input ref={fileRef} type="file" accept=".csv,.txt,.CSV,.xlsx,.xls" style={{ display: 'none' }} onChange={onFileChange} />
                {!archivo ? (
                  <>
                    <div style={{ marginBottom: '10px', color: JA.GREY }}>
                      <Icon name="folder-open" size={40} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: JA.TEXT, marginBottom: '5px' }}>
                      Arrastre aquí el archivo de su software contable
                    </div>
                    <div style={{ fontSize: '12px', color: JA.GREY, marginBottom: '12px' }}>
                      o haga clic para buscar en su computador
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '11px', color: JA.GREY, background: JA.SURFACE, borderRadius: '2px',
                        padding: '8px 14px', textAlign: 'left', lineHeight: '1.7', flex: '1 1 200px', maxWidth: '260px' }}>
                        <strong>Siigo Nube (.csv)</strong><br />
                        Contabilidad → Libros → Libro Auxiliar → seleccione <em>Todo el año {config.anioGravable}</em> → Exportar CSV
                      </div>
                      <div style={{ fontSize: '11px', color: JA.GREY, background: JA.SURFACE, borderRadius: '2px',
                        padding: '8px 14px', textAlign: 'left', lineHeight: '1.7', flex: '1 1 200px', maxWidth: '260px' }}>
                        <strong>Siigo / World Office / Helisa (.xlsx)</strong><br />
                        Libro Auxiliar de Siigo → Exportar xlsx, o prevalidador DIAN desde otro software
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: '6px', color: JA.GREEN }}>
                      <Icon name="check-circle" size={32} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: JA.GREEN, marginBottom: '3px' }}>{archivo.name}</div>
                    <div style={{ fontSize: '12px', color: JA.GREY, marginBottom: '4px' }}>
                      {(archivo.size / 1024).toFixed(0)} KB · listo para procesar
                    </div>
                    <div style={{ fontSize: '11px', color: tipoArchivo === 'xlsx' ? JA.BLUE : JA.GREY, marginBottom: '10px' }}>
                      {tipoArchivo === 'xlsx' ? 'Archivo xlsx detectado' : 'Libro auxiliar Siigo (.csv)'}
                    </div>
                    <button onClick={e => { e.stopPropagation(); setArchivo(null); setTipoArchivo(null); if (fileRef.current) fileRef.current.value = '' }}
                      style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${JA.BORDER}`,
                        borderRadius: '2px', fontSize: '12px', color: JA.GREY, cursor: 'pointer' }}>
                      Cambiar archivo
                    </button>
                  </>
                )}
              </div>

              {tipoArchivo !== 'xlsx' && (
                <div style={{ fontSize: '11px', color: JA.GREY, padding: '8px 12px', background: JA.AMBER_BG,
                  border: '1px solid #FDE68A', borderRadius: '2px', lineHeight: '1.6', marginTop: '4px' }}>
                  <strong>Importante:</strong> El libro auxiliar debe incluir <em>todos los movimientos del año {config.anioGravable}</em>,
                  con las columnas de tercero (NIT/CC), cuenta PUC, débitos y créditos. Exporte en formato CSV con detalle de movimientos.
                </div>
              )}

              {tipoArchivo === 'xlsx' && (
                <div style={{ fontSize: '11px', color: JA.GREY, padding: '8px 12px', background: JA.BLUE_BG,
                  border: '1px solid #BFDBFE', borderRadius: '2px', lineHeight: '1.6', marginTop: '4px' }}>
                  <strong>Archivo xlsx detectado.</strong> Si es el Libro Auxiliar de Siigo (.xlsx), el sistema aplicará las reglas de clasificación
                  PUC → DIAN automáticamente. Si es el prevalidador DIAN (hojas "1001", "1005"…), se leerá directamente sin transformación.
                </div>
              )}

              {/* Descarga CSV de prueba */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                background: JA.BLUE_BG, border: '1px solid #BFDBFE', borderRadius: '2px' }}>
                <Icon name="beaker" size={16} style={{ color: JA.BLUE, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: JA.BLUE }}>¿Sin archivo? Use el CSV de prueba de Siigo</div>
                  <div style={{ fontSize: '10px', color: JA.GREY }}>Datos ficticios con cuentas PUC reales para verificar que el sistema funciona</div>
                </div>
                <a href="/libro-auxiliar-prueba.csv" download
                  style={{ padding: '5px 12px', background: JA.BLUE, color: JA.WHITE, borderRadius: '2px',
                    fontSize: '11px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Descargar CSV prueba
                </a>
              </div>
            </Seccion>

            {/* ─── SECCIÓN 3: Formatos a generar ─── */}
            <Seccion num="3" titulo="Formatos a generar">
              <div style={{ fontSize: '12px', color: JA.GREY, marginBottom: '10px', lineHeight: '1.5' }}>
                Seleccione los formatos según las obligaciones de la empresa para el año gravable {config.anioGravable}.
                El sistema generará automáticamente cada formato a partir del libro auxiliar.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {FORMATOS_DISPONIBLES.map(codigo => {
                  const info = INFO_FORMATOS[codigo]
                  const version = VERSION_POR_ANIO[config.anioGravable]?.[codigo] ?? 'v1'
                  const seleccionado = config.formatosSeleccionados.includes(codigo)
                  return (
                    <label key={codigo}
                      style={{ display: 'flex', gap: '12px', alignItems: 'flex-start',
                        padding: '12px 14px', borderRadius: '2px', cursor: 'pointer',
                        background: seleccionado ? JA.BLUE_BG : JA.WHITE,
                        border: `1px solid ${seleccionado ? '#BFDBFE' : JA.BORDER}`,
                        transition: 'all 0.12s' }}>
                      <input type="checkbox" checked={seleccionado} onChange={() => toggleFormato(codigo)}
                        style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: JA.NAVY, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ width: '36px', height: '22px', background: seleccionado ? JA.NAVY : JA.SURFACE,
                            color: seleccionado ? JA.WHITE : JA.GREY, borderRadius: '2px', display: 'inline-flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
                            {codigo}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>{info?.nombre}</span>
                          <span style={{ fontSize: '10px', color: JA.GREY, marginLeft: 'auto', padding: '1px 6px',
                            background: JA.SURFACE, borderRadius: '2px' }}>{version}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: JA.GREY, lineHeight: '1.5', paddingLeft: '44px' }}>
                          {info?.descripcion}
                        </div>
                        {seleccionado && GUIA_FORMATOS[codigo] && (
                          <div style={{ paddingLeft: '44px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ fontSize: '10px', color: JA.BLUE }}>
                              <strong>Fuente PUC:</strong> {GUIA_FORMATOS[codigo].fuente}
                            </div>
                            <div style={{ fontSize: '10px', color: '#059669' }}>
                              <strong>Concilia con:</strong> {GUIA_FORMATOS[codigo].concilia}
                            </div>
                            <div style={{ fontSize: '10px', color: JA.AMBER }}>
                              <strong>Tip:</strong> {GUIA_FORMATOS[codigo].tip}
                            </div>
                          </div>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
              {config.formatosSeleccionados.length === 0 && (
                <div style={{ fontSize: '12px', color: JA.RED, marginTop: '6px' }}>
                  Seleccione al menos un formato para continuar.
                </div>
              )}
            </Seccion>

            {/* ─── Validación y botón generar ─── */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '16px 18px' }}>
              {/* Resumen de validación */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <ValidacionItem ok={config.nitDeclarante.replace(/\D/g, '').length >= 5} label="NIT del declarante" />
                <ValidacionItem ok={!!config.razonSocial.trim()} label="Razón social" />
                <ValidacionItem ok={!!archivo} label="Archivo de Siigo (.csv)" />
                <ValidacionItem ok={config.formatosSeleccionados.length > 0} label={`${config.formatosSeleccionados.length} formato(s) seleccionado(s)`} />
              </div>

              <button onClick={generarExogenas} disabled={!puedeGenerar}
                style={{ width: '100%', padding: '18px', borderRadius: '4px', border: 'none',
                  background: puedeGenerar ? JA.NAVY : '#CBD5E1',
                  color: JA.WHITE, fontSize: '16px', fontWeight: 700,
                  cursor: puedeGenerar ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  transition: 'background 0.2s' }}>
                <Icon name="bolt" size={18} />
                {puedeGenerar
                  ? `Generar Exógenas AG ${config.anioGravable} — ${config.formatosSeleccionados.length} formato(s)`
                  : 'Complete los campos requeridos para continuar'}
              </button>

              {puedeGenerar && (
                <div style={{ fontSize: '11px', color: JA.GREY, textAlign: 'center', marginTop: '10px', lineHeight: '1.6' }}>
                  El sistema clasificará los movimientos del Libro Auxiliar según el PUC colombiano
                  y la Resolución DIAN 000227/2025. Podrá seguir cada etapa en tiempo real.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA: PROCESANDO — Stepper en tiempo real
        ══════════════════════════════════════════════════════════ */}
        {vista === 'procesando' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Info de lo que se está generando */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
              padding: '12px 18px', marginBottom: '12px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '10px', color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresa</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>{config.razonSocial}</div>
              </div>
              <div style={{ borderLeft: `1px solid ${JA.BORDER}`, paddingLeft: '16px' }}>
                <div style={{ fontSize: '10px', color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NIT</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>{config.nitDeclarante}-{config.dvDeclarante}</div>
              </div>
              <div style={{ borderLeft: `1px solid ${JA.BORDER}`, paddingLeft: '16px' }}>
                <div style={{ fontSize: '10px', color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Año gravable</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: JA.NAVY }}>{config.anioGravable}</div>
              </div>
              <div style={{ borderLeft: `1px solid ${JA.BORDER}`, paddingLeft: '16px' }}>
                <div style={{ fontSize: '10px', color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Formatos</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>{config.formatosSeleccionados.join(', ')}</div>
              </div>
            </div>

            {/* Barra de progreso */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
              padding: '16px 20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>
                  {porcentaje < 100 ? 'Generando exógenas…' : '¡Proceso completado!'}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: JA.NAVY }}>{porcentaje}%</span>
              </div>
              <div style={{ height: '8px', background: JA.SURFACE, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: JA.NAVY, borderRadius: '4px',
                  width: `${porcentaje}%`, transition: 'width 0.5s ease' }} />
              </div>
            </div>

            {/* Stepper vertical */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
              {etapas.map((etapa, idx) => {
                const esUltima = idx === etapas.length - 1
                const activa = etapa.estado === 'activa'
                const completada = etapa.estado === 'ok'
                const conError = etapa.estado === 'error'
                const colorBorde = completada ? JA.GREEN : activa ? JA.NAVY : conError ? JA.RED : JA.BORDER
                const bgHeader = completada ? '#F0FDF4' : activa ? '#EFF6FF' : JA.WHITE
                return (
                  <div key={etapa.num} style={{ borderBottom: esUltima ? 'none' : `1px solid ${JA.BORDER}` }}>
                    <div style={{ padding: '14px 18px', background: bgHeader, borderLeft: `4px solid ${colorBorde}`,
                      display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                        background: completada ? '#D1FAE5' : activa ? '#DBEAFE' : conError ? '#FEE2E2' : JA.SURFACE,
                        border: `2px solid ${colorBorde}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                        {completada
                          ? <Icon name="check" size={14} style={{ color: JA.GREEN }} />
                          : conError
                          ? <Icon name="x-mark" size={14} style={{ color: JA.RED }} />
                          : activa ? <Spinner /> : <span style={{ fontSize: '12px', fontWeight: 700, color: JA.GREY }}>{etapa.num}</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600,
                          color: completada ? JA.GREEN : activa ? JA.BLUE : conError ? JA.RED : JA.GREY,
                          display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <Icon name={etapa.icono} size={14} style={{ flexShrink: 0 }} />
                          {etapa.titulo}
                        </div>
                        {activa && <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '2px' }}>En proceso…</div>}
                      </div>
                      {completada && (
                        <span style={{ fontSize: '11px', padding: '2px 8px', background: '#D1FAE5',
                          color: JA.GREEN, borderRadius: '2px', fontWeight: 600 }}>Completado</span>
                      )}
                    </div>
                    {(etapa.detalles.length > 0 || etapa.subformatos.length > 0) && (
                      <div style={{ paddingLeft: '54px', paddingRight: '18px', paddingTop: '8px', paddingBottom: '10px', background: JA.BG }}>
                        {etapa.detalles.map((d, i) => (
                          <div key={i} style={{ fontSize: '12px', color: JA.GREY, marginBottom: '4px',
                            display: 'flex', alignItems: 'center', gap: '6px', animation: 'fadeIn 0.3s ease' }}>
                            <span style={{ color: JA.GREEN, fontSize: '10px' }}>└─</span>{d}
                          </div>
                        ))}
                        {etapa.subformatos.map(f => (
                          <div key={f.codigo} style={{ display: 'flex', alignItems: 'center', gap: '8px',
                            marginBottom: '4px', fontSize: '12px', animation: 'fadeIn 0.3s ease' }}>
                            <span style={{ color: JA.GREEN, fontSize: '10px' }}>└─</span>
                            <span style={{ width: '24px', height: '24px',
                              background: f.estado === 'ok' ? JA.NAVY : f.estado === 'activa' ? '#3B82F6' : JA.SURFACE,
                              color: f.estado === 'pendiente' ? JA.GREY : JA.WHITE,
                              borderRadius: '2px', display: 'inline-flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: '9px', fontWeight: 800, flexShrink: 0 }}>
                              {f.estado === 'ok'
                                ? <Icon name="check" size={10} />
                                : f.estado === 'activa'
                                ? <Spinner />
                                : <span style={{ fontSize: '9px', fontWeight: 800 }}>{f.codigo}</span>}
                            </span>
                            <span style={{ color: JA.TEXT, fontWeight: 500 }}>
                              Formato {f.codigo}{f.nombre && <span style={{ color: JA.GREY, fontWeight: 400 }}> — {f.nombre}</span>}
                            </span>
                            {f.detalle && <span style={{ color: JA.GREY, marginLeft: 'auto', fontSize: '11px' }}>{f.detalle}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA: RESUMEN
        ══════════════════════════════════════════════════════════ */}
        {vista === 'resumen' && resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Encabezado empresa */}
            <div style={{ background: JA.NAVY, borderRadius: '2px', padding: '14px 18px',
              display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div style={{ width: '42px', height: '42px', background: JA.GOLD, borderRadius: '2px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="building-office" size={22} style={{ color: JA.NAVY }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: JA.WHITE }}>{config.razonSocial}</div>
                <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                  NIT {config.nitDeclarante}-{config.dvDeclarante} · AG {config.anioGravable} · {config.tipoDeclarante}
                </div>
              </div>
            </div>

            {/* Estado global */}
            <div style={{ background: resultado.resumenExcepciones.criticas > 0 ? JA.AMBER_BG : JA.GREEN_BG,
              border: `1px solid ${resultado.resumenExcepciones.criticas > 0 ? '#FDE68A' : '#BBF7D0'}`,
              borderRadius: '4px', padding: '20px 22px' }}>
              <div style={{ marginBottom: '10px',
                color: resultado.resumenExcepciones.criticas > 0 ? JA.AMBER : JA.GREEN }}>
                <Icon name={resultado.resumenExcepciones.criticas > 0 ? 'triangle-warning' : 'check-circle'} size={28} />
              </div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: JA.TEXT, marginBottom: '4px' }}>
                {resultado.resumenExcepciones.criticas === 0
                  ? '¡Exógenas generadas sin problemas!'
                  : `Generadas — ${resultado.resumenExcepciones.criticas} situación(es) a revisar`}
              </div>
              <div style={{ fontSize: '13px', color: JA.GREY }}>
                Procesé {resultado.asientosProcesados.toLocaleString('es-CO')} movimientos contables.{' '}
                {resultado.resumenExcepciones.descripcionResumen}
              </div>
            </div>

            {/* ══ BANNER DV COMPACTO ══════════════════════════════════════════ */}
            {resultado.autoCorrecciones && resultado.autoCorrecciones.totalCorregidos > 0 && (() => {
              const ac = resultado.autoCorrecciones!
              return (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '2px' }}>
                  <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px' }}>✅</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                      {ac.totalCorregidos} DV{ac.totalCorregidos > 1 ? 's' : ''} corregido{ac.totalCorregidos > 1 ? 's' : ''} automáticamente
                    </span>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
                      {ac.correcciones.map(c => (
                        <span key={c.nit} style={{ fontSize: '11px', padding: '1px 7px', background: JA.WHITE,
                          border: '1px solid #BBF7D0', borderRadius: '2px', color: '#166534', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {c.nit}<span style={{ color: JA.RED, textDecoration: 'line-through', margin: '0 2px' }}>-{c.dvOriginal||'?'}</span>
                          <span style={{ color: JA.GREEN, fontWeight: 700 }}>-{c.dvCorregido}</span>
                        </span>
                      ))}
                    </div>
                    <button onClick={() => setMostrarDvCorregidos(p => !p)}
                      style={{ fontSize: '11px', color: '#166534', background: 'none', border: 'none', cursor: 'pointer', padding: '0', flexShrink: 0 }}>
                      {mostrarDvCorregidos ? 'ocultar ▴' : 'detalle ▾'}
                    </button>
                  </div>
                  {mostrarDvCorregidos && (
                    <div style={{ borderTop: '1px solid #BBF7D0', padding: '8px 12px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                          <tr style={{ color: '#166534', fontWeight: 700 }}>
                            <th style={{ textAlign: 'left', padding: '3px 6px' }}>NIT</th>
                            <th style={{ textAlign: 'left', padding: '3px 6px' }}>DV antes</th>
                            <th style={{ textAlign: 'left', padding: '3px 6px' }}>DV corregido</th>
                            <th style={{ textAlign: 'left', padding: '3px 6px' }}>Nombre en Siigo</th>
                            <th style={{ textAlign: 'right', padding: '3px 6px' }}>Movs.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ac.correcciones.map((c, i) => (
                            <tr key={c.nit} style={{ background: i % 2 === 0 ? JA.WHITE : '#F0FDF4' }}>
                              <td style={{ padding: '3px 6px', fontFamily: 'monospace', fontWeight: 600 }}>{c.nit}</td>
                              <td style={{ padding: '3px 6px', color: JA.RED }}>{c.dvOriginal || '—'}</td>
                              <td style={{ padding: '3px 6px', color: JA.GREEN, fontWeight: 700 }}>{c.dvCorregido}</td>
                              <td style={{ padding: '3px 6px', color: JA.GREY, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</td>
                              <td style={{ padding: '3px 6px', textAlign: 'right', color: JA.GREY }}>{c.asientosAfectados}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })()}
            {/* ══ FIN BANNER DV ════════════════════════════════════════════════ */}

            {/* ══ PANEL AUDITORÍA ValidadorExperto ════════════════════════════ */}
            {resultado.informeValidacion && (() => {
              const inf = resultado.informeValidacion!
              const totalHallazgos = inf.criticos.length + inf.altos.length + inf.medios.length
              if (totalHallazgos === 0 && inf.observaciones.length === 0) return null

              const nivelConfig = {
                critico:     { bg: JA.RED_BG,   border: '#FECACA', texto: JA.RED,   icono: '🔴', etiqueta: 'CRÍTICO' },
                alto:        { bg: JA.AMBER_BG,  border: '#FDE68A', texto: JA.AMBER, icono: '🟠', etiqueta: 'ALTO' },
                medio:       { bg: JA.BLUE_BG,   border: '#BFDBFE', texto: JA.BLUE,  icono: '🟡', etiqueta: 'MEDIO' },
                observacion: { bg: JA.SURFACE,   border: JA.BORDER, texto: JA.GREY,  icono: '📋', etiqueta: 'INFO' },
              }

              type NivelKey = keyof typeof nivelConfig
              type HallazgoUI = { codigo: string; titulo: string; detalle: string; accion: string; formato?: string; valorRef?: number; terceroId?: string }
              type GrupoAudit = { nivel: NivelKey; items: HallazgoUI[] }
              const todosGrupos: GrupoAudit[] = [
                { nivel: 'critico',     items: inf.criticos      as HallazgoUI[] },
                { nivel: 'alto',        items: inf.altos         as HallazgoUI[] },
                { nivel: 'medio',       items: inf.medios        as HallazgoUI[] },
                { nivel: 'observacion', items: inf.observaciones as HallazgoUI[] },
              ]
              const grupos = todosGrupos.filter(g => g.items.length > 0)

              return (
                <div style={{ border: `2px solid ${inf.puedeExportar ? '#FDE68A' : '#FECACA'}`,
                  borderRadius: '2px', overflow: 'hidden', background: JA.WHITE }}>

                  {/* Cabecera del informe */}
                  <div style={{ padding: '12px 18px', background: inf.puedeExportar ? JA.AMBER_BG : JA.RED_BG,
                    borderBottom: `1px solid ${inf.puedeExportar ? '#FDE68A' : '#FECACA'}`,
                    display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>{inf.puedeExportar ? '⚠️' : '🚫'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.06em', color: inf.puedeExportar ? JA.AMBER : JA.RED, marginBottom: '2px' }}>
                        Informe de Auditoría DIAN — ValidadorExperto
                      </div>
                      <div style={{ fontSize: '12px', color: JA.TEXT }}>{inf.resumenTexto}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {inf.criticos.length > 0 && (
                        <div style={{ fontSize: '11px', fontWeight: 700, color: JA.RED }}>
                          {inf.criticos.length} CRÍTICO{inf.criticos.length > 1 ? 'S' : ''}
                        </div>
                      )}
                      {inf.altos.length > 0 && (
                        <div style={{ fontSize: '11px', fontWeight: 600, color: JA.AMBER }}>
                          {inf.altos.length} ALTO{inf.altos.length > 1 ? 'S' : ''}
                        </div>
                      )}
                      {inf.medios.length > 0 && (
                        <div style={{ fontSize: '11px', color: JA.BLUE }}>
                          {inf.medios.length} MEDIO{inf.medios.length > 1 ? 'S' : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hallazgos agrupados por nivel */}
                  {grupos.map(({ nivel, items }) => {
                    const cfg = nivelConfig[nivel]
                    return (
                      <div key={nivel}>
                        <div style={{ padding: '7px 18px', background: JA.SURFACE,
                          borderBottom: `1px solid ${JA.BORDER}`, borderTop: `1px solid ${JA.BORDER}`,
                          fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                          letterSpacing: '0.07em', color: cfg.texto }}>
                          {cfg.icono} {cfg.etiqueta} — {items.length} hallazgo{items.length > 1 ? 's' : ''}
                        </div>
                        {items.map((h, idx) => (
                          <details key={`${nivel}-${idx}`}
                            style={{ borderBottom: `1px solid ${JA.BORDER}` }}
                            open={nivel === 'critico'}>
                            <summary style={{ padding: '11px 18px', cursor: 'pointer',
                              display: 'flex', alignItems: 'flex-start', gap: '10px',
                              background: JA.WHITE, listStyle: 'none' }}>
                              <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '2px',
                                background: cfg.bg, color: cfg.texto, fontWeight: 700,
                                border: `1px solid ${cfg.border}`, flexShrink: 0, marginTop: '1px' }}>
                                {cfg.etiqueta}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT, flex: 1 }}>
                                {h.titulo}
                              </span>
                              {h.formato && (
                                <span style={{ fontSize: '10px', padding: '1px 6px', background: JA.NAVY,
                                  color: JA.WHITE, borderRadius: '2px', flexShrink: 0, marginTop: '2px' }}>
                                  F{h.formato}
                                </span>
                              )}
                            </summary>
                            <div style={{ padding: '0 18px 14px 18px', marginLeft: '0',
                              borderTop: `1px solid ${JA.BORDER}`, background: cfg.bg }}>
                              <div style={{ fontSize: '12px', color: JA.TEXT, lineHeight: '1.65',
                                paddingTop: '12px', marginBottom: '10px' }}>{h.detalle}</div>
                              <div style={{ fontSize: '11px', background: JA.WHITE, border: `1px solid ${cfg.border}`,
                                borderRadius: '2px', padding: '8px 12px', color: JA.TEXT }}>
                                <span style={{ fontWeight: 700, color: cfg.texto }}>▶ Acción requerida: </span>
                                {h.accion}
                              </div>
                              {h.valorRef != null && Math.abs(h.valorRef) > 0 && (
                                <div style={{ marginTop: '6px', fontSize: '11px', color: JA.GREY }}>
                                  Monto involucrado: <strong>{fmtCOP(Math.abs(h.valorRef))}</strong>
                                </div>
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            {/* ══ FIN PANEL AUDITORÍA ══════════════════════════════════════════ */}

            {/* Tabla de formatos */}
            <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 18px', background: JA.SURFACE, borderBottom: `1px solid ${JA.BORDER}`,
                fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: JA.GREY }}>
                Resultado por formato
              </div>
              {resultado.resumenFormatos.map(f => {
                const totalPrincipal = Object.entries(f.totales).find(([k]) => k !== 'totalFilas' && k.startsWith('total'))?.[1] ?? 0
                return (
                  <div key={f.codigo} style={{ padding: '13px 18px', borderBottom: `1px solid ${JA.BORDER}`,
                    display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', background: JA.NAVY, borderRadius: '2px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 800, color: JA.WHITE, flexShrink: 0 }}>{f.codigo}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT }}>{f.nombre}</div>
                      <div style={{ fontSize: '12px', color: JA.GREY, marginTop: '2px' }}>
                        {f.totalFilas.toLocaleString('es-CO')} {f.totalFilas === 1 ? 'tercero' : 'terceros'} · {fmtCOP(totalPrincipal)}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '2px', fontWeight: 600,
                      background: f.excepcionesCriticas > 0 ? '#FEE2E2' : f.excepcionesMedia > 0 ? '#FEF3C7' : '#D1FAE5',
                      color: f.excepcionesCriticas > 0 ? JA.RED : f.excepcionesMedia > 0 ? JA.AMBER : JA.GREEN }}>
                      {f.excepcionesCriticas > 0 ? `${f.excepcionesCriticas} críticas` : f.excepcionesMedia > 0 ? `${f.excepcionesMedia} alertas` : '✓ OK'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Advertencias CSV */}
            {resultado.advertenciasCsv.length > 0 && (
              <details style={{ background: JA.AMBER_BG, border: '1px solid #FDE68A', borderRadius: '2px', padding: '10px 14px' }}>
                <summary style={{ fontSize: '12px', fontWeight: 600, color: JA.AMBER, cursor: 'pointer' }}>
                  {resultado.advertenciasCsv.length} advertencia(s) al leer el archivo de Siigo
                </summary>
                <ul style={{ margin: '8px 0 0', paddingLeft: '16px', fontSize: '11px', color: '#92400E' }}>
                  {resultado.advertenciasCsv.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </details>
            )}

            {/* Cuentas sin regla */}
            {resultado.cuentasSinRegla.length > 0 && (
              <details style={{ background: JA.SURFACE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '10px 14px' }}>
                <summary style={{ fontSize: '12px', fontWeight: 600, color: JA.GREY, cursor: 'pointer' }}>
                  {resultado.cuentasSinRegla.length} cuenta(s) PUC sin clasificación DIAN asignada
                </summary>
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {resultado.cuentasSinRegla.map(c => (
                    <span key={c} style={{ fontSize: '11px', padding: '2px 8px', background: JA.WHITE,
                      border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontFamily: 'monospace' }}>{c}</span>
                  ))}
                </div>
              </details>
            )}

            {/* Detalle del proceso */}
            <details style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px' }}>
              <summary style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 600, color: JA.GREY, cursor: 'pointer' }}>
                Ver detalle del proceso ejecutado
              </summary>
              <div style={{ padding: '0 18px 14px' }}>
                {etapas.filter(e => e.estado === 'ok').map(e => (
                  <div key={e.num} style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: JA.TEXT, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon name={e.icono} size={12} />{e.titulo}
                    </div>
                    {e.detalles.map((d, i) => (
                      <div key={i} style={{ fontSize: '11px', color: JA.GREY, paddingLeft: '16px', marginTop: '3px' }}>└─ {d}</div>
                    ))}
                    {e.subformatos.map(f => (
                      <div key={f.codigo} style={{ fontSize: '11px', color: JA.GREY, paddingLeft: '16px', marginTop: '3px' }}>
                        └─ Formato {f.codigo}: {f.detalle}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </details>

            {/* Acciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {resultado.tarjetasExcepciones.length > 0 && (
                <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setVista('excepciones'); setIndiceExcepcion(0) }}
                  style={{ padding: '15px', background: JA.NAVY, color: JA.WHITE, border: 'none',
                    borderRadius: '4px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Icon name="magnifying-glass" size={16} /> Revisar {resultado.tarjetasExcepciones.length} situación(es) pendientes
                </button>
              )}
              {(() => {
                const bloqueado = resultado.informeValidacion?.puedeExportar === false
                const limpio = resultado.tarjetasExcepciones.length === 0 && !bloqueado
                return (
                  <>
                    {bloqueado && (
                      <div style={{ padding: '11px 14px', background: JA.RED_BG,
                        border: '1px solid #FECACA', borderRadius: '2px',
                        fontSize: '12px', color: JA.RED, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span>🚫</span>
                        <span><strong>Exportación bloqueada.</strong> Corrija los errores CRÍTICOS del informe de auditoría antes de descargar el archivo. La DIAN rechazaría el archivo en su estado actual.</span>
                      </div>
                    )}
                    <button onClick={exportarExcel} disabled={exportando || bloqueado}
                      style={{ padding: '13px',
                        background: bloqueado ? JA.SURFACE : limpio ? JA.GOLD : JA.WHITE,
                        color: bloqueado ? JA.GREY : limpio ? JA.NAVY : JA.GREY,
                        border: `1px solid ${bloqueado ? JA.BORDER : limpio ? JA.GOLD : JA.BORDER}`,
                        borderRadius: '4px', fontSize: '13px',
                        fontWeight: limpio ? 700 : 400,
                        cursor: (exportando || bloqueado) ? 'not-allowed' : 'pointer',
                        opacity: bloqueado ? 0.5 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Icon name="arrow-down-tray" size={16} />
                      {exportando ? 'Generando Excel…' : bloqueado ? 'Exportación bloqueada — corrija errores críticos' : 'Descargar Excel para el Prevalidador DIAN'}
                    </button>
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA: EXCEPCIONES
        ══════════════════════════════════════════════════════════ */}
        {vista === 'excepciones' && resultado && (() => {
          const tarjetas = resultado.tarjetasExcepciones
          const tarjeta = tarjetas[indiceExcepcion]
          const resuelta = excepcionesResueltas.get(indiceExcepcion)
          const severidadColor = tarjeta?.excepcionOriginal.severidad === 'alta' ? JA.RED
            : tarjeta?.excepcionOriginal.severidad === 'media' ? JA.AMBER : JA.BLUE
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Progreso */}
              <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: JA.TEXT }}>
                    Situación {indiceExcepcion + 1} de {tarjetas.length}
                  </span>
                  <span style={{ fontSize: '12px', color: JA.GREEN, fontWeight: 600 }}>
                    {excepcionesResueltas.size} resueltas
                  </span>
                </div>
                <div style={{ height: '5px', background: JA.SURFACE, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: JA.GREEN,
                    width: `${(excepcionesResueltas.size / tarjetas.length) * 100}%`, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {tarjetas.map((t, i) => (
                    <button key={i} onClick={() => setIndiceExcepcion(i)}
                      style={{ width: '26px', height: '26px', borderRadius: '2px', border: 'none', cursor: 'pointer',
                        fontSize: '10px', fontWeight: 700,
                        background: excepcionesResueltas.has(i) ? JA.GREEN : i === indiceExcepcion ? JA.NAVY
                          : t.excepcionOriginal.severidad === 'alta' ? '#FEE2E2' : '#FEF3C7',
                        color: excepcionesResueltas.has(i) || i === indiceExcepcion ? JA.WHITE : JA.TEXT }}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                
                {/* Botones de acción masiva */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${JA.BORDER}` }}>
                  <button onClick={() => {
                    setExcepcionesResueltas(prev => {
                      const n = new Map(prev)
                      tarjetas.forEach((t, i) => {
                        if (!n.has(i) && t.dvSugerido) n.set(i, { accion: 'corregir_dv', datos: t.dvSugerido })
                      })
                      return n
                    })
                  }} style={{ padding: '6px 12px', background: JA.SURFACE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icon name="check-circle" size={14} /> DVs Calculados
                  </button>

                  <button onClick={async () => {
                    const filas = tarjetas.map((t, i) => {
                      if (excepcionesResueltas.has(i)) return null
                      return {
                        'No.': i + 1,
                        'Situación': t.titulo,
                        'NIT': t.contexto?.terceroId ?? '',
                        'Nombre': t.contexto?.nombreTercero ?? '',
                        'Cuenta': t.contexto?.cuenta ?? '',
                        'Monto': t.contexto?.monto ?? '',
                        'Severidad': t.excepcionOriginal.severidad,
                        'Resolución': ''
                      }
                    }).filter(Boolean)
                    const XLSX = await import('xlsx')
                    const ws = XLSX.utils.json_to_sheet(filas)
                    const wb = XLSX.utils.book_new()
                    XLSX.utils.book_append_sheet(wb, ws, 'Pendientes')
                    XLSX.writeFile(wb, `Pendientes_Exogena_${config.anioGravable}.xlsx`)
                  }} style={{ padding: '6px 12px', background: JA.SURFACE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icon name="arrow-down-tray" size={14} /> Descargar XLSX
                  </button>

                  <label style={{ padding: '6px 12px', background: JA.SURFACE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icon name="arrow-up-tray" size={14} /> Subir Corregido (XLSX)
                    <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      try {
                        const XLSX = await import('xlsx'); const data = await file.arrayBuffer()
                        const wb = XLSX.read(data); const ws = wb.Sheets[wb.SheetNames[0]]
                        const json = XLSX.utils.sheet_to_json(ws) as any[]
                        setExcepcionesResueltas(prev => {
                          const n = new Map(prev)
                          json.forEach(row => {
                            const no = parseInt(row['No.'] || 0)
                            if (!no) return
                            const res = row['Resolución']?.toString().trim()
                            if (res) {
                              let act: any = 'asignar_tercero'
                              const l = res.toLowerCase()
                              if (l.includes('excluir')) act = 'excluir'
                              else if (l.includes('ok') || l.includes('bien')) act = 'confirmar_correcto'
                              else if (l.includes('diferir')) act = 'diferir'
                              n.set(no - 1, { accion: act, datos: res })
                            }
                          })
                          return n
                        }); e.target.value = ''
                      } catch (err) { alert('Error al leer el archivo Excel.') }
                    }} />
                  </label>

                  <div style={{ width: '1px', background: JA.BORDER, margin: '0 4px' }} />

                  <button onClick={() => setExcepcionesResueltas(prev => { const n = new Map(prev); tarjetas.forEach((_, i) => !n.has(i) && n.set(i, { accion: 'confirmar_correcto' })); return n })}
                    style={{ padding: '6px 12px', background: JA.WHITE, border: `1px solid ${JA.GREEN}`, color: JA.GREEN, borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Está bien todo</button>

                  <button onClick={() => setExcepcionesResueltas(prev => { const n = new Map(prev); tarjetas.forEach((_, i) => !n.has(i) && n.set(i, { accion: 'excluir' })); return n })}
                    style={{ padding: '6px 12px', background: JA.WHITE, border: `1px solid ${JA.RED}`, color: JA.RED, borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Excluir todo</button>

                  <button onClick={() => setExcepcionesResueltas(prev => { const n = new Map(prev); tarjetas.forEach((_, i) => !n.has(i) && n.set(i, { accion: 'diferir' })); return n })}
                    style={{ padding: '6px 12px', background: JA.WHITE, border: `1px solid ${JA.GREY}`, color: JA.GREY, borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>Revisar después</button>
                </div>
              </div>

              {/* Tarjeta */}
              {tarjeta && (
                <div style={{ background: JA.WHITE, border: `2px solid ${resuelta ? JA.GREEN : severidadColor}`, borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px',
                    background: resuelta ? JA.GREEN_BG : tarjeta.excepcionOriginal.severidad === 'alta' ? JA.RED_BG : JA.AMBER_BG,
                    borderBottom: `1px solid ${resuelta ? '#BBF7D0' : tarjeta.excepcionOriginal.severidad === 'alta' ? '#FECACA' : '#FDE68A'}`,
                    display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, marginTop: '2px',
                      color: resuelta ? JA.GREEN : tarjeta.excepcionOriginal.severidad === 'alta' ? JA.RED : JA.AMBER }}>
                      <Icon name={resuelta ? 'check-circle' : tarjeta.icono} size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: JA.TEXT }}>
                        {resuelta ? 'Situación resuelta' : tarjeta.titulo}
                      </div>
                      {!resuelta && (
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '2px', fontWeight: 700,
                          marginTop: '4px', display: 'inline-block',
                          background: tarjeta.excepcionOriginal.severidad === 'alta' ? '#FEE2E2' : '#FEF3C7',
                          color: severidadColor }}>
                          {tarjeta.excepcionOriginal.severidad === 'alta' ? 'CRÍTICA — la DIAN puede rechazar esto' : 'ALERTA — revise antes de enviar'}
                        </span>
                      )}
                    </div>
                  </div>
                  {!resuelta && (
                    <div style={{ padding: '20px' }}>
                      <p style={{ fontSize: '14px', color: JA.TEXT, lineHeight: '1.7', margin: '0 0 14px' }}>
                        {tarjeta.explicacion}
                      </p>
                      {tarjeta.contexto && Object.values(tarjeta.contexto).some(Boolean) && (
                        <div style={{ background: JA.SURFACE, borderRadius: '2px', padding: '10px 14px',
                          marginBottom: '14px', display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                          {tarjeta.contexto.cuenta && <InfoDato label="Cuenta" valor={`${tarjeta.contexto.cuenta}${tarjeta.contexto.nombreCuenta ? ` — ${tarjeta.contexto.nombreCuenta}` : ''}`} />}
                          {tarjeta.contexto.monto != null && <InfoDato label="Valor" valor={fmtCOP(tarjeta.contexto.monto)} />}
                          {tarjeta.contexto.documentoId && <InfoDato label="Comprobante" valor={tarjeta.contexto.documentoId} />}
                          {tarjeta.contexto.terceroId && <InfoDato label="NIT/Doc. (A quién)" valor={`${tarjeta.contexto.terceroId}${tarjeta.contexto.nombreTercero ? ` — ${tarjeta.contexto.nombreTercero}` : ''}`} />}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: JA.GREY, padding: '10px 13px',
                        background: JA.SURFACE, borderRadius: '2px', borderLeft: `3px solid ${JA.GREY}`,
                        marginBottom: '18px', lineHeight: '1.6' }}>
                        <strong>¿Por qué importa?</strong> {tarjeta.impacto}
                      </div>
                      {mostrarBusqueda && (
                        <div style={{ marginBottom: '14px', padding: '12px 14px', background: JA.BLUE_BG,
                          border: '1px solid #BFDBFE', borderRadius: '2px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: JA.BLUE, marginBottom: '6px' }}>
                            Buscar tercero por NIT o nombre
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input value={busquedaTercero} onChange={e => setBusquedaTercero(e.target.value)}
                              placeholder="Ej: 900123456 o EMPRESA XYZ"
                              style={{ ...inputSt, flex: 1 }} autoFocus />
                            <button onClick={() => resolverExcepcion('asignar_tercero', busquedaTercero)}
                              disabled={!busquedaTercero.trim()}
                              style={{ padding: '8px 14px', background: JA.BLUE, color: JA.WHITE, border: 'none',
                                borderRadius: '2px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                              Asignar
                            </button>
                          </div>
                        </div>
                      )}
                      {/* Panel DV: verifica con el sistema RUES + módulo 11 */}
                      {(tarjeta.excepcionOriginal.tipo === 'dv_incorrecto' || tarjeta.excepcionOriginal.tipo === 'dv_faltante') && (() => {
                        const nit = (tarjeta.contexto?.terceroId as string ?? '').replace(/\D/g, '')
                        if (!nit) return null
                        const dvCalc = tarjeta.dvSugerido ?? ''
                        const cached = nitVerifyCache.get(nit)
                        const loading = nitVerifyLoading === nit
                        // Disparar verificación si aún no está en caché
                        if (!cached && !loading) verificarNitRUES(nit)
                        const dvFinal = cached?.dv || dvCalc
                        const razon   = cached?.razonSocial
                        const ciuu    = cached?.ciuu
                        return (
                          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0',
                            borderRadius: '2px', padding: '10px 14px', marginBottom: '12px',
                            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            {/* NIT + DV */}
                            <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 800, color: JA.TEXT, flexShrink: 0 }}>
                              {nit}–<span style={{ color: JA.GREEN }}>{dvFinal || '…'}</span>
                            </div>
                            {/* Fuente */}
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '2px', fontWeight: 700, flexShrink: 0,
                              background: cached ? '#D1FAE5' : '#FEF3C7',
                              color: cached ? '#166534' : JA.AMBER }}>
                              {loading ? 'Verificando RUES…' : cached ? '✓ RUES verificado' : 'módulo 11'}
                            </span>
                            {/* Razón social */}
                            {razon && <span style={{ fontSize: '12px', color: JA.TEXT, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{razon}</span>}
                            {/* CIIU */}
                            {ciuu && <span style={{ fontSize: '11px', color: JA.GREY, flexShrink: 0 }}>🏢 {ciuu}</span>}
                          </div>
                        )
                      })()}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tarjeta.acciones.map(accion => (
                          <button key={accion.tipo}
                            onClick={() => {
                              if (accion.tipo === 'asignar_tercero') { setMostrarBusqueda(true); return }
                              if (accion.tipo === 'corregir_dv') {
                                const nit = (tarjeta.contexto?.terceroId as string ?? '').replace(/\D/g, '')
                                const dvRUES = nitVerifyCache.get(nit)?.dv
                                // Priorizar DV del RUES; si no, usar el calculado por módulo 11
                                const dv = dvRUES || tarjeta.dvSugerido
                                  || window.prompt('Ingrese el dígito de verificación (0–9):')
                                if (dv) resolverExcepcion(accion.tipo, dv)
                                return
                              }
                              if (accion.tipo === 'asignar_concepto') {
                                const concepto = window.prompt('Ingrese el código de concepto DIAN (ej. 5001):')
                                if (concepto) resolverExcepcion(accion.tipo, concepto)
                                return
                              }
                              resolverExcepcion(accion.tipo, tarjeta.dvSugerido)
                            }}
                            style={{ padding: '11px 14px', border: `1px solid ${accion.primaria ? JA.NAVY : JA.BORDER}`,
                              borderRadius: '2px', background: accion.primaria ? JA.NAVY : JA.WHITE,
                              color: accion.primaria ? JA.WHITE : JA.TEXT,
                              fontSize: '13px', fontWeight: accion.primaria ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}>
                            {(() => {
                              if (accion.tipo !== 'corregir_dv') return accion.etiqueta
                              const nit = (tarjeta.contexto?.terceroId as string ?? '').replace(/\D/g, '')
                              const dvRUES = nitVerifyCache.get(nit)?.dv
                              const dvFinal = dvRUES || tarjeta.dvSugerido
                              if (!dvFinal) return accion.etiqueta
                              return `Aplicar DV ${dvFinal} ${dvRUES ? '(verificado RUES ✓)' : '(módulo 11 ✓)'}`
                            })()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {resuelta && (
                    <div style={{ padding: '14px 20px', fontSize: '13px', color: JA.GREEN }}>
                      {resuelta.accion === 'corregir_dv' && resuelta.datos ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>✅</span>
                          <div>
                            <div style={{ fontWeight: 700 }}>DV corregido y verificado — NIT actualizado en el archivo</div>
                            <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>
                              Nuevo DV: <strong>{resuelta.datos}</strong> · El registro se marcó como &quot;Corregido por usuario&quot;
                              · El Excel exportará el NIT con el DV correcto.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>Acción: <strong>{etiquetaAccion(resuelta.accion)}</strong>
                        {resuelta.datos && <span style={{ color: JA.GREY }}> — {resuelta.datos}</span>}</>
                      )}
                      <button onClick={() => setExcepcionesResueltas(prev => { const n = new Map(prev); n.delete(indiceExcepcion); return n })}
                        style={{ marginLeft: '12px', fontSize: '11px', color: JA.GREY, background: 'none',
                          border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cambiar</button>
                    </div>
                  )}
                </div>
              )}

              {/* Navegación */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setIndiceExcepcion(i => Math.max(0, i - 1))} disabled={indiceExcepcion === 0}
                  style={{ flex: 1, padding: '10px', background: JA.WHITE, border: `1px solid ${JA.BORDER}`,
                    borderRadius: '2px', fontSize: '13px', color: JA.TEXT,
                    cursor: indiceExcepcion === 0 ? 'not-allowed' : 'pointer', opacity: indiceExcepcion === 0 ? 0.4 : 1 }}>
                  ← Anterior
                </button>
                {excepcionesPendientes === 0 ? (
                  <button onClick={() => setVista('listo')}
                    style={{ flex: 2, padding: '10px', background: JA.GREEN, color: JA.WHITE, border: 'none',
                      borderRadius: '2px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                    ✓ Terminado → Ver resultado final
                  </button>
                ) : (
                  <button onClick={() => {
                    let sig = indiceExcepcion + 1
                    while (sig < tarjetas.length && excepcionesResueltas.has(sig)) sig++
                    if (sig < tarjetas.length) setIndiceExcepcion(sig); else setVista('listo')
                  }}
                    style={{ flex: 2, padding: '10px', background: JA.NAVY, color: JA.WHITE, border: 'none',
                      borderRadius: '2px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    Siguiente situación →
                  </button>
                )}
              </div>
              <button onClick={() => setVista('resumen')} style={{ padding: '8px', background: 'transparent',
                border: 'none', fontSize: '12px', color: JA.GREY, cursor: 'pointer', textDecoration: 'underline' }}>
                Volver al resumen
              </button>
            </div>
          )
        })()}

        {/* ══════════════════════════════════════════════════════════
            VISTA: LISTO
        ══════════════════════════════════════════════════════════ */}
        {vista === 'listo' && resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: JA.GREEN_BG, border: '1px solid #BBF7D0', borderRadius: '4px',
              padding: '28px', textAlign: 'center' }}>
              <div style={{ marginBottom: '12px', color: JA.GREEN }}>
                <Icon name="check-circle" size={48} />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: JA.TEXT, marginBottom: '6px' }}>
                Exógenas listas para la DIAN
              </div>
              <div style={{ fontSize: '13px', color: JA.GREY, marginBottom: '6px' }}>
                {config.razonSocial} · NIT {config.nitDeclarante}-{config.dvDeclarante} · AG {config.anioGravable}
              </div>
              <p style={{ fontSize: '13px', color: JA.GREY, marginBottom: '22px', lineHeight: '1.6' }}>
                {excepcionesResueltas.size > 0
                  ? `Resolvió ${excepcionesResueltas.size} situación(es). El archivo está listo para el Prevalidador DIAN.`
                  : 'El archivo está listo para cargar en el Prevalidador de la DIAN.'}
              </p>
              <button onClick={exportarExcel} disabled={exportando}
                style={{ padding: '15px 30px', background: JA.GOLD, color: JA.NAVY, border: 'none',
                  borderRadius: '4px', fontSize: '15px', fontWeight: 800,
                  cursor: exportando ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="arrow-down-tray" size={18} />
                {exportando ? 'Generando…' : 'Descargar Excel para el Prevalidador DIAN'}
              </button>
              <div style={{ fontSize: '11px', color: JA.GREY, marginTop: '12px' }}>
                Verifique siempre en el Prevalidador oficial de la DIAN antes de presentar.
              </div>
            </div>
            <button onClick={reiniciar} style={{ padding: '11px', background: 'transparent',
              border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '13px', color: JA.GREY, cursor: 'pointer' }}>
              Generar exógenas de otra empresa
            </button>
          </div>
        )}

        </> /* fin tab generar */}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Seccion({ num, titulo, requerido, children }: {
  num: string; titulo: string; requerido?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', background: JA.SURFACE, borderBottom: `1px solid ${JA.BORDER}`,
        display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '24px', height: '24px', background: JA.NAVY, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 800, color: JA.WHITE, flexShrink: 0 }}>{num}</div>
        <span style={{ fontSize: '13px', fontWeight: 700, color: JA.TEXT }}>{titulo}</span>
        {requerido && (
          <span style={{ fontSize: '10px', padding: '1px 6px', background: '#FEE2E2', color: JA.RED,
            borderRadius: '2px', fontWeight: 600 }}>REQUERIDO</span>
        )}
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, requerido, children }: { label: string; requerido?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: JA.GREY,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>
        {label}{requerido && <span style={{ color: JA.RED, marginLeft: '3px' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function ValidacionItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
        background: ok ? JA.GREEN : JA.BORDER, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', color: JA.WHITE }}>
        {ok && <Icon name="check" size={10} style={{ color: JA.WHITE }} />}
      </div>
      <span style={{ fontSize: '12px', color: ok ? JA.GREEN : JA.GREY }}>{label}</span>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ width: '14px', height: '14px', border: '2px solid #BFDBFE',
      borderTop: `2px solid ${JA.BLUE}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  )
}

function InfoDato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: JA.TEXT, marginTop: '2px' }}>{valor}</div>
    </div>
  )
}

function etiquetaAccion(accion: AccionExcepcion): string {
  const m: Record<AccionExcepcion, string> = {
    asignar_tercero: 'Tercero asignado', corregir_dv: 'DV corregido',
    asignar_concepto: 'Concepto asignado', excluir: 'Excluido del reporte',
    confirmar_correcto: 'Confirmado correcto', diferir: 'Pendiente de revisión',
  }
  return m[accion] ?? accion
}

// (ConfiguracionMagnetica se importa desde ./ConfiguracionMagnetica.tsx)

// ── [obsoleto — kept for unused-var suppression] ──────────────────────────────
interface ReglaUI {
  id?: string
  formatoCodigo: string
  cuentaPucPatron: string
  conceptoCodigo: string
  naturaleza: '' | 'debito' | 'credito'
  notas: string
  esDefault?: boolean
}

function ConfiguracionPUC() {
  const [defaultReglas, setDefaultReglas] = useState<ReglaUI[]>([])
  const [customReglas, setCustomReglas] = useState<ReglaUI[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msgGuardado, setMsgGuardado] = useState('')
  const [formatoFiltro, setFormatoFiltro] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [nuevaRegla, setNuevaRegla] = useState<ReglaUI>({
    formatoCodigo: '1001', cuentaPucPatron: '', conceptoCodigo: '', naturaleza: '', notas: '',
  })
  const [mostrarFormNueva, setMostrarFormNueva] = useState(false)

  useEffect(() => {
    fetch('/api/exogenas/reglas')
      .then(r => r.json())
      .then((d: { reglasDefault?: ReglaUI[]; reglasOverride?: ReglaUI[] }) => {
        setDefaultReglas((d.reglasDefault ?? []).map(r => ({ ...r, esDefault: true })))
        setCustomReglas(d.reglasOverride ?? [])
      })
      .catch(() => { /* ignorar */ })
      .finally(() => setCargando(false))
  }, [])

  const guardarReglas = async () => {
    setGuardando(true)
    setMsgGuardado('')
    try {
      const res = await fetch('/api/exogenas/reglas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reglas: customReglas.map(r => ({
            formato_codigo:    r.formatoCodigo,
            cuenta_puc_patron: r.cuentaPucPatron,
            concepto_codigo:   r.conceptoCodigo,
            prioridad:         1,
            naturaleza:        r.naturaleza || null,
            notas:             r.notas || null,
          })),
        }),
      })
      const d = await res.json() as { reglasGuardadas?: number; error?: string }
      if (d.error) throw new Error(d.error)
      setMsgGuardado(`${d.reglasGuardadas ?? 0} regla(s) guardadas`)
    } catch (e) {
      setMsgGuardado(`Error: ${e instanceof Error ? e.message : 'Error desconocido'}`)
    } finally { setGuardando(false) }
  }

  const agregarRegla = () => {
    if (!nuevaRegla.cuentaPucPatron.trim() || !nuevaRegla.conceptoCodigo.trim()) return
    setCustomReglas(prev => [...prev, { ...nuevaRegla }])
    setNuevaRegla({ formatoCodigo: nuevaRegla.formatoCodigo, cuentaPucPatron: '', conceptoCodigo: '', naturaleza: '', notas: '' })
    setMostrarFormNueva(false)
    setMsgGuardado('')
  }

  const eliminarCustom = (cuentaPuc: string, concepto: string) => {
    setCustomReglas(prev => prev.filter(r => !(r.cuentaPucPatron === cuentaPuc && r.conceptoCodigo === concepto)))
    setMsgGuardado('')
  }

  const COLOR_FORMATO: Record<string, string> = {
    '1001': '#1D4ED8', '1003': '#7C3AED', '1005': '#0891B2', '1006': '#0369A1',
    '1007': '#059669', '1008': '#D97706', '1009': '#DC2626', '1010': '#9333EA', '2276': '#B45309',
  }
  const LABEL_NAT: Record<string, string> = { '': 'Saldo final cuenta', 'debito': 'Saldo Débito', 'credito': 'Saldo Crédito' }

  // Combinar todas las reglas en una vista unificada (igual que Siigo)
  const todasLasReglas = [
    ...customReglas.map(r => ({ ...r, esCustom: true })),
    ...defaultReglas.map(r => ({ ...r, esCustom: false })),
  ]

  const reglasFiltradas = todasLasReglas.filter(r => {
    const pasaFormato = formatoFiltro === 'todos' || r.formatoCodigo === formatoFiltro
    const pasaBusqueda = !busqueda || r.cuentaPucPatron.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.conceptoCodigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      (r.notas ?? '').toLowerCase().includes(busqueda.toLowerCase())
    return pasaFormato && pasaBusqueda
  })

  const conceptoLabel = (fmt: string, cod: string) =>
    (CONCEPTOS_POR_FORMATO[fmt] ?? []).find(c => c.valor === cod)?.label ?? cod

  if (cargando) return (
    <div style={{ textAlign: 'center', padding: '80px', color: JA.GREY, fontSize: '13px' }}>
      Cargando configuración de formatos…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

      {/* ── Encabezado estilo Siigo ── */}
      <div style={{ background: JA.WHITE, borderBottom: `1px solid ${JA.BORDER}`, padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: JA.NAVY }}>
            Asistente medios magnéticos — Configuración de formatos
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: JA.GREY }}>
            Año 2025 · Defina qué cuenta PUC alimenta cada formato DIAN. Las reglas de &quot;Mi empresa&quot; tienen prioridad.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {msgGuardado && (
            <span style={{ fontSize: '12px', color: msgGuardado.startsWith('Error') ? JA.RED : JA.GREEN,
              padding: '4px 10px', background: msgGuardado.startsWith('Error') ? '#FEE2E2' : '#D1FAE5',
              borderRadius: '2px' }}>
              {msgGuardado}
            </span>
          )}
          {customReglas.length > 0 && (
            <button onClick={guardarReglas} disabled={guardando}
              style={{ padding: '8px 18px', background: JA.GOLD, color: JA.NAVY, border: 'none',
                borderRadius: '2px', fontSize: '12px', fontWeight: 700, cursor: guardando ? 'wait' : 'pointer' }}>
              {guardando ? 'Guardando…' : 'Guardar configuración'}
            </button>
          )}
          <button onClick={() => setMostrarFormNueva(!mostrarFormNueva)}
            style={{ padding: '8px 16px', background: JA.NAVY, color: JA.WHITE, border: 'none',
              borderRadius: '2px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px' }}>
            + Adicionar nuevo registro
          </button>
        </div>
      </div>

      {/* ── Barra de filtros (estilo Siigo) ── */}
      <div style={{ background: JA.SURFACE, borderBottom: `1px solid ${JA.BORDER}`, padding: '10px 20px',
        display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar cuenta PUC o concepto…"
          style={{ ...inputStConf, maxWidth: '260px', padding: '6px 10px' }} />
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {(['todos', ...FORMATOS_DISPONIBLES]).map(f => (
            <button key={f} onClick={() => setFormatoFiltro(f)}
              style={{ padding: '5px 11px', borderRadius: '2px', border: `1px solid ${formatoFiltro === f ? 'transparent' : JA.BORDER}`,
                cursor: 'pointer', fontSize: '11px', fontWeight: formatoFiltro === f ? 700 : 400,
                background: formatoFiltro === f ? (COLOR_FORMATO[f] ?? JA.NAVY) : JA.WHITE,
                color: formatoFiltro === f ? JA.WHITE : JA.TEXT }}>
              {f === 'todos' ? 'Todos' : `F${f}`}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '11px', color: JA.GREY, marginLeft: 'auto' }}>
          {reglasFiltradas.length} registro(s) · {customReglas.length} personalizados · {defaultReglas.length} DIAN 2025
        </span>
      </div>

      {/* ── Formulario nueva regla (debajo de la barra) ── */}
      {mostrarFormNueva && (
        <div style={{ background: '#EFF6FF', borderBottom: `2px solid #BFDBFE`, padding: '14px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: JA.BLUE, marginBottom: '10px' }}>
            Nuevo registro — asigne una cuenta PUC a un formato DIAN
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 200px 1fr 150px auto', gap: '10px', alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: '10px', color: JA.GREY, marginBottom: '3px', fontWeight: 700 }}>Cuenta contable *</div>
              <input value={nuevaRegla.cuentaPucPatron} placeholder="Ej: 51050601 o 5120%"
                onChange={e => setNuevaRegla(p => ({ ...p, cuentaPucPatron: e.target.value }))}
                style={inputStConf} autoFocus />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: JA.GREY, marginBottom: '3px', fontWeight: 700 }}>Formato *</div>
              <select value={nuevaRegla.formatoCodigo}
                onChange={e => setNuevaRegla(p => ({ ...p, formatoCodigo: e.target.value, conceptoCodigo: '' }))}
                style={inputStConf}>
                {FORMATOS_DISPONIBLES.map(f => <option key={f} value={f}>Formato {f}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: JA.GREY, marginBottom: '3px', fontWeight: 700 }}>Concepto DIAN *</div>
              <select value={nuevaRegla.conceptoCodigo}
                onChange={e => setNuevaRegla(p => ({ ...p, conceptoCodigo: e.target.value }))}
                style={inputStConf}>
                <option value="">— Seleccionar concepto —</option>
                {(CONCEPTOS_POR_FORMATO[nuevaRegla.formatoCodigo] ?? []).map(c => (
                  <option key={c.valor} value={c.valor}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: JA.GREY, marginBottom: '3px', fontWeight: 700 }}>Valor a reportar</div>
              <select value={nuevaRegla.naturaleza}
                onChange={e => setNuevaRegla(p => ({ ...p, naturaleza: e.target.value as '' | 'debito' | 'credito' }))}
                style={inputStConf}>
                <option value="">Saldo final cuenta</option>
                <option value="debito">Saldo Débito</option>
                <option value="credito">Saldo Crédito</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '6px', paddingBottom: '1px' }}>
              <button onClick={agregarRegla}
                disabled={!nuevaRegla.cuentaPucPatron.trim() || !nuevaRegla.conceptoCodigo}
                style={{ padding: '8px 14px', background: JA.NAVY, color: JA.WHITE, border: 'none',
                  borderRadius: '2px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  opacity: (!nuevaRegla.cuentaPucPatron.trim() || !nuevaRegla.conceptoCodigo) ? 0.4 : 1 }}>
                Agregar
              </button>
              <button onClick={() => setMostrarFormNueva(false)}
                style={{ padding: '8px 10px', background: 'transparent', color: JA.GREY,
                  border: `1px solid ${JA.BORDER}`, borderRadius: '2px', fontSize: '12px', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          </div>
          <div style={{ fontSize: '10px', color: JA.GREY, marginTop: '8px' }}>
            Use <strong>%</strong> al final como comodín. Ej: <code>5120%</code> = todas las subcuentas 5120xx.
            Cuenta exacta: <code>51050601</code> = solo esa subcuenta específica.
          </div>
        </div>
      )}

      {/* ── Tabla unificada estilo Siigo ── */}
      <div style={{ overflowX: 'auto', background: JA.WHITE }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: JA.SURFACE, position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={thSt}>Cuenta contable</th>
              <th style={{ ...thSt, width: '70px' }}>Formato</th>
              <th style={{ ...thSt, width: '80px' }}>Concepto</th>
              <th style={{ ...thSt, minWidth: '180px' }}>Categoría</th>
              <th style={{ ...thSt, width: '140px' }}>Valor a reportar</th>
              <th style={{ ...thSt, width: '36px' }}></th>
            </tr>
          </thead>
          <tbody>
            {reglasFiltradas.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: JA.GREY, fontSize: '13px' }}>
                  No hay registros con los filtros aplicados.
                </td>
              </tr>
            )}
            {reglasFiltradas.map((r, idx) => {
              const colorFmt = COLOR_FORMATO[r.formatoCodigo] ?? JA.NAVY
              const conceptoDesc = conceptoLabel(r.formatoCodigo, r.conceptoCodigo)
              const catLabel = conceptoDesc.includes('—') ? conceptoDesc.split('—')[1].trim() : conceptoDesc
              return (
                <tr key={idx} style={{
                  borderBottom: `1px solid ${JA.BORDER}`,
                  background: r.esCustom ? '#FFFBEB' : idx % 2 === 0 ? JA.WHITE : JA.BG,
                }}>
                  {/* Cuenta contable */}
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: JA.NAVY, fontSize: '12px' }}>
                      {r.cuentaPucPatron}
                    </span>
                    {r.esCustom && (
                      <span style={{ marginLeft: '8px', fontSize: '9px', padding: '1px 6px', background: '#FEF3C7',
                        color: '#92400E', borderRadius: '2px', fontWeight: 700 }}>MI EMPRESA</span>
                    )}
                    {r.notas && (
                      <span style={{ marginLeft: '6px', fontSize: '10px', color: JA.GREY }}>— {r.notas}</span>
                    )}
                  </td>
                  {/* Formato */}
                  <td style={{ padding: '9px 14px' }}>
                    {r.formatoCodigo && (
                      <span style={{ padding: '2px 8px', background: colorFmt, color: JA.WHITE,
                        borderRadius: '2px', fontSize: '10px', fontWeight: 800 }}>{r.formatoCodigo}</span>
                    )}
                  </td>
                  {/* Concepto */}
                  <td style={{ padding: '9px 14px', fontWeight: 600, color: JA.TEXT }}>
                    {r.conceptoCodigo}
                  </td>
                  {/* Categoría (descripción del concepto) */}
                  <td style={{ padding: '9px 14px', color: JA.GREY, fontSize: '11px', maxWidth: '220px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {catLabel}
                  </td>
                  {/* Valor a reportar */}
                  <td style={{ padding: '9px 14px', color: JA.GREY, fontSize: '11px' }}>
                    {LABEL_NAT[r.naturaleza ?? ''] ?? 'Saldo final cuenta'}
                  </td>
                  {/* Eliminar (solo custom) */}
                  <td style={{ padding: '9px 8px', textAlign: 'center' }}>
                    {r.esCustom && (
                      <button onClick={() => eliminarCustom(r.cuentaPucPatron, r.conceptoCodigo)}
                        title="Eliminar esta regla personalizada"
                        style={{ width: '26px', height: '26px', background: '#FEE2E2', color: JA.RED,
                          border: 'none', borderRadius: '2px', cursor: 'pointer', fontSize: '13px',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        ␡
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Leyenda ── */}
      <div style={{ padding: '10px 20px', background: JA.SURFACE, borderTop: `1px solid ${JA.BORDER}`,
        display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: JA.GREY }}>
          <span style={{ width: '14px', height: '14px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '2px', display: 'inline-block' }} />
          Reglas de mi empresa (mayor prioridad — editables)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: JA.GREY }}>
          <span style={{ width: '14px', height: '14px', background: JA.WHITE, border: `1px solid ${JA.BORDER}`, borderRadius: '2px', display: 'inline-block' }} />
          Reglas predeterminadas DIAN 2025 (basadas en Siigo Nube + Res. 000227/2025)
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '10px', color: JA.GREY }}>
          Las reglas predeterminadas garantizan el mapeo correcto para la mayoría de empresas colombianas.
          Agregue reglas propias solo para cuentas auxiliares específicas de su plan de cuentas.
        </div>
      </div>
    </div>
  )
}

const inputStConf: React.CSSProperties = {
  width: '100%', padding: '7px 9px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px',
  fontSize: '12px', color: JA.TEXT, background: JA.WHITE, boxSizing: 'border-box',
  fontFamily: 'Inter, sans-serif', outline: 'none',
}

const thSt: React.CSSProperties = {
  padding: '9px 14px', textAlign: 'left', borderBottom: `2px solid ${JA.BORDER}`,
  fontSize: '10px', fontWeight: 700, color: JA.GREY, textTransform: 'uppercase',
  letterSpacing: '0.05em', background: JA.SURFACE, whiteSpace: 'nowrap',
}

// ── Iconos SVG — sin emojis ───────────────────────────────────────────────────
type IconName =
  | 'folder-open' | 'document-list' | 'magnifying-glass' | 'chart-bar' | 'shield-check'
  | 'bolt' | 'beaker' | 'arrow-down-tray' | 'triangle-warning' | 'check-circle'
  | 'check' | 'x-mark' | 'question-circle' | 'hashtag' | 'tag' | 'user-circle'
  | 'arrows-rotate' | 'building-office' | 'file-spreadsheet'

function Icon({ name, size = 16, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  const paths: Record<string, React.ReactNode> = {
    'folder-open': <><path d="M2 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v1H2V6z"/><path d="M1 10a1 1 0 011-1h18a1 1 0 01.97 1.243l-2 8A1 1 0 0118 19H3a1 1 0 01-.97-.757l-2-8A1 1 0 011 9v1z" opacity=".6"/></>,
    'document-list': <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></>,
    'magnifying-glass': <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    'chart-bar': <><rect x="3" y="12" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/></>,
    'shield-check': <><path d="M12 2l7 4v5c0 5-3.5 9.74-7 11C8.5 20.74 5 16 5 11V6l7-4z"/><polyline points="9 12 11 14 15 10"/></>,
    'bolt': <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    'beaker': <><path d="M9 3h6M9 3v7l-4.5 8.5A1 1 0 005.4 20h13.2a1 1 0 00.9-1.5L15 10V3M9 3H7m8 0h2"/><line x1="9" y1="14" x2="15" y2="14"/></>,
    'arrow-down-tray': <><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></>,
    'triangle-warning': <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    'check-circle': <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
    'check': <polyline points="20 6 9 17 4 12"/>,
    'x-mark': <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    'question-circle': <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    'hashtag': <><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></>,
    'tag': <><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
    'user-circle': <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    'arrows-rotate': <><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/></>,
    'building-office': <><path d="M3 21h18M6 21V7a2 2 0 012-2h8a2 2 0 012 2v14M3 7h18"/><path d="M9 21v-4a1 1 0 011-1h4a1 1 0 011 1v4"/><rect x="9" y="9" width="2" height="2"/><rect x="13" y="9" width="2" height="2"/><rect x="9" y="13" width="2" height="2"/><rect x="13" y="13" width="2" height="2"/></>,
    'file-spreadsheet': <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="12" y1="11" x2="12" y2="19"/></>,
  }
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {paths[name] ?? null}
    </svg>
  )
}

// supress unused type warning
const _iconNames: IconName[] = []
void _iconNames

const JA_CONST = JA

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: `1px solid ${JA_CONST.BORDER}`, borderRadius: '2px',
  fontSize: '13px', color: JA_CONST.TEXT, background: JA_CONST.WHITE, boxSizing: 'border-box',
  fontFamily: 'Inter, sans-serif', outline: 'none',
}
