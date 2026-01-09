-- Alterar la tabla usuarios para cambiar la columna activo a estado
-- Primero crear la nueva columna
ALTER TABLE usuarios ADD COLUMN estado VARCHAR(20) DEFAULT 'activo';

-- Copiar datos de la columna activo anterior a la nueva (si existe)
UPDATE usuarios SET estado = CASE WHEN activo = true THEN 'activo' ELSE 'inactivo' END;

-- Eliminar la columna activo anterior (opcional)
-- ALTER TABLE usuarios DROP COLUMN activo;

-- Agregar constraint a la columna estado
ALTER TABLE usuarios ADD CONSTRAINT check_estado CHECK (estado IN ('activo', 'inactivo'));
