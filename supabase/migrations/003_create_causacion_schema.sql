-- 003_create_causacion_schema.sql
-- Creación de esquema para Causación Automática de Facturas Electrónicas (DIAN)

-- Habilitar la extensión pgcrypto si no existe para manejar encriptación
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Configuración de Proveedor Tecnológico por Usuario/Empresa
CREATE TABLE IF NOT EXISTS public.user_dian_config (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    proveedor_tecnologico VARCHAR(50) NOT NULL, -- 'factus', 'siigo', 'custom', etc.
    api_key BYTEA NOT NULL, -- Almacenado encriptado
    api_secret BYTEA, -- Almacenado encriptado (opcional dependiendo del PT)
    nit_empresa VARCHAR(50) NOT NULL,
    ambiente VARCHAR(20) DEFAULT 'pruebas' CHECK (ambiente IN ('produccion', 'pruebas')),
    activo BOOLEAN DEFAULT false,
    last_sync TIMESTAMP WITH TIME ZONE,
    reglas_causacion JSONB DEFAULT '[]'::jsonb, -- Reglas personalizadas de mapeo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Facturas Recibidas Pendientes/Causadas
CREATE TABLE IF NOT EXISTS public.facturas_recibidas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    cufe VARCHAR(255) NOT NULL,
    numero_factura VARCHAR(100) NOT NULL,
    proveedor_nit VARCHAR(50) NOT NULL,
    proveedor_nombre VARCHAR(255) NOT NULL,
    fecha_emision DATE NOT NULL,
    subtotal NUMERIC(15, 2) DEFAULT 0,
    iva NUMERIC(15, 2) DEFAULT 0,
    total NUMERIC(15, 2) NOT NULL,
    impuestos_retenidos JSONB DEFAULT '[]'::jsonb,
    xml_url TEXT, -- O el contenido del XML directamente
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'causada', 'rechazada', 'revision')),
    asiento_contable_generado JSONB,
    fecha_causacion TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (profile_id, cufe) -- Un CUFE es único por empresa
);

-- Índices de optimización
CREATE INDEX IF NOT EXISTS idx_facturas_recibidas_profile_id ON public.facturas_recibidas(profile_id);
CREATE INDEX IF NOT EXISTS idx_facturas_recibidas_estado ON public.facturas_recibidas(estado);
CREATE INDEX IF NOT EXISTS idx_facturas_recibidas_fecha_emision ON public.facturas_recibidas(fecha_emision);

-- Políticas de Seguridad RLS
ALTER TABLE public.user_dian_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_recibidas ENABLE ROW LEVEL SECURITY;

-- user_dian_config RLS
CREATE POLICY "Usuarios pueden ver su propia config DIAN" 
    ON public.user_dian_config FOR SELECT 
    USING (auth.uid() = profile_id);

CREATE POLICY "Usuarios pueden insertar su propia config DIAN" 
    ON public.user_dian_config FOR INSERT 
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Usuarios pueden actualizar su propia config DIAN" 
    ON public.user_dian_config FOR UPDATE 
    USING (auth.uid() = profile_id);

-- facturas_recibidas RLS
CREATE POLICY "Usuarios pueden ver sus facturas recibidas" 
    ON public.facturas_recibidas FOR SELECT 
    USING (auth.uid() = profile_id);

CREATE POLICY "Usuarios pueden insertar sus facturas recibidas" 
    ON public.facturas_recibidas FOR INSERT 
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Usuarios pueden actualizar sus facturas recibidas" 
    ON public.facturas_recibidas FOR UPDATE 
    USING (auth.uid() = profile_id);

-- Opcional: Políticas para admin general (si es necesario para superadmin)
-- CREATE POLICY "Permitir select a superadmin" ON public.user_dian_config FOR SELECT USING (true);
