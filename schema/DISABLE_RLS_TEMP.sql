-- =====================================================
-- DESHABILITAR RLS TEMPORALMENTE (para diagnóstico)
-- =====================================================

ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- Intenta registrarte ahora
-- Si funciona: el problema es el RLS
-- Si no funciona: el problema es el código
