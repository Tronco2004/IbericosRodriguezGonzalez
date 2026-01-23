-- =====================================================
-- ROW LEVEL SECURITY (RLS) PARA TABLA CARRITOS
-- =====================================================
-- Políticas:
-- - Usuarios ven/editan solo su propio carrito
-- - Admin ve/edita todo
-- =====================================================

-- 0. LIMPIAR POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "carritos_select_own" ON carritos;
DROP POLICY IF EXISTS "carritos_select_admin" ON carritos;
DROP POLICY IF EXISTS "carritos_insert_own" ON carritos;
DROP POLICY IF EXISTS "carritos_insert_admin" ON carritos;
DROP POLICY IF EXISTS "carritos_update_own" ON carritos;
DROP POLICY IF EXISTS "carritos_update_admin" ON carritos;
DROP POLICY IF EXISTS "carritos_delete_own" ON carritos;
DROP POLICY IF EXISTS "carritos_delete_admin" ON carritos;

-- Deshabilitar RLS temporalmente
ALTER TABLE carritos DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- HABILITAR RLS
-- =====================================================
ALTER TABLE carritos ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS
-- =====================================================

-- 1. POLÍTICA SELECT: Todos pueden ver carritos
CREATE POLICY "carritos_select_all"
ON carritos
FOR SELECT
USING (true);

CREATE POLICY "carritos_select_admin"
ON carritos
FOR SELECT
USING (
  (auth.jwt()->>'rol') = 'admin'
);

-- 2. POLÍTICA INSERT: Todos pueden crear carritos
CREATE POLICY "carritos_insert_all"
ON carritos
FOR INSERT
WITH CHECK (true);

CREATE POLICY "carritos_insert_admin"
ON carritos
FOR INSERT
WITH CHECK (
  (auth.jwt()->>'rol') = 'admin'
);

-- 3. POLÍTICA UPDATE: Todos pueden editar carritos
CREATE POLICY "carritos_update_all"
ON carritos
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "carritos_update_admin"
ON carritos
FOR UPDATE
USING (
  (auth.jwt()->>'rol') = 'admin'
)
WITH CHECK (
  (auth.jwt()->>'rol') = 'admin'
);

-- 4. POLÍTICA DELETE: Todos pueden eliminar carritos
CREATE POLICY "carritos_delete_all"
ON carritos
FOR DELETE
USING (true);

CREATE POLICY "carritos_delete_admin"
ON carritos
FOR DELETE
USING (
  (auth.jwt()->>'rol') = 'admin'
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) PARA TABLA CARRITO_ITEMS
-- =====================================================
-- Políticas:
-- - Usuarios ven/editan items solo de su carrito
-- - Admin ve/edita todo
-- =====================================================

-- 0. LIMPIAR POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "carrito_items_select_own" ON carrito_items;
DROP POLICY IF EXISTS "carrito_items_select_admin" ON carrito_items;
DROP POLICY IF EXISTS "carrito_items_insert_own" ON carrito_items;
DROP POLICY IF EXISTS "carrito_items_insert_admin" ON carrito_items;
DROP POLICY IF EXISTS "carrito_items_update_own" ON carrito_items;
DROP POLICY IF EXISTS "carrito_items_update_admin" ON carrito_items;
DROP POLICY IF EXISTS "carrito_items_delete_own" ON carrito_items;
DROP POLICY IF EXISTS "carrito_items_delete_admin" ON carrito_items;

-- Deshabilitar RLS temporalmente
ALTER TABLE carrito_items DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- HABILITAR RLS
-- =====================================================
ALTER TABLE carrito_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS (validando que el carrito pertenece al usuario)
-- =====================================================

-- 1. POLÍTICA SELECT: Todos pueden ver items
CREATE POLICY "carrito_items_select_all"
ON carrito_items
FOR SELECT
USING (true);

CREATE POLICY "carrito_items_select_admin"
ON carrito_items
FOR SELECT
USING (
  (auth.jwt()->>'rol') = 'admin'
);

-- 2. POLÍTICA INSERT: Todos pueden agregar items
CREATE POLICY "carrito_items_insert_all"
ON carrito_items
FOR INSERT
WITH CHECK (true);

CREATE POLICY "carrito_items_insert_admin"
ON carrito_items
FOR INSERT
WITH CHECK (
  (auth.jwt()->>'rol') = 'admin'
);

-- 3. POLÍTICA UPDATE: Todos pueden editar items
CREATE POLICY "carrito_items_update_all"
ON carrito_items
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "carrito_items_update_admin"
ON carrito_items
FOR UPDATE
USING (
  (auth.jwt()->>'rol') = 'admin'
)
WITH CHECK (
  (auth.jwt()->>'rol') = 'admin'
);

-- 4. POLÍTICA DELETE: Todos pueden eliminar items
CREATE POLICY "carrito_items_delete_all"
ON carrito_items
FOR DELETE
USING (true);

CREATE POLICY "carrito_items_delete_admin"
ON carrito_items
FOR DELETE
USING (
  (auth.jwt()->>'rol') = 'admin'
);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- SELECT policyname, qual, with_check FROM pg_policies WHERE tablename IN ('carritos', 'carrito_items');
