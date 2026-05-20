-- ════════════════════════════════════════════════════════════════════════════
-- Módulo: Información Exógena Tributaria (Medios Magnéticos DIAN)
-- Normativa: Resolución 000227/2025 (RUMT) + Res. 000233/2025 (modificatoria)
-- Año gravable: 2025 | Presentación: 2026
-- ════════════════════════════════════════════════════════════════════════════

-- ── Configuración del declarante por año gravable ─────────────────────────
CREATE TABLE IF NOT EXISTS exogenas_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  anio_gravable         INTEGER NOT NULL CHECK (anio_gravable >= 2020),
  nit_declarante        TEXT NOT NULL,
  dv_declarante         TEXT,
  razon_social          TEXT NOT NULL,
  tipo_declarante       TEXT NOT NULL DEFAULT 'contribuyente',
    -- contribuyente | gran_contribuyente | autoretenedor | agente_retenedor
  codigo_actividad_ciiu TEXT,
  municipio_codigo      TEXT DEFAULT '11001',  -- Bogotá DIVIPOLA
  correo_contacto       TEXT,
  activo                BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, anio_gravable)
);

-- ── Reglas de mapeo PUC → Formato / Concepto (motor declarativo) ──────────
CREATE TABLE IF NOT EXISTS exogenas_reglas_mapeo (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL = regla global compartida para todos los tenants
  anio_gravable     INTEGER NOT NULL,
  formato_codigo    TEXT NOT NULL,          -- '1001', '1005', '1006', '1007', '1010'
  cuenta_puc_patron TEXT NOT NULL,          -- '5120', '51%', '5120-5199'
  concepto_codigo   TEXT NOT NULL,          -- '5001', '5007', etc.
  tipo_tercero      TEXT,                   -- 'persona_natural' | 'persona_juridica' | 'exterior' | NULL=ambos
  naturaleza        TEXT,                   -- 'debito' | 'credito' | NULL=ambas
  monto_minimo      NUMERIC(18,2),          -- aplicar solo si monto >= este valor
  incluye_retencion BOOLEAN,               -- true = solo si tiene retención asociada
  prioridad         INTEGER DEFAULT 50,     -- menor número = mayor prioridad
  activo            BOOLEAN DEFAULT true,
  fuente            TEXT DEFAULT 'sistema', -- 'sistema' | 'usuario' | 'importado'
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ── Proceso de generación (una ejecución completa) ────────────────────────
CREATE TABLE IF NOT EXISTS exogenas_procesos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  anio_gravable       INTEGER NOT NULL,
  periodo_inicio      DATE NOT NULL,
  periodo_fin         DATE NOT NULL,
  formatos_incluidos  TEXT[] DEFAULT ARRAY['1001','1005','1006','1007','1010'],
  estado              TEXT NOT NULL DEFAULT 'borrador',
    -- borrador | procesando | revision | aprobado | exportado | anulado
  total_registros     INTEGER DEFAULT 0,
  total_excepciones   INTEGER DEFAULT 0,
  excepciones_abiertas INTEGER DEFAULT 0,
  monto_pagos_1001    NUMERIC(18,2) DEFAULT 0,
  monto_retenciones   NUMERIC(18,2) DEFAULT 0,
  parametros_json     JSONB DEFAULT '{}',   -- umbrales, configuración adicional
  log_proceso         JSONB DEFAULT '[]',
  iniciado_por        UUID REFERENCES profiles(id),
  aprobado_por        UUID REFERENCES profiles(id),
  fecha_aprobacion    TIMESTAMPTZ,
  observaciones       TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ── Filas generadas por formato ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exogenas_filas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proceso_id          UUID NOT NULL REFERENCES exogenas_procesos(id) ON DELETE CASCADE,
  formato_codigo      TEXT NOT NULL,
  formato_version     TEXT NOT NULL,
  numero_fila         INTEGER NOT NULL,

  -- Identificación del tercero informado
  tipo_documento      TEXT,     -- 1=CC 2=CE 3=NIT 4=TI 5=PP 6=TE 7=PEP 11=DI 12=SC 13=DE 14=CCS
  numero_id           TEXT,
  dv                  TEXT,
  pais_codigo         TEXT DEFAULT 'CO',
  depto_codigo        TEXT,
  municipio_codigo    TEXT,
  primer_apellido     TEXT,
  segundo_apellido    TEXT,
  primer_nombre       TEXT,
  otros_nombres       TEXT,
  razon_social        TEXT,     -- para personas jurídicas

  -- Concepto y valores monetarios (en COP, sin decimales para el prevalidador)
  concepto_codigo     TEXT,
  valor_pago          NUMERIC(18,2) DEFAULT 0,
  valor_iva           NUMERIC(18,2) DEFAULT 0,
  valor_retefuente    NUMERIC(18,2) DEFAULT 0,
  valor_reteiva       NUMERIC(18,2) DEFAULT 0,
  valor_reteica       NUMERIC(18,2) DEFAULT 0,

  -- Campos adicionales para otros formatos (1005, 1006, 1007, 1010)
  datos_adicionales   JSONB DEFAULT '{}',

  -- Trazabilidad
  cuentas_origen      TEXT[],       -- cuentas PUC que originaron este registro
  documentos_ids      TEXT[],       -- CUFEs, IDs Siigo, refs internas
  regla_id            UUID REFERENCES exogenas_reglas_mapeo(id),

  -- Estado de revisión
  estado_fila         TEXT DEFAULT 'ok',
    -- ok | excepcion | corregido | omitido | manual
  excepcion_tipo      TEXT,
  excepcion_desc      TEXT,
  valor_original      JSONB,        -- snapshot antes de corrección manual
  corregido_por       UUID REFERENCES profiles(id),
  fecha_correccion    TIMESTAMPTZ,
  justificacion       TEXT,         -- obligatoria si estado = 'omitido'

  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (proceso_id, formato_codigo, numero_fila)
);

