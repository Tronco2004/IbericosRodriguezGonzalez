-- Agregar columnas a la tabla pedidos si no existen
ALTER TABLE pedidos 
  ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
