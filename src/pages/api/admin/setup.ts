import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { action } = await request.json();

    if (action === 'crear_categorias') {
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

      const { data, error } = await supabaseClient
        .from('categorias')
        .insert(categorias)
        .select();

      if (error && error.code !== '23505') {
        throw error;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Categorías procesadas',
          categorias: data || []
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
