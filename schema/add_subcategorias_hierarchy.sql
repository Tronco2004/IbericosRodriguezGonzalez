-- ============================================
-- AGREGAR SOPORTE PARA SUBCATEGORÍAS JERÁRQUICO
-- ============================================

-- Agregar columnas a tabla categorias
ALTER TABLE categorias 
ADD COLUMN IF NOT EXISTS categoria_padre INT REFERENCES categorias(id) ON DELETE CASCADE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS orden INT DEFAULT 0;

-- Crear índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_categoria_padre ON categorias(categoria_padre);
CREATE INDEX IF NOT EXISTS idx_categoria_activa_padre ON categorias(activa, categoria_padre);
CREATE INDEX IF NOT EXISTS idx_categoria_orden ON categorias(orden);

-- ============================================
-- INSERTAR SUBCATEGORÍAS (Datos iniciales)
-- ============================================

-- Nota: Ejecutar esto DESPUÉS de tener las categorías principales
-- Las IDs pueden variar según tu BD actual

-- Insertar categoría padre para Lácteos (si no existe)
INSERT INTO categorias (nombre, slug, descripcion, activa, categoria_padre, orden)
VALUES ('Lácteos', 'lacteos', 'Productos lácteos ibéricos premium', true, NULL, 4)
ON CONFLICT (slug) DO NOTHING;

-- Insertar categoría padre para Promociones
INSERT INTO categorias (nombre, slug, descripcion, activa, categoria_padre, orden)
VALUES ('Promociones', 'promociones', 'Packs y promociones especiales', true, NULL, 5)
ON CONFLICT (slug) DO NOTHING;

-- Obtener IDs de categorías padre (ajusta según tus IDs reales)
-- Luego ejecuta esto para insertar subcategorías:

-- SUBCATEGORÍAS bajo LÁCTEOS
INSERT INTO categorias (nombre, slug, descripcion, activa, categoria_padre, orden)
SELECT 'Mantecas', 'mantecas', 'Mantecas de cerdo ibérico', true, categorias.id, 1
FROM categorias WHERE slug = 'lacteos' AND categoria_padre IS NULL
ON CONFLICT (slug) DO NOTHING;

-- SUBCATEGORÍAS bajo EMBUTIDOS
INSERT INTO categorias (nombre, slug, descripcion, activa, categoria_padre, orden)
SELECT 'Taquitos', 'taquitos', 'Taquitos y embutidos premium', true, categorias.id, 2
FROM categorias WHERE slug = 'embutidos' AND categoria_padre IS NULL
ON CONFLICT (slug) DO NOTHING;

-- SUBCATEGORÍAS bajo PROMOCIONES
INSERT INTO categorias (nombre, slug, descripcion, activa, categoria_padre, orden)
SELECT 'Paquetes 100g', 'paquetes-100g', 'Packs promocionales de 100g', true, categorias.id, 1
FROM categorias WHERE slug = 'promociones' AND categoria_padre IS NULL
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- VERIFICAR ESTRUCTURA
-- ============================================

-- Ver todas las categorías con su jerarquía
SELECT 
  c.id,
  c.nombre,
  c.slug,
  c.categoria_padre,
  cp.nombre as categoria_padre_nombre,
  c.orden
FROM categorias c
LEFT JOIN categorias cp ON c.categoria_padre = cp.id
ORDER BY c.categoria_padre NULLS FIRST, c.orden ASC;
