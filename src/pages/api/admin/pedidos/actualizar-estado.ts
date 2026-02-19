import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

export const PUT: APIRoute = async ({ request }) => {
  try {
    const { pedido_id, estado } = await request.json();

    // Validar que el estado sea válido
    const estadosValidos = ['pagado', 'preparando', 'enviado', 'entregado', 'cancelado', 'devolucion_solicitada', 'devolucion_recibida'];
    if (!estadosValidos.includes(estado.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Estado no válido' }),
        { status: 400 }
      );
    }

    // Preparar datos de actualización
    const updateData: any = { estado: estado.toLowerCase() };
    const ahora = new Date().toISOString();

    // Sincronizar con estado_seguimiento y actualizar fechas correspondientes
    const estadoLower = estado.toLowerCase();
    if (estadoLower === 'pagado') {
      updateData.estado_seguimiento = 'pagado';
    } else if (estadoLower === 'enviado') {
      updateData.estado_seguimiento = 'enviado';
      updateData.fecha_envio = ahora;
    } else if (estadoLower === 'entregado') {
      updateData.estado_seguimiento = 'entregado';
      updateData.fecha_entrega = ahora;
    }

    // Actualizar el estado del pedido
    const { data, error } = await supabaseAdmin
      .from('pedidos')
      .update(updateData)
      .eq('id', pedido_id)
      .select();

    if (error) {
      console.error('Error actualizando pedido:', error);
      return new Response(
        JSON.stringify({ error: 'Error al actualizar el pedido' }),
        { status: 500 }
      );
    }

    console.log('✅ Pedido actualizado:', { pedido_id, estado: estadoLower, estado_seguimiento: updateData.estado_seguimiento });

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
