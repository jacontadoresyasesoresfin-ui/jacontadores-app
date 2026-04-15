-- ============================================================
-- SCRIPT DE DIAGNÓSTICO: ¿Qué columnas tiene la tabla profiles?
-- Ejecutar en: https://supabase.com/dashboard/project/cofxjxfrmzomqajjdwtr/sql/new
-- ============================================================

-- 1. Ver estructura de la tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Ver si hay un registro para el admin y qué campos tiene
SELECT * FROM public.profiles LIMIT 1;

-- 3. Ver disparadores (triggers) activos
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles';
