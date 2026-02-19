-- =====================================================
-- ROW LEVEL SECURITY (RLS) PARA TABLA PEDIDO_ITEMS
-- =====================================================
-- Políticas:
-- USUARIO (auth.uid()):
--   - SELECT: ve solo items de SUS pedidos (por usuario_id o email en pedidos)
--   - INSERT: puede insertar items en sus propios pedidos
--   - UPDATE: NO puede modificar items
--   - DELETE: NO puede eliminar items
-- ADMIN:
--   - SELECT/INSERT/UPDATE/DELETE: acceso total
-- INVITADOS:
--   - INSERT: items de pedidos con es_invitado=true
-- NOTA: La app usa custom auth (no Supabase Auth), por lo que
--   auth.uid() es siempre NULL. Las operaciones server-side
--   usan supabaseAdmin (service role) que bypasea RLS.
--   Estas políticas protegen contra acceso directo con anon key.
-- =====================================================

-- 0. LIMPIAR POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "pedido_items_select" ON pedido_items;
DROP POLICY IF EXISTS "pedido_items_insert" ON pedido_items;
DROP POLICY IF EXISTS "pedido_items_insert_allow" ON pedido_items;
DROP POLICY IF EXISTS "pedido_items_insert_allow_all" ON pedido_items;
DROP POLICY IF EXISTS "pedido_items_update" ON pedido_items;
DROP POLICY IF EXISTS "pedido_items_delete" ON pedido_items;

-- Deshabilitar RLS temporalmente para limpiar
ALTER TABLE pedido_items DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- HABILITAR RLS
-- =====================================================
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS
-- =====================================================

-- 1. SELECT: usuario ve items de sus propios pedidos, admin ve todos
CREATE POLICY "pedido_items_select"
ON pedido_items FOR SELECT
USING (
  -- Admin ve todo
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
  OR
  -- Usuario logueado ve items de sus pedidos (por usuario_id)
  EXISTS (
    SELECT 1 FROM pedidos
    WHERE pedidos.id = pedido_items.pedido_id
    AND pedidos.usuario_id = auth.uid()
  )
  OR
  -- Usuario logueado ve items de pedidos vinculados por email
  EXISTS (
    SELECT 1 FROM pedidos
    JOIN usuarios ON usuarios.id = auth.uid()
    WHERE pedidos.id = pedido_items.pedido_id
    AND pedidos.email_cliente = usuarios.email
  )
);

-- 2. INSERT: usuario puede insertar items en sus pedidos o pedidos de invitados
CREATE POLICY "pedido_items_insert"
ON pedido_items FOR INSERT
WITH CHECK (
  -- Admin puede insertar cualquier item
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
  OR
  -- Usuario inserta items en su propio pedido
  EXISTS (
    SELECT 1 FROM pedidos
    WHERE pedidos.id = pedido_items.pedido_id
    AND pedidos.usuario_id = auth.uid()
  )
  OR
  -- Items para pedidos de invitados
  EXISTS (
    SELECT 1 FROM pedidos
    WHERE pedidos.id = pedido_items.pedido_id
    AND pedidos.usuario_id IS NULL
    AND pedidos.es_invitado = true
  )
);

-- 3. UPDATE: solo admin puede modificar items
CREATE POLICY "pedido_items_update"
ON pedido_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
);

-- 4. DELETE: solo admin puede eliminar items
CREATE POLICY "pedido_items_delete"
ON pedido_items FOR DELETE
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
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'pedido_items';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'pedido_items';
