-- =============================================
-- FIX VARIANTES - CONVERTIR PRECIO A CENTIMOS
-- =============================================
-- Este script arregla variantes con precio en euros
-- Ejecuta esto en Supabase SQL Editor
-- Fecha: 2026-01-22
-- =============================================

-- Primero, mostrar cuáles variantes tienen precio que parece estar en euros (< 100)
SELECT 
  pv.id,
  pv.producto_id,
  pv.peso_kg,
  pv.precio_total,
  p.precio_por_kg,
  (pv.peso_kg * p.precio_por_kg) as precio_esperado_euros,
  ROUND((pv.peso_kg * p.precio_por_kg) * 100) as precio_esperado_centimos
FROM producto_variantes pv
JOIN productos p ON pv.producto_id = p.id
WHERE pv.precio_total < 100
ORDER BY pv.producto_id, pv.peso_kg;

-- =============================================
-- ACTUALIZAR: Multiplicar por 100 las variantes con precio < 100
-- =============================================
UPDATE producto_variantes 
SET precio_total = ROUND(precio_total * 100)
WHERE precio_total < 100
AND precio_total > 0;

-- =============================================
-- VERIFICAR: Mostrar variantes después de la conversión
-- =============================================
SELECT 
  pv.id,
  pv.producto_id,
  pv.peso_kg,
  pv.precio_total,
  ROUND(pv.precio_total / 100.0, 2) as precio_en_euros,
  p.precio_por_kg,
  (pv.peso_kg * p.precio_por_kg) as precio_calculado_euros
FROM producto_variantes pv
JOIN productos p ON pv.producto_id = p.id
ORDER BY pv.producto_id, pv.peso_kg;

-- =============================================
-- NOTA
-- =============================================
-- Todas las variantes ahora tienen precio_total en centimos
-- Cuando se muestran en carrito: precio_total / 100 = euros
-- Ejemplo: precio_total = 68848 → 68848 / 100 = 688.48€
