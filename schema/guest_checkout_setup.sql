-- =============================================
-- GUEST CHECKOUT - COMPRAS SIN INICIAR SESIÓN
-- =============================================
-- Ejecuta este script en Supabase SQL Editor
-- Fecha: 2026-01-22
-- =============================================

-- 1. Hacer usuario_id NULLABLE para permitir pedidos de invitados
-- (Esto permite que un pedido no tenga usuario asociado)
ALTER TABLE pedidos 
ALTER COLUMN usuario_id DROP NOT NULL;

-- 2. Agregar columna nombre_cliente si no existe
-- (Para guardar el nombre del invitado)
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS nombre_cliente VARCHAR(150);

-- 3. Agregar columna para identificar pedidos de invitados
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS es_invitado BOOLEAN DEFAULT FALSE;

-- 4. Actualizar constraint de foreign key
-- Cambiamos ON DELETE CASCADE a ON DELETE SET NULL
-- para que si se elimina un usuario, sus pedidos no se borren
ALTER TABLE pedidos 
DROP CONSTRAINT IF EXISTS pedidos_usuario_id_fkey;

ALTER TABLE pedidos 
ADD CONSTRAINT pedidos_usuario_id_fkey 
FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- 5. Índice para buscar pedidos de invitados por email
-- (Útil para consultas de soporte)
CREATE INDEX IF NOT EXISTS idx_pedidos_email_invitado 
ON pedidos(email_cliente) WHERE es_invitado = TRUE;

-- 6. Índice para buscar pedidos sin usuario
CREATE INDEX IF NOT EXISTS idx_pedidos_sin_usuario 
ON pedidos(fecha_creacion) WHERE usuario_id IS NULL;

-- =============================================
-- FUNCIÓN PARA VINCULAR PEDIDOS DE INVITADOS
-- =============================================
-- Se ejecuta automáticamente cuando un usuario invitado se registra
-- Busca todos los pedidos hechos con su email y los vincula a su cuenta

CREATE OR REPLACE FUNCTION vincular_pedidos_invitado(p_usuario_id UUID, p_email VARCHAR)
RETURNS TABLE(pedidos_vinculados INT) AS $$
DECLARE
  v_updated INT;
BEGIN
  -- Actualizar todos los pedidos invitados con este email
  UPDATE pedidos 
  SET usuario_id = p_usuario_id, es_invitado = FALSE
  WHERE email_cliente = p_email 
    AND usuario_id IS NULL
    AND es_invitado = TRUE;
  
  -- Obtener cantidad de pedidos actualizados
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RETURN QUERY SELECT v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- VERIFICACIÓN
-- =============================================
-- Ejecuta esto para verificar que todo está correcto:

-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'pedidos' 
-- AND column_name IN ('usuario_id', 'nombre_cliente', 'es_invitado', 'email_cliente');

-- =============================================
-- NOTA IMPORTANTE
-- =============================================
-- Los pedidos de invitados tendrán:
-- - usuario_id = NULL
-- - es_invitado = TRUE
-- - nombre_cliente = 'Nombre del cliente'
-- - email_cliente = 'email@ejemplo.com'
-- - telefono_cliente = '612345678'
--
-- El cliente recibirá un email de confirmación automáticamente.
-- Cuando se registre, sus pedidos previos se vincularán automáticamente a su cuenta.
