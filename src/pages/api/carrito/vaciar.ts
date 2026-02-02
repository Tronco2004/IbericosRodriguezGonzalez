import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Usuario no autenticado' }),
        { status: 401 }
      );
    }

    console.log('🗑️ Vaciando carrito para usuario:', userId);

    // Primero obtener todos los items del carrito para devolver el stock
    const { data: carritoData, error: errorCarrito } = await supabaseClient
      .from('carritos')
      .select('id')
      .eq('usuario_id', userId);

    console.log('📦 Consulta carrito - Data:', carritoData, 'Error:', errorCarrito);

    if (errorCarrito) {
      console.error('❌ Error en query carrito:', errorCarrito);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al obtener carrito', error: errorCarrito.message }),
        { status: 500 }
      );
    }

    if (!carritoData || carritoData.length === 0) {
      console.log('Carrito vacío o no existe');
      return new Response(
        JSON.stringify({ success: true, message: 'Carrito ya estaba vacío' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const carritoId = carritoData[0].id;
    console.log('✅ Carrito encontrado, ID:', carritoId);

    // Obtener todos los items del carrito
    const { data: items, error: errorItems } = await supabaseClient
      .from('carrito_items')
      .select('*')
      .eq('carrito_id', carritoId);

    console.log('📋 Items obtenidos:', items?.length || 0, 'Error:', errorItems);

    if (errorItems) {
      console.error('❌ Error obteniendo items:', errorItems);
    }

    if (items && items.length > 0) {
      console.log('Devolviendo stock de', items.length, 'items');
      
      // Devolver el stock de cada item
      for (const item of items) {
        if (item.producto_variante_id) {
          // Producto con variante
          const { data: variante } = await supabaseClient
            .from('producto_variantes')
            .select('cantidad_disponible')
            .eq('id', item.producto_variante_id)
            .single();

          if (variante) {
            const nuevoStock = (variante.cantidad_disponible || 0) + item.cantidad;
            const { error: errorUpdate } = await supabaseClient
              .from('producto_variantes')
              .update({ 
                cantidad_disponible: nuevoStock,
                disponible: nuevoStock > 0
              })
              .eq('id', item.producto_variante_id);
            
            if (errorUpdate) {
              console.error('Error actualizando variante:', errorUpdate);
            } else {
              console.log('Stock variante devuelto:', item.producto_variante_id, '+', item.cantidad, '=', nuevoStock);
            }
          }
        } else {
          // Producto simple
          const { data: producto } = await supabaseClient
            .from('productos')
            .select('stock')
            .eq('id', item.producto_id)
            .single();

          if (producto) {
            const nuevoStock = producto.stock + item.cantidad;
            const { error: errorUpdate } = await supabaseClient
              .from('productos')
              .update({ stock: nuevoStock })
              .eq('id', item.producto_id);
            
            if (errorUpdate) {
              console.error('Error actualizando producto:', errorUpdate);
            } else {
              console.log('Stock producto devuelto:', item.producto_id, '+', item.cantidad, '=', nuevoStock);
            }
          }
        }
      }

      // Eliminar todos los items del carrito
      const { error: errorDelete } = await supabaseClient
        .from('carrito_items')
        .delete()
        .eq('carrito_id', carritoId);

      if (errorDelete) {
        console.error('Error eliminando items:', errorDelete);
        return new Response(
          JSON.stringify({ success: false, message: 'Error al eliminar items del carrito' }),
          { status: 500 }
        );
      }
      
      console.log('✅ Items eliminados correctamente');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Carrito vaciado correctamente' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en vaciar carrito:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor', error: String(error) }),
      { status: 500 }
    );
  }
};
