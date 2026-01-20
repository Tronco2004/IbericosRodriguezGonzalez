-- ============================================
-- MIGRACIÓN: SISTEMA HÍBRIDO DE PRODUCTOS
-- ============================================
-- Enfoque flexible para dos tipos de productos:
--
-- 1. PRODUCTOS SIMPLES (sin variantes):
--    - Paquete jamón 100gr
--    - Manteca 500gr
--    - Queso curado 250gr
--    → Usan campo "stock" en tabla productos
--    → es_variable = FALSE
--
-- 2. PRODUCTOS CON VARIANTES (múltiples pesos):
--    - Jamón Ibérico (4.5kg, 4.6kg, 4.7kg, etc.)
--    - Jamón Serrano (pesos variables)
--    → Usan tabla "producto_variantes"
--    → es_variable = TRUE
--    → campo "stock" se ignora

-- 1. Agregar campos a tabla productos
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS precio_por_kg DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS es_variable BOOLEAN DEFAULT FALSE;

-- 2. Crear tabla de variantes de productos (solo para productos variables)
CREATE TABLE IF NOT EXISTS producto_variantes (
  id SERIAL PRIMARY KEY,
  producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  peso_kg DECIMAL(5, 3) NOT NULL,
  precio_total DECIMAL(10, 2) NOT NULL,
  disponible BOOLEAN DEFAULT TRUE,
  sku_variante VARCHAR(100) UNIQUE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(producto_id, peso_kg)
);

-- 3. Crear índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_producto_variantes_producto_id 
ON producto_variantes(producto_id);

CREATE INDEX IF NOT EXISTS idx_producto_variantes_disponible 
ON producto_variantes(disponible);

-- 4. Alterar tabla carrito_items para almacenar variante (opcional pero recomendado)
ALTER TABLE carrito_items
ADD COLUMN IF NOT EXISTS producto_variante_id INT REFERENCES producto_variantes(id),
ADD COLUMN IF NOT EXISTS peso_kg DECIMAL(5, 3);

-- 5. Crear índice en carrito_items
CREATE INDEX IF NOT EXISTS idx_carrito_items_variante 
ON carrito_items(producto_variante_id);

-- ============================================
-- LÓGICA DE FUNCIONAMIENTO
-- ============================================
--
-- AGREGAR AL CARRITO - Producto Simple (sin variantes):
-- UPDATE productos SET stock = stock - 1 WHERE id = X;
--
-- AGREGAR AL CARRITO - Producto Variable (con variantes):
-- DELETE FROM producto_variantes WHERE id = Y;
-- (o UPDATE disponible = FALSE)
--
-- CONSULTAR VARIANTES DISPONIBLES:
-- SELECT * FROM producto_variantes 
-- WHERE producto_id = X AND disponible = TRUE 
-- ORDER BY peso_kg;

