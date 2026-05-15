-- 004_dian_sync_logs.sql
-- Historial de ejecuciones del cron de descarga automática DIAN

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
    triggered_by    VARCHAR(50) DEFAULT 'cron' -- 'cron' | 'manual' | 'all_active'
);

CREATE INDEX IF NOT EXISTS idx_dian_sync_logs_profile_id ON public.dian_sync_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_dian_sync_logs_iniciado_en ON public.dian_sync_logs(iniciado_en DESC);

ALTER TABLE public.dian_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_sync_logs"
    ON public.dian_sync_logs FOR SELECT
    USING (auth.uid() = profile_id);

-- El servicio (service_role) inserta los logs sin restricción RLS
CREATE POLICY "service_role_insert_sync_logs"
    ON public.dian_sync_logs FOR INSERT
    WITH CHECK (true);
