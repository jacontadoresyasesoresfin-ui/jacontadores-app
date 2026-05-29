-- ════════════════════════════════════════════════════════════════════════════
-- Migración: Campos adicionales para pantalla "Configuración de formatos"
-- Replica la pantalla "Asistente medios magnéticos" de Siigo Nube
-- Ejecutar UNA VEZ en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════════════════

-- Agregar nombre visible de la cuenta PUC (ej: "Sueldos y jornales")
ALTER TABLE exogenas_reglas_mapeo
  ADD COLUMN IF NOT EXISTS nombre_cuenta TEXT;

-- Agregar categoría descriptiva del concepto
-- (ej: "Saldo cuentas por Cobrar", "Pago o abono en cuenta", etc.)
ALTER TABLE exogenas_reglas_mapeo
  ADD COLUMN IF NOT EXISTS categoria TEXT;

-- Índice para búsqueda rápida por cuenta
CREATE INDEX IF NOT EXISTS idx_exogenas_reglas_cuenta
  ON exogenas_reglas_mapeo (tenant_id, cuenta_puc_patron);

-- Índice para búsqueda rápida por año
CREATE INDEX IF NOT EXISTS idx_exogenas_reglas_anio
  ON exogenas_reglas_mapeo (tenant_id, anio_gravable, activo);

-- Comentarios para documentación
COMMENT ON COLUMN exogenas_reglas_mapeo.nombre_cuenta IS
  'Nombre descriptivo de la cuenta PUC para mostrar en pantalla (ej: "Sueldos y jornales")';
COMMENT ON COLUMN exogenas_reglas_mapeo.categoria IS
  'Categoría DIAN del concepto (ej: "Pago o abono en cuenta", "Saldo cuentas por Cobrar")';
