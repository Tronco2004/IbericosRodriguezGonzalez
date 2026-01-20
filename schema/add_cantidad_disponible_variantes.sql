-- Agregar campo cantidad_disponible a la tabla producto_variantes si no existe
ALTER TABLE producto_variantes
ADD COLUMN IF NOT EXISTS cantidad_disponible INT DEFAULT 1;

-- Actualizar variantes existentes que tengan null en cantidad_disponible
UPDATE producto_variantes
SET cantidad_disponible = 1
WHERE cantidad_disponible IS NULL OR cantidad_disponible = 0;

-- Crear índice para mejorar búsquedas por disponibilidad
CREATE INDEX IF NOT EXISTS idx_producto_variantes_cantidad_disponible
ON producto_variantes(cantidad_disponible);
