-- Crear función para insertar pedidos (bypasea RLS)
CREATE OR REPLACE FUNCTION crear_pedido(
  p_stripe_session_id TEXT,
  p_numero_pedido TEXT,
  p_subtotal NUMERIC,
  p_total NUMERIC,
  p_nombre_cliente TEXT,
  p_email_cliente TEXT,
  p_telefono_cliente TEXT,
  p_usuario_id UUID DEFAULT NULL,
  p_descuento_aplicado NUMERIC DEFAULT 0,
  p_es_invitado BOOLEAN DEFAULT false,
  p_envio NUMERIC DEFAULT 500
)
RETURNS TABLE(pedido_id INT, numero_pedido_out TEXT, success BOOLEAN, error_msg TEXT) AS $$
DECLARE
  v_pedido_id INT;
  v_error TEXT;
BEGIN
  BEGIN
    -- Insertar el pedido
    -- Nota: subtotal y total se recalculan automáticamente con trigger después de insertar items
    INSERT INTO pedidos (
      usuario_id,
      stripe_session_id,
      numero_pedido,
      subtotal,
      total,
      descuento_aplicado,
      nombre_cliente,
      email_cliente,
      telefono_cliente,
      es_invitado,
      envio,
      estado,
      fecha_pago,
      fecha_creacion,
      fecha_actualizacion
    ) VALUES (
      p_usuario_id,
      p_stripe_session_id,
      p_numero_pedido,
      0,  -- subtotal se recalculará con trigger
      p_envio,  -- total inicial es solo el envío, se recalculará con trigger
      p_descuento_aplicado,
      p_nombre_cliente,
      p_email_cliente,
      p_telefono_cliente,
      p_es_invitado,
      p_envio,
      'pagado',
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_pedido_id;

    RETURN QUERY SELECT v_pedido_id, p_numero_pedido, true, NULL::TEXT;

  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    RETURN QUERY SELECT NULL::INT, NULL::TEXT, false, v_error;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permisos de ejecución a usuarios anónimos
GRANT EXECUTE ON FUNCTION crear_pedido TO anon, authenticated;
