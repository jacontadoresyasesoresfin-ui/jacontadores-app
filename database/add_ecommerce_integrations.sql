-- ============================================================
-- ADD ECOMMERCE INTEGRATIONS COLUMN TO PROFILES
-- Run this in Supabase SQL Editor if not applied via migration
-- ============================================================

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS ecommerce_integrations JSONB DEFAULT '{}';

COMMENT ON COLUMN public.profiles.ecommerce_integrations IS 
  'JSON with ecommerce platform credentials: mercadolibre, dropi, shopify, woocommerce, tiendanube';

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
  AND column_name = 'ecommerce_integrations';
