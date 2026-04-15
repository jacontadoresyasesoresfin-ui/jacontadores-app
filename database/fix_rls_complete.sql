-- ============================================================
-- SCRIPT: Reparar políticas RLS - Panel Maestro desaparecido
-- Ejecutar en: https://supabase.com/dashboard/project/cofxjxfrmzomqajjdwtr/sql/new
-- ============================================================

-- 1. Eliminar TODAS las políticas actuales de profiles y recrear desde cero
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Superadmins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
-- Políticas nuevas (en caso de re-ejecución)
DROP POLICY IF EXISTS "authenticated_can_select_profiles" ON public.profiles;
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "superadmin_can_update_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "superadmin_can_delete_profiles" ON public.profiles;

-- 2. Asegurar que RLS está activo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. SELECT: Cualquier usuario autenticado puede leer TODOS los perfiles
--    (necesario para el dashboard y las listas de clientes)
CREATE POLICY "authenticated_can_select_profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- 4. INSERT: El usuario solo puede insertar su propio perfil
--    (el trigger usa SECURITY DEFINER así que bypasea esto)
CREATE POLICY "users_can_insert_own_profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 5. UPDATE propio: Cualquier usuario puede actualizar su propio perfil
CREATE POLICY "users_can_update_own_profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 6. UPDATE otros: El superadmin puede actualizar perfiles de otros usuarios
--    NOTA: Usamos una función auxiliar para evitar recursión infinita
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

CREATE POLICY "superadmin_can_update_all_profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

-- 7. DELETE: Solo superadmins pueden eliminar perfiles
CREATE POLICY "superadmin_can_delete_profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (public.is_superadmin());

-- 8. GARANTIZAR que admin@ecomfin.com tiene role = 'superadmin'
UPDATE public.profiles
SET role = 'superadmin', updated_at = NOW()
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@ecomfin.com' LIMIT 1
);

-- 9. Verificar que el rol quedó bien
SELECT p.id, u.email, p.role
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'admin@ecomfin.com';

-- Ver columnas reales de la tabla profiles
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 10. Verificar políticas activas
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;
