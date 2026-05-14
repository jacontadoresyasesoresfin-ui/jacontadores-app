-- ============================================================
-- Migración: Agregar columnas de configuración a profiles
-- Ejecutar en el panel de Supabase → SQL Editor
-- Proyecto: zxpookuhrwcohhryyxyv (ja-contadores)
-- ============================================================

-- Agregar siigo_url si no existe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS siigo_url TEXT DEFAULT NULL;

-- Agregar drive_invoices_url si no existe  
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drive_invoices_url TEXT DEFAULT NULL;

-- Agregar reconciliation_sheet_url si no existe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reconciliation_sheet_url TEXT DEFAULT NULL;

-- Confirmar columnas disponibles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;
