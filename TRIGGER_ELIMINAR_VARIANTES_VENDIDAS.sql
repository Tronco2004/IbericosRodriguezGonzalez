-- ============================================
-- TRIGGER: Eliminar variantes vendidas automáticamente
-- ============================================
-- Cuando se inserta un item de pedido con variante, eliminar esa variante de la BD

-- 1. Crear la función que se ejecutará cuando se venda una variante
CREATE OR REPLACE FUNCTION eliminar_variante_vendida()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el pedido_item tiene un producto_variante_id, ELIMINAR esa variante
  IF NEW.producto_variante_id IS NOT NULL THEN
    DELETE FROM producto_variantes
    WHERE id = NEW.producto_variante_id;
    
    RAISE NOTICE 'Variante eliminada completamente: %', NEW.producto_variante_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Crear el trigger que se dispara después de insertar en pedido_items
DROP TRIGGER IF EXISTS trigger_eliminar_variante_vendida ON pedido_items;

CREATE TRIGGER trigger_eliminar_variante_vendida
AFTER INSERT ON pedido_items
FOR EACH ROW
EXECUTE FUNCTION eliminar_variante_vendida();

-- Verificar que el trigger se creó correctamente
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_eliminar_variante_vendida';
