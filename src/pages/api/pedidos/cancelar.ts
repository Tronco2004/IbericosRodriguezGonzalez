import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';
import { enviarEmailCancelacion, notificarCancelacionAlAdmin } from '../../../lib/email';
import { procesarReembolsoStripe } from '../../../lib/stripe';

export const POST: APIRoute = async ({ request }) => {
  try {
    const userId = request.headers.get('x-user-id');
    const { pedido_id } = await request.json();

    if (!userId || !pedido_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Datos incompletos' }),
        { status: 400 }
      );
    }

    console.log('🔵 Cancelando pedido:', { pedido_id, userId });

    // Obtener email del usuario para poder verificar propiedad por email también
    let userEmail: string | null = null;
    const { data: usuario } = await supabaseClient
      .from('usuarios')
      .select('email')
      .eq('id', userId)
      .single();
    if (usuario?.email) userEmail = usuario.email;

    // Buscar pedido por ID (sin filtrar por usuario_id, ya que puede ser null en pedidos de invitado)
    const { data: pedido, error: errorPedido } = await supabaseClient
      .from('pedidos')
      .select('id, estado, usuario_id, stripe_session_id, email_cliente')
      .eq('id', parseInt(pedido_id))
      .single();

    if (errorPedido || !pedido) {
      console.error('❌ Pedido no encontrado:', errorPedido);
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido no encontrado' }),
        { status: 404 }
      );
    }

    // Verificar que el pedido pertenece al usuario (por usuario_id o por email)
    const esPropietario = pedido.usuario_id === userId || 
      (userEmail && pedido.email_cliente === userEmail);

    if (!esPropietario) {
      console.error('❌ El pedido no pertenece al usuario:', { pedidoUserId: pedido.usuario_id, pedidoEmail: pedido.email_cliente, userId, userEmail });
      return new Response(
        JSON.stringify({ success: false, error: 'No tienes permiso para cancelar este pedido' }),
        { status: 403 }
      );
    }

    // Validar que el estado sea "pagado"
    if (pedido.estado !== 'pagado') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No se puede cancelar un pedido en estado ${pedido.estado}` 
        }),
        { status: 400 }
      );
    }

    console.log('🔵 Restaurando stock de los productos del pedido...');

    // Obtener todos los items del pedido con más información
    const { data: items, error: errorItems } = await supabaseClient
      .from('pedido_items')
      .select('producto_id, producto_variante_id, cantidad, precio_unitario, peso_kg')
      .eq('pedido_id', pedido.id);

    console.log('🔵 Items encontrados:', JSON.stringify(items, null, 2));

    if (!errorItems && items && items.length > 0) {
      let restaurados = 0;
      
      // Para cada producto en el pedido
      for (const item of items) {
        if (!item.producto_id) {
          console.warn('⚠️ Item sin producto_id:', item);
          continue;
        }

        console.log('🔵 Restaurando stock para producto:', item.producto_id, 'cantidad:', item.cantidad, 'peso_kg:', item.peso_kg);

        // Verificar si es un producto de peso variable (tiene peso_kg o producto_variante_id)
        if (item.producto_variante_id || item.peso_kg) {
          // Producto de peso variable: recrear la variante en la BD
          console.log('🔵 Recreando variante para producto:', item.producto_id, 'peso:', item.peso_kg, 'kg');
          
          // precio_unitario está en euros, convertir a céntimos para precio_total
          const precioTotalCentimos = Math.round((item.precio_unitario || 0) * 100);
          
          const { data: nuevaVariante, error: insertError } = await supabaseClient
            .from('producto_variantes')
            .insert({
              producto_id: item.producto_id,
              peso_kg: item.peso_kg,
              precio_total: precioTotalCentimos,
              disponible: true,
              cantidad_disponible: 1
            })
            .select()
            .single();

          if (insertError) {
            console.error('❌ Error recreando variante:', insertError);
          } else {
            console.log('✅ Variante recreada:', nuevaVariante.id, 'peso:', item.peso_kg, 'kg, precio:', precioTotalCentimos, 'céntimos');
            restaurados++;
          }
        } else {
          // Producto normal: incrementar stock
          console.log('🔵 Producto normal, incrementando stock...');
          
          const { data: producto, error: errorGetProducto } = await supabaseClient
            .from('productos')
            .select('stock')
            .eq('id', item.producto_id)
            .single();

          if (errorGetProducto || !producto) {
            console.warn('⚠️ No se encontró el producto:', item.producto_id, errorGetProducto);
            continue;
          }

          const nuevoStock = (producto.stock || 0) + (item.cantidad || 1);
          console.log('🔵 Actualizando producto', item.producto_id, 'stock de', producto.stock, 'a', nuevoStock);
          
          const { error: errorRestore } = await supabaseClient
            .from('productos')
            .update({ stock: nuevoStock })
            .eq('id', item.producto_id);

          if (errorRestore) {
            console.error('❌ Error restaurando stock:', errorRestore);
          } else {
            console.log('✅ Stock restaurado para producto', item.producto_id);
            restaurados++;
          }
        }
      }
      console.log('🔵 Total de items restaurados:', restaurados);
    } else {
      console.warn('⚠️ No hay items en el pedido o error:', errorItems);
    }

    // ✅ PROCESAR REEMBOLSO REAL EN STRIPE
    let reembolsoInfo = { procesado: false, refundId: '', error: '' };

    if (pedido.stripe_session_id) {
      console.log('💳 Procesando reembolso en Stripe para sesión:', pedido.stripe_session_id);

      const resultado = await procesarReembolsoStripe(
        pedido.stripe_session_id,
        `Cancelación de pedido por el cliente`
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
        // No bloqueamos la cancelación, pero logueamos el error
      }
    } else {
      console.warn('⚠️ El pedido no tiene stripe_session_id, no se puede procesar reembolso automático');
      reembolsoInfo.error = 'Sin stripe_session_id';
    }

    console.log('🔵 Actualizando estado del pedido a cancelado...');

    // Cambiar estado a cancelado
    const { error: errorUpdate } = await supabaseClient
      .from('pedidos')
      .update({ 
        estado: 'cancelado',
        fecha_actualizacion: new Date().toISOString()
      })
      .eq('id', pedido.id);

    if (errorUpdate) {
      console.error('❌ Error actualizando pedido:', errorUpdate);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al cancelar el pedido' }),
        { status: 500 }
      );
    }

    console.log('✅ Pedido cancelado exitosamente');

    // Enviar correos de cancelación (sin bloquear la respuesta)
    try {
      // Obtener datos completos del pedido (email_cliente y nombre_cliente ya están en la tabla pedidos)
      const { data: pedidoCompleto } = await supabaseClient
        .from('pedidos')
        .select('numero_pedido, total, fecha_pago, email_cliente, nombre_cliente')
        .eq('id', pedido.id)
        .single();

      if (pedidoCompleto && pedidoCompleto.email_cliente) {
        console.log('📧 Enviando correos de cancelación a cliente:', pedidoCompleto.email_cliente, 'y admin:', import.meta.env.ADMIN_EMAIL);
        
        // Enviar ambos correos en paralelo para que el fallo de uno no bloquee al otro
        const resultados = await Promise.allSettled([
          enviarEmailCancelacion(
            pedidoCompleto.email_cliente,
            pedidoCompleto.numero_pedido,
            pedidoCompleto.nombre_cliente,
            pedidoCompleto.total
          ),
          notificarCancelacionAlAdmin(
            pedidoCompleto.numero_pedido,
            pedidoCompleto.email_cliente,
            pedidoCompleto.nombre_cliente,
            pedidoCompleto.total
          )
        ]);
        
        resultados.forEach((r, i) => {
          const dest = i === 0 ? 'cliente' : 'admin';
          if (r.status === 'fulfilled') {
            console.log(`✅ Correo de cancelación enviado al ${dest}`);
          } else {
            console.error(`⚠️ Error enviando correo al ${dest}:`, r.reason);
          }
        });
      } else {
        console.warn('⚠️ No se pudo obtener email_cliente del pedido:', pedido.id);
      }
    } catch (emailError) {
      console.error('⚠️ Error enviando correos, pero pedido fue cancelado:', emailError);
      // No bloqueamos la respuesta si falla el envío de emails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: reembolsoInfo.procesado
          ? 'Pedido cancelado y reembolso procesado en Stripe. Stock restaurado.'
          : `Pedido cancelado. Stock restaurado. ${reembolsoInfo.error ? 'Reembolso Stripe pendiente: ' + reembolsoInfo.error : ''}`,
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
    console.error('🔴 Error cancelando pedido:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
