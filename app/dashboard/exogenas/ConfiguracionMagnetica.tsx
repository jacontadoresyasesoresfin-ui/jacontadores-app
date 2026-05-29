'use client'
/**
 * ConfiguracionMagnetica — Réplica exacta de "Asistente medios magnéticos –
 * Configuración de formatos" de Siigo Nube.
 *
 * Muestra TODAS las cuentas PUC posibles como filas en la tabla.
 * Cada fila tiene selects inline para Formato, Concepto, Categoría, Valor a reportar.
 * El contador selecciona libremente en cada celda.
 * Misma cuenta puede tener múltiples filas (diferentes formatos).
 */

import React, { useState, useEffect, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// DATOS: Cuentas PUC del Plan de Cuentas Colombiano (fuente: Siigo PDF + PUC estándar)
// ─────────────────────────────────────────────────────────────────────────────
interface CuentaBase { codigo: string; nombre: string }

const TODAS_LAS_CUENTAS: CuentaBase[] = [
  // ── Clase 1: Activos ──────────────────────────────────────────────────────
  { codigo: '11050501', nombre: 'Caja general' },
  { codigo: '11051001', nombre: 'Cajas menores' },
  { codigo: '11100501', nombre: 'Banco Caja Social' },
  { codigo: '11100502', nombre: 'Banco BBVA' },
  { codigo: '11100503', nombre: 'Banco Agrario' },
  { codigo: '11100504', nombre: 'Bancolombia' },
  { codigo: '11100505', nombre: 'Banco Bogotá' },
  { codigo: '11100506', nombre: 'Banco Davivienda' },
  { codigo: '12050501', nombre: 'Acciones y cuotas' },
  { codigo: '12100501', nombre: 'Bonos' },
  { codigo: '13050501', nombre: 'Clientes nacionales' },
  { codigo: '13050502', nombre: 'Clientes del exterior' },
  { codigo: '13200501', nombre: 'Cuentas por cobrar socios' },
  { codigo: '13301501', nombre: 'Anticipos de clientes' },
  { codigo: '135505',   nombre: 'Anticipo de impuestos' },
  { codigo: '13551501', nombre: 'Anticipo retención fuente - renta' },
  { codigo: '13551502', nombre: 'Devolución retención renta' },
  { codigo: '13551503', nombre: 'Anticipo retención - honorarios' },
  { codigo: '13551505', nombre: 'Anticipo retención 3.5%' },
  { codigo: '13551507', nombre: 'Anticipo retención 2%' },
  { codigo: '13551509', nombre: 'Anticipo retención 1%' },
  { codigo: '13551513', nombre: 'Anticipo retención otros conceptos' },
  { codigo: '13551701', nombre: 'Impuesto a las ventas retenido' },
  { codigo: '13551801', nombre: 'ReteIca Comercio' },
  { codigo: '13551802', nombre: 'Devolución ReteIca' },
  { codigo: '13551805', nombre: 'ReteIca otros municipios' },
  { codigo: '13551811', nombre: 'ReteIca servicios' },
  { codigo: '13651501', nombre: 'Educación' },
  { codigo: '14050501', nombre: 'Materias primas' },
  { codigo: '14350101', nombre: 'Mercancías no fabricadas por la empresa' },
  { codigo: '14350102', nombre: 'Mercancías importadas' },
  { codigo: '14400101', nombre: 'Productos en proceso' },
  { codigo: '14450101', nombre: 'Productos terminados' },
  { codigo: '14980101', nombre: 'Otros inventarios' },
  { codigo: '15080501', nombre: 'Construcciones en curso' },
  { codigo: '15200101', nombre: 'Maquinaria y equipo' },
  { codigo: '15240501', nombre: 'Equipo de oficina' },
  { codigo: '15280501', nombre: 'Equipo de cómputo' },
  { codigo: '15400101', nombre: 'Vehículos' },
  { codigo: '16800101', nombre: 'Intangibles - Software' },
  { codigo: '17050501', nombre: 'Inversiones en acciones' },
  { codigo: '170505',   nombre: 'Anticipo a proveedores' },
  { codigo: '19200501', nombre: 'Depreciación acumulada maquinaria' },
  // ── Clase 2: Pasivos ──────────────────────────────────────────────────────
  { codigo: '21050501', nombre: 'Obligaciones bancarias nacionales' },
  { codigo: '21060501', nombre: 'Obligaciones bancarias exterior' },
  { codigo: '22050501', nombre: 'Proveedores nacionales' },
  { codigo: '22060501', nombre: 'Proveedores del exterior' },
  { codigo: '229999',   nombre: 'Causación automática' },
  { codigo: '23650501', nombre: 'Salarios y prestaciones por pagar' },
  { codigo: '23651501', nombre: 'Honorarios por pagar' },
  { codigo: '23651505', nombre: 'Retención 3.5% por pagar' },
  { codigo: '23651507', nombre: 'Retención 2% por pagar' },
  { codigo: '23651509', nombre: 'Retención 1% por pagar' },
  { codigo: '23652501', nombre: 'Servicios 6% por pagar' },
  { codigo: '23652503', nombre: 'Servicios generales por pagar' },
  { codigo: '23652507', nombre: 'Servicios hotelería y turismo' },
  { codigo: '23653001', nombre: 'Arrendamientos por pagar' },
  { codigo: '23654001', nombre: 'Retención en fuente por pagar' },
  { codigo: '23654002', nombre: 'Devolución retención' },
  { codigo: '23654004', nombre: 'Retención pagos al exterior' },
  { codigo: '23654006', nombre: 'Retención 0.1%' },
  { codigo: '23657001', nombre: 'Otras retenciones por pagar' },
  { codigo: '23670101', nombre: 'Impuesto a las ventas por pagar' },
  { codigo: '23680501', nombre: 'ReteIca Comercio' },
  { codigo: '23680502', nombre: 'Devolución ReteIca' },
  { codigo: '23680503', nombre: 'ReteIca otros municipios' },
  { codigo: '23680505', nombre: 'ReteIca industria' },
  { codigo: '23680507', nombre: 'ReteIca financiero' },
  { codigo: '23680511', nombre: 'ReteIca contratos' },
  { codigo: '23680513', nombre: 'ReteIca servicios personales' },
  { codigo: '23680515', nombre: 'ReteIca servicios generales' },
  { codigo: '23680527', nombre: 'ReteIca servicios varios' },
  { codigo: '23700501', nombre: 'Aportes a entidades de salud (EPS)' },
  { codigo: '23700601', nombre: 'Aporte a administradoras de pensión' },
  { codigo: '23701001', nombre: 'Aportes al ICBF/SENA/CCF' },
  { codigo: '23701501', nombre: 'Aportes ARL' },
  { codigo: '23703001', nombre: 'Libranzas por pagar' },
  { codigo: '23803001', nombre: 'Fondos de cesantías' },
  { codigo: '24080501', nombre: 'IVA generado ventas' },
  { codigo: '24080601', nombre: 'IVA generado servicios' },
  { codigo: '24081001', nombre: 'IVA descontable compras' },
  { codigo: '24081002', nombre: 'IVA devoluciones compras' },
  { codigo: '24082001', nombre: 'IVA descontable en devoluciones venta' },
  { codigo: '25050501', nombre: 'Salarios por pagar mes' },
  { codigo: '2510100101', nombre: 'Cesantías empleados producción' },
  { codigo: '2510100102', nombre: 'Cesantías empleados administrativos' },
  { codigo: '2510100201', nombre: 'Intereses sobre cesantías producción' },
  { codigo: '2510100202', nombre: 'Intereses sobre cesantías administr.' },
  { codigo: '2510100301', nombre: 'Vacaciones empleados producción' },
  { codigo: '2510100302', nombre: 'Vacaciones empleados administrativos' },
  { codigo: '2510100401', nombre: 'Prima de servicios producción' },
  { codigo: '2510100402', nombre: 'Prima de servicios administrativos' },
  // ── Clase 3: Patrimonio ───────────────────────────────────────────────────
  { codigo: '313001',   nombre: 'Capital personal' },
  { codigo: '320505',   nombre: 'Prima en colocación de acciones' },
  { codigo: '360505',   nombre: 'Utilidad del ejercicio' },
  { codigo: '361005',   nombre: 'Pérdida del ejercicio' },
  // ── Clase 4: Ingresos ─────────────────────────────────────────────────────
  { codigo: '41050501', nombre: 'Ingresos operacionales industria' },
  { codigo: '41350101', nombre: 'Comercio al por mayor y menor' },
  { codigo: '41750501', nombre: 'Devoluciones en ventas' },
  { codigo: '41750503', nombre: 'Devoluciones en servicios' },
  { codigo: '41756001', nombre: 'Descuentos comerciales ventas' },
  { codigo: '41756002', nombre: 'Descuentos pronto pago ventas' },
  { codigo: '41800101', nombre: 'Ingresos por servicios' },
  { codigo: '42101501', nombre: 'Descuentos financieros recibidos' },
  { codigo: '42104001', nombre: 'Descuentos por pronto pago' },
  { codigo: '42950501', nombre: 'Aprovechamientos' },
  { codigo: '42958101', nombre: 'Ajuste al peso' },
  { codigo: '429596',   nombre: 'Ingresos POS' },
  // ── Clase 5: Gastos ───────────────────────────────────────────────────────
  { codigo: '51050601', nombre: 'Sueldos y jornales' },
  { codigo: '51052701', nombre: 'Auxilio de transporte' },
  { codigo: '51053001', nombre: 'Cesantías' },
  { codigo: '51053301', nombre: 'Intereses sobre cesantías' },
  { codigo: '51053601', nombre: 'Prima de servicios' },
  { codigo: '51053901', nombre: 'Vacaciones' },
  { codigo: '51054801', nombre: 'Bonificaciones' },
  { codigo: '51054901', nombre: 'Incapacidades' },
  { codigo: '51055001', nombre: 'Horas extras y recargos' },
  { codigo: '51056801', nombre: 'Aportes a ARL' },
  { codigo: '51056901', nombre: 'Aportes a entidades de salud (EPS)' },
  { codigo: '51057001', nombre: 'Aporte a fondos de pensión' },
  { codigo: '51057501', nombre: 'Aportes ICBF/SENA/CCF' },
  { codigo: '51100501', nombre: 'Honorarios profesionales' },
  { codigo: '51150501', nombre: 'Comisiones por ventas' },
  { codigo: '51200501', nombre: 'Arrendamiento inmuebles' },
  { codigo: '51250501', nombre: 'Contribuciones y afiliaciones' },
  { codigo: '51300501', nombre: 'Seguros generales' },
  { codigo: '51350501', nombre: 'Servicios públicos' },
  { codigo: '51400501', nombre: 'Transporte y fletes' },
  { codigo: '51450501', nombre: 'Publicidad y propaganda' },
  { codigo: '51500501', nombre: 'Mantenimiento y reparaciones' },
  { codigo: '51550501', nombre: 'Aseo y vigilancia' },
  { codigo: '51600501', nombre: 'Capacitación y bienestar' },
  { codigo: '51950501', nombre: 'Gastos legales y notariales' },
  { codigo: '53050501', nombre: 'Gastos financieros' },
  { codigo: '53100501', nombre: 'Comisiones bancarias' },
  { codigo: '53950501', nombre: 'Gastos extraordinarios' },
  { codigo: '59050501', nombre: 'Gastos no operacionales' },
  { codigo: '59950501', nombre: 'Ajuste al peso - gastos' },
  // ── Clase 6: Costos de ventas y de prestación de servicios ───────────────
  { codigo: '61050501', nombre: 'Costo de ventas - industria manufacturera' },
  { codigo: '61100501', nombre: 'Devoluciones en compras - industria' },
  { codigo: '62050501', nombre: 'Costo de ventas - comercio al por mayor' },
  { codigo: '62100501', nombre: 'Devoluciones en compras - comercio' },
  { codigo: '62050502', nombre: 'Costo de ventas - comercio al por menor' },
  { codigo: '63050501', nombre: 'Costo de prestación de servicios' },
  { codigo: '63100501', nombre: 'Sueldos y salarios - costo' },
  { codigo: '63150501', nombre: 'Prestaciones sociales - costo' },
  { codigo: '63200501', nombre: 'Aportes sobre nómina - costo' },
  { codigo: '63350501', nombre: 'Honorarios - costo' },
  { codigo: '63400501', nombre: 'Arrendamientos - costo' },
  { codigo: '63450501', nombre: 'Seguros - costo' },
  { codigo: '63500501', nombre: 'Servicios públicos - costo' },
  { codigo: '63550501', nombre: 'Mantenimiento y reparaciones - costo' },
  { codigo: '63950501', nombre: 'Otros costos de prestación de servicios' },
  { codigo: '64050501', nombre: 'Costos de exploración de recursos naturales' },
  { codigo: '65050501', nombre: 'Costos de explotación de recursos naturales' },
  // ── Clase 7: Costos de producción o de operación ──────────────────────────
  { codigo: '71050501', nombre: 'Materias primas - producción' },
  { codigo: '72050501', nombre: 'Mano de obra directa - salarios' },
  { codigo: '72100501', nombre: 'Mano de obra directa - prestaciones' },
  { codigo: '72150501', nombre: 'Mano de obra directa - aportes nómina' },
  { codigo: '73050501', nombre: 'Costos indirectos - materiales indirectos' },
  { codigo: '73100501', nombre: 'Costos indirectos - mano de obra indirecta' },
  { codigo: '73150501', nombre: 'Costos indirectos - servicios públicos' },
  { codigo: '73200501', nombre: 'Costos indirectos - seguros' },
  { codigo: '73250501', nombre: 'Costos indirectos - mantenimiento' },
  { codigo: '73300501', nombre: 'Costos indirectos - arrendamientos planta' },
  { codigo: '73950501', nombre: 'Otros costos indirectos de fabricación' },
  // ── Clase 8: Cuentas de orden deudoras ───────────────────────────────────
  { codigo: '81050501', nombre: 'Bienes y valores entregados en custodia' },
  { codigo: '82050501', nombre: 'Activos contingentes' },
  { codigo: '83050501', nombre: 'Derechos contingentes - procesos legales' },
  { codigo: '89050501', nombre: 'Otras cuentas de orden deudoras' },
  // ── Clase 9: Cuentas de orden acreedoras ─────────────────────────────────
  { codigo: '91050501', nombre: 'Bienes y valores recibidos en custodia' },
  { codigo: '92050501', nombre: 'Pasivos contingentes' },
  { codigo: '93050501', nombre: 'Responsabilidades contingentes' },
  { codigo: '99050501', nombre: 'Otras cuentas de orden acreedoras' },
]

// ─────────────────────────────────────────────────────────────────────────────
// OPCIONES DE DROPDOWNS
// ─────────────────────────────────────────────────────────────────────────────
const FORMATOS_OPS = [
  { v: '',     l: '—' },
  { v: '1001', l: '1001' },
  { v: '1003', l: '1003' },
  { v: '1005', l: '1005' },
  { v: '1006', l: '1006' },
  { v: '1007', l: '1007' },
  { v: '1008', l: '1008' },
  { v: '1009', l: '1009' },
  { v: '1010', l: '1010' },
  { v: '1012', l: '1012' },
  { v: '2276', l: '2276' },
]

const CONCEPTOS_POR_FMT: Record<string, { v: string; l: string }[]> = {
  '1001': [
    { v: '5001', l: '5001' }, { v: '5002', l: '5002' }, { v: '5003', l: '5003' },
    { v: '5004', l: '5004' }, { v: '5005', l: '5005' }, { v: '5006', l: '5006' },
    { v: '5007', l: '5007' }, { v: '5009', l: '5009' }, { v: '5011', l: '5011' },
    { v: '5017', l: '5017' }, { v: '5018', l: '5018' }, { v: '5019', l: '5019' },
    { v: '5027', l: '5027' }, { v: '5028', l: '5028' }, { v: '5029', l: '5029' },
    { v: '5030', l: '5030' }, { v: '5039', l: '5039' }, { v: '5040', l: '5040' },
    { v: '5051', l: '5051' }, { v: '5098', l: '5098' }, { v: '5099', l: '5099' },
  ],
  '1003': [
    { v: '1302', l: '1302' }, { v: '1303', l: '1303' }, { v: '1305', l: '1305' },
    { v: '1307', l: '1307' }, { v: '1309', l: '1309' }, { v: '1310', l: '1310' },
    { v: '1399', l: '1399' },
  ],
  '1005': [{ v: '9997', l: '9997' }],
  '1006': [{ v: '9998', l: '9998' }],
  '1007': [{ v: '4001', l: '4001' }, { v: '4002', l: '4002' }],
  '1008': [
    { v: '1315', l: '1315' }, { v: '1316', l: '1316' },
    { v: '1317', l: '1317' }, { v: '1318', l: '1318' }, { v: '1399', l: '1399' },
  ],
  '1009': [
    { v: '2201', l: '2201' }, { v: '2202', l: '2202' }, { v: '2203', l: '2203' },
    { v: '2204', l: '2204' }, { v: '2205', l: '2205' }, { v: '2208', l: '2208' },
    { v: '2214', l: '2214' }, { v: '2215', l: '2215' }, { v: '2299', l: '2299' },
  ],
  '1010': [
    { v: 'proveedor', l: 'Proveedor' }, { v: 'cliente', l: 'Cliente' },
    { v: 'empleado', l: 'Empleado' },   { v: 'socio', l: 'Socio' },
  ],
  '1012': [
    { v: '1204', l: '1204 — Cuentas bancarias (corriente/ahorro)' },
    { v: '1208', l: '1208 — Fondos fiduciarios' },
    { v: '1209', l: '1209 — Fondos de inversión colectiva' },
    { v: '1210', l: '1210 — Acciones y cuotas de interés social' },
    { v: '1211', l: '1211 — CDT y certificados de depósito' },
    { v: '1212', l: '1212 — Bonos y títulos de deuda' },
    { v: '1299', l: '1299 — Otras inversiones' },
  ],
  '2276': [
    { v: '6001', l: '6001' }, { v: '6002', l: '6002' }, { v: '6003', l: '6003' },
    { v: '6004', l: '6004' }, { v: '6005', l: '6005' }, { v: '6006', l: '6006' },
    { v: '6007', l: '6007' }, { v: '6008', l: '6008' }, { v: '6009', l: '6009' },
    { v: '6010', l: '6010' }, { v: '9996', l: '9996' }, { v: '6099', l: '6099' },
  ],
}

// Categorías que muestra Siigo (exactas del PDF)
const CATEGORIAS_POR_CONCEPTO: Record<string, string[]> = {
  '1302': ['Retención en la fuente que le practicaron'],
  '1303': ['Retención en la fuente que le practicaron'],
  '1305': ['Retención en la fuente que le practicaron'],
  '1307': ['Retención en la fuente que le practicaron'],
  '1309': ['Retención en la fuente que le practicaron'],
  '1310': ['Retención en la fuente que le practicaron'],
  '1399': ['Retención en la fuente que le practicaron'],
  '1315': ['Saldo cuentas por Cobrar'],
  '1316': ['Saldo cuentas por Cobrar (exterior)'],
  '1317': ['Saldo cuentas por Cobrar'],
  '1318': ['Saldo cuentas por Cobrar (provisión)'],
  '2201': ['Saldo cuentas por pagar (proveedores)'],
  '2202': ['Saldo cuentas por pagar (exterior)'],
  '2203': ['Saldo cuentas por pagar (socios)'],
  '2204': ['Saldo cuentas por pagar (costos/gastos)'],
  '2205': ['Saldo cuentas por pagar (retenciones nómina)'],
  '2208': ['Saldo cuentas por pagar (acreedores)'],
  '2214': ['Saldo cuentas por pagar (prestaciones sociales)'],
  '2215': ['Saldo cuentas por pagar (salarios)'],
  '2299': ['Saldo cuentas por pagar (otros)'],
  '4001': ['Ingresos brutos recibidos', 'Devoluciones, rebajas y descuentos'],
  '4002': ['Ingresos brutos recibidos'],
  '5001': ['Pago o abono en cuenta (honorarios PN)', 'Retención en la fuente practicada'],
  '5002': ['Pago o abono en cuenta (comisiones)', 'Retención en la fuente practicada'],
  '5003': ['Pago o abono en cuenta (servicios)', 'Retención en la fuente practicada'],
  '5004': ['Pago o abono en cuenta (arrendamiento inmuebles)', 'Retención en la fuente practicada'],
  '5005': ['Pago o abono en cuenta (arrendamiento muebles)', 'Retención en la fuente practicada'],
  '5006': ['Pago o abono en cuenta (intereses/rendimientos)', 'Retención en la fuente practicada'],
  '5007': ['Pago o abono en cuenta (compras bienes)', 'Retención en la fuente practicada'],
  '5009': ['Pago o abono en cuenta (regalías)', 'Retención en la fuente practicada'],
  '5011': ['Pago o abono en cuenta (contratos)', 'Retención en la fuente practicada'],
  '5017': ['Pago o abono en cuenta (honorarios PJ)', 'Retención en la fuente practicada'],
  '5018': ['Pago o abono en cuenta (servicios técnicos)', 'Retención en la fuente practicada'],
  '5019': ['Pago o abono en cuenta (exterior)', 'Retención en la fuente practicada'],
  '5027': ['Pago o abono en cuenta (parafiscales)', 'Retención en la fuente practicada'],
  '5028': ['Pago o abono en cuenta (aseo/vigilancia)', 'Retención en la fuente practicada'],
  '5029': ['Pago o abono en cuenta (transporte carga)', 'Retención en la fuente practicada'],
  '5030': ['Pago o abono en cuenta (transporte pasajeros)', 'Retención en la fuente practicada'],
  '5039': ['Pago o abono en cuenta (publicidad)', 'Retención en la fuente practicada'],
  '5040': ['Pago o abono en cuenta (seguros)', 'Retención en la fuente practicada'],
  '5051': ['Pago o abono en cuenta (mantenimiento)', 'Retención en la fuente practicada'],
  '5098': ['Pago o abono en cuenta (otros gastos)'],
  '5099': ['Pago o abono en cuenta (otros)'],
  '6001': ['Pagos por Salarios'],
  '6002': ['Pagos por prestaciones sociales (prima)'],
  '6003': ['Cesantías consignadas al fondo'],
  '6004': ['Pagos por prestaciones sociales (vacaciones)'],
  '6005': ['Pagos por horas extras y recargos'],
  '6006': ['Otros pagos laborales'],
  '6007': ['Auxilio de transporte'],
  '6008': ['Pagos por incapacidades'],
  '6009': ['Aportes seguridad social empleador'],
  '6010': ['Aportes parafiscales (SENA, ICBF, CCF)'],
  '6099': ['Otros pagos laborales'],
  '9996': [
    'Pagos por Salarios',
    'Otros pagos',
    'Cesantías consignadas al fondo',
    'Pagos por prestaciones sociales',
    'Aportes obligatorios por nómina',
    'Aportes obligatorios a fondo de cesantías',
  ],
  '9997': ['Impuesto descontable', 'IVA resultante por devolución en ventas'],
  '9998': ['Impuesto generado', 'IVA recuperado en devoluciones'],
  '1204': ['Efectivo y cuentas bancarias (corriente/ahorro)'],
  '1208': ['Fondos fiduciarios y patrimonios autónomos'],
  '1209': ['Fondos de inversión colectiva'],
  '1210': ['Acciones y cuotas de interés social'],
  '1211': ['CDT y certificados de depósito a término'],
  '1212': ['Bonos y otros títulos de deuda pública y privada'],
  '1299': ['Otras inversiones y equivalentes de efectivo'],
  'proveedor': ['Saldo cuentas por pagar'],
  'cliente':   ['Saldo cuentas por Cobrar'],
  'empleado':  ['Saldo cuentas empleados'],
  'socio':     ['Capital social'],
}

const VALOR_OPS = [
  { v: '',        l: 'Saldo Final a Dic 31' },
  { v: 'debito',  l: 'Movimientos Débito' },
  { v: 'credito', l: 'Movimientos Crédito' },
]

// Mapeo predeterminado Siigo (extraído literalmente del PDF)
const MAPEO_DEFAULT_SIIGO: Record<string, { formato: string; concepto: string; categoria: string; valor: string }[]> = {
  // ── Clase 11: Efectivo y bancos → F1012 ──────────────────────────────────
  '11050501': [{ formato: '1012', concepto: '1204', categoria: 'Efectivo y cuentas bancarias (corriente/ahorro)', valor: 'debito' }],
  '11051001': [{ formato: '1012', concepto: '1204', categoria: 'Efectivo y cuentas bancarias (corriente/ahorro)', valor: 'debito' }],
  '11100501': [{ formato: '1012', concepto: '1204', categoria: 'Efectivo y cuentas bancarias (corriente/ahorro)', valor: 'debito' }],
  '11100502': [{ formato: '1012', concepto: '1204', categoria: 'Efectivo y cuentas bancarias (corriente/ahorro)', valor: 'debito' }],
  '11100503': [{ formato: '1012', concepto: '1204', categoria: 'Efectivo y cuentas bancarias (corriente/ahorro)', valor: 'debito' }],
  '11100504': [{ formato: '1012', concepto: '1204', categoria: 'Efectivo y cuentas bancarias (corriente/ahorro)', valor: 'debito' }],
  '11100505': [{ formato: '1012', concepto: '1204', categoria: 'Efectivo y cuentas bancarias (corriente/ahorro)', valor: 'debito' }],
  '11100506': [{ formato: '1012', concepto: '1204', categoria: 'Efectivo y cuentas bancarias (corriente/ahorro)', valor: 'debito' }],
  // ── Clase 12: Inversiones → F1012 ────────────────────────────────────────
  '12050501': [{ formato: '1012', concepto: '1210', categoria: 'Acciones y cuotas de interés social', valor: 'debito' }],
  '12100501': [{ formato: '1012', concepto: '1212', categoria: 'Bonos y otros títulos de deuda pública y privada', valor: 'debito' }],
  // ── Clase 13: Deudores → F1008 ───────────────────────────────────────────
  '13050501': [{ formato: '1008', concepto: '1315', categoria: 'Saldo cuentas por Cobrar', valor: '' }],
  '135505':   [{ formato: '1008', concepto: '1317', categoria: 'Saldo cuentas por Cobrar', valor: '' }],
  '13551501': [{ formato: '1003', concepto: '1302', categoria: 'Retención en la fuente que le practicaron', valor: 'debito' }],
  '13551503': [{ formato: '1003', concepto: '1303', categoria: 'Retención en la fuente que le practicaron', valor: 'debito' }],
  '13551701': [{ formato: '1003', concepto: '1309', categoria: 'Retención en la fuente que le practicaron', valor: 'debito' }],
  '13551801': [{ formato: '1008', concepto: '1317', categoria: 'Saldo cuentas por Cobrar', valor: 'debito' }],
  '13551805': [{ formato: '1008', concepto: '1317', categoria: 'Saldo cuentas por Cobrar', valor: 'debito' }],
  '13551811': [{ formato: '1008', concepto: '1317', categoria: 'Saldo cuentas por Cobrar', valor: 'debito' }],
  '14350101': [
    { formato: '1001', concepto: '5007', categoria: 'Retención en la fuente practicada', valor: 'credito' },
    { formato: '1001', concepto: '5007', categoria: 'Pago o abono en cuenta (compras bienes)', valor: 'debito' },
  ],
  '15080501': [{ formato: '1001', concepto: '5007', categoria: 'Pago o abono en cuenta (compras bienes)', valor: 'debito' }],
  '22050501': [{ formato: '1009', concepto: '2201', categoria: 'Saldo cuentas por pagar (proveedores)', valor: '' }],
  '23654001': [{ formato: '1009', concepto: '2204', categoria: 'Saldo cuentas por pagar (costos/gastos)', valor: '' }],
  '23680515': [{ formato: '1009', concepto: '2204', categoria: 'Saldo cuentas por pagar (costos/gastos)', valor: '' }],
  '23700501': [
    { formato: '1009', concepto: '2214', categoria: 'Saldo cuentas por pagar (prestaciones sociales)', valor: '' },
    { formato: '2276', concepto: '9996', categoria: 'Aportes obligatorios por nómina', valor: 'credito' },
  ],
  '23700601': [{ formato: '1009', concepto: '2214', categoria: 'Saldo cuentas por pagar (prestaciones sociales)', valor: '' }],
  '23701001': [{ formato: '1009', concepto: '2214', categoria: 'Saldo cuentas por pagar (prestaciones sociales)', valor: '' }],
  '23701501': [{ formato: '1009', concepto: '2214', categoria: 'Saldo cuentas por pagar (prestaciones sociales)', valor: '' }],
  '23803001': [
    { formato: '1009', concepto: '2214', categoria: 'Saldo cuentas por pagar (prestaciones sociales)', valor: '' },
    { formato: '2276', concepto: '9996', categoria: 'Aportes obligatorios a fondo de cesantías', valor: 'credito' },
  ],
  '24080501': [{ formato: '1006', concepto: '9998', categoria: 'Impuesto generado', valor: 'credito' }],
  '24080601': [{ formato: '1006', concepto: '9998', categoria: 'Impuesto generado', valor: 'credito' }],
  '24081001': [{ formato: '1005', concepto: '9997', categoria: 'Impuesto descontable', valor: '' }],
  '24081002': [{ formato: '1006', concepto: '9998', categoria: 'IVA recuperado en devoluciones', valor: 'credito' }],
  '24082001': [{ formato: '1005', concepto: '9997', categoria: 'IVA resultante por devolución en ventas', valor: 'debito' }],
  '25050501': [{ formato: '1009', concepto: '2215', categoria: 'Saldo cuentas por pagar (salarios)', valor: '' }],
  '2510100101': [{ formato: '1009', concepto: '2214', categoria: 'Saldo cuentas por pagar (prestaciones sociales)', valor: '' }],
  '2510100102': [{ formato: '1009', concepto: '2214', categoria: 'Saldo cuentas por pagar (prestaciones sociales)', valor: '' }],
  '2510100202': [{ formato: '1009', concepto: '2214', categoria: 'Saldo cuentas por pagar (prestaciones sociales)', valor: '' }],
  '2510100302': [{ formato: '1009', concepto: '2214', categoria: 'Saldo cuentas por pagar (prestaciones sociales)', valor: '' }],
  '2510100402': [{ formato: '1009', concepto: '2214', categoria: 'Saldo cuentas por pagar (prestaciones sociales)', valor: '' }],
  '41350101': [{ formato: '1007', concepto: '4001', categoria: 'Ingresos brutos recibidos', valor: 'credito' }],
  '41750501': [{ formato: '1007', concepto: '4001', categoria: 'Devoluciones, rebajas y descuentos', valor: '' }],
  '42104001': [{ formato: '1007', concepto: '4002', categoria: 'Ingresos brutos recibidos', valor: '' }],
  '51050601': [{ formato: '2276', concepto: '9996', categoria: 'Pagos por Salarios', valor: '' }],
  '51052701': [{ formato: '2276', concepto: '9996', categoria: 'Otros pagos', valor: '' }],
  '51053001': [{ formato: '2276', concepto: '9996', categoria: 'Cesantías consignadas al fondo', valor: '' }],
  '51053301': [{ formato: '2276', concepto: '9996', categoria: 'Pagos por prestaciones sociales', valor: '' }],
  '51053601': [{ formato: '2276', concepto: '9996', categoria: 'Pagos por prestaciones sociales', valor: 'debito' }],
  '51053901': [{ formato: '2276', concepto: '9996', categoria: 'Pagos por prestaciones sociales', valor: '' }],
  '51056801': [{ formato: '1001', concepto: '5011', categoria: 'Pago o abono en cuenta (contratos)', valor: '' }],
  '51056901': [{ formato: '1001', concepto: '5011', categoria: 'Pago o abono en cuenta (contratos)', valor: '' }],
  '51057001': [{ formato: '1001', concepto: '5011', categoria: 'Pago o abono en cuenta (contratos)', valor: '' }],
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPO: Fila de la tabla
// ─────────────────────────────────────────────────────────────────────────────
interface Fila {
  _id:      string     // id único de la fila (para React key)
  dbId:     string     // id en DB (vacío si no guardado aún)
  codigo:   string
  nombre:   string
  formato:  string
  concepto: string
  categoria: string
  valor:    string
  modificado: boolean
  esNueva:  boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20

export default function ConfiguracionMagnetica({
  onVolver,
  anioInicial = 2025,
}: {
  onVolver: () => void
  anioInicial?: number
}) {
  const [anio,       setAnio]       = useState(anioInicial)
  const [filas,      setFilas]      = useState<Fila[]>([])
  const [pagina,     setPagina]     = useState(1)
  const [busqueda,   setBusqueda]   = useState('')
  const [guardando,  setGuardando]  = useState(false)
  const [cargando,   setCargando]   = useState(true)
  const [msg,        setMsg]        = useState('')
  const [msgError,   setMsgError]   = useState('')

  // ── Construir filas iniciales ─────────────────────────────────────────────
  const construirFilas = useCallback((reglasDB: { id: string; cuenta_puc_patron: string; formato_codigo: string; concepto_codigo: string; categoria?: string | null; naturaleza: string | null; notas?: string | null }[]) => {
    const result: Fila[] = []
    let seq = 0

    for (const cuenta of TODAS_LAS_CUENTAS) {
      // Buscar si hay reglas del usuario en DB para esta cuenta
      const reglasUsuario = reglasDB.filter(r => r.cuenta_puc_patron === cuenta.codigo)

      // Buscar mapeo Siigo default para esta cuenta
      const defaultsSiigo = MAPEO_DEFAULT_SIIGO[cuenta.codigo] ?? []

      if (reglasUsuario.length > 0) {
        // Usar reglas del usuario (override) — derivar categoría desde el concepto si no está en DB
        for (const r of reglasUsuario) {
          const categoriaDerivada = r.categoria
            ?? CATEGORIAS_POR_CONCEPTO[r.concepto_codigo]?.[0]
            ?? ''
          result.push({
            _id: `db_${r.id}`,
            dbId: r.id,
            codigo: cuenta.codigo,
            nombre: cuenta.nombre,            // nombre siempre desde TODAS_LAS_CUENTAS
            formato:   r.formato_codigo ?? '',
            concepto:  r.concepto_codigo ?? '',
            categoria: categoriaDerivada,
            valor:     r.naturaleza ?? '',
            modificado: false,
            esNueva: false,
          })
        }
      } else if (defaultsSiigo.length > 0) {
        // Usar mapeo Siigo predeterminado
        for (const d of defaultsSiigo) {
          result.push({
            _id: `siigo_${cuenta.codigo}_${seq++}`,
            dbId: '',
            codigo: cuenta.codigo,
            nombre: cuenta.nombre,
            formato:   d.formato,
            concepto:  d.concepto,
            categoria: d.categoria,
            valor:     d.valor,
            modificado: false,
            esNueva: false,
          })
        }
      } else {
        // Fila vacía (sin mapeo)
        result.push({
          _id: `empty_${cuenta.codigo}`,
          dbId: '',
          codigo: cuenta.codigo,
          nombre: cuenta.nombre,
          formato: '', concepto: '', categoria: '', valor: '',
          modificado: false,
          esNueva: false,
        })
      }
    }

    return result
  }, [])

  // ── Cargar datos del servidor ─────────────────────────────────────────────
  useEffect(() => {
    setCargando(true)
    fetch('/api/exogenas/reglas?soloMias=true&page=1')
      .then(r => r.json())
      .then((d: { reglas?: { id: string; cuenta_puc_patron: string; formato_codigo: string; concepto_codigo: string; categoria?: string | null; naturaleza: string | null; notas?: string | null }[]; error?: string }) => {
        if (d.error) throw new Error(d.error)
        setFilas(construirFilas(d.reglas ?? []))
      })
      .catch(e => setMsgError(e.message ?? 'Error al cargar'))
      .finally(() => setCargando(false))
  }, [anio, construirFilas])

  // ── Editar celda de una fila ──────────────────────────────────────────────
  const editarFila = (id: string, campo: keyof Fila, valor: string) => {
    setFilas(prev => prev.map(f => {
      if (f._id !== id) return f
      const actualizada = { ...f, [campo]: valor, modificado: true }

      // Cuando cambia el formato, limpiar concepto y categoría
      if (campo === 'formato') {
        actualizada.concepto = ''
        actualizada.categoria = ''
        actualizada.valor = ''
      }
      // Cuando cambia el concepto, auto-completar categoría
      if (campo === 'concepto' && valor) {
        const cats = CATEGORIAS_POR_CONCEPTO[valor]
        actualizada.categoria = cats?.[0] ?? ''
      }
      return actualizada
    }))
    setMsg('')
  }

  // ── Agregar nueva fila (para cuenta adicional o extra) ────────────────────
  const agregarFila = () => {
    const nuevaFila: Fila = {
      _id: `nueva_${Date.now()}`,
      dbId: '',
      codigo: '',
      nombre: '',
      formato: '', concepto: '', categoria: '', valor: '',
      modificado: true,
      esNueva: true,
    }
    setFilas(prev => [nuevaFila, ...prev])
    setPagina(1)
  }

  // ── Limpiar fila (quitar mapeo) ───────────────────────────────────────────
  const limpiarFila = (fila: Fila) => {
    if (fila.esNueva) {
      // Eliminar fila nueva de la lista
      setFilas(prev => prev.filter(f => f._id !== fila._id))
    } else {
      // Limpiar los valores de mapeo pero marcar como modificada para que se borre de DB al guardar
      setFilas(prev => prev.map(f =>
        f._id === fila._id
          ? { ...f, formato: '', concepto: '', categoria: '', valor: '', modificado: true }
          : f
      ))
    }
  }

  // ── Guardar todos los cambios ─────────────────────────────────────────────
  const guardar = async () => {
    setGuardando(true)
    setMsg('')
    setMsgError('')
    try {
      const modificadas = filas.filter(f => f.modificado)

      if (modificadas.length === 0) {
        setMsg('No hay cambios pendientes para guardar.')
        setGuardando(false)
        return
      }

      let guardadas = 0
      let borradas = 0
      const errores: string[] = []

      for (const fila of modificadas) {
        // Si el usuario vació los campos de una fila que estaba en la BD, se debe borrar
        if (!fila.formato || !fila.concepto || !fila.codigo) {
          if (fila.dbId) {
            const res = await fetch(`/api/exogenas/reglas/${fila.dbId}`, { method: 'DELETE' })
            if (!res.ok) { errores.push(`DELETE ${fila.codigo}: Error al borrar`); continue }
            setFilas(prev => prev.map(f => f._id === fila._id ? { ...f, dbId: '', modificado: false } : f))
            borradas++
          } else {
            setFilas(prev => prev.map(f => f._id === fila._id ? { ...f, modificado: false } : f))
          }
          continue
        }

        // Solo enviar campos que EXISTEN en la tabla exogenas_reglas_mapeo.
        const body = {
          formato_codigo:    fila.formato,
          cuenta_puc_patron: fila.codigo,
          concepto_codigo:   fila.concepto,
          naturaleza:        fila.valor || null,
          notas:             fila.nombre
                               ? `${fila.nombre}${fila.categoria ? ' — ' + fila.categoria : ''}`
                               : (fila.categoria || null),
          prioridad:         1,
          anio_gravable:     anio,
        }

        if (fila.dbId) {
          const res  = await fetch(`/api/exogenas/reglas/${fila.dbId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = await res.json() as { error?: string }
          if (data.error) { errores.push(`PATCH ${fila.codigo}: ${data.error}`); continue }
          setFilas(prev => prev.map(f => f._id === fila._id ? { ...f, modificado: false } : f))
          guardadas++
        } else {
          const res  = await fetch('/api/exogenas/reglas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = await res.json() as { regla?: { id: string }; error?: string }
          if (data.error) { errores.push(`POST ${fila.codigo}: ${data.error}`); continue }
          if (data.regla?.id) {
            setFilas(prev => prev.map(f =>
              f._id === fila._id ? { ...f, dbId: data.regla!.id, modificado: false } : f
            ))
            guardadas++
          }
        }
      }

      if (errores.length > 0) {
        setMsgError(`${errores.length} error(es): ${errores.slice(0, 2).join(' | ')}`)
      }
      if (guardadas > 0 || borradas > 0) {
        setMsg(`¡Configuración actualizada! ${guardadas} regla(s) guardada(s) y ${borradas} regla(s) limpiada(s).`)
      } else if (errores.length === 0) {
        setMsg('No hubo cambios para guardar.')
      }
    } catch (e) {
      setMsgError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // ── Filtrar y paginar ─────────────────────────────────────────────────────
  const filasFiltradas = busqueda.trim()
    ? filas.filter(f =>
        f.codigo.includes(busqueda) ||
        f.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        f.formato.includes(busqueda) ||
        f.concepto.includes(busqueda)
      )
    : filas

  const totalItems = filasFiltradas.length
  const totalPags  = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const paginaActual = Math.min(pagina, totalPags)
  const filasPagina = filasFiltradas.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE)
  const cambiosSinGuardar = filas.filter(f => f.modificado).length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Arial, Inter, sans-serif', color: '#333', background: '#fff', minHeight: '100vh' }}>

      {/* ══ TÍTULO SIIGO ═══════════════════════════════════════════════════════ */}
      <div style={{ padding: '18px 24px 10px', borderBottom: '1px solid #e0e0e0' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 400, color: '#00AEEF' }}>
          Mapeo PUC a Conceptos DIAN - Exógena
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', color: '#555' }}>Año</span>
            <select value={anio} onChange={e => { setAnio(+e.target.value); setPagina(1) }}
              style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '3px',
                fontSize: '13px', color: '#333', background: '#fff', cursor: 'pointer' }}>
              <option value={2025}>2025 ▼</option>
              <option value={2024}>2024 ▼</option>
            </select>
          </div>
          <button onClick={onVolver}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: '13px',
              cursor: 'pointer', textDecoration: 'none' }}>
            Volver al panel principal
          </button>
        </div>
      </div>

      {/* ══ BARRA DE ACCIONES ══════════════════════════════════════════════════ */}
      <div style={{ padding: '10px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
        borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>

        {/* Buscador */}
        <input
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
          placeholder="Buscar cuenta contable…"
          style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '3px',
            fontSize: '13px', width: '260px', outline: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {cambiosSinGuardar > 0 && (
            <span style={{ fontSize: '12px', color: '#D97706', fontWeight: 600 }}>
              {cambiosSinGuardar} cambio(s) sin guardar
            </span>
          )}
          {msg && <span style={{ fontSize: '12px', color: '#059669' }}>{msg}</span>}
          {msgError && <span style={{ fontSize: '12px', color: '#DC2626' }}>{msgError}</span>}
          {cambiosSinGuardar > 0 && (
            <button onClick={guardar} disabled={guardando}
              style={{ padding: '7px 18px', background: '#00AEEF', color: '#fff', border: 'none',
                borderRadius: '3px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {guardando ? 'Guardando…' : 'Guardar configuración'}
            </button>
          )}
          <button onClick={agregarFila}
            style={{ padding: '7px 16px', background: '#28A745', color: '#fff', border: 'none',
              borderRadius: '3px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px' }}>
            + Adicionar cuenta PUC
          </button>
          {/* Ícono exportar (decorativo como Siigo) */}
          <div style={{ width: '32px', height: '32px', border: '1px solid #ccc', borderRadius: '3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            background: '#fff', fontSize: '16px', color: '#666' }} title="Exportar">
            📊
          </div>
        </div>
      </div>

      {/* ══ TABLA PRINCIPAL ════════════════════════════════════════════════════ */}
      {cargando ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#888', fontSize: '14px' }}>
          Cargando configuración…
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={TH}>Cuenta contable <Flecha /></th>
                <th style={{ ...TH, width: '4px', padding: '10px 4px' }}><Flecha /></th>
                <th style={{ ...TH, width: '90px', textAlign: 'center' }}>Formato</th>
                <th style={{ ...TH, width: '90px' }}>Concepto <Flecha /></th>
                <th style={{ ...TH, width: '220px' }}>Categoría <Flecha /></th>
                <th style={{ ...TH, width: '160px' }}>Valor a reportar <Flecha /></th>
                <th style={{ ...TH, width: '44px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filasPagina.map((fila, idx) => {
                const tieneDatos = !!(fila.formato)
                const bgColor = idx % 2 === 0 ? '#ffffff' : '#f9f9f9'

                return (
                  <tr key={fila._id}
                    style={{ borderBottom: '1px solid #e8e8e8', background: fila.modificado ? '#FFFBEB' : bgColor }}>

                    {/* ── Cuenta contable (dropdown con todas las cuentas PUC) ── */}
                    <td style={{ padding: '7px 14px', minWidth: '260px' }}>
                      <select
                        value={fila.codigo}
                        onChange={e => {
                          const cuenta = TODAS_LAS_CUENTAS.find(c => c.codigo === e.target.value)
                          setFilas(prev => prev.map(f =>
                            f._id !== fila._id ? f : {
                              ...f,
                              codigo: e.target.value,
                              nombre: cuenta?.nombre ?? '',
                              modificado: true,
                            }
                          ))
                          setMsg('')
                        }}
                        style={{
                          ...SELECT_ST,
                          maxWidth: '300px',
                          color: fila.codigo ? '#333' : '#aaa',
                          fontWeight: fila.codigo ? 500 : 400,
                        }}>
                        <option value="">— Seleccionar cuenta contable —</option>
                        <optgroup label="── Clase 1: Activos ──────────────────">
                          {TODAS_LAS_CUENTAS.filter(c => c.codigo.startsWith('1')).map(c => (
                            <option key={c.codigo} value={c.codigo}>
                              {c.codigo} - {c.nombre}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="── Clase 2: Pasivos ──────────────────">
                          {TODAS_LAS_CUENTAS.filter(c => c.codigo.startsWith('2')).map(c => (
                            <option key={c.codigo} value={c.codigo}>
                              {c.codigo} - {c.nombre}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="── Clase 3: Patrimonio ───────────────">
                          {TODAS_LAS_CUENTAS.filter(c => c.codigo.startsWith('3')).map(c => (
                            <option key={c.codigo} value={c.codigo}>
                              {c.codigo} - {c.nombre}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="── Clase 4: Ingresos ─────────────────">
                          {TODAS_LAS_CUENTAS.filter(c => c.codigo.startsWith('4')).map(c => (
                            <option key={c.codigo} value={c.codigo}>
                              {c.codigo} - {c.nombre}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="── Clase 5: Gastos operacionales ────">
                          {TODAS_LAS_CUENTAS.filter(c => c.codigo.startsWith('5')).map(c => (
                            <option key={c.codigo} value={c.codigo}>
                              {c.codigo} - {c.nombre}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="── Clase 6: Costos de ventas/servicios">
                          {TODAS_LAS_CUENTAS.filter(c => c.codigo.startsWith('6')).map(c => (
                            <option key={c.codigo} value={c.codigo}>
                              {c.codigo} - {c.nombre}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="── Clase 7: Costos de producción ─────">
                          {TODAS_LAS_CUENTAS.filter(c => c.codigo.startsWith('7')).map(c => (
                            <option key={c.codigo} value={c.codigo}>
                              {c.codigo} - {c.nombre}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="── Clase 8: Cuentas de orden deudoras">
                          {TODAS_LAS_CUENTAS.filter(c => c.codigo.startsWith('8')).map(c => (
                            <option key={c.codigo} value={c.codigo}>
                              {c.codigo} - {c.nombre}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="── Clase 9: Cuentas de orden acreedoras">
                          {TODAS_LAS_CUENTAS.filter(c => c.codigo.startsWith('9')).map(c => (
                            <option key={c.codigo} value={c.codigo}>
                              {c.codigo} - {c.nombre}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </td>

                    {/* ── Columna filtro vacía (igual que Siigo) ── */}
                    <td style={{ padding: '0', width: '4px' }}></td>

                    {/* ── Formato ── */}
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <select
                        value={fila.formato}
                        onChange={e => editarFila(fila._id, 'formato', e.target.value)}
                        style={{
                          ...SELECT_ST,
                          color: fila.formato ? '#333' : '#bbb',
                          fontWeight: fila.formato ? 600 : 400,
                        }}>
                        {FORMATOS_OPS.map(o => (
                          <option key={o.v} value={o.v}>{o.l}</option>
                        ))}
                      </select>
                    </td>

                    {/* ── Concepto ── */}
                    <td style={{ padding: '7px 10px' }}>
                      <select
                        value={fila.concepto}
                        onChange={e => editarFila(fila._id, 'concepto', e.target.value)}
                        disabled={!fila.formato}
                        style={{
                          ...SELECT_ST,
                          color: fila.concepto ? '#333' : '#bbb',
                          opacity: fila.formato ? 1 : 0.4,
                        }}>
                        <option value="">—</option>
                        {(CONCEPTOS_POR_FMT[fila.formato] ?? []).map(o => (
                          <option key={o.v} value={o.v}>{o.l}</option>
                        ))}
                      </select>
                    </td>

                    {/* ── Categoría ── */}
                    <td style={{ padding: '7px 10px' }}>
                      <select
                        value={fila.categoria}
                        onChange={e => editarFila(fila._id, 'categoria', e.target.value)}
                        disabled={!fila.concepto}
                        style={{
                          ...SELECT_ST,
                          color: fila.categoria ? '#333' : '#bbb',
                          opacity: fila.concepto ? 1 : 0.4,
                          maxWidth: '210px',
                        }}>
                        <option value="">—</option>
                        {(CATEGORIAS_POR_CONCEPTO[fila.concepto] ?? []).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>

                    {/* ── Valor a reportar ── */}
                    <td style={{ padding: '7px 10px' }}>
                      <select
                        value={fila.valor}
                        onChange={e => editarFila(fila._id, 'valor', e.target.value)}
                        disabled={!fila.concepto}
                        style={{
                          ...SELECT_ST,
                          color: '#333',
                          opacity: fila.concepto ? 1 : 0.4,
                        }}>
                        {VALOR_OPS.map(o => (
                          <option key={o.v} value={o.v}>{o.l}</option>
                        ))}
                      </select>
                    </td>

                    {/* ── Trash icon (en TODAS las filas como Siigo) ── */}
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                      {(tieneDatos || fila.esNueva) ? (
                        <button
                          onClick={() => limpiarFila(fila)}
                          title={fila.esNueva ? 'Eliminar fila' : 'Limpiar mapeo'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '16px', color: '#cc0000', padding: '2px 4px',
                            lineHeight: 1, opacity: 0.8 }}>
                          🗑
                        </button>
                      ) : (
                        <span style={{ color: '#ddd', fontSize: '16px', padding: '2px 4px' }}>🗑</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ PAGINACIÓN — exacta a Siigo ════════════════════════════════════════ */}
      {!cargando && totalItems > 0 && (
        <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'flex-end',
          alignItems: 'center', gap: '8px', borderTop: '1px solid #e0e0e0',
          background: '#fafafa', fontSize: '13px', color: '#555' }}>
          <span>Página {paginaActual} de {totalPags} ({totalItems} ítems)</span>
          <div style={{ display: 'flex', gap: '3px' }}>
            {Array.from({ length: Math.min(totalPags, 10) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPagina(p)}
                style={{
                  width: '28px', height: '28px', borderRadius: '3px',
                  border: p === paginaActual ? 'none' : '1px solid #ddd',
                  cursor: 'pointer', fontSize: '12px', fontWeight: p === paginaActual ? 700 : 400,
                  background: p === paginaActual ? '#00AEEF' : '#fff',
                  color:      p === paginaActual ? '#fff'    : '#555',
                }}>
                {p}
              </button>
            ))}
            {totalPags > 10 && <span style={{ alignSelf: 'center', padding: '0 4px' }}>…{totalPags}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Estilos compartidos ───────────────────────────────────────────────────────
const TH: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left',
  fontSize: '12px', fontWeight: 600, color: '#555',
  whiteSpace: 'nowrap', userSelect: 'none',
}

const SELECT_ST: React.CSSProperties = {
  padding: '4px 6px', border: '1px solid #ddd', borderRadius: '3px',
  fontSize: '12px', background: '#fff', cursor: 'pointer',
  outline: 'none', width: '100%', maxWidth: '140px',
  appearance: 'auto',
}

const INPUT_ST: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid #00AEEF', borderRadius: '3px',
  fontSize: '12px', outline: 'none', width: '200px',
}

function Flecha() {
  return <span style={{ color: '#aaa', fontSize: '10px', marginLeft: '3px' }}>▼</span>
}
