-- Crear variantes para productos de peso variable
-- Por ejemplo, si el producto 13 es queso y lo vendes en diferentes pesos
-- Agregar estas líneas con los pesos específicos que uses

INSERT INTO producto_variantes (producto_id, peso_kg, disponible)
VALUES
  (13, 0.250, 100),  -- Queso de 250g
  (13, 0.500, 100),  -- Queso de 500g
  (13, 1.000, 50)    -- Queso de 1kg
ON CONFLICT (producto_id, peso_kg) DO NOTHING;
