-- ============================================================
-- Migración 003: Firmas Contables (Tenants) + Rol firma_admin
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tabla de Firmas Contables (Tenants)
CREATE TABLE IF NOT EXISTS public.tenants (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,                        -- Nombre de la firma (ej: "García & Asociados")
    brand_name     TEXT,                                  -- Nombre visible para sus clientes
    primary_color  TEXT DEFAULT '#13213C',                -- Color primario white-label
    accent_color   TEXT DEFAULT '#B8960C',                -- Color de acento
    logo_url       TEXT,                                  -- URL del logo (futuro)
    plan           TEXT DEFAULT 'basic',                  -- basic | pro | enterprise
    available_modules TEXT[] DEFAULT ARRAY[
        'analytics','sales','taxes','inventory',
        'reports','reconciliation','portfolio','nomina'
    ],
    is_active      BOOLEAN DEFAULT true,
    created_by     UUID REFERENCES auth.users(id),        -- Superadmin que la creó
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Convertir tenant_id de TEXT a UUID si ya existe como TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
          AND column_name = 'tenant_id' AND data_type = 'text'
    ) THEN
        -- Limpiar valores inválidos primero
        UPDATE public.profiles SET tenant_id = NULL
        WHERE tenant_id IS NOT NULL
          AND tenant_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
        -- Cambiar tipo de columna
        ALTER TABLE public.profiles
            ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN tenant_id UUID;
    END IF;
END $$;

-- 3. Foreign key a tenants (si no existe ya)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'profiles_tenant_id_fkey'
          AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. RLS para tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_full_tenants" ON public.tenants;
CREATE POLICY "superadmin_full_tenants" ON public.tenants
FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
);

DROP POLICY IF EXISTS "firma_admin_view_own_tenant" ON public.tenants;
CREATE POLICY "firma_admin_view_own_tenant" ON public.tenants
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND tenant_id = tenants.id
    )
);

-- 5. Actualizar RLS de profiles para firma_admin
-- firma_admin puede ver todos los perfiles de su tenant
DROP POLICY IF EXISTS "firma_admin_view_tenant_profiles" ON public.profiles;
CREATE POLICY "firma_admin_view_tenant_profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
    -- El usuario logueado es firma_admin y este perfil pertenece al mismo tenant
    (
        EXISTS (
            SELECT 1 FROM public.profiles AS me
            WHERE me.id = auth.uid()
              AND me.role = 'firma_admin'
              AND me.tenant_id IS NOT NULL
              AND me.tenant_id = profiles.tenant_id
        )
    )
    OR
    -- O el usuario es superadmin (ve todo)
    (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
    )
    OR
    -- O es su propio perfil
    profiles.id = auth.uid()
);

-- 6. firma_admin puede insertar clientes en su tenant
DROP POLICY IF EXISTS "firma_admin_insert_tenant_profiles" ON public.profiles;
CREATE POLICY "firma_admin_insert_tenant_profiles" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
    (
        EXISTS (
            SELECT 1 FROM public.profiles AS me
            WHERE me.id = auth.uid()
              AND me.role = 'firma_admin'
              AND me.tenant_id IS NOT NULL
              AND me.tenant_id = profiles.tenant_id
        )
    )
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
);

-- 7. firma_admin puede actualizar clientes de su tenant
DROP POLICY IF EXISTS "firma_admin_update_tenant_profiles" ON public.profiles;
CREATE POLICY "firma_admin_update_tenant_profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (
    (
        EXISTS (
            SELECT 1 FROM public.profiles AS me
            WHERE me.id = auth.uid()
              AND me.role = 'firma_admin'
              AND me.tenant_id IS NOT NULL
              AND me.tenant_id = profiles.tenant_id
        )
    )
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
);

-- 8. Índices
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON public.tenants(is_active);

-- ============================================================
-- INSTRUCCIONES:
-- 1. Pegar este script completo en Supabase > SQL Editor
-- 2. Ejecutar (Run)
-- 3. Verificar que la tabla 'tenants' aparezca en Table Editor
-- ============================================================
