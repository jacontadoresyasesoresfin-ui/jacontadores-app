-- ============================================================
-- SCRIPT FINAL: Fix "Database error saving new user" & Esquema
-- Ejecutar en: https://supabase.com/dashboard/project/cofxjxfrmzomqajjdwtr/sql/new
-- ============================================================

-- 1. ASEGURAR COLUMNAS EN TABLA PROFILES
-- Añade company_name y google_sheet_url si no existen
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='company_name') THEN
        ALTER TABLE public.profiles ADD COLUMN company_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='google_sheet_url') THEN
        ALTER TABLE public.profiles ADD COLUMN google_sheet_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';
    END IF;
END $$;

-- 2. TRIGGER: Auto-crear perfil (SECURITY DEFINER bypassea RLS)
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. POLÍTICAS RLS (Limpias y sin recursión)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_can_select_profiles" ON public.profiles;
CREATE POLICY "authenticated_can_select_profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;
CREATE POLICY "users_can_update_own_profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Función para verificar superadmin sin recursión
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

DROP POLICY IF EXISTS "superadmin_can_manage_all" ON public.profiles;
CREATE POLICY "superadmin_can_manage_all"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

-- 4. GARANTIZAR SUPERADMIN (admin@ecomfin.com)
UPDATE public.profiles
SET role = 'superadmin', updated_at = NOW()
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@ecomfin.com' LIMIT 1
);

-- 5. VERIFICACIÓN FINAL
SELECT p.id, u.email, p.role, p.company_name, p.google_sheet_url
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'admin@ecomfin.com';
