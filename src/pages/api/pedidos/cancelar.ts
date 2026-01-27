import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';
import { enviarEmailCancelacion, notificarCancelacionAlAdmin } from '../../../lib/email';

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

    // Verificar que el pedido pertenece al usuario
    const { data: pedido, error: errorPedido } = await supabaseClient
      .from('pedidos')
      .select('id, estado, usuario_id')
      .eq('id', parseInt(pedido_id))
      .eq('usuario_id', userId)
      .single();

    if (errorPedido || !pedido) {
      console.error('❌ Pedido no encontrado:', errorPedido);
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido no encontrado' }),
        { status: 404 }
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
      // Obtener datos completos del pedido y usuario para los correos
      const { data: pedidoCompleto } = await supabaseClient
        .from('pedidos')
        .select('numero_pedido, total, fecha_pago')
        .eq('id', pedido.id)
        .single();

      const { data: usuario } = await supabaseClient
        .from('usuarios')
        .select('email, nombre')
        .eq('id', userId)
        .single();

      if (pedidoCompleto && usuario) {
        console.log('📧 Enviando correos de cancelación...');
        
        // Enviar correo al cliente
        await enviarEmailCancelacion(
          usuario.email,
          pedidoCompleto.numero_pedido,
          usuario.nombre,
          pedidoCompleto.total
        );

        // Enviar notificación al admin
        await notificarCancelacionAlAdmin(
          pedidoCompleto.numero_pedido,
          usuario.email,
          usuario.nombre,
          pedidoCompleto.total
        );
        
        console.log('✅ Correos de cancelación enviados exitosamente');
      }
    } catch (emailError) {
      console.error('⚠️ Error enviando correos, pero pedido fue cancelado:', emailError);
      // No bloqueamos la respuesta si falla el envío de emails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pedido cancelado exitosamente. Stock restaurado.',
        pedido_id: pedido_id
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
