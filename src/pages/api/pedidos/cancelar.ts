import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

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

    // Obtener todos los items del pedido
    const { data: items, error: errorItems } = await supabaseClient
      .from('pedido_items')
      .select('producto_id, cantidad, peso_kg')
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

        // Primero verificar si el producto tiene variantes
        const { data: variantes, error: errorVariantes } = await supabaseClient
          .from('producto_variantes')
          .select('id, disponible')
          .eq('producto_id', item.producto_id);

        if (!errorVariantes && variantes && variantes.length > 0) {
          // Producto con variantes: restaurar stock en cada variante
          console.log('🔵 Producto con variantes encontradas:', variantes.length);

          for (const variante of variantes) {
            // Para productos con variantes de peso, restaurar el peso_kg, no la cantidad
            const cantidadARestaurar = item.peso_kg || item.cantidad;
            
            // Si disponible es booleano, solo marcar true. Si es número, sumar.
            let nuevoDisponible = cantidadARestaurar > 0 ? true : false;
            if (typeof variante.disponible === 'number') {
              nuevoDisponible = (variante.disponible || 0) + cantidadARestaurar;
            }
            
            console.log('🔵 Actualizando variante', variante.id, 'disponible de', variante.disponible, 'a', nuevoDisponible);
            
            const { error: errorRestore } = await supabaseClient
              .from('producto_variantes')
              .update({ disponible: nuevoDisponible })
              .eq('id', variante.id);
            
            if (errorRestore) {
              console.error('❌ Error restaurando stock para variante', variante.id, ':', errorRestore);
            } else {
              console.log('✅ Stock restaurado para variante', variante.id);
              restaurados++;
            }
          }
        } else {
          // Producto sin variantes: crear una nueva variante con el peso_kg
          console.log('🔵 Producto sin variantes, creando nueva variante con peso:', item.peso_kg);
          
          const pesoARestaurar = item.peso_kg || item.cantidad;
          
          // Insertar nueva variante con el peso devuelto
          const { data: nuevaVariante, error: insertError } = await supabaseClient
            .from('producto_variantes')
            .insert({
              producto_id: item.producto_id,
              peso_kg: pesoARestaurar,
              disponible: true,
              precio_total: 0 // Puedes ajustar esto si es necesario
            })
            .select()
            .single();

          if (insertError) {
            console.error('❌ Error creando nueva variante:', insertError);
          } else {
            console.log('✅ Nueva variante creada:', nuevaVariante.id, 'con peso:', pesoARestaurar);
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
