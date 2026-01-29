import type { APIRoute } from 'astro';
import { supabaseAdmin as supabase } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: producto, error } = await supabase
      .from('productos')
      .select(`
        id,
        nombre,
        descripcion,
        precio_centimos,
        imagen_url,
        stock,
        rating,
        activo,
        categorias (
          id,
          nombre,
          slug
        )
      `)
      .eq('id', parseInt(id))
      .eq('activo', true)
      .single();

    if (error || !producto) {
      return new Response(
        JSON.stringify({ success: false, error: 'Producto no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, producto }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
