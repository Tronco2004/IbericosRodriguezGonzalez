-- Corregir los subtotales en pedido_items que fueron guardados en centimos
-- pero se almacenaron en campos NUMERIC(10, 2) que los interpreta como euros
-- Por ejemplo: 10000 centimos (€100) fue almacenado como €10000

-- Primero, ver qué datos hay
SELECT 
  id,
  pedido_id,
  precio_unitario,
  cantidad,
  subtotal,
  ROUND(subtotal / 100.0, 2) as subtotal_corregido
FROM pedido_items
WHERE subtotal > 100
LIMIT 10;

-- Si los valores son mayores a lo esperado, significa que fueron guardados en centimos
-- Aplicar la corrección: dividir por 100
UPDATE pedido_items
SET 
  precio_unitario = ROUND(precio_unitario / 100.0, 2),
  subtotal = ROUND(subtotal / 100.0, 2)
WHERE precio_unitario > 100
  OR subtotal > 1000; -- Si subtotal es mayor a 1000, probablemente está en centimos

-- Verificar el resultado
SELECT 
  id,
  pedido_id,
  precio_unitario,
  cantidad,
  subtotal
FROM pedido_items
LIMIT 10;
