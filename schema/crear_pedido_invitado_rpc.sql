-- =====================================================
-- FUNCIÓN RPC: Crear pedido de invitado
-- =====================================================
-- Esta función puede ser llamada sin service role key
-- porque se ejecuta con los permisos de Postgres (authenticated)

CREATE OR REPLACE FUNCTION crear_pedido_invitado(
  p_stripe_session_id TEXT,
  p_numero_pedido TEXT,
  p_email_cliente TEXT,
  p_telefono_cliente TEXT,
  p_subtotal DECIMAL,
  p_envio DECIMAL,
  p_total DECIMAL,
  p_items JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_pedido_id UUID;
  v_item JSONB;
BEGIN
  -- Insertar el pedido (sin usuario_id para invitados)
  -- Nota: subtotal y total se recalculan automáticamente con trigger después de insertar items
  INSERT INTO pedidos (
    usuario_id,
    stripe_session_id,
    numero_pedido,
    estado,
    subtotal,
    envio,
    impuestos,
    total,
    email_cliente,
    telefono_cliente,
    fecha_pago,
    es_invitado
  ) VALUES (
    NULL,
    p_stripe_session_id,
    p_numero_pedido,
    'confirmado',
    0,  -- subtotal se recalculará con trigger
    p_envio,
    0,
    p_envio,  -- total inicial es solo el envío, se recalculará con trigger
    p_email_cliente,
    p_telefono_cliente,
    NOW(),
    TRUE
  )
  RETURNING id INTO v_pedido_id;

  -- Insertar los items del pedido
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO pedido_items (
      pedido_id,
      producto_id,
      producto_variante_id,
      nombre_producto,
      cantidad,
      precio_unitario,
      subtotal,
      peso_kg
    ) VALUES (
      v_pedido_id,
      (v_item->>'producto_id')::INTEGER,
      CASE WHEN v_item->>'producto_variante_id' != 'null' THEN (v_item->>'producto_variante_id')::INTEGER ELSE NULL END,
      v_item->>'nombre_producto',
      (v_item->>'cantidad')::INTEGER,
      (v_item->>'precio_unitario')::DECIMAL,
      (v_item->>'subtotal')::DECIMAL,
      CASE WHEN v_item->>'peso_kg' != 'null' THEN (v_item->>'peso_kg')::DECIMAL ELSE NULL END
    );
  END LOOP;

  -- Retornar el ID del pedido creado
  RETURN jsonb_build_object('id', v_pedido_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos para llamar la función
GRANT EXECUTE ON FUNCTION crear_pedido_invitado(TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION crear_pedido_invitado(TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, JSONB) TO authenticated;
