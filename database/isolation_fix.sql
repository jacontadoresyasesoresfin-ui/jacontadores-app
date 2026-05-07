-- ============================================================
-- FIX: AISLAMIENTO DE DATOS (TENANCY)
-- Ejecuta este script en el editor SQL de Supabase
-- ============================================================

-- 1. Asegurar que la tabla dian_invoices tenga la columna de propietario
ALTER TABLE public.dian_invoices 
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id);

-- 2. (Opcional) Si ya tienes datos y quieres asignarlos a tu usuario actual para pruebas:
-- UPDATE public.dian_invoices SET profile_id = 'TU_UUID_AQUÍ' WHERE profile_id IS NULL;

-- 3. Activar Row Level Security (RLS)
ALTER TABLE public.dian_invoices ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Permitir select a todos" ON public.dian_invoices;
DROP POLICY IF EXISTS "Permitir insert a todos" ON public.dian_invoices;
DROP POLICY IF EXISTS "Permitir update a todos" ON public.dian_invoices;
DROP POLICY IF EXISTS "Permitir delete a todos" ON public.dian_invoices;

-- 5. Crear políticas de aislamiento estrictas
-- Los usuarios normales solo ven lo suyo. Los superadmins ven todo.

CREATE POLICY "Aislamiento: Ver registros propios" 
ON public.dian_invoices FOR SELECT 
USING (
  profile_id = auth.uid() OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);

CREATE POLICY "Aislamiento: Insertar registros propios" 
ON public.dian_invoices FOR INSERT 
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Aislamiento: Actualizar registros propios" 
ON public.dian_invoices FOR UPDATE 
USING (
  profile_id = auth.uid() OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);

CREATE POLICY "Aislamiento: Eliminar registros propios" 
ON public.dian_invoices FOR DELETE 
USING (
  profile_id = auth.uid() OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);

-- 6. Verificación de columnas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'dian_invoices';
