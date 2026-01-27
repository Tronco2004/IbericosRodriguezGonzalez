import { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

/**
 * GET: Obtener todas las variantes disponibles de un producto
 * Usado para actualizar el catálogo en tiempo real
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const productoId = url.searchParams.get('producto_id');

    if (!productoId) {
      return new Response(
        JSON.stringify({ error: 'producto_id es requerido', success: false }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('📦 GET /api/variantes/obtener-disponibles - Producto:', productoId);

    // Obtener todas las variantes del producto
    const { data: variantes, error } = await supabaseClient
      .from('producto_variantes')
      .select('id, producto_id, peso_kg, precio_total, cantidad_disponible, disponible, fecha_creacion')
      .eq('producto_id', parseInt(productoId))
      .order('peso_kg', { ascending: true });

    if (error) {
      console.error('❌ Error obteniendo variantes:', error);
      return new Response(
        JSON.stringify({ error: 'Error obteniendo variantes', success: false }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Variantes obtenidas:', variantes?.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        variantes: variantes || []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error en GET /api/variantes/obtener-disponibles:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', success: false }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
