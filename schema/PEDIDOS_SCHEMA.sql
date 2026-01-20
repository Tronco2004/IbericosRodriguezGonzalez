-- Primero elimina las tablas si existen (opcional, solo para limpiar)
DROP TABLE IF EXISTS pedido_items CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;

-- Tabla de Pedidos
CREATE TABLE pedidos (
  id SERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  stripe_session_id VARCHAR(255),
  numero_pedido VARCHAR(50) UNIQUE NOT NULL,
  estado VARCHAR(50) DEFAULT 'pendiente',
  subtotal NUMERIC(10, 2) NOT NULL,
  envio NUMERIC(10, 2) DEFAULT 0,
  impuestos NUMERIC(10, 2) DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL,
  direccion_envio TEXT,
  email_cliente VARCHAR(100),
  telefono_cliente VARCHAR(20),
  notas_pedido TEXT,
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_pago TIMESTAMP,
  fecha_envio TIMESTAMP,
  fecha_entrega TIMESTAMP
);

-- Tabla de Items del Pedido
CREATE TABLE pedido_items (
  id SERIAL PRIMARY KEY,
  pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  producto_variante_id INT REFERENCES producto_variantes(id),
  nombre_producto VARCHAR(255) NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  peso_kg NUMERIC(10, 3),
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX idx_pedidos_stripe ON pedidos(stripe_session_id);
CREATE INDEX idx_pedido_items_pedido ON pedido_items(pedido_id);
