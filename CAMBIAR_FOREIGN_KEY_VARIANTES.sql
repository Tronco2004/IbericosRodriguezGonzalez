-- ============================================
-- CAMBIAR CLAVE FORÁNEA PARA PERMITIR ELIMINAR VARIANTES
-- ============================================
-- Cambiar la FK de pedido_items para que sea ON DELETE SET NULL

-- 1. Eliminar la clave foránea existente
ALTER TABLE pedido_items
DROP CONSTRAINT pedido_items_producto_variante_id_fkey;

-- 2. Crear la nueva clave foránea con ON DELETE SET NULL
ALTER TABLE pedido_items
ADD CONSTRAINT pedido_items_producto_variante_id_fkey
FOREIGN KEY (producto_variante_id)
REFERENCES producto_variantes(id)
ON DELETE SET NULL;

-- 3. Hacer lo mismo para carrito_items
ALTER TABLE carrito_items
DROP CONSTRAINT carrito_items_producto_variante_id_fkey;

ALTER TABLE carrito_items
ADD CONSTRAINT carrito_items_producto_variante_id_fkey
FOREIGN KEY (producto_variante_id)
REFERENCES producto_variantes(id)
ON DELETE SET NULL;

-- Verificar que los cambios se aplicaron
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name IN ('pedido_items', 'carrito_items')
AND column_name = 'producto_variante_id';
