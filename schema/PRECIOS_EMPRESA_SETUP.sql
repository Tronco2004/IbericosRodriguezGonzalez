-- ============================================
-- AGREGAR PRECIOS DE EMPRESA A PRODUCTOS
-- ============================================

-- Agregar columna de precio empresa a la tabla productos
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS precio_empresa_centimos INT DEFAULT 0;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_productos_precio_empresa ON productos(precio_empresa_centimos);

-- Actualizar vista de productos para incluir precios de empresa
DROP VIEW IF EXISTS v_productos_completo;
CREATE VIEW v_productos_completo AS
SELECT 
  p.id,
  p.nombre,
  p.descripcion,
  p.precio_centimos,
  p.precio_empresa_centimos,
  c.nombre AS categoria,
  c.slug,
  p.imagen_url,
  p.rating,
  p.stock,
  p.sku,
  p.activo
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id;

-- Nota: Los datos existentes tendrán precio_empresa_centimos = 0
-- Debes actualizar manualmente los precios de empresa en el admin
