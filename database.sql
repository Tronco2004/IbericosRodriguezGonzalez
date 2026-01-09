-- ============================================
-- CREAR TABLAS PRINCIPALES (CON VALIDACIÓN)
-- ============================================

-- Tabla de Usuarios (vinculada a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  telefono VARCHAR(20),
  rol VARCHAR(20) DEFAULT 'cliente' CHECK (rol IN ('admin', 'cliente', 'moderador')),
  activo BOOLEAN DEFAULT TRUE,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Sesiones
CREATE TABLE IF NOT EXISTS sesiones (
  id SERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_expiracion TIMESTAMP NOT NULL,
  activa BOOLEAN DEFAULT TRUE
);

-- Tabla de Categorías
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  slug VARCHAR(100) UNIQUE NOT NULL,
  imagen_url VARCHAR(500),
  activa BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Clientes Empresariales (Bares, Casas, Particulares, etc.)
CREATE TABLE IF NOT EXISTS clientes_empresariales (
  id SERIAL PRIMARY KEY,
  nombre_empresa VARCHAR(200) NOT NULL,
  numero_identificacion VARCHAR(50) NOT NULL UNIQUE,
  tipo_identificacion VARCHAR(10) NOT NULL CHECK (tipo_identificacion IN ('NIF', 'RUT', 'RFC', 'CUIT', 'OTRO')),
  direccion_fiscal VARCHAR(300) NOT NULL,
  nombre_representante VARCHAR(150) NOT NULL,
  email_contacto VARCHAR(100) NOT NULL,
  telefono_contacto VARCHAR(20),
  tipo_cliente VARCHAR(50) NOT NULL CHECK (tipo_cliente IN ('Bar', 'Restaurante', 'Tienda', 'Particular', 'Mayorista', 'Otro')),
  estado BOOLEAN DEFAULT TRUE,
  notas TEXT,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Productos
CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  precio_centimos INT NOT NULL,
  categoria_id INT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  imagen_url VARCHAR(500),
  rating DECIMAL(3, 1) DEFAULT 0,
  stock INT DEFAULT 0,
  sku VARCHAR(100) UNIQUE,
  activo BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Detalles del Producto
CREATE TABLE IF NOT EXISTS producto_detalles (
  id SERIAL PRIMARY KEY,
  producto_id INT NOT NULL UNIQUE REFERENCES productos(id) ON DELETE CASCADE,
  origen VARCHAR(100),
  tiempo_curacion VARCHAR(100),
  peso_gramos INT,
  caracteristicas_nutricionales TEXT,
  ingredientes TEXT,
  forma_consumo TEXT
);

-- Tabla de Direcciones
CREATE TABLE IF NOT EXISTS direcciones (
  id SERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_completo VARCHAR(150) NOT NULL,
  direccion VARCHAR(255) NOT NULL,
  ciudad VARCHAR(100) NOT NULL,
  provincia VARCHAR(100) NOT NULL,
  codigo_postal VARCHAR(10) NOT NULL,
  pais VARCHAR(100) DEFAULT 'España',
  telefono VARCHAR(20),
  es_principal BOOLEAN DEFAULT FALSE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Carritos
CREATE TABLE IF NOT EXISTS carritos (
  id SERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Items del Carrito
CREATE TABLE IF NOT EXISTS carrito_items (
  id SERIAL PRIMARY KEY,
  carrito_id INT NOT NULL REFERENCES carritos(id) ON DELETE CASCADE,
  producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad INT NOT NULL,
  precio_unitario INT NOT NULL,
  fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  numero_pedido VARCHAR(50) UNIQUE NOT NULL,
  total_centimos INT NOT NULL,
  estado VARCHAR(20) DEFAULT 'pendiente',
  metodo_pago VARCHAR(20) NOT NULL,
  direccion_envio_id INT REFERENCES direcciones(id),
  notas TEXT,
  fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_envio TIMESTAMP,
  fecha_entrega TIMESTAMP
);

-- Tabla de Items del Pedido
CREATE TABLE IF NOT EXISTS pedido_items (
  id SERIAL PRIMARY KEY,
  pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id INT NOT NULL REFERENCES productos(id),
  cantidad INT NOT NULL,
  precio_unitario INT NOT NULL
);

-- Tabla de Reseñas
CREATE TABLE IF NOT EXISTS resenas (
  id SERIAL PRIMARY KEY,
  producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  titulo VARCHAR(200),
  contenido TEXT,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Cupones
CREATE TABLE IF NOT EXISTS cupones (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  descripcion TEXT,
  descuento_porcentaje DECIMAL(5, 2),
  descuento_fijo INT,
  valido_desde TIMESTAMP,
  valido_hasta TIMESTAMP,
  uso_maximo INT,
  usos_actuales INT DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ALTERAR TABLAS EXISTENTES (AGREGAR COLUMNAS FALTANTES)
-- ============================================

-- Agregar columna rol a usuarios si no existe (migración desde rol_id)
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT 'cliente' CHECK (rol IN ('admin', 'cliente', 'moderador'));

-- ============================================
-- INSERTAR DATOS INICIALES (SIN DUPLICADOS)
-- ============================================

-- Los usuarios se crean a través de auth.users en Supabase
-- Para agregar manualmente un usuario admin, primero créalo en auth.users
-- y luego inserta aquí con su UUID:
-- INSERT INTO usuarios (id, nombre, email, rol, activo) VALUES
-- ('uuid-del-usuario', 'Nombre', 'email@ejemplo.com', 'admin', TRUE);

-- Insertar Categorías (si no existen)
INSERT INTO categorias (nombre, slug, descripcion, imagen_url) VALUES
('Jamones', 'jamones', 'Jamones ibéricos de bellota curados tradicionalmente', 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=500'),
('Quesos', 'quesos', 'Quesos artesanales de la región ibérica', 'https://images.unsplash.com/photo-1452195463300-e83e0a2a7a25?w=500'),
('Embutidos', 'embutidos', 'Chorizos, morcillas y embutidos de bellota', 'https://images.unsplash.com/photo-1557803104268-0ef0f060e15f?w=500')
ON CONFLICT (nombre) DO NOTHING;

-- Insertar Productos (si no existen)
INSERT INTO productos (nombre, descripcion, precio_centimos, categoria_id, imagen_url, rating, stock, sku) VALUES
('Jamón Ibérico Reserva', 'Jamón ibérico de bellota curado 48 meses', 9999, 1, 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=500', 4.9, 15, 'JIR-001'),
('Queso Manchego Premium', 'Queso artesanal de oveja manchega', 2200, 2, 'https://images.unsplash.com/photo-1452195463300-e83e0a2a7a25?w=500', 4.8, 30, 'QMP-001'),
('Chorizo de Bellota', 'Chorizo ibérico con pimentón de la Vera', 1800, 3, 'https://images.unsplash.com/photo-1557803104268-0ef0f060e15f?w=500', 4.7, 25, 'CHB-001')
ON CONFLICT (sku) DO NOTHING;

-- Insertar Detalles de Productos (si no existen)
INSERT INTO producto_detalles (producto_id, origen, tiempo_curacion, peso_gramos, ingredientes) VALUES
(1, 'Jabugo, Huelva', '48 meses', 500, 'Jamón ibérico de bellota, sal'),
(2, 'La Mancha', '12 meses', 250, 'Leche de oveja, cultivos, sal'),
(3, 'Extremadura', '3 meses', 400, 'Carne de cerdo ibérico, pimentón')
ON CONFLICT (producto_id) DO NOTHING;

-- ============================================
-- CREAR ÍNDICES (CON VALIDACIÓN)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_clientes_numero_id ON clientes_empresariales(numero_identificacion);
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes_empresariales(email_contacto);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_sku ON productos(sku);
CREATE INDEX IF NOT EXISTS idx_carritos_usuario ON carritos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_carrito_items_carrito ON carrito_items(carrito_id);
CREATE INDEX IF NOT EXISTS idx_carrito_items_producto ON carrito_items(producto_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_numero ON pedidos(numero_pedido);
CREATE INDEX IF NOT EXISTS idx_resenas_producto ON resenas(producto_id);
CREATE INDEX IF NOT EXISTS idx_resenas_usuario ON resenas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_direcciones_usuario ON direcciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cupones_codigo ON cupones(codigo);

-- ============================================
-- CREAR VISTAS (CON VALIDACIÓN)
-- ============================================

-- Vista: Usuarios con sus roles
DROP VIEW IF EXISTS v_usuarios_con_roles;
CREATE VIEW v_usuarios_con_roles AS
SELECT 
  id,
  nombre,
  email,
  telefono,
  rol,
  activo,
  fecha_registro
FROM usuarios;

-- Vista: Productos con categorías
DROP VIEW IF EXISTS v_productos_completo;
CREATE VIEW v_productos_completo AS
SELECT 
  p.id,
  p.nombre,
  p.descripcion,
  p.precio_centimos,
  c.nombre AS categoria,
  c.slug,
  p.imagen_url,
  p.rating,
  p.stock,
  p.sku,
  p.activo
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id;

-- Vista: Pedidos con detalles de usuario
DROP VIEW IF EXISTS v_pedidos_detallado;
CREATE VIEW v_pedidos_detallado AS
SELECT 
  p.id,
  p.numero_pedido,
  u.nombre AS cliente,
  u.email,
  p.total_centimos,
  p.estado,
  p.metodo_pago,
  p.fecha_pedido,
  COUNT(pi.id) AS cantidad_items
FROM pedidos p
LEFT JOIN usuarios u ON p.usuario_id = u.id
LEFT JOIN pedido_items pi ON p.id = pi.pedido_id
GROUP BY p.id, p.numero_pedido, u.nombre, u.email, p.total_centimos, p.estado, p.metodo_pago, p.fecha_pedido;

-- ============================================
-- SCRIPT PARA LIMPIAR BD (OPCIONAL)
-- ============================================

-- DESCOMENTA ESTO SOLO SI QUIERES BORRAR TODO Y EMPEZAR DE CERO

DROP VIEW IF EXISTS v_pedidos_detallado;
DROP VIEW IF EXISTS v_productos_completo;
DROP VIEW IF EXISTS v_usuarios_con_roles;

DROP TABLE IF EXISTS cupones CASCADE;
DROP TABLE IF EXISTS resenas CASCADE;
DROP TABLE IF EXISTS pedido_items CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS carrito_items CASCADE;
DROP TABLE IF EXISTS carritos CASCADE;
DROP TABLE IF EXISTS direcciones CASCADE;
DROP TABLE IF EXISTS producto_detalles CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS clientes_empresariales CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS sesiones CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

