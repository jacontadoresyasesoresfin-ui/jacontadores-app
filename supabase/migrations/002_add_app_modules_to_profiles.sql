-- 002_add_app_modules_to_profiles.sql
-- Añadir soporte para control de módulos por empresa

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS app_modules JSONB DEFAULT '["dashboard", "portfolio", "reconciliation", "taxes", "reports", "ecommerce", "inventory", "sales", "siigo"]'::jsonb;
