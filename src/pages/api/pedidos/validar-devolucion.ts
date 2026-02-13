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
          error: `No se puede validar una devolución en estado ${pedido.estado}` 
        }),
        { status: 400 }
      );
    }

    console.log('🔵 Actualizando estado del pedido a devolucion_recibida...');

    // ✅ RESTAURAR STOCK DE LOS PRODUCTOS DEL PEDIDO
    console.log('🔵 Restaurando stock de productos...');
    
    // Obtener los items del pedido
    const { data: pedidoItems, error: itemsError } = await supabaseClient
      .from('pedido_items')
      .select('producto_id, producto_variante_id, cantidad, precio_unitario, peso_kg, nombre_producto')
      .eq('pedido_id', pedido.id);

    if (itemsError) {
      console.error('❌ Error obteniendo items del pedido:', itemsError);
    } else if (pedidoItems && pedidoItems.length > 0) {
      for (const item of pedidoItems) {
        if (item.producto_variante_id || item.peso_kg) {
          // Era una variante de peso variable: recrearla en la BD
          console.log('🔵 Recreando variante para producto:', item.producto_id, 'peso:', item.peso_kg, 'kg');
          
          // precio_unitario está en euros, convertir a céntimos para precio_total
          const precioTotalCentimos = Math.round((item.precio_unitario || 0) * 100);
          
          const { error: varianteError } = await supabaseClient
            .from('producto_variantes')
            .insert({
              producto_id: item.producto_id,
              peso_kg: item.peso_kg,
              precio_total: precioTotalCentimos,
              disponible: true,
              cantidad_disponible: 1
            });
          
          if (varianteError) {
            console.error('❌ Error recreando variante:', varianteError);
          } else {
            console.log('✅ Variante recreada para producto:', item.producto_id, 'peso:', item.peso_kg, 'kg, precio:', precioTotalCentimos, 'céntimos');
          }
        } else {
          // Producto normal: incrementar stock
          console.log('🔵 Incrementando stock para producto:', item.producto_id, 'cantidad:', item.cantidad);
          
          // Obtener stock actual
          const { data: producto, error: getError } = await supabaseClient
            .from('productos')
            .select('stock')
            .eq('id', item.producto_id)
            .single();
          
          if (!getError && producto) {
            const nuevoStock = (producto.stock || 0) + (item.cantidad || 1);
            const { error: stockError } = await supabaseClient
              .from('productos')
              .update({ stock: nuevoStock })
              .eq('id', item.producto_id);
            
            if (stockError) {
              console.error('❌ Error incrementando stock:', stockError);
            } else {
              console.log('✅ Stock incrementado para producto:', item.producto_id, 'nuevo stock:', nuevoStock);
            }
          }
        }
      }
    }

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

    // Enviar correo de validación de devolución (sin bloquear la respuesta)
    try {
      const emailCliente = pedido.email_cliente;
      const nombreCliente = pedido.nombre_cliente;
      
      if (emailCliente) {
        console.log('📧 Enviando correo de validación de devolución a:', emailCliente);
        
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
