-- RLS para CODIGOS_PROMOCIONALES
-- Lógica: Todos (registrados y no registrados) pueden ver códigos activos
-- Solo admins pueden crear, editar y eliminar

ALTER TABLE codigos_promocionales ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "Ver codigos activos" ON codigos_promocionales;
DROP POLICY IF EXISTS "Crear codigos (admin)" ON codigos_promocionales;
DROP POLICY IF EXISTS "Actualizar codigos (admin)" ON codigos_promocionales;
DROP POLICY IF EXISTS "Eliminar codigos (admin)" ON codigos_promocionales;
DROP POLICY IF EXISTS "Crear codigos" ON codigos_promocionales;
DROP POLICY IF EXISTS "Actualizar codigos" ON codigos_promocionales;
DROP POLICY IF EXISTS "Eliminar codigos" ON codigos_promocionales;

-- SELECT: Todos pueden ver códigos activos
CREATE POLICY "Ver codigos activos" ON codigos_promocionales
  FOR SELECT
  USING (activo = true);

-- INSERT: Abierto, validación en endpoint
CREATE POLICY "Crear codigos" ON codigos_promocionales
  FOR INSERT
  WITH CHECK (true);

-- UPDATE: Abierto, validación en endpoint
CREATE POLICY "Actualizar codigos" ON codigos_promocionales
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- DELETE: Abierto, validación en endpoint
CREATE POLICY "Eliminar codigos" ON codigos_promocionales
  FOR DELETE
  USING (true);

-- RLS para USO_CODIGOS
-- Lógica: Usuarios ven solo su propio uso de códigos, admins ven todo

ALTER TABLE uso_codigos ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "Ver propio uso de codigos" ON uso_codigos;
DROP POLICY IF EXISTS "Registrar uso de codigo" ON uso_codigos;
DROP POLICY IF EXISTS "Actualizar uso (admin)" ON uso_codigos;
DROP POLICY IF EXISTS "Eliminar uso (admin)" ON uso_codigos;

-- SELECT: Usuarios ven su propio uso, admins ven todo
CREATE POLICY "Ver propio uso de codigos" ON uso_codigos
  FOR SELECT
  USING (
    usuario_id = auth.uid()
    OR (auth.jwt()->>'rol') = 'admin'
    OR usuario_id IS NULL
  );

-- INSERT: Todos pueden registrar uso de código
CREATE POLICY "Registrar uso de codigo" ON uso_codigos
  FOR INSERT
  WITH CHECK (true);

-- UPDATE: Solo admins
CREATE POLICY "Actualizar uso (admin)" ON uso_codigos
  FOR UPDATE
  USING ((auth.jwt()->>'rol') = 'admin')
  WITH CHECK ((auth.jwt()->>'rol') = 'admin');

-- DELETE: Solo admins
CREATE POLICY "Eliminar uso (admin)" ON uso_codigos
  FOR DELETE
  USING ((auth.jwt()->>'rol') = 'admin');
