-- ============================================
-- SETUP DE CLIENTES EMPRESARIALES
-- ============================================
-- Este archivo crea la tabla de clientes empresariales
-- para bares, restaurantes, tiendas y otros clientes B2B
-- ============================================

-- Crear tabla de Clientes Empresariales
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

-- Crear índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_clientes_numero_id ON clientes_empresariales(numero_identificacion);
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes_empresariales(email_contacto);
CREATE INDEX IF NOT EXISTS idx_clientes_tipo ON clientes_empresariales(tipo_cliente);
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes_empresariales(estado);

-- Crear vista para clientes activos
DROP VIEW IF EXISTS v_clientes_activos;
CREATE VIEW v_clientes_activos AS
SELECT 
  id,
  nombre_empresa,
  numero_identificacion,
  tipo_identificacion,
  direccion_fiscal,
  nombre_representante,
  email_contacto,
  telefono_contacto,
  tipo_cliente,
  fecha_registro
FROM clientes_empresariales
WHERE estado = TRUE;

-- Insertar clientes de ejemplo (opcional, comentar si no se desean)
-- INSERT INTO clientes_empresariales (
--   nombre_empresa,
--   numero_identificacion,
--   tipo_identificacion,
--   direccion_fiscal,
--   nombre_representante,
--   email_contacto,
--   telefono_contacto,
--   tipo_cliente,
--   estado,
--   notas
-- ) VALUES
-- ('Bar La Esquina', '12345678A', 'NIF', 'Calle Principal 123, Madrid, 28001', 'Juan García López', 'juan@laesquina.com', '+34 600 123 456', 'Bar', TRUE, 'Cliente frecuente desde 2024'),
-- ('Restaurante El Gusto', '87654321B', 'NIF', 'Avenida Central 456, Barcelona, 08002', 'María Rodríguez García', 'maria@elgusto.com', '+34 600 234 567', 'Restaurante', TRUE, 'Cuenta corporativa'),
-- ('Tienda Gourmet Premium', '45678912C', 'NIF', 'Paseo de la Reforma 789, Mexico City, 06500', 'Carlos Martínez López', 'carlos@gourmetpremium.com', '+52 55 1234 5678', 'Tienda', TRUE, 'Cliente mayorista');

-- ============================================
-- SCRIPT PARA LIMPIAR (OPCIONAL)
-- ============================================
-- Descomenta solo si necesitas eliminar todo y empezar de cero

-- DROP VIEW IF EXISTS v_clientes_activos;
-- DROP TABLE IF EXISTS clientes_empresariales CASCADE;
