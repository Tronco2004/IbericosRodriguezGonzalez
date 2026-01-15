-- Agregar campo cantidad_disponible a producto_variantes
ALTER TABLE producto_variantes
ADD COLUMN IF NOT EXISTS cantidad_disponible INT DEFAULT 10;

-- Crear índice para optimizar búsquedas por stock
CREATE INDEX IF NOT EXISTS idx_producto_variantes_stock 
ON producto_variantes(cantidad_disponible);
