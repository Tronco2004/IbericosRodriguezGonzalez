-- =====================================================
-- FIX RLS PARA PERMITIR PEDIDOS DE INVITADOS
-- =====================================================
-- Este script permite que el servidor cree pedidos
-- incluso cuando el usuario no está autenticado (invitados)
-- =====================================================

-- 1. ELIMINAR POLÍTICA EXISTENTE DE INSERT
DROP POLICY IF EXISTS "pedidos_insert_allow_all" ON pedidos;

-- 2. CREAR POLÍTICA INSERT MÁS PERMISIVA
-- Permite insertar pedidos:
-- - A usuarios autenticados (para sus propios pedidos)
-- - A cualquier conexión (para pedidos de invitados desde el servidor)
CREATE POLICY "pedidos_insert_allow_all"
ON pedidos
FOR INSERT
WITH CHECK (true);

-- 3. TAMBIÉN NECESITAMOS PERMITIR INSERT EN pedido_items
DROP POLICY IF EXISTS "pedido_items_insert_allow" ON pedido_items;
DROP POLICY IF EXISTS "pedido_items_insert_allow_all" ON pedido_items;

CREATE POLICY "pedido_items_insert_allow_all"
ON pedido_items
FOR INSERT
WITH CHECK (true);

-- 4. VERIFICAR POLÍTICAS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('pedidos', 'pedido_items');

-- 5. VERIFICAR QUE RLS ESTÉ HABILITADO
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('pedidos', 'pedido_items');
