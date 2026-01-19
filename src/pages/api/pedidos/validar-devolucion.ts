import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';
import { notificarDevolucionValidada } from '../../../lib/email';

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

    console.log('🔵 Validando devolución del pedido:', pedido_id);

    // Obtener datos del pedido
    const { data: pedido, error: errorPedido } = await supabaseClient
      .from('pedidos')
      .select('id, numero_pedido, estado, total, usuario_id, email_cliente')
      .eq('id', parseInt(pedido_id))
      .single();

    if (errorPedido || !pedido) {
      console.error('❌ Pedido no encontrado:', errorPedido);
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido no encontrado' }),
        { status: 404 }
      );
    }

    // Validar que el estado sea devolucion_solicitada
    if (pedido.estado !== 'devolucion_solicitada') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No se puede validar una devolución en estado ${pedido.estado}` 
        }),
        { status: 400 }
      );
    }

    console.log('🔵 Actualizando estado del pedido a devolucion_recibida...');

    // Cambiar estado a devolucion_recibida
    const { error: errorUpdate } = await supabaseClient
      .from('pedidos')
      .update({ 
        estado: 'devolucion_recibida',
        fecha_actualizacion: new Date().toISOString()
      })
      .eq('id', pedido.id);

    if (errorUpdate) {
      console.error('❌ Error actualizando pedido:', errorUpdate);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al validar la devolución' }),
        { status: 500 }
      );
    }

    console.log('✅ Pedido marcado como devolucion_recibida');

    // Obtener datos del usuario para el correo
    const { data: usuario } = await supabaseClient
      .from('usuarios')
      .select('email, nombre')
      .eq('id', pedido.usuario_id)
      .single();

    // Enviar correo de validación de devolución (sin bloquear la respuesta)
    try {
      if (usuario) {
        console.log('📧 Enviando correo de validación de devolución...');
        
        await notificarDevolucionValidada(
          usuario.email || pedido.email_cliente,
          pedido.numero_pedido,
          usuario.nombre,
          pedido.total
        );
        
        console.log('✅ Correo de validación enviado');
      }
    } catch (emailError) {
      console.error('⚠️ Error enviando correo, pero devolución fue validada:', emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Devolución validada correctamente. Cliente notificado.',
        pedido_id: pedido_id
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('🔴 Error validando devolución:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
