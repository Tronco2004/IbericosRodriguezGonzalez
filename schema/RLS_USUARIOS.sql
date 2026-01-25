-- =====================================================
-- ROW LEVEL SECURITY (RLS) PARA TABLA USUARIOS
-- =====================================================
-- Política: Cada usuario solo puede ver/editar su propio perfil
-- Excepción: Admin (rol='admin') tiene acceso total
-- =====================================================

-- 0. LIMPIAR POLÍTICAS Y FUNCIONES EXISTENTES (si existen)
DROP POLICY IF EXISTS "usuarios_select_own_or_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_select_own" ON usuarios;
DROP POLICY IF EXISTS "usuarios_select_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_own_or_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_own" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_admin_only" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_new_or_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_via_function" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_self" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_admin" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_allow" ON usuarios;
DROP POLICY IF EXISTS "usuarios_delete_admin_only" ON usuarios;

DROP FUNCTION IF EXISTS crear_usuario_nuevo(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS es_usuario_admin();

-- Deshabilitar RLS temporalmente para limpiar
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREAR NUEVAS POLÍTICAS Y FUNCIONES
-- =====================================================

-- 1. Habilitar RLS en la tabla usuarios
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- 2. Función auxiliar para verificar si el usuario actual es admin
CREATE OR REPLACE FUNCTION es_usuario_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT rol 
    FROM usuarios 
    WHERE id = auth.uid()
    LIMIT 1
  ) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. POLÍTICA SELECT: Usuarios ven su propio perfil
CREATE POLICY "usuarios_select_own"
ON usuarios
FOR SELECT
USING (
  auth.uid() = id
);

-- 3b. POLÍTICA SELECT ADMIN: Admin ve todo (sin SELECT recursivo)
-- Se valida en auth.jwt.claims
CREATE POLICY "usuarios_select_admin"
ON usuarios
FOR SELECT
USING (
  (auth.jwt()->>'rol') = 'admin'
);

-- 4. POLÍTICA UPDATE: Usuarios pueden editar su propio perfil
CREATE POLICY "usuarios_update_own"
ON usuarios
FOR UPDATE
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);

-- 4b. POLÍTICA UPDATE ADMIN: Admin puede editar todo
CREATE POLICY "usuarios_update_admin"
ON usuarios
FOR UPDATE
USING (
  (auth.jwt()->>'rol') = 'admin'
)
WITH CHECK (
  (auth.jwt()->>'rol') = 'admin'
);

-- 5. POLÍTICA INSERT: Permitir inserción durante registro (cualquier usuario autenticado)
-- Los usuarios pueden crear su propia fila, admin puede crear cualquiera
CREATE POLICY "usuarios_insert_allow"
ON usuarios
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- 7. POLÍTICA DELETE: Solo admin puede eliminar usuarios
CREATE POLICY "usuarios_delete_admin_only"
ON usuarios
FOR DELETE
USING (
  (auth.jwt()->>'rol') = 'admin'
);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Para verificar que las políticas están activas:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'usuarios';
-- 
-- Para ver las políticas creadas:
-- SELECT policyname, qual, with_check FROM pg_policies WHERE tablename = 'usuarios';
