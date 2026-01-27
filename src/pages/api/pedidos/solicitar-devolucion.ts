import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';
import { enviarEmailDevolucion, notificarDevolucionAlAdmin } from '../../../lib/email';

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

    // Verificar que el pedido pertenece al usuario y está entregado
    const { data: pedido, error: errorPedido } = await supabaseClient
      .from('pedidos')
      .select('id, estado, usuario_id, numero_pedido, email_cliente')
      .eq('id', pedido_id)
      .eq('usuario_id', userId)
      .single();

    if (errorPedido || !pedido) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido no encontrado' }),
        { status: 404 }
      );
    }

    // Validar que el estado sea "pagado" o "entregado"
    if (pedido.estado !== 'pagado' && pedido.estado !== 'entregado') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Solo puedes solicitar devolución de pedidos pagados o entregados` 
        }),
        { status: 400 }
      );
    }

    // ✅ RESTAURAR STOCK INMEDIATAMENTE
    console.log('🔵 Restaurando stock de productos del pedido:', pedido_id);
    
    // Obtener los items del pedido
    const { data: pedidoItems, error: itemsError } = await supabaseClient
      .from('pedido_items')
      .select('producto_id, producto_variante_id, cantidad, precio_unitario, peso_kg, nombre_producto')
      .eq('pedido_id', pedido_id);

    if (itemsError) {
      console.error('❌ Error obteniendo items del pedido:', itemsError);
    } else if (pedidoItems && pedidoItems.length > 0) {
      for (const item of pedidoItems) {
        if (item.producto_variante_id) {
          // Era una variante: recrearla en la BD
          console.log('🔵 Recreando variante para producto:', item.producto_id);
          
          const { error: varianteError } = await supabaseClient
            .from('producto_variantes')
            .insert({
              producto_id: item.producto_id,
              peso_kg: item.peso_kg,
              precio_total: item.precio_unitario * 100, // Convertir a centimos
              disponible: true,
              cantidad_disponible: 1
            });
          
          if (varianteError) {
            console.error('❌ Error recreando variante:', varianteError);
          } else {
            console.log('✅ Variante recreada para producto:', item.producto_id);
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
            const nuevoStock = (producto.stock || 0) + item.cantidad;
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

    // Actualizar estado a "devolucion_solicitada"
    const { error: errorUpdate } = await supabaseClient
      .from('pedidos')
      .update({ 
        estado: 'devolucion_solicitada',
        fecha_actualizacion: new Date().toISOString()
      })
      .eq('id', pedido_id);

    if (errorUpdate) {
      console.error('Error actualizando estado:', errorUpdate);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al procesar la devolución' }),
        { status: 500 }
      );
    }

    // Enviar email con etiqueta de devolución
    try {
      await enviarEmailDevolucion(pedido.email_cliente, pedido.numero_pedido);
      console.log('Email de devolución enviado a:', pedido.email_cliente);
    } catch (emailError) {
      console.error('Error enviando email de devolución:', emailError);
      // No fallar si el email no se envía
    }

    // Notificar al admin sobre la devolución
    try {
      const { data: usuario } = await supabaseClient
        .from('usuarios')
        .select('nombre')
        .eq('id', userId)
        .single();
      
      await notificarDevolucionAlAdmin(
        pedido.numero_pedido,
        pedido.email_cliente,
        usuario?.nombre
      );
      console.log('✅ Admin notificado sobre la devolución');
    } catch (adminEmailError) {
      console.error('⚠️ Error notificando al admin:', adminEmailError);
      // No fallar si no se puede notificar al admin
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Solicitud de devolución registrada',
        pedido_id: pedido_id
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error solicitando devolución:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