-- ── Excepciones pendientes de revisión ────────────────────────────────────
CREATE TABLE IF NOT EXISTS exogenas_excepciones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proceso_id          UUID NOT NULL REFERENCES exogenas_procesos(id) ON DELETE CASCADE,
  fila_id             UUID REFERENCES exogenas_filas(id),
  formato_codigo      TEXT,
  tipo                TEXT NOT NULL,
    -- tercero_sin_identificar | nit_invalido | dv_incorrecto
    -- cuenta_sin_regla | monto_anomalo | retencion_inconsistente
    -- base_inferior_minimo | tercero_duplicado | pais_exterior_sin_datos
  severidad           TEXT NOT NULL DEFAULT 'media',  -- alta | media | baja
  descripcion         TEXT NOT NULL,
  valor_involucrado   NUMERIC(18,2),
  sugerencia          TEXT,
  documentos_refs     TEXT[],
  estado              TEXT DEFAULT 'pendiente',  -- pendiente | resuelto | ignorado
  resuelto_por        UUID REFERENCES profiles(id),
  resolucion          TEXT,
  fecha_resolucion    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ── Reconciliación: generado vs saldos contables ─────────────────────────
CREATE TABLE IF NOT EXISTS exogenas_reconciliacion (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proceso_id          UUID NOT NULL REFERENCES exogenas_procesos(id) ON DELETE CASCADE,
  formato_codigo      TEXT NOT NULL,
  concepto_codigo     TEXT,
  cuenta_puc_ref      TEXT,         -- cuenta de referencia para comparar
  descripcion         TEXT,
  monto_generado      NUMERIC(18,2) DEFAULT 0,
  monto_contable      NUMERIC(18,2) DEFAULT 0,
  diferencia          NUMERIC(18,2) GENERATED ALWAYS AS (monto_generado - monto_contable) STORED,
  porcentaje_diff     NUMERIC(8,4),
  estado              TEXT DEFAULT 'ok', -- ok | alerta | critico
  notas               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ── Archivos exportados (trazabilidad de descarga) ────────────────────────
CREATE TABLE IF NOT EXISTS exogenas_archivos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proceso_id          UUID NOT NULL REFERENCES exogenas_procesos(id),
  formato_codigo      TEXT NOT NULL,
  nombre_archivo      TEXT NOT NULL,   -- ej: 1001_900123456_2025.xlsx
  total_filas         INTEGER,
  total_monto         NUMERIC(18,2),
  hash_sha256         TEXT,            -- integridad del archivo generado
  storage_path        TEXT,            -- path en Supabase Storage (opcional)
  exportado_por       UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ── Índices de rendimiento ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_exogenas_filas_proceso
  ON exogenas_filas(proceso_id, formato_codigo);
CREATE INDEX IF NOT EXISTS idx_exogenas_filas_tercero
  ON exogenas_filas(numero_id, concepto_codigo);
CREATE INDEX IF NOT EXISTS idx_exogenas_filas_estado
  ON exogenas_filas(proceso_id, estado_fila);
CREATE INDEX IF NOT EXISTS idx_exogenas_excepciones_proceso
  ON exogenas_excepciones(proceso_id, estado);
CREATE INDEX IF NOT EXISTS idx_exogenas_reglas_formato
  ON exogenas_reglas_mapeo(formato_codigo, anio_gravable, activo);
CREATE INDEX IF NOT EXISTS idx_exogenas_procesos_tenant
  ON exogenas_procesos(tenant_id, anio_gravable, estado);

-- ── RLS (Row Level Security) ──────────────────────────────────────────────
ALTER TABLE exogenas_config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE exogenas_reglas_mapeo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE exogenas_procesos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exogenas_filas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE exogenas_excepciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE exogenas_reconciliacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE exogenas_archivos       ENABLE ROW LEVEL SECURITY;

-- Políticas: tenant isolation
CREATE POLICY exogenas_config_tenant ON exogenas_config
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY exogenas_procesos_tenant ON exogenas_procesos
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY exogenas_reglas_tenant ON exogenas_reglas_mapeo
  USING (tenant_id IS NULL OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
