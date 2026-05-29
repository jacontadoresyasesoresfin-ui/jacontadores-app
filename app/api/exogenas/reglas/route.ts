import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { REGLAS_DEFAULT_2025 } from '@/lib/exogenas/config/reglas-default-2025'

const PAGE_SIZE = 20

// ── Categoría automática desde concepto ──────────────────────────────────────
const CATEGORIA_POR_CONCEPTO: Record<string, string> = {
  '1302': 'Retención en la fuente que le practicaron',
  '1303': 'Retención en la fuente que le practicaron',
  '1305': 'Retención en la fuente que le practicaron',
  '1307': 'Retención en la fuente que le practicaron',
  '1309': 'Retención en la fuente que le practicaron',
  '1310': 'Retención en la fuente que le practicaron',
  '1399': 'Retención en la fuente que le practicaron',
  '1204': 'Efectivo y cuentas bancarias',
  '1208': 'Fondos fiduciarios y patrimonios autónomos',
  '1209': 'Fondos de inversión colectiva',
  '1210': 'Acciones y cuotas de interés social',
  '1211': 'CDT y certificados de depósito',
  '1212': 'Bonos y títulos de deuda',
  '1299': 'Otras inversiones y equivalentes',
  '1315': 'Saldo cuentas por Cobrar',
  '1316': 'Saldo cuentas por Cobrar (exterior)',
  '1317': 'Saldo cuentas por Cobrar',
  '1318': 'Saldo cuentas por Cobrar (provisión)',
  '2201': 'Saldo cuentas por pagar (proveedores)',
  '2202': 'Saldo cuentas por pagar (exterior)',
  '2203': 'Saldo cuentas por pagar (socios)',
  '2204': 'Saldo cuentas por pagar (costos y gastos)',
  '2205': 'Saldo cuentas por pagar (retenciones)',
  '2208': 'Saldo cuentas por pagar (acreedores)',
  '2214': 'Saldo cuentas por pagar (prestaciones sociales)',
  '2215': 'Saldo cuentas por pagar (salarios)',
  '2299': 'Saldo cuentas por pagar',
  '4001': 'Ingresos brutos recibidos',
  '4002': 'Ingresos brutos recibidos',
  '5001': 'Pago o abono en cuenta (honorarios PN)',
  '5002': 'Pago o abono en cuenta (comisiones)',
  '5003': 'Pago o abono en cuenta (servicios)',
  '5004': 'Pago o abono en cuenta (arrendamiento inmuebles)',
  '5005': 'Pago o abono en cuenta (arrendamiento muebles)',
  '5006': 'Pago o abono en cuenta (intereses)',
  '5007': 'Pago o abono en cuenta (compras)',
  '5009': 'Pago o abono en cuenta (regalías)',
  '5011': 'Pago o abono en cuenta (contratos)',
  '5017': 'Pago o abono en cuenta (honorarios PJ)',
  '5018': 'Pago o abono en cuenta (servicios técnicos)',
  '5019': 'Pago o abono en cuenta (exterior)',
  '5027': 'Pago o abono en cuenta (parafiscales)',
  '5028': 'Pago o abono en cuenta (aseo/vigilancia)',
  '5029': 'Pago o abono en cuenta (transporte carga)',
  '5030': 'Pago o abono en cuenta (transporte pasajeros)',
  '5039': 'Pago o abono en cuenta (publicidad)',
  '5040': 'Pago o abono en cuenta (seguros)',
  '5051': 'Pago o abono en cuenta (mantenimiento)',
  '5098': 'Pago o abono en cuenta (otros/no deducibles)',
  '5099': 'Pago o abono en cuenta (otros)',
  '6001': 'Pagos por Salarios',
  '6002': 'Pagos por prestaciones sociales (prima)',
  '6003': 'Cesantías consignadas al fondo',
  '6004': 'Pagos por prestaciones sociales (vacaciones)',
  '6005': 'Pagos por horas extras y recargos',
  '6006': 'Otros pagos laborales',
  '6007': 'Auxilio de transporte',
  '6008': 'Pagos por incapacidades',
  '6009': 'Aportes seguridad social empleador',
  '6010': 'Aportes parafiscales',
  '9996': 'Aportes obligatorios por nómina',
  '9997': 'Impuesto descontable',
  '9998': 'Impuesto generado',
  'proveedor': 'Saldo cuentas por pagar (proveedores)',
  'cliente':   'Saldo cuentas por Cobrar (clientes)',
  'empleado':  'Saldo cuentas empleados',
  'socio':     'Capital social (socios)',
}

// Helper: obtener tenant_id del usuario (null si no tiene empresa asignada)
async function getTenantId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles').select('tenant_id').eq('id', userId).single()
  return data?.tenant_id ?? null
}

// Helper: construir query filtrando por tenant (o por null si no tiene)
function filtrarPorTenant<T>(
  query: T & { eq: (col: string, val: unknown) => T; is: (col: string, val: null) => T },
  tenantId: string | null
): T {
  return tenantId
    ? query.eq('tenant_id', tenantId)
    : query.is('tenant_id', null)
}

