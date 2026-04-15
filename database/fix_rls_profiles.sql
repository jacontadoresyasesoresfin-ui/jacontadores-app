-- SCRIPT PARA REPARAR POLÍTICAS DE SEGURIDAD (RLS) EN LA TABLA PROFILES
-- Ejecuta este script en el Editor SQL de Supabase para permitir la creación de usuarios

-- 1. Asegurar que RLS esté activado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas que puedan estar interfiriendo (Opcional but recommended)
-- DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
-- DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
-- DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 3. Política: Todos pueden ver perfiles (Necesario para el dashboard)
CREATE POLICY "Profiles are viewable by authenticated users" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- 4. Política: El usuario puede insertar su propio perfil al registrarse
-- Nota: Esto a veces falla si el admin es quien lo registra, por eso la siguiente política es clave
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 5. Política MAESTRA: Los Superadmins pueden CREAR y EDITAR cualquier perfil
-- Esta es la que probablemente falta y causa el error en el Panel Master
CREATE POLICY "Superadmins can manage all profiles" 
ON public.profiles FOR ALL 
TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);

-- 6. Política: Los usuarios pueden editar su propio perfil
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
