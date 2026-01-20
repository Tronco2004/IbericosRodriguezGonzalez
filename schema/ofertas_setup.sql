-- ============================================
-- TABLA DE OFERTAS
-- ============================================

CREATE TABLE IF NOT EXISTS ofertas (
  id SERIAL PRIMARY KEY,
  producto_id INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre_oferta VARCHAR(200) NOT NULL,
  descripcion TEXT,
  precio_original_centimos INT NOT NULL,
  precio_descuento_centimos INT NOT NULL,
  porcentaje_descuento INT GENERATED ALWAYS AS (
    ROUND(((precio_original_centimos - precio_descuento_centimos) * 100.0 / precio_original_centimos))
  ) STORED,
  fecha_inicio TIMESTAMP NOT NULL,
  fecha_fin TIMESTAMP NOT NULL,
  activa BOOLEAN DEFAULT TRUE,
  imagen_url VARCHAR(500),
  orden INT DEFAULT 0,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fecha_valida CHECK (fecha_fin > fecha_inicio),
  CONSTRAINT precios_validos CHECK (precio_descuento_centimos < precio_original_centimos AND precio_descuento_centimos > 0)
);

-- Índices para optimizar búsquedas
CREATE INDEX idx_ofertas_activa_fechas ON ofertas(activa, fecha_inicio, fecha_fin);
CREATE INDEX idx_ofertas_producto ON ofertas(producto_id);
CREATE INDEX idx_ofertas_orden ON ofertas(orden);
