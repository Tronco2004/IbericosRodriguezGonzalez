import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ url }) => {
  try {
    const query = url.searchParams.get('q') || '';

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ success: true, resultados: [] }),
        { status: 200 }
      );
    }

    // Buscar en productos por nombre, descripción o categoría
    const { data: productos, error } = await supabaseClient
      .from('productos')
      .select('id, nombre, descripcion, precio_centimos, imagen_url, categoria_id')
      .ilike('nombre', `%${query}%`)
      .limit(8);

    if (error) {
      console.error('Error en búsqueda:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500 }
      );
    }

    // Formatear resultados
    const resultados = (productos || []).map((producto) => ({
      id: producto.id,
      nombre: producto.nombre,
      precio: (parseInt(producto.precio_centimos) / 100).toFixed(2),
      imagen: producto.imagen_url || '/default-product.jpg',
      categoria_id: producto.categoria_id
    }));

    return new Response(
      JSON.stringify({
        success: true,
        resultados: resultados
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en búsqueda:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.toString() }),
      { status: 500 }
    );
  }
};
