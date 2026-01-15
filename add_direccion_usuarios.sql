-- Añadir campo dirección a la tabla usuarios si no existe
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS direccion VARCHAR(255) DEFAULT NULL;

-- Actualizar la descripción de la tabla usuarios
COMMENT ON COLUMN usuarios.direccion IS 'Dirección principal del usuario';
