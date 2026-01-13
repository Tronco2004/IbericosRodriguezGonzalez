-- ============================================
-- AGREGAR IVA (IMPUESTO AL VALOR AGREGADO)
-- ============================================

-- Agregar columnas de IVA a la tabla productos
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS iva NUMERIC(5,2) DEFAULT 21.00;

ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS iva_empresa NUMERIC(5,2) DEFAULT 21.00;

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_productos_iva ON productos(iva);
CREATE INDEX IF NOT EXISTS idx_productos_iva_empresa ON productos(iva_empresa);

-- Comentarios sobre los campos
COMMENT ON COLUMN productos.iva IS 'IVA en porcentaje para precio público (B2C)';
COMMENT ON COLUMN productos.iva_empresa IS 'IVA en porcentaje para precio empresarial (B2B)';

-- Nota: Los valores por defecto son 21% (IVA estándar en España)
-- Cada producto puede tener un IVA diferente según su categorización
