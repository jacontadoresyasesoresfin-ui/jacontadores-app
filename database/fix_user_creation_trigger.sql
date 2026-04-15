-- ============================================================
-- SCRIPT: Fix "Database error saving new user" en Panel Master
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/cofxjxfrmzomqajjdwtr/sql/new
-- ============================================================

-- 1. TRIGGER: Auto-crear perfil cuando se registra un usuario
--    Esto evita el error de RLS al crear usuarios desde el Panel Master
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company_name, role, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'company_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    company_name = EXCLUDED.company_name,
    role = EXCLUDED.role,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. Crear el trigger en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Política superadmin (sin recursión) para gestionar todos los perfiles
DROP POLICY IF EXISTS "Superadmins can manage all profiles" ON public.profiles;
CREATE POLICY "Superadmins can manage all profiles" 
ON public.profiles FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'superadmin'
  )
);
