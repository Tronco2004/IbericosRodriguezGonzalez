-- =====================================================
-- ROW LEVEL SECURITY (RLS) PARA TABLA PRODUCTO_VARIANTES
-- =====================================================
-- Políticas:
-- PÚBLICO (anon):
--   - SELECT: todos pueden ver variantes disponibles (catálogo público)
-- ADMIN:
--   - SELECT/INSERT/UPDATE/DELETE: acceso total
-- NOTA: La app usa custom auth (no Supabase Auth), por lo que
--   auth.uid() es siempre NULL en las peticiones.
--   Las operaciones server-side de escritura usan supabaseAdmin
--   (service role) que bypasea RLS completamente.
--   La política SELECT pública permite que el catálogo funcione
--   con la anon key sin problemas.
-- =====================================================

-- 0. LIMPIAR POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "producto_variantes_select" ON producto_variantes;
DROP POLICY IF EXISTS "producto_variantes_select_public" ON producto_variantes;
DROP POLICY IF EXISTS "producto_variantes_insert" ON producto_variantes;
DROP POLICY IF EXISTS "producto_variantes_update" ON producto_variantes;
DROP POLICY IF EXISTS "producto_variantes_delete" ON producto_variantes;

-- Deshabilitar RLS temporalmente para limpiar
ALTER TABLE producto_variantes DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- HABILITAR RLS
-- =====================================================
ALTER TABLE producto_variantes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS
-- =====================================================

-- 1. SELECT: público (cualquiera puede ver variantes para el catálogo)
CREATE POLICY "producto_variantes_select_public"
ON producto_variantes FOR SELECT
USING (true);

-- 2. INSERT: solo admin (crear variantes desde panel admin o restaurar stock en devoluciones)
CREATE POLICY "producto_variantes_insert"
ON producto_variantes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
);

-- 3. UPDATE: solo admin (modificar stock, precio, disponibilidad)
CREATE POLICY "producto_variantes_update"
ON producto_variantes FOR UPDATE
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

-- 4. DELETE: solo admin (eliminar variantes desde panel admin o al vender)
CREATE POLICY "producto_variantes_delete"
ON producto_variantes FOR DELETE
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
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'producto_variantes';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'producto_variantes';
