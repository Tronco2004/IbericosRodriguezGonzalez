-- ============================================
-- RLS PARA TABLA: productos
-- ============================================
-- Políticas:
--   SELECT: Público (cualquiera puede ver productos activos, catálogo)
--   INSERT: Solo admin (service_role)
--   UPDATE: Solo admin (service_role) - incluye actualización de stock
--   DELETE: Solo admin (service_role)
--
-- NOTA: Las operaciones de stock (carrito, pedidos, cancelaciones)
--       se realizan desde el backend con supabaseAdmin (service_role),
--       que bypasea RLS automáticamente.
-- ============================================

-- 1. Habilitar RLS en la tabla productos
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "productos_select_public" ON productos;
DROP POLICY IF EXISTS "productos_insert_admin" ON productos;
DROP POLICY IF EXISTS "productos_update_admin" ON productos;
DROP POLICY IF EXISTS "productos_delete_admin" ON productos;

-- 3. SELECT: Público - Cualquiera puede ver los productos (catálogo)
CREATE POLICY "productos_select_public"
  ON productos
  FOR SELECT
  USING (true);

-- 4. INSERT: Solo admin (a través de service_role que bypasea RLS)
-- Esta política existe como fallback pero en la práctica
-- el service_role bypasea RLS
CREATE POLICY "productos_insert_admin"
  ON productos
  FOR INSERT
  WITH CHECK (false);

-- 5. UPDATE: Solo admin (a través de service_role que bypasea RLS)
-- Incluye actualizaciones de stock desde el carrito/pedidos
CREATE POLICY "productos_update_admin"
  ON productos
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- 6. DELETE: Solo admin (a través de service_role que bypasea RLS)
CREATE POLICY "productos_delete_admin"
  ON productos
  FOR DELETE
  USING (false);
