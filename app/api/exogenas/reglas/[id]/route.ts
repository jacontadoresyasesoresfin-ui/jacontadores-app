import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Helper: obtener tenant_id del usuario (null si no tiene empresa asignada)
async function getTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('profiles').select('tenant_id').eq('id', userId).single()
  return data?.tenant_id ?? null
}

// PATCH /api/exogenas/reglas/[id] — Actualiza una regla individual
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tenantId = await getTenantId(supabase, user.id)
  // Permitir usuarios sin tenant (superadmin / usuario sin empresa asignada)

  const body = await req.json() as {
    formato_codigo?: string
    cuenta_puc_patron?: string
    concepto_codigo?: string
    naturaleza?: string | null
    notas?: string | null
    prioridad?: number
  }

  // Construir la query filtrando por tenant_id (null o valor concreto)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from('exogenas_reglas_mapeo')
    .update({
      ...(body.formato_codigo    !== undefined && { formato_codigo:    body.formato_codigo }),
      ...(body.cuenta_puc_patron !== undefined && { cuenta_puc_patron: body.cuenta_puc_patron }),
      ...(body.concepto_codigo   !== undefined && { concepto_codigo:   body.concepto_codigo }),
      ...(body.naturaleza        !== undefined && { naturaleza:        body.naturaleza }),
      ...(body.notas             !== undefined && { notas:             body.notas }),
      ...(body.prioridad         !== undefined && { prioridad:         body.prioridad }),
    })
    .eq('id', id)

  if (tenantId) {
    q = q.eq('tenant_id', tenantId)
  } else {
    q = q.is('tenant_id', null).eq('fuente', 'usuario')
  }

  const { data, error } = await q.select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ regla: data })
}

// DELETE /api/exogenas/reglas/[id] — Elimina una regla individual
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tenantId = await getTenantId(supabase, user.id)
  // Permitir usuarios sin tenant (superadmin / usuario sin empresa asignada)

  // Construir la query filtrando por tenant_id (null o valor concreto)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from('exogenas_reglas_mapeo')
    .delete()
    .eq('id', id)

  if (tenantId) {
    q = q.eq('tenant_id', tenantId)
  } else {
    q = q.is('tenant_id', null).eq('fuente', 'usuario')
  }

  const { error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
