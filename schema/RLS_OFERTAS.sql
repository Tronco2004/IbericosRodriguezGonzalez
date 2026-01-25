-- =====================================================
-- ROW LEVEL SECURITY (RLS) PARA TABLA OFERTAS
-- =====================================================
-- Políticas:
-- - Todos pueden leer ofertas (SELECT: true)
-- - Solo admin puede crear, editar y eliminar
-- =====================================================

-- 0. LIMPIAR POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "ofertas_select_all" ON ofertas;
DROP POLICY IF EXISTS "ofertas_insert_admin" ON ofertas;
DROP POLICY IF EXISTS "ofertas_update_admin" ON ofertas;
DROP POLICY IF EXISTS "ofertas_delete_admin" ON ofertas;

-- Deshabilitar RLS temporalmente
ALTER TABLE ofertas DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- HABILITAR RLS
-- =====================================================
ALTER TABLE ofertas ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS
-- =====================================================

-- 1. POLÍTICA SELECT: Todos pueden ver ofertas (público)
CREATE POLICY "ofertas_select_all"
ON ofertas
FOR SELECT
USING (true);

-- 2. POLÍTICA INSERT: Solo admin puede crear ofertas
CREATE POLICY "ofertas_insert_admin"
ON ofertas
FOR INSERT
WITH CHECK (
  (auth.jwt()->>'rol') = 'admin'
);

-- 3. POLÍTICA UPDATE: Solo admin puede editar ofertas
CREATE POLICY "ofertas_update_admin"
ON ofertas
FOR UPDATE
USING (
  (auth.jwt()->>'rol') = 'admin'
)
WITH CHECK (
  (auth.jwt()->>'rol') = 'admin'
);

-- 4. POLÍTICA DELETE: Solo admin puede eliminar ofertas
CREATE POLICY "ofertas_delete_admin"
ON ofertas
FOR DELETE
USING (
  (auth.jwt()->>'rol') = 'admin'
);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- SELECT policyname, qual, with_check FROM pg_policies WHERE tablename = 'ofertas';
