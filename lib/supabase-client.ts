import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_ANON_KEY || '';

// Cliente estándar para la base de datos
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos base para perfiles
export interface Profile {
    id: string
    role: string
    full_name?: string | null
    company_name?: string | null
    google_sheet_url?: string | null
    phone?: string | null
    tenant_id?: string | null
    app_modules?: string[] | null
    created_at?: string
    email?: string
}

// Tipos base para la estructura de facturas DIAN
export interface DianInvoice {
    id: string
    profile_id?: string
    cufe: string
    fecha_emision: string
    tipo: 'emitida' | 'recibida'
    entidad_nombre: string
    entidad_nit: string
    subtotal: number
    iva: number
    retefuente: number
    reteica: number
    total: number
    estado_conciliacion: 'Pendiente' | 'Conciliada' | 'Rechazada'
    created_at?: string
}
