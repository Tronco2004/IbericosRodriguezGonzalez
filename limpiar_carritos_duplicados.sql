-- Limpiar carritos duplicados - mantener solo el más reciente por usuario
WITH carritosMasRecientes AS (
  SELECT DISTINCT ON (usuario_id) id
  FROM carritos
  ORDER BY usuario_id, fecha_creacion DESC
)
DELETE FROM carritos
WHERE id NOT IN (SELECT id FROM carritosMasRecientes);

-- Verificar resultado
SELECT usuario_id, COUNT(*) as total_carritos
FROM carritos
GROUP BY usuario_id
ORDER BY total_carritos DESC;
