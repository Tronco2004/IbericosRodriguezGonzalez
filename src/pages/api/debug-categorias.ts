import type { APIRoute } from 'astro';
import { supabaseClient } from '../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    // Obtener todos los productos
    const { data: productos, error: prodError } = await supabaseClient
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('id', { ascending: true });

    if (prodError) {
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

    // Obtener todas las categorías
    const { data: categorias, error: catError } = await supabaseClient
      .from('categorias')
      .select('id, nombre, slug');

    if (catError) {
      console.error('Error Supabase categorías:', catError);
    }

    // Mapear categorías
    const categoriaMap: any = {};
    categorias?.forEach((cat) => {
      categoriaMap[cat.id] = { nombre: cat.nombre, slug: cat.slug };
    });

    // Enriquecer productos con datos de categoría
    const productosEnriquecidos = productos?.map((p) => ({
      ...p,
      categorias: categoriaMap[p.categoria_id] || { nombre: 'Sin categoría', slug: 'sin-categoria' }
    })) || [];

    // Contar por categoría
    const conteoPoCategoria: any = {};
    productosEnriquecidos.forEach(p => {
      const slug = p.categorias?.slug || 'sin-categoria';
      conteoPoCategoria[slug] = (conteoPoCategoria[slug] || 0) + 1;
    });

    return new Response(
      JSON.stringify({
        success: true,
        totalProductos: productosEnriquecidos.length,
        conteoPoCategoria,
        productosEjemplo: productosEnriquecidos.slice(0, 5).map(p => ({
          id: p.id,
          nombre: p.nombre,
          categoria_id: p.categoria_id,
          categorias: p.categorias
        }))
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error)
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
