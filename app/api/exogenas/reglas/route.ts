import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { REGLAS_DEFAULT_2025 } from '@/lib/exogenas/config/reglas-default-2025'

// GET /api/exogenas/reglas — Retorna reglas del tenant (default + overrides)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) return NextResponse.json({ error: 'Sin tenant' }, { status: 403 })

  const url = new URL(req.url)
  const soloOverrides = url.searchParams.get('soloOverrides') === 'true'

  if (soloOverrides) {
    const { data, error } = await supabase
      .from('exogenas_reglas_mapeo')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('activo', true)
      .order('prioridad')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reglas: data ?? [] })
  }

  // Combinar default + overrides del tenant
  const { data: overrides } = await supabase
    .from('exogenas_reglas_mapeo')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .eq('activo', true)
    .order('prioridad')

  return NextResponse.json({
    reglasDefault: REGLAS_DEFAULT_2025,
    reglasOverride: overrides ?? [],
    totalReglas: REGLAS_DEFAULT_2025.length + (overrides?.length ?? 0),
  })
}

// PUT /api/exogenas/reglas — Guarda reglas override del tenant
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) return NextResponse.json({ error: 'Sin tenant' }, { status: 403 })

  const body = await req.json() as {
    reglas: Array<{
      formato_codigo: string
      cuenta_puc_patron: string
      concepto_codigo: string
      prioridad: number
      tipo_tercero?: string
      naturaleza?: string
      monto_minimo?: number
      incluye_retencion?: boolean
      notas?: string
    }>
  }

  if (!Array.isArray(body.reglas)) {
    return NextResponse.json({ error: 'Se requiere array de reglas' }, { status: 400 })
  }

  // Desactivar reglas anteriores del tenant
  await supabase
    .from('exogenas_reglas_mapeo')
    .update({ activo: false })
    .eq('tenant_id', profile.tenant_id)

  // Insertar nuevas reglas
  const reglasParaInsertar = body.reglas.map(r => ({
    tenant_id: profile.tenant_id,
    formato_codigo: r.formato_codigo,
    cuenta_puc_patron: r.cuenta_puc_patron,
    concepto_codigo: r.concepto_codigo,
    prioridad: r.prioridad,
    tipo_tercero: r.tipo_tercero ?? null,
    naturaleza: r.naturaleza ?? null,
    monto_minimo: r.monto_minimo ?? null,
    incluye_retencion: r.incluye_retencion ?? null,
    notas: r.notas ?? null,
    activo: true,
  }))

  const { data, error } = await supabase
    .from('exogenas_reglas_mapeo')
    .insert(reglasParaInsertar)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reglasGuardadas: data?.length ?? 0 })
}
