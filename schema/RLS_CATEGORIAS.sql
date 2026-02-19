-- =====================================================
-- ROW LEVEL SECURITY (RLS) PARA TABLA CATEGORIAS
-- =====================================================
-- Políticas:
-- - Todos pueden leer categorías (SELECT: true)
-- - Solo admin puede crear, editar y eliminar
-- Nota: Las operaciones de admin se hacen con supabaseAdmin
--       (service_role) que bypasea RLS automáticamente.
--       RLS protege contra acceso directo desde el cliente.
-- =====================================================

-- 0. LIMPIAR POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "categorias_select_all" ON categorias;
DROP POLICY IF EXISTS "categorias_insert_admin" ON categorias;
DROP POLICY IF EXISTS "categorias_update_admin" ON categorias;
DROP POLICY IF EXISTS "categorias_delete_admin" ON categorias;

-- Deshabilitar RLS temporalmente para limpiar
ALTER TABLE categorias DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- HABILITAR RLS
-- =====================================================
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS
-- =====================================================

-- 1. POLÍTICA SELECT: Todos pueden ver categorías (público)
CREATE POLICY "categorias_select_all"
ON categorias
FOR SELECT
USING (true);

-- 2. POLÍTICA INSERT: Solo admin puede crear categorías
CREATE POLICY "categorias_insert_admin"
ON categorias
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
);

-- 3. POLÍTICA UPDATE: Solo admin puede editar categorías
CREATE POLICY "categorias_update_admin"
ON categorias
FOR UPDATE
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

-- 4. POLÍTICA DELETE: Solo admin puede eliminar categorías
CREATE POLICY "categorias_delete_admin"
ON categorias
FOR DELETE
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
-- Verificar que RLS está activo:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'categorias';
--
-- Verificar políticas:
-- SELECT * FROM pg_policies WHERE tablename = 'categorias';
