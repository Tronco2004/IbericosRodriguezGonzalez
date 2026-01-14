import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const prerender = false;

export const PUT: APIRoute = async ({ request, cookies }) => {
  try {
    const { item_id, cantidad, user_id } = await request.json();
    
    let userId = user_id || cookies.get('user_id')?.value;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401 }
      );
    }

    if (!item_id || cantidad === undefined) {
      return new Response(
        JSON.stringify({ error: 'Datos inválidos' }),
        { status: 400 }
      );
    }

    // Obtener el item antes de actualizar para saber la cantidad anterior
    const { data: itemAnterior } = await supabaseClient
      .from('carrito_items')
      .select('*')
      .eq('id', item_id)
      .single();

    // Si la cantidad es 0 o menor, eliminar
    if (cantidad <= 0) {
      const { error: deleteError } = await supabaseClient
        .from('carrito_items')
        .delete()
        .eq('id', item_id);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: 'Error eliminando item' }),
          { status: 500 }
        );
      }

      // Devolver stock si es producto simple
      if (itemAnterior && !itemAnterior.producto_variante_id) {
        const { data: producto } = await supabaseClient
          .from('productos')
          .select('stock')
          .eq('id', itemAnterior.producto_id)
          .single();
        
        if (producto) {
          const nuevoStock = producto.stock + itemAnterior.cantidad;
          await supabaseClient
            .from('productos')
            .update({ stock: nuevoStock })
            .eq('id', itemAnterior.producto_id);
          console.log('✅ Stock devuelto (cantidad=0):', { producto_id: itemAnterior.producto_id, nuevoStock });
        }
      }

      return new Response(
        JSON.stringify({ success: true, deleted: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Actualizar cantidad
    const { data: actualizado, error: updateError } = await supabaseClient
      .from('carrito_items')
      .update({ cantidad })
      .eq('id', item_id)
      .select()
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Error actualizando item' }),
        { status: 500 }
      );
    }

    // Ajustar stock si cambió la cantidad (solo si es producto simple)
    if (itemAnterior && !itemAnterior.producto_variante_id && itemAnterior.cantidad !== cantidad) {
      const diferencia = itemAnterior.cantidad - cantidad; // Si es positivo, devolvemos stock
      
      const { data: producto } = await supabaseClient
        .from('productos')
        .select('stock')
        .eq('id', itemAnterior.producto_id)
        .single();
      
      if (producto) {
        const nuevoStock = producto.stock + diferencia;
        await supabaseClient
          .from('productos')
          .update({ stock: nuevoStock })
          .eq('id', itemAnterior.producto_id);
        console.log('✅ Stock ajustado:', { 
          producto_id: itemAnterior.producto_id, 
          cantidadAnterior: itemAnterior.cantidad,
          cantidadNueva: cantidad,
          diferencia,
          nuevoStock 
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, item: actualizado }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en PUT /api/carrito/[id]:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};

export const DELETE: APIRoute = async ({ request, cookies, params }) => {
  try {
    const body = await request.json().catch(() => ({}));
    let userId = body.user_id || cookies.get('user_id')?.value;
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401 }
      );
    }

    const itemId = params.id;

    if (!itemId) {
      return new Response(
        JSON.stringify({ error: 'ID del item no proporcionado' }),
        { status: 400 }
      );
    }

    // Obtener el item antes de eliminarlo
    const { data: item, error: getError } = await supabaseClient
      .from('carrito_items')
      .select('*')
      .eq('id', parseInt(itemId))
      .single();

    if (getError || !item) {
      console.log('❌ Item no encontrado:', itemId);
      return new Response(
        JSON.stringify({ error: 'Item no encontrado', success: false }),
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabaseClient
      .from('carrito_items')
      .delete()
      .eq('id', parseInt(itemId));

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: 'Error eliminando item' }),
        { status: 500 }
      );
    }

    console.log('✅ Item eliminado:', itemId);

    // Si es un producto simple (sin variante), devolver el stock
    if (!item.producto_variante_id) {
      console.log('➕ Devolviendo stock del producto:', item.producto_id, 'cantidad:', item.cantidad);
      const { data: producto } = await supabaseClient
        .from('productos')
        .select('stock')
        .eq('id', item.producto_id)
        .single();

      if (producto) {
        const nuevoStock = producto.stock + item.cantidad;
        await supabaseClient
          .from('productos')
          .update({ stock: nuevoStock })
          .eq('id', item.producto_id);
        console.log('✅ Stock devuelto:', { producto_id: item.producto_id, stockAnterior: producto.stock, nuevoStock });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en DELETE /api/carrito/[id]:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
