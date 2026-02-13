import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';
import { notificarDevolucionDenegada } from '../../../lib/email';

export const POST: APIRoute = async ({ request }) => {
  try {
    const userRole = request.headers.get('x-user-role');
    const { pedido_id } = await request.json();

    if (userRole !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 403 }
      );
    }

    if (!pedido_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID del pedido requerido' }),
        { status: 400 }
      );
    }

    console.log('🔵 Denegando devolución del pedido:', pedido_id);

    // Obtener datos del pedido
    const { data: pedido, error: errorPedido } = await supabaseClient
      .from('pedidos')
      .select('id, numero_pedido, estado, total, usuario_id, email_cliente, nombre_cliente')
      .eq('id', parseInt(pedido_id))
      .single();

    if (errorPedido || !pedido) {
      console.error('❌ Pedido no encontrado:', errorPedido);
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido no encontrado' }),
        { status: 404 }
      );
    }

    // Validar que el estado sea devolucion_solicitada o devolucion_recibida
    if (pedido.estado !== 'devolucion_solicitada' && pedido.estado !== 'devolucion_recibida') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No se puede denegar una devolución en estado ${pedido.estado}` 
        }),
        { status: 400 }
      );
    }

    console.log('🔵 Actualizando estado del pedido a devolucion_denegada...');

    // Cambiar estado a devolucion_denegada
    const { error: errorUpdate } = await supabaseClient
      .from('pedidos')
      .update({ 
        estado: 'devolucion_denegada',
        fecha_actualizacion: new Date().toISOString()
      })
      .eq('id', pedido.id);

    if (errorUpdate) {
      console.error('❌ Error actualizando pedido:', errorUpdate);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al denegar la devolución' }),
        { status: 500 }
      );
    }

    console.log('✅ Pedido marcado como devolucion_denegada');

    // Enviar correo de denegación de devolución (sin bloquear la respuesta)
    try {
      const emailCliente = pedido.email_cliente;
      const nombreCliente = pedido.nombre_cliente;
      
      if (emailCliente) {
        console.log('📧 Enviando correo de denegación de devolución a:', emailCliente);
        
        await notificarDevolucionDenegada(
          emailCliente,
          pedido.numero_pedido,
          nombreCliente,
          'El producto no cumple con los requisitos para devolución establecidos en nuestras políticas.'
        );
        
        console.log('✅ Correo de denegación enviado exitosamente');
      }
    } catch (emailError) {
      console.error('⚠️ Error enviando correo de denegación:', emailError);
      // No bloqueamos la respuesta si hay error en el email
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Devolución denegada correctamente. Cliente notificado.',
        pedido_id: pedido_id
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );


  } catch (error) {
    console.error('🔴 Error denegando devolución:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
