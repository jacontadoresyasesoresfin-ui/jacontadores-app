-- ============================================================
-- SCRIPT: Reparar políticas RLS para que el superadmin pueda
--         ver su propio perfil y el link "Panel Maestro" vuelva
-- Ejecutar en: https://supabase.com/dashboard/project/cofxjxfrmzomqajjdwtr/sql/new
-- ============================================================

-- 1. Ver políticas actuales (para diagnóstico)
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;
