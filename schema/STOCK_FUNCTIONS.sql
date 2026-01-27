-- Función para decrementar stock de un producto
CREATE OR REPLACE FUNCTION decrementar_stock_producto(
  p_producto_id INT,
  p_cantidad INT
)
RETURNS VOID AS $$
BEGIN
  UPDATE productos
  SET stock = GREATEST(0, stock - p_cantidad)
  WHERE id = p_producto_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para incrementar stock de un producto (para devoluciones)
CREATE OR REPLACE FUNCTION incrementar_stock_producto(
  p_producto_id INT,
  p_cantidad INT
)
RETURNS VOID AS $$
BEGIN
  UPDATE productos
  SET stock = stock + p_cantidad
  WHERE id = p_producto_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos
GRANT EXECUTE ON FUNCTION decrementar_stock_producto TO anon, authenticated;
GRANT EXECUTE ON FUNCTION incrementar_stock_producto TO anon, authenticated;
