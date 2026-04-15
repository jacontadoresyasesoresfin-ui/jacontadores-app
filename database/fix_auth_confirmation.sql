-- 1. Confirmar correos de todos los usuarios actuales
UPDATE auth.users 
SET email_confirmed_at = NOW(),
    last_sign_in_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 2. Asegurar que los perfiles tengan los metadatos correctos (opcional)
UPDATE public.profiles
SET updated_at = NOW()
WHERE updated_at IS NULL;

-- NOTA: Para usuarios futuros, se recomienda desactivar "Confirm Email" 
-- en el Dashboard de Supabase: Authentication > Settings > Email Auth.
