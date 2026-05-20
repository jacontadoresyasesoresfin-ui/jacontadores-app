/**
 * Reglas de mapeo PUC → Formato/Concepto — Año gravable 2025
 * Resolución DIAN 000227/2025 + 000233/2025
 *
 * Las cuentas PUC siguen el Decreto 2650/1993 (PUC Colombia).
 * Estas reglas son el punto de partida; cada tenant puede añadir
 * overrides desde la base de datos (tabla exogenas_reglas_mapeo).
 *
 * Prioridad: menor número = mayor prioridad.
 * El motor evalúa de menor a mayor y toma la primera regla que aplique.
 */
import type { ReglaMapeo } from '../types'

export const REGLAS_DEFAULT_2025: ReglaMapeo[] = [

  // ══════════════════════════════════════════════════════════════════════
  //  FORMATO 1001 — Pagos o abonos en cuenta y retenciones practicadas
  // ══════════════════════════════════════════════════════════════════════

  // ── Honorarios ────────────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5120%', conceptoCodigo: '5001', prioridad: 10,
    tipoTercero: 'persona_natural', notas: 'Honorarios PN' },
  { formatoCodigo: '1001', cuentaPucPatron: '5120%', conceptoCodigo: '5017', prioridad: 15,
    tipoTercero: 'persona_juridica', notas: 'Honorarios PJ' },
  { formatoCodigo: '1001', cuentaPucPatron: '5120%', conceptoCodigo: '5001', prioridad: 20,
    notas: 'Honorarios (tipo tercero no determinado → PN por defecto)' },

  // ── Comisiones ────────────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5125%', conceptoCodigo: '5002', prioridad: 10,
    notas: 'Comisiones' },

  // ── Servicios ─────────────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5135-02', conceptoCodigo: '5018', prioridad: 10,
    notas: 'Servicios técnicos' },
  { formatoCodigo: '1001', cuentaPucPatron: '5135-03', conceptoCodigo: '5018', prioridad: 10,
    notas: 'Asistencia técnica' },
  { formatoCodigo: '1001', cuentaPucPatron: '5130%', conceptoCodigo: '5003', prioridad: 20,
    notas: 'Servicios generales' },
  { formatoCodigo: '1001', cuentaPucPatron: '5135%', conceptoCodigo: '5003', prioridad: 25,
    notas: 'Servicios (fallback 5135)' },

  // ── Mantenimiento y reparaciones ──────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5196%', conceptoCodigo: '5051', prioridad: 10,
    notas: 'Mantenimiento y reparaciones' },
  { formatoCodigo: '1001', cuentaPucPatron: '5197%', conceptoCodigo: '5051', prioridad: 10,
    notas: 'Adecuaciones e instalaciones' },

  // ── Arrendamientos ────────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5140-01', conceptoCodigo: '5004', prioridad: 10,
    notas: 'Arrendamiento inmuebles' },
  { formatoCodigo: '1001', cuentaPucPatron: '5140-02', conceptoCodigo: '5005', prioridad: 10,
    notas: 'Arrendamiento muebles' },
  { formatoCodigo: '1001', cuentaPucPatron: '5140%', conceptoCodigo: '5004', prioridad: 20,
    notas: 'Arrendamientos (fallback → inmuebles)' },

  // ── Intereses y financieros ───────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5310%', conceptoCodigo: '5006', prioridad: 10,
    notas: 'Intereses sobre obligaciones financieras' },
  { formatoCodigo: '1001', cuentaPucPatron: '5315%', conceptoCodigo: '5006', prioridad: 10,
    notas: 'Intereses sobre proveedores y cuentas por pagar' },
  { formatoCodigo: '1001', cuentaPucPatron: '5320%', conceptoCodigo: '5006', prioridad: 10,
    notas: 'Otros gastos financieros' },

  // ── Seguros ───────────────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5150%', conceptoCodigo: '5040', prioridad: 10,
    notas: 'Seguros (primas)' },

  // ── Transporte ────────────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5160-01', conceptoCodigo: '5029', prioridad: 10,
    notas: 'Transporte carga' },
  { formatoCodigo: '1001', cuentaPucPatron: '5160-02', conceptoCodigo: '5030', prioridad: 10,
    notas: 'Transporte pasajeros' },
  { formatoCodigo: '1001', cuentaPucPatron: '5160%', conceptoCodigo: '5029', prioridad: 20,
    notas: 'Transporte (fallback → carga)' },

  // ── Aseo y vigilancia ─────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5165%', conceptoCodigo: '5028', prioridad: 10,
    notas: 'Aseo y vigilancia' },

  // ── Publicidad ────────────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5130-05', conceptoCodigo: '5039', prioridad: 10,
    notas: 'Publicidad y propaganda' },

  // ── Contribuciones / aportes parafiscales ────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5105%', conceptoCodigo: '5027', prioridad: 10,
    notas: 'Contribuciones y afiliaciones (parafiscales, seguridad social)' },

  // ── Regalías ─────────────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5175%', conceptoCodigo: '5009', prioridad: 10,
    notas: 'Regalías y patentes' },

  // ── Compras de bienes e inventarios ──────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '14%', conceptoCodigo: '5007', prioridad: 30,
    notas: 'Compras — activos circulantes/inventarios (Clase 14)' },
  { formatoCodigo: '1001', cuentaPucPatron: '6205%', conceptoCodigo: '5007', prioridad: 30,
    notas: 'Costo de ventas — compras de mercancías' },
  { formatoCodigo: '1001', cuentaPucPatron: '7205%', conceptoCodigo: '5007', prioridad: 30,
    notas: 'Materias primas' },

  // ── Pagos al exterior ─────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5%', conceptoCodigo: '5019', prioridad: 40,
    tipoTercero: 'exterior', notas: 'Pagos al exterior — servicios' },

  // ── Salarios (solo si son pagos informados al empleado) ───────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5110%', conceptoCodigo: '5001', prioridad: 50,
    tipoTercero: 'persona_natural', notas: 'Gastos de personal PN' },

  // ── Fallback general (gastos clase 5 no clasificados) ─────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5%', conceptoCodigo: '5098', prioridad: 99,
    notas: 'Otros pagos — fallback clase 5. Revisar clasificación más específica.' },

  // ══════════════════════════════════════════════════════════════════════
  //  FORMATO 1005 — IVA por pagar (IVA descontable por compras)
  // ══════════════════════════════════════════════════════════════════════
  { formatoCodigo: '1005', cuentaPucPatron: '2408%', conceptoCodigo: 'iva_descontable', prioridad: 10,
    notas: 'IVA descontable cuenta 2408' },
  { formatoCodigo: '1005', cuentaPucPatron: '2409%', conceptoCodigo: 'iva_descontable', prioridad: 10,
    notas: 'IVA por pagar en compras' },

  // ══════════════════════════════════════════════════════════════════════
  //  FORMATO 1006 — Información de compras
  // ══════════════════════════════════════════════════════════════════════
  { formatoCodigo: '1006', cuentaPucPatron: '14%', conceptoCodigo: 'compra_bienes', prioridad: 10,
    notas: 'Compras inventario/activos circulantes' },
  { formatoCodigo: '1006', cuentaPucPatron: '6205%', conceptoCodigo: 'compra_bienes', prioridad: 10,
    notas: 'Compra mercancías (costo)' },
  { formatoCodigo: '1006', cuentaPucPatron: '7205%', conceptoCodigo: 'compra_materia_prima', prioridad: 10,
    notas: 'Compra materias primas' },
  { formatoCodigo: '1006', cuentaPucPatron: '5%', conceptoCodigo: 'compra_servicios', prioridad: 50,
    notas: 'Compras de servicios (gastos)' },

  // ══════════════════════════════════════════════════════════════════════
  //  FORMATO 1007 — Información de ingresos / ventas
  // ══════════════════════════════════════════════════════════════════════
  { formatoCodigo: '1007', cuentaPucPatron: '41%', conceptoCodigo: 'ingreso_operacional', prioridad: 10,
    notas: 'Ingresos operacionales' },
  { formatoCodigo: '1007', cuentaPucPatron: '42%', conceptoCodigo: 'ingreso_no_operacional', prioridad: 10,
    notas: 'Ingresos no operacionales' },

  // ══════════════════════════════════════════════════════════════════════
  //  FORMATO 1010 — Información de terceros
  //  (se extrae de todos los formatos, no requiere cuentas PUC directas)
  // ══════════════════════════════════════════════════════════════════════
  { formatoCodigo: '1010', cuentaPucPatron: '2%', conceptoCodigo: 'proveedor', prioridad: 10,
    notas: 'Terceros — proveedores (cuentas por pagar)' },
  { formatoCodigo: '1010', cuentaPucPatron: '13%', conceptoCodigo: 'cliente', prioridad: 10,
    notas: 'Terceros — clientes (cuentas por cobrar)' },
  { formatoCodigo: '1010', cuentaPucPatron: '5110%', conceptoCodigo: 'empleado', prioridad: 10,
    notas: 'Terceros — empleados' },
]

/** UVT vigente para año gravable 2025 (resolución DIAN 000238/2025) */
export const UVT_2025 = 49_799   // año gravable 2025
export const UVT_2026 = 52_374   // para retención fuente 2026 (Comunicado DIAN 070/2026)

/** Monto mínimo por NIT para informar en el Formato 1001 (0 = todos) */
export const UMBRAL_MINIMO_INFORMAR_1001 = 0

/** Monto mínimo por NIT para informar en Formato 1006/1007 */
export const UMBRAL_MINIMO_1006_1007_UVT = 500   // > 500 UVT ≈ $24.9M (año gravable 2025)
