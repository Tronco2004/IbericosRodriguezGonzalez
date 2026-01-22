import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    console.log('📡 GET /api/productos/lista iniciado');
    
    // Obtener todos los productos activos
    const { data: productos, error: prodError } = await supabaseClient
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('id', { ascending: true });

    if (prodError) {
      console.error('❌ Error Supabase productos:', prodError);
      return new Response(
        JSON.stringify({
          success: false,
          error: prodError.message,
          productos: []
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Productos obtenidos:', productos?.length || 0);

    // Obtener todas las categorías
    const { data: categorias, error: catError } = await supabaseClient
      .from('categorias')
      .select('id, nombre, slug');

    if (catError) {
      console.error('❌ Error Supabase categorías:', catError);
    }

    console.log('✅ Categorías obtenidas:', categorias?.length || 0);

    // Mapear categorías
    const categoriaMap: { [key: number]: any } = {};
    categorias?.forEach((cat) => {
      categoriaMap[cat.id] = { nombre: cat.nombre, slug: cat.slug };
    });

    // Enriquecer productos con datos de categoría
    const productosEnriquecidos = productos?.map((p) => ({
      ...p,
      categorias: categoriaMap[p.categoria_id] || { nombre: 'Sin categoría', slug: 'sin-categoria' }
    })) || [];

    console.log('✅ Retornando', productosEnriquecidos.length, 'productos enriquecidos');

    return new Response(
      JSON.stringify({
        success: true,
        productos: productosEnriquecidos,
        source: 'supabase'
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en GET /api/productos/lista:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno del servidor',
        productos: []
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
