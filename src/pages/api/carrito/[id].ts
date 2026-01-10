import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const prerender = false;

export const PUT: APIRoute = async ({ request, cookies }) => {
  try {
    const { item_id, cantidad, user_id } = await request.json();
    
    let userId = user_id || cookies.get('user_id')?.value;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401 }
      );
    }

    if (!item_id || cantidad === undefined) {
      return new Response(
        JSON.stringify({ error: 'Datos inválidos' }),
        { status: 400 }
      );
    }

    // Si la cantidad es 0 o menor, eliminar
    if (cantidad <= 0) {
      const { error: deleteError } = await supabaseClient
        .from('carrito_items')
        .delete()
        .eq('id', item_id);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: 'Error eliminando item' }),
          { status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, deleted: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Actualizar cantidad
    const { data: actualizado, error: updateError } = await supabaseClient
      .from('carrito_items')
      .update({ cantidad })
      .eq('id', item_id)
      .select()
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Error actualizando item' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, item: actualizado }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en PUT /api/carrito/[id]:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};

export const DELETE: APIRoute = async ({ request, cookies, params }) => {
  try {
    const body = await request.json().catch(() => ({}));
    let userId = body.user_id || cookies.get('user_id')?.value;
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401 }
      );
    }

    const itemId = params.id;

    if (!itemId) {
      return new Response(
        JSON.stringify({ error: 'ID del item no proporcionado' }),
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabaseClient
      .from('carrito_items')
      .delete()
      .eq('id', parseInt(itemId));

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: 'Error eliminando item' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en DELETE /api/carrito/[id]:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
