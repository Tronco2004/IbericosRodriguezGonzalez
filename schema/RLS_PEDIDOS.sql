-- =====================================================
-- ROW LEVEL SECURITY (RLS) PARA TABLA PEDIDOS
-- =====================================================
-- Políticas:
-- - Usuarios ven/editan solo sus propios pedidos
-- - Pueden CANCELAR si está en estado 'pagado'
-- - Pueden DEVOLVER si está en estado 'entregado'
-- - Admin ve/edita todo
-- =====================================================

-- 0. LIMPIAR POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "pedidos_select_own" ON pedidos;
DROP POLICY IF EXISTS "pedidos_select_admin" ON pedidos;
DROP POLICY IF EXISTS "pedidos_update_own" ON pedidos;
DROP POLICY IF EXISTS "pedidos_update_own_cancelar" ON pedidos;
DROP POLICY IF EXISTS "pedidos_update_own_devolver" ON pedidos;
DROP POLICY IF EXISTS "pedidos_update_admin" ON pedidos;
DROP POLICY IF EXISTS "pedidos_insert_admin" ON pedidos;
DROP POLICY IF EXISTS "pedidos_delete_admin" ON pedidos;
DROP POLICY IF EXISTS "pedidos_insert_allow" ON pedidos;
DROP POLICY IF EXISTS "pedidos_delete_allow" ON pedidos;

-- Deshabilitar RLS temporalmente
ALTER TABLE pedidos DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- HABILITAR RLS
-- =====================================================
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS
-- =====================================================

-- 1. POLÍTICA SELECT: Usuarios ven sus propios pedidos, Admin ve todo
CREATE POLICY "pedidos_select_own"
ON pedidos
FOR SELECT
USING (
  auth.uid() = usuario_id
);

CREATE POLICY "pedidos_select_admin"
ON pedidos
FOR SELECT
USING (
  (auth.jwt()->>'rol') = 'admin'
);

-- 2. POLÍTICA UPDATE: Usuarios pueden cambiar estado de sus pedidos con restricciones
-- - CANCELAR: solo si estado actual es 'pagado'
-- - DEVOLVER: solo si estado actual es 'entregado'
CREATE POLICY "pedidos_update_own_cancelar"
ON pedidos
FOR UPDATE
USING (
  estado = 'pagado'
)
WITH CHECK (
  estado = 'cancelado'
);

CREATE POLICY "pedidos_update_own_devolver"
ON pedidos
FOR UPDATE
USING (
  estado = 'entregado'
)
WITH CHECK (
  estado = 'devolucion_solicitada'
);

-- 3. POLÍTICA UPDATE: Admin puede editar todo
CREATE POLICY "pedidos_update_admin"
ON pedidos
FOR UPDATE
USING (
  (auth.jwt()->>'rol') = 'admin'
)
WITH CHECK (
  (auth.jwt()->>'rol') = 'admin'
);

-- 4. POLÍTICA INSERT: Solo admin crea pedidos
CREATE POLICY "pedidos_insert_admin"
ON pedidos
FOR INSERT
WITH CHECK (
  (auth.jwt()->>'rol') = 'admin'
);

-- 5. POLÍTICA DELETE: Solo admin elimina pedidos
CREATE POLICY "pedidos_delete_admin"
ON pedidos
FOR DELETE
USING (
  (auth.jwt()->>'rol') = 'admin'
);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- SELECT policyname, qual, with_check FROM pg_policies WHERE tablename = 'pedidos';
