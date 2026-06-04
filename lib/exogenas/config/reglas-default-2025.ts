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

  // ── Honorarios (5110) ─────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5110%', conceptoCodigo: '5001', prioridad: 10,
    tipoTercero: 'persona_natural', notas: 'Honorarios PN' },
  { formatoCodigo: '1001', cuentaPucPatron: '5110%', conceptoCodigo: '5017', prioridad: 15,
    tipoTercero: 'persona_juridica', notas: 'Honorarios PJ' },
  { formatoCodigo: '1001', cuentaPucPatron: '5110%', conceptoCodigo: '5001', prioridad: 20,
    notas: 'Honorarios (tipo tercero no determinado → PN por defecto)' },

  // ── Impuestos (5115, 5405) ────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5115%', conceptoCodigo: '5099', prioridad: 10,
    notas: 'Impuestos asumidos / Predial / Otros' },
  { formatoCodigo: '1001', cuentaPucPatron: '5405%', conceptoCodigo: '5098', prioridad: 10,
    deducible: false, notas: 'Impuesto de renta (No deducible)' },

  // ── Arrendamientos (5120) ─────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5120-01', conceptoCodigo: '5004', prioridad: 10,
    notas: 'Arrendamiento inmuebles' },
  { formatoCodigo: '1001', cuentaPucPatron: '5120-02', conceptoCodigo: '5005', prioridad: 10,
    notas: 'Arrendamiento muebles' },
  { formatoCodigo: '1001', cuentaPucPatron: '5120%', conceptoCodigo: '5004', prioridad: 20,
    notas: 'Arrendamientos (fallback → inmuebles)' },

  // ── Contribuciones / Aportes (5125) ───────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5125%', conceptoCodigo: '5027', prioridad: 10,
    notas: 'Contribuciones y afiliaciones' },

  // ── Seguros (5130) ────────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5130%', conceptoCodigo: '5040', prioridad: 10,
    notas: 'Seguros (primas)' },

  // ── Servicios (5135) ──────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5135-02', conceptoCodigo: '5018', prioridad: 10,
    notas: 'Servicios técnicos' },
  { formatoCodigo: '1001', cuentaPucPatron: '5135-03', conceptoCodigo: '5018', prioridad: 10,
    notas: 'Asistencia técnica' },
  { formatoCodigo: '1001', cuentaPucPatron: '5135%', conceptoCodigo: '5003', prioridad: 25,
    notas: 'Servicios (fallback 5135)' },

  // ── Gastos Legales / Otros Financieros (5140) ─────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5140%', conceptoCodigo: '5099', prioridad: 20,
    notas: 'Gastos legales, GMF, notariales' },

  // ── Mantenimiento y reparaciones (5145, 5150) ─────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5145%', conceptoCodigo: '5051', prioridad: 10,
    notas: 'Mantenimiento y reparaciones' },
  { formatoCodigo: '1001', cuentaPucPatron: '5150%', conceptoCodigo: '5051', prioridad: 10,
    notas: 'Adecuaciones e instalaciones' },

  // ── Viáticos y Gastos de Viaje (5155, 510521) ─────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5155%', conceptoCodigo: '5099', prioridad: 10,
    notas: 'Gastos de viaje' },
  { formatoCodigo: '1001', cuentaPucPatron: '510521%', conceptoCodigo: '5099', prioridad: 10,
    notas: 'Viáticos (Gastos de personal)' },

  // ── Diversos (5195) ───────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5195%', conceptoCodigo: '5099', prioridad: 10,
    notas: 'Diversos (Papelería, Combustibles, etc.)' },

  // ── Intereses y financieros (53) ──────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5310%', conceptoCodigo: '5006', prioridad: 10,
    notas: 'Intereses sobre obligaciones financieras' },
  { formatoCodigo: '1001', cuentaPucPatron: '5315%', conceptoCodigo: '5006', prioridad: 10,
    notas: 'Intereses sobre proveedores y cuentas por pagar' },
  { formatoCodigo: '1001', cuentaPucPatron: '5320%', conceptoCodigo: '5006', prioridad: 10,
    notas: 'Otros gastos financieros' },
  { formatoCodigo: '1001', cuentaPucPatron: '53%', conceptoCodigo: '5006', prioridad: 20,
    notas: 'Financieros fallback' },

  // ── Transporte ────────────────────────────────────────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '5135-04', conceptoCodigo: '5029', prioridad: 10,
    notas: 'Transporte carga (reubicado a subcuenta servicio)' },

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
  // ── Retención IVA (1309) — concepto DIAN para ReteIVA ─────────────────
  { formatoCodigo: '1003', cuentaPucPatron: '13551701', conceptoCodigo: '1309', prioridad: 10, naturaleza: 'debito',
    notas: 'Anticipo IVA retenido por clientes (ReteIVA a favor) — concepto 1309 según Siigo' },
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
  // ── ReteICA a favor (1317) — según Siigo va en F1008, no F1003 ────────
  { formatoCodigo: '1008', cuentaPucPatron: '13551801', conceptoCodigo: '1317', prioridad: 5, naturaleza: 'debito',
    notas: 'ReteICA Bogotá a favor — saldo débito (F1008 concepto 1317 según Siigo)' },
  { formatoCodigo: '1008', cuentaPucPatron: '13551805', conceptoCodigo: '1317', prioridad: 5, naturaleza: 'debito',
    notas: 'ReteICA otros municipios a favor — saldo débito' },
  { formatoCodigo: '1008', cuentaPucPatron: '13551811', conceptoCodigo: '1317', prioridad: 5, naturaleza: 'debito',
    notas: 'ReteICA servicios a favor — saldo débito' },
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

  // ── Sueldos y jornales (5105) ─────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '510506', conceptoCodigo: '6001', prioridad: 10,
    notas: 'Sueldos y jornales (salario básico mensual)' },
  // ── Prima de servicios ────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '510536', conceptoCodigo: '6002', prioridad: 10,
    notas: 'Prima de servicios semestral legal' },
  // ── Cesantías e intereses ─────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '510530', conceptoCodigo: '6003', prioridad: 10,
    notas: 'Cesantías' },
  { formatoCodigo: '2276', cuentaPucPatron: '510533', conceptoCodigo: '6003', prioridad: 10,
    notas: 'Intereses sobre cesantías' },
  // ── Vacaciones ────────────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '510539', conceptoCodigo: '6004', prioridad: 10,
    notas: 'Vacaciones' },
  // ── Horas extras ──────────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '510515', conceptoCodigo: '6005', prioridad: 10,
    notas: 'Horas extras, recargos nocturnos y dominicales' },
  // ── Incapacidades ─────────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '510578', conceptoCodigo: '6008', prioridad: 10,
    notas: 'Incapacidades' },
  // ── Bonificaciones ────────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '510548', conceptoCodigo: '6006', prioridad: 10,
    notas: 'Bonificaciones y auxilios no salariales' },
  // ── Aportes empleador ─────────────────────────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '510568', conceptoCodigo: '6009', prioridad: 10,
    notas: 'Aportes empleador (ARL, Salud)' },
  { formatoCodigo: '2276', cuentaPucPatron: '510569', conceptoCodigo: '6009', prioridad: 10,
    notas: 'Aportes empleador (Pensiones)' },
  { formatoCodigo: '2276', cuentaPucPatron: '510570', conceptoCodigo: '6009', prioridad: 10,
    notas: 'Aportes empleador (Cajas, ICBF, SENA)' },
  { formatoCodigo: '2276', cuentaPucPatron: '510572', conceptoCodigo: '6009', prioridad: 10,
    notas: 'Aportes empleador (Otros)' },
  // ── Otros gastos de personal (fallback) ───────────────────────────────
  { formatoCodigo: '2276', cuentaPucPatron: '5105%', conceptoCodigo: '6099', prioridad: 50,
    notas: 'Otros gastos de personal — fallback. (Excluye viáticos que van a F1001)' },

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
  // Catch-all de terceros: prioridad 99 para no pisar reglas específicas (F1005, F1009, F1008, F1001)
  { formatoCodigo: '1010', cuentaPucPatron: '2%', conceptoCodigo: 'proveedor', prioridad: 99,
    notas: 'Terceros — proveedores (cuentas por pagar) — catch-all clase 2' },
  { formatoCodigo: '1010', cuentaPucPatron: '13%', conceptoCodigo: 'cliente', prioridad: 99,
    notas: 'Terceros — clientes (cuentas por cobrar) — catch-all clase 13' },
  { formatoCodigo: '1010', cuentaPucPatron: '5105%', conceptoCodigo: 'empleado', prioridad: 99,
    notas: 'Terceros — empleados — catch-all 5105' },

  // ══════════════════════════════════════════════════════════════════════
  //  FORMATO 1012 — Saldos en cuentas bancarias, inversiones y fondos
  //  Art. 631 E.T. + Res. DIAN 000227/2025
  //  Grupo 11 (Efectivo y equivalentes) + Grupo 12 (Inversiones)
  //  Valor a reportar: Saldo Débito (saldo al 31-dic de activos)
  //
  //  CRUCE: Concilia con la sección de efectivo y equivalentes del
  //  Balance general (Formulario 110/210).
  // ══════════════════════════════════════════════════════════════════════

  // ── Grupo 11: Efectivo y equivalentes de efectivo ─────────────────────
  // 1105xx — Caja (efectivo en mano)
  { formatoCodigo: '1012', cuentaPucPatron: '1105%', conceptoCodigo: '1204', prioridad: 5,
    naturaleza: 'debito', notas: 'Caja — efectivo en mano al 31-dic' },
  // 1110xx — Bancos (cuentas corrientes)
  { formatoCodigo: '1012', cuentaPucPatron: '1110%', conceptoCodigo: '1204', prioridad: 5,
    naturaleza: 'debito', notas: 'Bancos — cuentas corrientes y de ahorro' },
  // 1115xx — Cuentas de ahorro
  { formatoCodigo: '1012', cuentaPucPatron: '1115%', conceptoCodigo: '1204', prioridad: 5,
    naturaleza: 'debito', notas: 'Cuentas de ahorro' },
  // 1120xx — Fondos de inversión colectiva / monetarios
  { formatoCodigo: '1012', cuentaPucPatron: '1120%', conceptoCodigo: '1209', prioridad: 5,
    naturaleza: 'debito', notas: 'Fondos de inversión colectiva — tipo 1209' },

  // ── Grupo 12: Inversiones ─────────────────────────────────────────────
  // 1205xx — Acciones y cuotas de interés social
  { formatoCodigo: '1012', cuentaPucPatron: '1205%', conceptoCodigo: '1210', prioridad: 5,
    naturaleza: 'debito', notas: 'Acciones y cuotas de interés social' },
  // 1210xx — Cuotas de interés social
  { formatoCodigo: '1012', cuentaPucPatron: '1210%', conceptoCodigo: '1210', prioridad: 5,
    naturaleza: 'debito', notas: 'Cuotas de interés social en sociedades de personas' },
  // 1215xx — Bonos y títulos de deuda pública
  { formatoCodigo: '1012', cuentaPucPatron: '1215%', conceptoCodigo: '1212', prioridad: 5,
    naturaleza: 'debito', notas: 'Bonos y otros títulos de deuda pública y privada' },
  // 1220xx — CDT y certificados de depósito a término
  { formatoCodigo: '1012', cuentaPucPatron: '1220%', conceptoCodigo: '1211', prioridad: 5,
    naturaleza: 'debito', notas: 'CDT — certificados de depósito a término' },
  // 1225xx — Fondos de inversión colectiva administrados por fiduciarias
  { formatoCodigo: '1012', cuentaPucPatron: '1225%', conceptoCodigo: '1209', prioridad: 5,
    naturaleza: 'debito', notas: 'Fondos de inversión colectiva — fiduciarias' },
  // 1240xx — Derechos fiduciarios y patrimonios autónomos
  { formatoCodigo: '1012', cuentaPucPatron: '1240%', conceptoCodigo: '1208', prioridad: 5,
    naturaleza: 'debito', notas: 'Derechos fiduciarios y patrimonios autónomos' },

  // ══════════════════════════════════════════════════════════════════════
  //  REGLAS COMPLEMENTARIAS — Costos Clase 6 y 7 → Formato 1001
  //  Res. DIAN 000227/2025: los costos de ventas y de producción que
  //  impliquen pagos a terceros DEBEN reportarse en F1001.
  //  Grupo 61 → costo de ventas (comercio/servicios)
  //  Grupo 62 → costo de ventas (industria)
  //  Grupos 71-74 → costos de producción
  // ══════════════════════════════════════════════════════════════════════

  // ── Clase 6: Costos de ventas → Formato 1001 concepto 5007 ───────────
  // Compras de bienes (mercancías) registradas en clase 6
  { formatoCodigo: '1001', cuentaPucPatron: '61%', conceptoCodigo: '5007', prioridad: 28,
    notas: 'Costo de ventas industria — compras de materia prima e insumos' },
  { formatoCodigo: '1001', cuentaPucPatron: '62%', conceptoCodigo: '5007', prioridad: 28,
    notas: 'Costo de ventas comercio — compras de mercancías para reventa' },
  { formatoCodigo: '1001', cuentaPucPatron: '63%', conceptoCodigo: '5003', prioridad: 28,
    notas: 'Costo de prestación de servicios — pagos a terceros por servicios' },
  { formatoCodigo: '1001', cuentaPucPatron: '64%', conceptoCodigo: '5007', prioridad: 28,
    notas: 'Costos de exploración de recursos naturales' },
  { formatoCodigo: '1001', cuentaPucPatron: '65%', conceptoCodigo: '5007', prioridad: 28,
    notas: 'Costos de explotación de recursos naturales' },

  // ── Clase 7: Costos de producción → Formato 1001 ─────────────────────
  { formatoCodigo: '1001', cuentaPucPatron: '71%', conceptoCodigo: '5007', prioridad: 28,
    notas: 'Materias primas — compras para producción' },
  { formatoCodigo: '1001', cuentaPucPatron: '72%', conceptoCodigo: '5027', prioridad: 28,
    notas: 'Mano de obra directa — aportes y beneficios laborales producción' },
  { formatoCodigo: '1001', cuentaPucPatron: '73%', conceptoCodigo: '5007', prioridad: 28,
    notas: 'Costos indirectos de fabricación — materiales y servicios' },
  { formatoCodigo: '1001', cuentaPucPatron: '74%', conceptoCodigo: '5007', prioridad: 28,
    notas: 'Otros costos de producción o de operación' },

  // ══════════════════════════════════════════════════════════════════════
  //  REGLAS DE GRUPO — Fallbacks completos por clase PUC
  //  Estos cubren cuentas no especificadas en reglas anteriores.
  //  Garantizan que NINGUNA cuenta quede sin clasificar.
  //
  //  Principio DIAN (Art. 631 E.T.):
  //    • Clase 11-12 → F1012 (bancos e inversiones)
  //    • Clase 13    → F1008 (CxC, con excepción de 1355xx → F1003)
  //    • Clases 2x   → F1009 (CxP, con excepción de 2408xx → F1005/1006)
  //    • Clases 41-42 → F1007 (ingresos)
  //    • Clases 51-53 → F1001 (gastos operacionales)
  //    • Clases 61-65 → F1001 (costos de ventas/servicios)
  //    • Clases 71-74 → F1001 (costos de producción)
  // ══════════════════════════════════════════════════════════════════════

  // Clase 11 (fallback bancos — no capturado por reglas específicas 1012)
  { formatoCodigo: '1012', cuentaPucPatron: '11%', conceptoCodigo: '1204', prioridad: 95,
    naturaleza: 'debito', notas: 'Efectivo y equivalentes — fallback clase 11' },
  // Clase 12 (fallback inversiones)
  { formatoCodigo: '1012', cuentaPucPatron: '12%', conceptoCodigo: '1299', prioridad: 95,
    naturaleza: 'debito', notas: 'Inversiones — fallback clase 12' },
  // Clase 52 — Gastos no operacionales (incluye pérdidas en venta de activos)
  { formatoCodigo: '1001', cuentaPucPatron: '52%', conceptoCodigo: '5099', prioridad: 90,
    notas: 'Gastos no operacionales — clase 52 (fallback)' },
  // Clase 53 — Gastos financieros
  { formatoCodigo: '1001', cuentaPucPatron: '53%', conceptoCodigo: '5006', prioridad: 85,
    notas: 'Gastos financieros — intereses y comisiones bancarias (fallback clase 53)' },
]

/** UVT vigente para año gravable 2025 (resolución DIAN 000238/2025) */
export const UVT_2025 = 49_799   // año gravable 2025
export const UVT_2026 = 52_374   // para retención fuente 2026 (Comunicado DIAN 070/2026)

/**
 * Cuantías menores F1001 (Art. 631 E.T. + Res. 000227/2025).
 * Terceros con pagos acumulados en el año INFERIORES a este monto
 * Y SIN retención practicada se consolidan bajo NIT 222222222.
 * Valor actual: 100.000 COP ≈ 2 UVT (revisar contra resolución vigente).
 */
export const UMBRAL_CUANTIAS_MENORES_1001 = 100_000  // COP

/** Monto mínimo por NIT para informar en Formato 1006/1007 */
export const UMBRAL_MINIMO_1006_1007_UVT = 500   // > 500 UVT ≈ $24.9M (año gravable 2025)
