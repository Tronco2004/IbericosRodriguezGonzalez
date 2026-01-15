-- Stored Procedure para cancelar un pedido de forma atómica
-- Cambiar estado a CANCELLED y restaurar stock de todas las variantes

CREATE OR REPLACE FUNCTION cancelar_pedido(p_pedido_id INT)
RETURNS TABLE(success BOOLEAN, message TEXT, pedido_id INT) AS $$
DECLARE
  v_estado TEXT;
BEGIN
  -- Iniciar transacción y verificar estado del pedido
  BEGIN
    -- Lock para evitar race conditions
    SELECT estado INTO v_estado
    FROM pedidos
    WHERE id = p_pedido_id
    FOR UPDATE;

    -- Verificar que el pedido existe
    IF v_estado IS NULL THEN
      RETURN QUERY SELECT false, 'Pedido no encontrado'::TEXT, p_pedido_id;
      RETURN;
    END IF;

    -- Solo permitir cancelación si está en estado "pagado"
    IF v_estado != 'pagado' THEN
      RETURN QUERY SELECT false, ('El pedido no puede ser cancelado en estado: ' || v_estado)::TEXT, p_pedido_id;
      RETURN;
    END IF;

    -- 1. Restaurar stock de todas las variantes del pedido
    UPDATE producto_variantes pv
    SET disponible = disponible + pi.cantidad
    FROM pedido_items pi
    WHERE pi.producto_variante_id = pv.id
    AND pi.pedido_id = p_pedido_id;

    -- 2. Cambiar estado del pedido a "cancelado"
    UPDATE pedidos
    SET estado = 'cancelado',
        fecha_actualizacion = NOW()
    WHERE id = p_pedido_id;

    -- Retornar éxito
    RETURN QUERY SELECT true, 'Pedido cancelado y stock restaurado exitosamente'::TEXT, p_pedido_id;

  EXCEPTION WHEN OTHERS THEN
    -- Si algo falla, toda la transacción se revierte
    RETURN QUERY SELECT false, ('Error: ' || SQLERRM)::TEXT, p_pedido_id;
  END;
END;
$$ LANGUAGE plpgsql;

  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;

-- Grant para que el usuario puede ejecutar esta función
GRANT EXECUTE ON FUNCTION cancelar_pedido(INT) TO authenticated;
