-- Agregar columna para stock en kg (productos de peso variable)
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS stock_kg DECIMAL(10, 3) DEFAULT 0;