// ── GET — carga reglas propias o combinadas ───────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tenantId = await getTenantId(supabase, user.id)

  const url     = new URL(req.url)
  const page    = Math.max(1, parseInt(url.searchParams.get('page')    ?? '1'))
  const q       = (url.searchParams.get('q')   ?? '').trim()
  const formato = url.searchParams.get('formato') ?? ''
  const soloMias = url.searchParams.get('soloMias') === 'true'
  const anio    = parseInt(url.searchParams.get('anio') ?? '2025')

  // ── Construir query de reglas propias ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let qPropia: any = supabase
    .from('exogenas_reglas_mapeo')
    .select('*', { count: 'exact' })
    .eq('activo', true)
    .order('prioridad', { ascending: true })
    .order('cuenta_puc_patron', { ascending: true })

  // Filtrar por tenant — null = reglas de usuario sin empresa asignada
  if (tenantId) {
    qPropia = qPropia.eq('tenant_id', tenantId)
  } else {
    qPropia = qPropia.is('tenant_id', null).eq('fuente', 'usuario')
  }

  if (q)       qPropia = qPropia.or(`cuenta_puc_patron.ilike.%${q}%,concepto_codigo.ilike.%${q}%,notas.ilike.%${q}%`)
  if (formato) qPropia = qPropia.eq('formato_codigo', formato)

  const { data: propias, count: totalPropias } = await qPropia

  if (soloMias) {
    return NextResponse.json({
      reglas:      propias ?? [],
      total:       totalPropias ?? 0,
    })
  }

  // ── Reglas DIAN 2025 (desde código — sin BD) ──────────────────────────────
  let defaults = REGLAS_DEFAULT_2025.map((r, i) => ({
    id:                `default_${i}`,
    tenant_id:         null,
    anio_gravable:     anio,
    formato_codigo:    r.formatoCodigo,
    cuenta_puc_patron: r.cuentaPucPatron,
    concepto_codigo:   r.conceptoCodigo,
    categoria:         CATEGORIA_POR_CONCEPTO[r.conceptoCodigo] ?? null,
    naturaleza:        r.naturaleza ?? null,
    prioridad:         r.prioridad,
    activo:            true,
    fuente:            'sistema' as const,
    notas:             r.notas ?? null,
    esDefault:         true,
  }))

  if (q)       defaults = defaults.filter(r =>
    r.cuenta_puc_patron.toLowerCase().includes(q.toLowerCase()) ||
    r.concepto_codigo.toLowerCase().includes(q.toLowerCase()) ||
    (r.notas ?? '').toLowerCase().includes(q.toLowerCase())
  )
  if (formato) defaults = defaults.filter(r => r.formato_codigo === formato)

  const propiasMapped = (propias ?? []).map((r: any) => ({
    ...r,
    categoria: CATEGORIA_POR_CONCEPTO[(r as { concepto_codigo: string }).concepto_codigo] ?? null,
    esDefault: false,
  }))

  const todasJuntas  = [...propiasMapped, ...defaults]
  const total        = todasJuntas.length
  const pagina       = todasJuntas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return NextResponse.json({
    reglas:        pagina,
    total,
    page,
    pageSize:      PAGE_SIZE,
    totalPaginas:  Math.ceil(total / PAGE_SIZE),
    totalPropias:  totalPropias ?? 0,
    totalDefault:  defaults.length,
  })
}

// ── POST — crear una regla individual ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tenantId = await getTenantId(supabase, user.id)

  const body = await req.json() as {
    formato_codigo:    string
    cuenta_puc_patron: string
    concepto_codigo:   string
    naturaleza?:       string | null
    notas?:            string | null
    prioridad?:        number
    anio_gravable?:    number
  }

  if (!body.formato_codigo || !body.cuenta_puc_patron || !body.concepto_codigo) {
    return NextResponse.json({ error: 'Faltan campos obligatorios: formato, cuenta PUC y concepto' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('exogenas_reglas_mapeo')
    .insert({
      tenant_id:         tenantId,   // null permitido = usuario sin empresa
      anio_gravable:     body.anio_gravable ?? 2025,
      formato_codigo:    body.formato_codigo,
      cuenta_puc_patron: body.cuenta_puc_patron,
      concepto_codigo:   body.concepto_codigo,
      naturaleza:        body.naturaleza ?? null,
      notas:             body.notas ?? null,
      prioridad:         body.prioridad ?? 1,
      activo:            true,
      fuente:            'usuario',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ regla: data }, { status: 201 })
}

// ── PUT — reemplaza TODAS las reglas del tenant (compatibilidad) ──────────────
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tenantId = await getTenantId(supabase, user.id)

  const body = await req.json() as {
    reglas: Array<{
      formato_codigo:    string
      cuenta_puc_patron: string
      concepto_codigo:   string
      prioridad?:        number
      naturaleza?:       string | null
      notas?:            string | null
    }>
  }

  if (!Array.isArray(body.reglas)) {
    return NextResponse.json({ error: 'Se requiere array de reglas' }, { status: 400 })
  }

  // Desactivar reglas anteriores
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let delQ: any = supabase.from('exogenas_reglas_mapeo').update({ activo: false })
  if (tenantId) {
    delQ = delQ.eq('tenant_id', tenantId)
  } else {
    delQ = delQ.is('tenant_id', null).eq('fuente', 'usuario')
  }
  await delQ

  if (body.reglas.length === 0) return NextResponse.json({ reglasGuardadas: 0 })

  const { data, error } = await supabase
    .from('exogenas_reglas_mapeo')
    .insert(body.reglas.map(r => ({
      tenant_id:         tenantId,
      anio_gravable:     2025,
      formato_codigo:    r.formato_codigo,
      cuenta_puc_patron: r.cuenta_puc_patron,
      concepto_codigo:   r.concepto_codigo,
      prioridad:         r.prioridad ?? 1,
      naturaleza:        r.naturaleza ?? null,
      notas:             r.notas ?? null,
      activo:            true,
      fuente:            'usuario',
    })))
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reglasGuardadas: data?.length ?? 0 })
}
