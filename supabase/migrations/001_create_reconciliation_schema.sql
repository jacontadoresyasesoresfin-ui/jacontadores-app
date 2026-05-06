-- 001_create_reconciliation_schema.sql
-- Creación de esquema para conciliación de facturas DIAN (Modelo Colombiano)

CREATE TABLE IF NOT EXISTS public.dian_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cufe VARCHAR(255) UNIQUE NOT NULL,
    fecha_emision DATE NOT NULL,
    tipo VARCHAR(50) CHECK (tipo IN ('emitida', 'recibida')) NOT NULL,
    entidad_nombre VARCHAR(255) NOT NULL,
    entidad_nit VARCHAR(50) NOT NULL,
    subtotal NUMERIC(15, 2) DEFAULT 0,
    iva NUMERIC(15, 2) DEFAULT 0,
    retefuente NUMERIC(15, 2) DEFAULT 0,
    reteica NUMERIC(15, 2) DEFAULT 0,
    total NUMERIC(15, 2) NOT NULL,
    estado_conciliacion VARCHAR(50) DEFAULT 'Pendiente' CHECK (estado_conciliacion IN ('Pendiente', 'Conciliada', 'Rechazada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Políticas de Seguridad RLS
ALTER TABLE public.dian_invoices ENABLE ROW LEVEL SECURITY;

-- Por defecto, permitimos acceso completo para propósitos del dashboard admin (Puedes restringir según auth.uid() en producción)
CREATE POLICY "Permitir select a todos" ON public.dian_invoices FOR SELECT USING (true);
CREATE POLICY "Permitir insert a todos" ON public.dian_invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update a todos" ON public.dian_invoices FOR UPDATE USING (true);
CREATE POLICY "Permitir delete a todos" ON public.dian_invoices FOR DELETE USING (true);
