import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_ANON_KEY!

// Cliente estándar para la base de datos
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos base para la estructura de facturas DIAN
export interface DianInvoice {
    id: string
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
