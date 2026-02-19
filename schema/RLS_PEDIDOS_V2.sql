-- =====================================================
-- ROW LEVEL SECURITY (RLS) PARA TABLA PEDIDOS
-- =====================================================
-- Políticas:
-- USUARIO:
--   - SELECT: ve solo SUS pedidos (por usuario_id O email_cliente)
--   - INSERT: puede crear sus propios pedidos
--   - UPDATE: puede actualizar solo SUS pedidos
--   - DELETE: NO puede eliminar pedidos
-- ADMIN:
--   - SELECT/INSERT/UPDATE/DELETE: acceso total
-- INVITADOS:
--   - INSERT: pueden crear pedidos con es_invitado=true
--   - SELECT por email: si luego se registran, ven sus pedidos anteriores
-- =====================================================

-- 0. LIMPIAR POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "pedidos_insert_allow_all" ON pedidos;
DROP POLICY IF EXISTS "pedidos_select_own" ON pedidos;
DROP POLICY IF EXISTS "pedidos_update_own" ON pedidos;
DROP POLICY IF EXISTS "pedidos_delete_admin" ON pedidos;
DROP POLICY IF EXISTS "pedidos_select" ON pedidos;
DROP POLICY IF EXISTS "pedidos_insert" ON pedidos;
DROP POLICY IF EXISTS "pedidos_update" ON pedidos;
DROP POLICY IF EXISTS "pedidos_delete" ON pedidos;

-- Deshabilitar RLS temporalmente para limpiar
ALTER TABLE pedidos DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- HABILITAR RLS
-- =====================================================
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS
-- =====================================================

-- 1. SELECT: usuario ve sus propios pedidos (por usuario_id O email), admin ve todos
CREATE POLICY "pedidos_select"
ON pedidos FOR SELECT
USING (
  -- Admin ve todo
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
  OR
  -- Usuario logueado ve los suyos por usuario_id
  (auth.uid() = usuario_id)
  OR
  -- Usuario logueado ve los suyos por email (invitados vinculados)
  (email_cliente = (SELECT email FROM usuarios WHERE id = auth.uid()))
);

-- 2. INSERT: usuario puede crear sus propios pedidos
CREATE POLICY "pedidos_insert"
ON pedidos FOR INSERT
WITH CHECK (
  -- Admin puede crear cualquier pedido
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
  OR
  -- Usuario crea pedido con su propio usuario_id
  (auth.uid() = usuario_id)
  OR
  -- Pedidos de invitados (usuario_id es null y es_invitado es true)
  (usuario_id IS NULL AND es_invitado = true)
);

-- 3. UPDATE: usuario solo actualiza sus pedidos, admin todos
CREATE POLICY "pedidos_update"
ON pedidos FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
  OR
  (auth.uid() = usuario_id)
  OR
  (email_cliente = (SELECT email FROM usuarios WHERE id = auth.uid()))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
  OR
  (auth.uid() = usuario_id)
  OR
  (email_cliente = (SELECT email FROM usuarios WHERE id = auth.uid()))
);

-- 4. DELETE: solo admin puede eliminar pedidos
CREATE POLICY "pedidos_delete"
ON pedidos FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'pedidos';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'pedidos';
