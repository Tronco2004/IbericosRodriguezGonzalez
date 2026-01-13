import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../../lib/supabase';

export const PUT: APIRoute = async ({ request }) => {
  try {
    const { pedido_id, estado } = await request.json();

    // Validar que el estado sea válido
    const estadosValidos = ['pagado', 'preparando', 'enviado', 'entregado', 'cancelado'];
    if (!estadosValidos.includes(estado.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Estado no válido' }),
        { status: 400 }
      );
    }

    // Actualizar el estado del pedido
    const { data, error } = await supabaseClient
      .from('pedidos')
      .update({ estado: estado.toLowerCase() })
      .eq('id', pedido_id)
      .select();

    if (error) {
      console.error('Error actualizando pedido:', error);
      return new Response(
        JSON.stringify({ error: 'Error al actualizar el pedido' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        pedido: data?.[0]
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
