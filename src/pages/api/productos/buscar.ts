import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';
import { obtenerIdsCategoriaYSubcategorias } from '../../../lib/categorias-hierarchy';

export const GET: APIRoute = async ({ url }) => {
  try {
    const query = url.searchParams.get('q') || '';
    const categoriaId = url.searchParams.get('categoria_id');

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ success: true, resultados: [] }),
        { status: 200 }
      );
    }

    // Obtener todas las categorías si se filtró por categoría
    let idsCategorias: number[] = [];
    if (categoriaId) {
      const { data: categorias } = await supabaseClient
        .from('categorias')
        .select('*');
      
      idsCategorias = obtenerIdsCategoriaYSubcategorias(
        parseInt(categoriaId),
        categorias || []
      );
    }

    // Buscar en productos por nombre, descripción o categoría
    let query_builder = supabaseClient
      .from('productos')
      .select(`
        id, 
        nombre, 
        descripcion, 
        precio_centimos, 
        imagen_url, 
        categoria_id,
        categorias (
          id,
          nombre,
          slug,
          categoria_padre
        )
      `)
      .ilike('nombre', `%${query}%`)
      .limit(8);

    // Filtrar por categoría si se especificó
    if (idsCategorias.length > 0) {
      query_builder = query_builder.in('categoria_id', idsCategorias);
    }

    const { data: productos, error } = await query_builder;

    if (error) {
      console.error('Error en búsqueda:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500 }
      );
    }

    // Formatear resultados con información de categoría
    const resultados = (productos || []).map((producto: any) => ({
      id: producto.id,
      nombre: producto.nombre,
      precio: (parseInt(producto.precio_centimos) / 100).toFixed(2),
      imagen: producto.imagen_url || '/default-product.jpg',
      categoria_id: producto.categoria_id,
      categoria_nombre: producto.categorias?.nombre || '',
      categoria_slug: producto.categorias?.slug || ''
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
