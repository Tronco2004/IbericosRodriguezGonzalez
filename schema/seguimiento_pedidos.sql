-- ============================================
-- SISTEMA DE SEGUIMIENTO DE PEDIDOS
-- ============================================

-- 1. Agregar columna de código de seguimiento a pedidos
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS codigo_seguimiento VARCHAR(20) UNIQUE;

-- 2. Agregar columna estado_seguimiento con los 3 estados
-- (pagado, enviado, entregado)
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS estado_seguimiento VARCHAR(20) DEFAULT 'pagado' 
CHECK (estado_seguimiento IN ('pagado', 'enviado', 'entregado'));

-- 3. Crear índice para búsquedas rápidas por código de seguimiento
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo_seguimiento 
ON pedidos(codigo_seguimiento);

-- 4. Función para generar código de seguimiento único
-- Formato: IRG-XXXXXXXX (8 caracteres alfanuméricos)
CREATE OR REPLACE FUNCTION generar_codigo_seguimiento()
RETURNS VARCHAR(20) AS $$
DECLARE
  codigo VARCHAR(20);
  existe BOOLEAN;
BEGIN
  LOOP
    -- Generar código: IRG- + 8 caracteres alfanuméricos
    codigo := 'IRG-' || UPPER(
      SUBSTRING(
        MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) 
        FROM 1 FOR 8
      )
    );
    
    -- Verificar que no existe
    SELECT EXISTS(SELECT 1 FROM pedidos WHERE codigo_seguimiento = codigo) INTO existe;
    
    -- Si no existe, salir del loop
    EXIT WHEN NOT existe;
  END LOOP;
  
  RETURN codigo;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para asignar código automáticamente al crear pedido
CREATE OR REPLACE FUNCTION trigger_asignar_codigo_seguimiento()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo asignar si no tiene código
  IF NEW.codigo_seguimiento IS NULL THEN
    NEW.codigo_seguimiento := generar_codigo_seguimiento();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe y crear nuevo
DROP TRIGGER IF EXISTS trg_asignar_codigo_seguimiento ON pedidos;

CREATE TRIGGER trg_asignar_codigo_seguimiento
BEFORE INSERT ON pedidos
FOR EACH ROW
EXECUTE FUNCTION trigger_asignar_codigo_seguimiento();

-- 6. Actualizar pedidos existentes que no tengan código
UPDATE pedidos 
SET codigo_seguimiento = generar_codigo_seguimiento(),
    estado_seguimiento = CASE 
      WHEN fecha_entrega IS NOT NULL THEN 'entregado'
      WHEN fecha_envio IS NOT NULL THEN 'enviado'
      ELSE 'pagado'
    END
WHERE codigo_seguimiento IS NULL;

-- 7. Vista para consultar seguimiento (sin datos sensibles)
CREATE OR REPLACE VIEW vista_seguimiento_pedidos AS
SELECT 
  codigo_seguimiento,
  estado_seguimiento,
  fecha_creacion,
  fecha_pago,
  fecha_envio,
  fecha_entrega,
  CASE estado_seguimiento
    WHEN 'pagado' THEN 'Tu pedido ha sido pagado y está siendo preparado'
    WHEN 'enviado' THEN 'Tu pedido está en camino'
    WHEN 'entregado' THEN 'Tu pedido ha sido entregado'
  END as mensaje_estado
FROM pedidos
WHERE codigo_seguimiento IS NOT NULL;
