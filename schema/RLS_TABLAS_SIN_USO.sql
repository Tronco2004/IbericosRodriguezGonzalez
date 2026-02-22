-- ============================================
-- RLS PARA TABLAS SIN USO ACTIVO
-- Solo accesibles por admin (service_role)
-- Tablas: cupones, direcciones, producto_detalles, resenas
-- ============================================

-- 1. CUPONES
ALTER TABLE cupones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupones FORCE ROW LEVEL SECURITY;

-- 2. DIRECCIONES
ALTER TABLE direcciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE direcciones FORCE ROW LEVEL SECURITY;

-- 3. PRODUCTO_DETALLES
ALTER TABLE producto_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_detalles FORCE ROW LEVEL SECURITY;

-- 4. RESENAS
ALTER TABLE resenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE resenas FORCE ROW LEVEL SECURITY;

-- Sin políticas = nadie accede excepto service_role (que bypasa RLS)
-- Si necesitas desactivar:
-- ALTER TABLE cupones DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE direcciones DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE producto_detalles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE resenas DISABLE ROW LEVEL SECURITY;
