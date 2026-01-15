-- Agregar columna descuento_aplicado a la tabla pedidos si no existe
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS descuento_aplicado DECIMAL(10, 2) DEFAULT 0;
