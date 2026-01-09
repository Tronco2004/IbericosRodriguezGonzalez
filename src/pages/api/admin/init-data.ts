import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'setup_inicial') {
      // 1. Crear/Verificar categorías
      const categorias = [
        {
          nombre: 'Jamones',
          slug: 'jamones',
          descripcion: 'Nuestros mejores jamones ibéricos',
          imagen_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=500&h=500&fit=crop'
        },
        {
          nombre: 'Quesos',
          slug: 'quesos',
          descripcion: 'Quesos de denominación de origen',
          imagen_url: 'https://images.unsplash.com/photo-1452195463300-e83e0a2a7a25?w=500&h=500&fit=crop'
        },
        {
          nombre: 'Embutidos',
          slug: 'embutidos',
          descripcion: 'Embutidos tradicionales',
          imagen_url: 'https://images.unsplash.com/photo-1602611954283-ed3f0f4fb5f0?w=500&h=500&fit=crop'
        }
      ];

      // Insertar categorías (ignorar si ya existen)
      const { data: catData, error: catError } = await supabaseClient
        .from('categorias')
        .insert(categorias)
        .select();

      // 2. Obtener los IDs de las categorías
      const { data: todasCategorias, error: catListError } = await supabaseClient
        .from('categorias')
        .select('id, slug, nombre');

      if (catListError) {
        throw new Error('Error obteniendo categorías: ' + catListError.message);
      }

      const categoriaMap = {};
      todasCategorias?.forEach((cat) => {
        categoriaMap[cat.slug] = cat.id;
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Setup completado',
          categorias: todasCategorias || [],
          categoriaMap: categoriaMap
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no válida' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error setup:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
