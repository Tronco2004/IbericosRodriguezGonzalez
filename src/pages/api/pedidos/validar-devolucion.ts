import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { notificarDevolucionValidada } from '../../../lib/email';
import { procesarReembolsoStripe } from '../../../lib/stripe';
import { requireAdmin } from '../../../lib/auth-helpers';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // ═══════════════════════════════════════════════════════════
    // FIX P0-5: Verificar admin con JWT+BD en vez de header spoofable
    // ═══════════════════════════════════════════════════════════
    const adminResult = await requireAdmin(request, cookies);
    if (adminResult instanceof Response) return adminResult;

    const { pedido_id } = await request.json();

    if (!pedido_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID del pedido requerido' }),
        { status: 400 }
      );
    }

    console.log('🔵 Validando devolución del pedido:', pedido_id);

    // Obtener datos del pedido (incluir stripe_session_id para el reembolso)
    const { data: pedido, error: errorPedido } = await supabaseAdmin
      .from('pedidos')
      .select('id, numero_pedido, estado, total, usuario_id, email_cliente, nombre_cliente, stripe_session_id')
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
          error: `No se puede validar una devolución en estado ${pedido.estado}` 
        }),
        { status: 400 }
      );
    }

    console.log('🔵 Actualizando estado del pedido a devolucion_recibida...');

    // ℹ️ El stock NO se restaura en devoluciones — el producto devuelto
    // puede no estar en condiciones de venta. El admin lo repondrá manualmente si procede.

    // ✅ PROCESAR REEMBOLSO REAL EN STRIPE
    let reembolsoInfo = { procesado: false, refundId: '', error: '' };

    if (pedido.stripe_session_id) {
      console.log('💳 Procesando reembolso en Stripe para sesión:', pedido.stripe_session_id);

      const resultado = await procesarReembolsoStripe(
        pedido.stripe_session_id,
        `Devolución aprobada - Pedido ${pedido.numero_pedido}`
      );

      if (resultado.success) {
        reembolsoInfo.procesado = true;
        reembolsoInfo.refundId = resultado.refundId || '';

        if (resultado.alreadyRefunded) {
          console.log('⚠️ El pago ya estaba reembolsado en Stripe');
        } else {
          console.log('✅ Reembolso procesado en Stripe:', resultado.refundId, '| Monto:', resultado.amount, resultado.currency);
        }
      } else {
        console.error('❌ Error al procesar reembolso en Stripe:', resultado.error);
        reembolsoInfo.error = resultado.error || 'Error desconocido';
        // No bloqueamos el flujo: el admin puede hacer el reembolso manual desde Stripe
      }
    } else {
      console.warn('⚠️ El pedido no tiene stripe_session_id, no se puede procesar reembolso automático');
      reembolsoInfo.error = 'Sin stripe_session_id';
    }

    // Cambiar estado a devolucion_recibida
    const { error: errorUpdate } = await supabaseAdmin
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

    // Enviar correo de validación de devolución (sin bloquear la respuesta)
    try {
      const emailCliente = pedido.email_cliente;
      const nombreCliente = pedido.nombre_cliente;
      
      if (emailCliente) {
        console.log('📧 Enviando correo de validación de devolución');
        
        await notificarDevolucionValidada(
          emailCliente,
          pedido.numero_pedido,
          nombreCliente,
          pedido.total
        );
        
        console.log('✅ Correo de validación enviado exitosamente');
      }
    } catch (emailError) {
      console.error('⚠️ Error enviando correo de validación:', emailError);
      // No bloqueamos la respuesta si hay error en el email
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: reembolsoInfo.procesado
          ? 'Devolución validada y reembolso procesado en Stripe. Cliente notificado.'
          : `Devolución validada. Cliente notificado. ${reembolsoInfo.error ? 'Reembolso Stripe pendiente: ' + reembolsoInfo.error : ''}`,
        pedido_id: pedido_id,
        reembolso: {
          procesado: reembolsoInfo.procesado,
          refund_id: reembolsoInfo.refundId || null,
          error: reembolsoInfo.error || null
        }
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
