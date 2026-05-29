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

  // ── Compras de inventarios — Clase 14 PUC ────────────────────────────
  // Clase 14 = inventarios (mercancías, M.P., productos terminados)
  // Concepto 5007: Compras de bienes — ReteFuente 2.5%, base mín. 27 UVT
  { formatoCodigo: '1001', cuentaPucPatron: '1430%', conceptoCodigo: '5007', prioridad: 28,
    notas: 'Mercancías no fabricadas por la empresa' },
  { formatoCodigo: '1001', cuentaPucPatron: '1435%', conceptoCodigo: '5007', prioridad: 28,
    notas: 'Materias primas e insumos' },
  { formatoCodigo: '1001', cuentaPucPatron: '1440%', conceptoCodigo: '5007', prioridad: 28,
    notas: 'Productos en proceso' },
  { formatoCodigo: '1001', cuentaPucPatron: '1445%', conceptoCodigo: '5007', prioridad: 28,
    notas: 'Productos terminados' },
  { formatoCodigo: '1001', cuentaPucPatron: '14%', conceptoCodigo: '5007', prioridad: 30,
    notas: 'Compras inventarios — Clase 14 PUC (fallback)' },

  // ── Costos de ventas — Clase 6 PUC ───────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '6205%', conceptoCodigo: '5007', prioridad: 30,
    notas: 'Costo de ventas — compras de mercancías' },
  { formatoCodigo: '1001', cuentaPucPatron: '7205%', conceptoCodigo: '5007', prioridad: 30,
    notas: 'Materias primas — Clase 7 (costos industriales)' },

  // ── Pagos al exterior ─────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5%', conceptoCodigo: '5019', prioridad: 40,
    tipoTercero: 'exterior', notas: 'Pagos al exterior — servicios (Art. 408 E.T.)' },

  // ── NO DEDUCIBLES (Art. 107 / 115-1 E.T.) ────────────────────────────
  // Se reportan en valorPagoNoDeducible del F1001. El concepto aplica igualmente.
  { formatoCodigo: '1001', cuentaPucPatron: '5899%', conceptoCodigo: '5098', prioridad: 5,
    deducible: false, notas: 'Multas, sanciones, intereses de mora — no deducibles (Art. 115-1 E.T.)' },
  { formatoCodigo: '1001', cuentaPucPatron: '5290%', conceptoCodigo: '5098', prioridad: 5,
    deducible: false, notas: 'Impuesto de renta y complementarios — no deducible (Art. 105 E.T.)' },
  { formatoCodigo: '1001', cuentaPucPatron: '5295%', conceptoCodigo: '5098', prioridad: 5,
    deducible: false, notas: 'Impuesto al patrimonio — no deducible' },

  // ── Fallback gastos clase 5 (excluye 511x que van en F2276) ──────────
  { formatoCodigo: '1001', cuentaPucPatron: '5%', conceptoCodigo: '5098', prioridad: 99,
    notas: 'Otros pagos — fallback clase 5. Revisar clasificación.' },

  // ══════════════════════════════════════════════════════════════════════
  //  FORMATO 1003 — Retenciones que le practicaron al declarante
  //  Fuente: cuentas 1355xx (Anticipo de impuestos y retenciones a favor)
  //  Valor a reportar: Saldo Débito (movimientos que aumentan el activo)
  // ══════════════════════════════════════════════════════════════════════

  // ── Retención renta (1302) ────────────────────────────────────────────
  { formatoCodigo: '1003', cuentaPucPatron: '13551501', conceptoCodigo: '1302', prioridad: 10, naturaleza: 'debito',
    notas: 'Anticipo ReteFuente renta — salarios y pagos generales' },
  { formatoCodigo: '1003', cuentaPucPatron: '13551503', conceptoCodigo: '1302', prioridad: 10, naturaleza: 'debito',
    notas: 'Anticipo ReteFuente renta — honorarios 3.5%' },
  { formatoCodigo: '1003', cuentaPucPatron: '13551505', conceptoCodigo: '1302', prioridad: 10, naturaleza: 'debito',
    notas: 'Anticipo ReteFuente 3.5%' },
  { formatoCodigo: '1003', cuentaPucPatron: '13551507', conceptoCodigo: '1302', prioridad: 10, naturaleza: 'debito',
    notas: 'Anticipo ReteFuente 2%' },
  { formatoCodigo: '1003', cuentaPucPatron: '13551509', conceptoCodigo: '1302', prioridad: 10, naturaleza: 'debito',
    notas: 'Anticipo ReteFuente 1%' },
  { formatoCodigo: '1003', cuentaPucPatron: '13551513', conceptoCodigo: '1302', prioridad: 10, naturaleza: 'debito',
    notas: 'Anticipo ReteFuente otros conceptos renta' },
  // ── Retención IVA (1303) ──────────────────────────────────────────────
  { formatoCodigo: '1003', cuentaPucPatron: '13551701', conceptoCodigo: '1303', prioridad: 10, naturaleza: 'debito',
    notas: 'Anticipo IVA retenido por clientes (ReteIVA a favor)' },
  // ── ReteICA (1310) ────────────────────────────────────────────────────
  { formatoCodigo: '1003', cuentaPucPatron: '13551801', conceptoCodigo: '1310', prioridad: 10, naturaleza: 'debito',
    notas: 'Anticipo ReteICA — Bogotá' },
  { formatoCodigo: '1003', cuentaPucPatron: '13551805', conceptoCodigo: '1310', prioridad: 10, naturaleza: 'debito',
    notas: 'Anticipo ReteICA — otros municipios' },
  { formatoCodigo: '1003', cuentaPucPatron: '13551811', conceptoCodigo: '1310', prioridad: 10, naturaleza: 'debito',
    notas: 'Anticipo ReteICA — servicios' },
  // ── Fallback 1355xx ───────────────────────────────────────────────────
  { formatoCodigo: '1003', cuentaPucPatron: '1355%', conceptoCodigo: '1302', prioridad: 50, naturaleza: 'debito',
    notas: 'Anticipo retención genérico — fallback. Revisar subcuenta.' },

  // ══════════════════════════════════════════════════════════════════════
  //  FORMATO 1008 — Saldos cuentas por cobrar (31-dic)
  //  Fuente: clase 13 PUC (Deudores)
  //  Valor a reportar: Saldo final cuenta (neto débitos - créditos)
  // ══════════════════════════════════════════════════════════════════════

  // ── Clientes nacionales (1315) ────────────────────────────────────────
  { formatoCodigo: '1008', cuentaPucPatron: '1305%', conceptoCodigo: '1315', prioridad: 10,
    notas: 'Clientes nacionales — saldo CxC al 31-dic' },
  { formatoCodigo: '1008', cuentaPucPatron: '1306%', conceptoCodigo: '1315', prioridad: 10,
    notas: 'Clientes del exterior — saldo CxC al 31-dic' },
  // ── Anticipos e impuestos a favor (1317) ─────────────────────────────
  { formatoCodigo: '1008', cuentaPucPatron: '135505', conceptoCodigo: '1317', prioridad: 10,
    notas: 'Anticipo de impuestos — saldo final' },
  { formatoCodigo: '1008', cuentaPucPatron: '1360%', conceptoCodigo: '1317', prioridad: 10,
    notas: 'Anticipos y avances a proveedores' },
  { formatoCodigo: '1008', cuentaPucPatron: '1365%', conceptoCodigo: '1317', prioridad: 10,
    notas: 'Préstamos a trabajadores y otras CxC' },
  // ── Fallback clase 13 (excluye 1355xx que van en F1003) ───────────────
  { formatoCodigo: '1008', cuentaPucPatron: '13%', conceptoCodigo: '1399', prioridad: 80,
    notas: 'Otras cuentas por cobrar clase 13 — fallback. Verificar concepto.' },

  // ══════════════════════════════════════════════════════════════════════
  //  FORMATO 1009 — Saldos cuentas por pagar (31-dic)
  //  Fuente: clases 22, 23, 25 PUC (Pasivos corrientes y laborales)
  //  Valor a reportar: Saldo final cuenta (neto créditos - débitos)
  // ══════════════════════════════════════════════════════════════════════

  // ── Proveedores nacionales (2201) ─────────────────────────────────────
  { formatoCodigo: '1009', cuentaPucPatron: '2205%', conceptoCodigo: '2201', prioridad: 10,
    notas: 'Proveedores nacionales — saldo CxP al 31-dic' },
  { formatoCodigo: '1009', cuentaPucPatron: '2206%', conceptoCodigo: '2202', prioridad: 10,
    notas: 'Proveedores del exterior — saldo CxP al 31-dic' },
  // ── Costos y gastos por pagar (2204) ─────────────────────────────────
  { formatoCodigo: '1009', cuentaPucPatron: '23651%', conceptoCodigo: '2204', prioridad: 10,
    notas: 'Honorarios, comisiones, servicios por pagar' },
  { formatoCodigo: '1009', cuentaPucPatron: '23652%', conceptoCodigo: '2204', prioridad: 10,
    notas: 'Servicios por pagar' },
  { formatoCodigo: '1009', cuentaPucPatron: '23653%', conceptoCodigo: '2204', prioridad: 10,
    notas: 'Arrendamientos por pagar' },
  { formatoCodigo: '1009', cuentaPucPatron: '23654001', conceptoCodigo: '2205', prioridad: 10,
    notas: 'Retención en la fuente por pagar (agente retenedor)' },
  { formatoCodigo: '1009', cuentaPucPatron: '23654%', conceptoCodigo: '2205', prioridad: 15,
    notas: 'Retenciones por pagar (fallback 23654x)' },
  { formatoCodigo: '1009', cuentaPucPatron: '23680515', conceptoCodigo: '2205', prioridad: 10,
    notas: 'ReteICA por pagar — servicios' },
  { formatoCodigo: '1009', cuentaPucPatron: '2368%', conceptoCodigo: '2205', prioridad: 15,
    notas: 'ReteICA por pagar (fallback 2368x)' },
  // ── Aportes parafiscales y prestaciones sociales (2214) ───────────────
  { formatoCodigo: '1009', cuentaPucPatron: '23700501', conceptoCodigo: '2214', prioridad: 10,
    notas: 'Aportes a EPS (salud empleador) por pagar' },
  { formatoCodigo: '1009', cuentaPucPatron: '23700601', conceptoCodigo: '2214', prioridad: 10,
    notas: 'Aportes AFP (pensión empleador) por pagar' },
  { formatoCodigo: '1009', cuentaPucPatron: '23701001', conceptoCodigo: '2214', prioridad: 10,
    notas: 'Aportes ICBF, SENA, CCF por pagar' },
  { formatoCodigo: '1009', cuentaPucPatron: '23701501', conceptoCodigo: '2214', prioridad: 10,
    notas: 'Aportes ARL por pagar' },
  { formatoCodigo: '1009', cuentaPucPatron: '23803001', conceptoCodigo: '2214', prioridad: 10,
    notas: 'Fondos de cesantías por consignar' },
  { formatoCodigo: '1009', cuentaPucPatron: '2510100101', conceptoCodigo: '2214', prioridad: 10,
    notas: 'Cesantías consolidadas por pagar' },
  { formatoCodigo: '1009', cuentaPucPatron: '2510100102', conceptoCodigo: '2214', prioridad: 10,
    notas: 'Cesantías consolidadas (administrativos)' },
  { formatoCodigo: '1009', cuentaPucPatron: '2510100202', conceptoCodigo: '2214', prioridad: 10,
    notas: 'Intereses sobre cesantías por pagar' },
  { formatoCodigo: '1009', cuentaPucPatron: '2510100302', conceptoCodigo: '2214', prioridad: 10,
    notas: 'Vacaciones consolidadas por pagar' },
  { formatoCodigo: '1009', cuentaPucPatron: '2510100402', conceptoCodigo: '2214', prioridad: 10,
    notas: 'Prima de servicios consolidada por pagar' },
  // ── Salarios por pagar (2215) ─────────────────────────────────────────
  { formatoCodigo: '1009', cuentaPucPatron: '25050501', conceptoCodigo: '2215', prioridad: 10,
    notas: 'Salarios y prestaciones del mes por pagar' },
  { formatoCodigo: '1009', cuentaPucPatron: '23650501', conceptoCodigo: '2215', prioridad: 10,
    notas: 'Nómina del mes pendiente de pago' },
  // ── Fallback clases 22-25 ─────────────────────────────────────────────
  { formatoCodigo: '1009', cuentaPucPatron: '22%', conceptoCodigo: '2201', prioridad: 90,
    notas: 'Proveedores clase 22 — fallback. Verificar concepto.' },
  { formatoCodigo: '1009', cuentaPucPatron: '23%', conceptoCodigo: '2204', prioridad: 95,
    notas: 'Cuentas por pagar clase 23 — fallback. Verificar concepto.' },
  { formatoCodigo: '1009', cuentaPucPatron: '25%', conceptoCodigo: '2215', prioridad: 95,
    notas: 'Pasivos laborales clase 25 — fallback. Verificar concepto.' },

  // ══════════════════════════════════════════════════════════════════════
  //  FORMATO 2276 — Información de pagos laborales (Nómina)
  //  Res. DIAN 000227/2025 — Art. 631 E.T.
  //  Reporta SALARIOS de empleados con contrato laboral.
  //  Honorarios a independientes → F1001 concepto 5001/5017.
  // ══════════════════════════════════════════════════════════════════════

  // ── Sueldos y jornales ────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '511005', conceptoCodigo: '6001', prioridad: 10,
    notas: 'Sueldos y jornales (salario básico mensual)' },
  // ── Prima de servicios ────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '511010', conceptoCodigo: '6002', prioridad: 10,
    notas: 'Prima de servicios semestral legal' },
  // ── Cesantías e intereses ─────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '511015', conceptoCodigo: '6003', prioridad: 10,
    notas: 'Cesantías' },
  { formatoCodigo: '2276', cuentaPucPatron: '511020', conceptoCodigo: '6003', prioridad: 10,
    notas: 'Intereses sobre cesantías (12% anual)' },
  // ── Vacaciones ────────────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '511025', conceptoCodigo: '6004', prioridad: 10,
    notas: 'Vacaciones (15 días hábiles / año)' },
  // ── Horas extras ──────────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '511030', conceptoCodigo: '6005', prioridad: 10,
    notas: 'Horas extras, recargos nocturnos y dominicales' },
  // ── Incapacidades ─────────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '511035', conceptoCodigo: '6008', prioridad: 10,
    notas: 'Incapacidades reconocidas por la empresa (días 1-2)' },
  // ── Bonificaciones ────────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '511040', conceptoCodigo: '6006', prioridad: 10,
    notas: 'Bonificaciones y auxilios no salariales' },
  // ── Aportes empleador ─────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '5105%', conceptoCodigo: '6009', prioridad: 10,
    notas: 'Aportes empleador: salud 8.5%, pensión 12%, ARL, SENA 2%, ICBF 3%, CCF 4%' },
  // ── Otros gastos de personal (fallback) ───────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '511%', conceptoCodigo: '6099', prioridad: 50,
    notas: 'Otros gastos de personal — fallback. Revisar subcuenta.' },

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
