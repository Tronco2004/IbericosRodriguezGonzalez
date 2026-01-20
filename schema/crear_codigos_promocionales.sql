-- Tabla de Códigos Promocionales
CREATE TABLE IF NOT EXISTS codigos_promocionales (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  descripcion TEXT,
  tipo_descuento VARCHAR(20) NOT NULL CHECK (tipo_descuento IN ('porcentaje', 'fijo')),
  valor_descuento DECIMAL(10, 2) NOT NULL,
  uso_maximo INT,
  usos_actuales INT DEFAULT 0,
  fecha_inicio TIMESTAMP NOT NULL,
  fecha_fin TIMESTAMP NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  restriccion_monto_minimo DECIMAL(10, 2),
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT codigo_unico UNIQUE (codigo)
);

-- Tabla de Uso de Códigos Promocionales
CREATE TABLE IF NOT EXISTS uso_codigos (
  id SERIAL PRIMARY KEY,
  codigo_id INT NOT NULL REFERENCES codigos_promocionales(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  pedido_id INT REFERENCES pedidos(id) ON DELETE SET NULL,
  descuento_aplicado DECIMAL(10, 2) NOT NULL,
  fecha_uso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  email_usuario VARCHAR(100)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_codigo_activo ON codigos_promocionales(codigo, activo);
CREATE INDEX IF NOT EXISTS idx_uso_codigo ON uso_codigos(codigo_id);
CREATE INDEX IF NOT EXISTS idx_uso_usuario ON uso_codigos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_uso_pedido ON uso_codigos(pedido_id);
