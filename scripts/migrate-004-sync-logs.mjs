/**
 * Migración 004: Crear tabla dian_sync_logs
 *
 * USO:
 *   node scripts/migrate-004-sync-logs.mjs "postgresql://postgres:[PASSWORD]@db.zxpookuhrwcohhryyxyv.supabase.co:5432/postgres"
 *
 * Obtener la URL desde:
 *   Supabase Dashboard → Project Settings → Database → Connection string → URI
 */

import pg from 'pg';
const { Client } = pg;

const DB_URL = process.argv[2] || process.env.DATABASE_URL;

if (!DB_URL) {
    console.error('❌ Falta la URL de base de datos.');
    console.error('');
    console.error('Uso: node scripts/migrate-004-sync-logs.mjs "postgresql://postgres:[PASSWORD]@db.zxpookuhrwcohhryyxyv.supabase.co:5432/postgres"');
    console.error('');
    console.error('Obtén la URL en: Supabase Dashboard → Project Settings → Database → Connection string → URI');
    process.exit(1);
}

const SQL = `
-- 004: Historial de ejecuciones del cron DIAN
CREATE TABLE IF NOT EXISTS public.dian_sync_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    iniciado_en     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finalizado_en   TIMESTAMP WITH TIME ZONE,
    nuevas          INTEGER NOT NULL DEFAULT 0,
    causadas        INTEGER NOT NULL DEFAULT 0,
    errores         INTEGER NOT NULL DEFAULT 0,
    omitidas        INTEGER NOT NULL DEFAULT 0,
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    errores_detalle JSONB DEFAULT '[]'::jsonb,
    triggered_by    VARCHAR(50) DEFAULT 'cron'
);

CREATE INDEX IF NOT EXISTS idx_dian_sync_logs_profile_id
    ON public.dian_sync_logs(profile_id);

CREATE INDEX IF NOT EXISTS idx_dian_sync_logs_iniciado_en
    ON public.dian_sync_logs(iniciado_en DESC);

ALTER TABLE public.dian_sync_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'dian_sync_logs' AND policyname = 'users_see_own_sync_logs'
    ) THEN
        CREATE POLICY "users_see_own_sync_logs"
            ON public.dian_sync_logs FOR SELECT
            USING (auth.uid() = profile_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'dian_sync_logs' AND policyname = 'service_role_insert_sync_logs'
    ) THEN
        CREATE POLICY "service_role_insert_sync_logs"
            ON public.dian_sync_logs FOR INSERT
            WITH CHECK (true);
    END IF;
END $$;
`;

const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

try {
    console.log('🔌 Conectando a Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Conectado.');

    console.log('⚙️  Ejecutando migración 004...');
    await client.query(SQL);
    console.log('✅ Tabla dian_sync_logs creada con RLS.');

    // Verificar
    const { rows } = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dian_sync_logs'"
    );
    if (rows.length > 0) {
        console.log('✅ Verificado: la tabla existe en public schema.');
    }

    console.log('');
    console.log('🎉 Migración 004 completada exitosamente.');
} catch (err) {
    console.error('❌ Error en la migración:', err.message);
    process.exit(1);
} finally {
    await client.end();
}
