import type { APIRoute } from 'astro';
import { supabaseAdmin, supabaseClient } from '../../../lib/supabase';

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
    const { data: itemAnterior, error: itemError } = await supabaseAdmin
      .from('carrito_items')
      .select('*')
      .eq('id', item_id)
      .single();

    if (itemError || !itemAnterior) {
      console.error('❌ Item no encontrado para actualizar:', item_id, itemError);
      return new Response(
        JSON.stringify({ error: 'Item no encontrado en el carrito', success: false }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Si la cantidad es 0 o menor, eliminar
    if (cantidad <= 0) {
      const { error: deleteError } = await supabaseAdmin
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
        const { data: producto } = await supabaseAdmin
          .from('productos')
          .select('stock')
          .eq('id', itemAnterior.producto_id)
          .single();
        
        if (producto) {
          const nuevoStock = producto.stock + itemAnterior.cantidad;
          await supabaseAdmin
            .from('productos')
            .update({ stock: nuevoStock })
            .eq('id', itemAnterior.producto_id);
          console.log('✅ Stock devuelto (cantidad=0):', { producto_id: itemAnterior.producto_id, nuevoStock });
        }
      }

      // Devolver stock si es producto variable
      if (itemAnterior && itemAnterior.producto_variante_id) {
        const { data: variante } = await supabaseAdmin
          .from('producto_variantes')
          .select('cantidad_disponible')
          .eq('id', itemAnterior.producto_variante_id)
          .single();
        
        if (variante) {
          const nuevoStock = (variante.cantidad_disponible || 0) + itemAnterior.cantidad;
          const nuevoDisponible = nuevoStock > 0;
          await supabaseAdmin
            .from('producto_variantes')
            .update({ 
              cantidad_disponible: nuevoStock,
              disponible: nuevoDisponible
            })
            .eq('id', itemAnterior.producto_variante_id);
          console.log('✅ Stock variante devuelto (cantidad=0):', { variante_id: itemAnterior.producto_variante_id, nuevoStock });
        }
      }

      return new Response(
        JSON.stringify({ success: true, deleted: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Actualizar cantidad - VALIDAR STOCK
    if (cantidad > 0) {
      // Si estamos incrementando, validar stock disponible
      if (cantidad > itemAnterior.cantidad) {
        const incremento = cantidad - itemAnterior.cantidad;
        
        let stockDisponible = 0;
        if (itemAnterior.producto_variante_id) {
          const { data: variante } = await supabaseAdmin
            .from('producto_variantes')
            .select('cantidad_disponible')
            .eq('id', itemAnterior.producto_variante_id)
            .single();
          stockDisponible = variante?.cantidad_disponible || 0;
        } else {
          const { data: producto } = await supabaseAdmin
            .from('productos')
            .select('stock')
            .eq('id', itemAnterior.producto_id)
            .single();
          stockDisponible = producto?.stock || 0;
        }

        if (incremento > stockDisponible) {
          console.log('❌ Stock insuficiente para incremento:', { solicitado: incremento, disponible: stockDisponible });
          return new Response(
            JSON.stringify({ error: 'No hay suficiente stock', success: false }),
            { status: 400 }
          );
        }
      }
    }

    const { data: actualizado, error: updateError } = await supabaseAdmin
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
      
      const { data: producto } = await supabaseAdmin
        .from('productos')
        .select('stock')
        .eq('id', itemAnterior.producto_id)
        .single();
      
      if (producto) {
        const nuevoStock = producto.stock + diferencia;
        await supabaseAdmin
          .from('productos')
          .update({ stock: nuevoStock })
          .eq('id', itemAnterior.producto_id);
        console.log('✅ Stock ajustado:', { producto_id: itemAnterior.producto_id, cantidadAnterior: itemAnterior.cantidad, cantidadNueva: cantidad, diferencia, nuevoStock });
      }
    }

    // Ajustar stock si cambió la cantidad (para variantes)
    if (itemAnterior && itemAnterior.producto_variante_id && itemAnterior.cantidad !== cantidad) {
      const diferencia = itemAnterior.cantidad - cantidad; // Si es positivo, devolvemos stock
      
      const { data: variante } = await supabaseAdmin
        .from('producto_variantes')
        .select('cantidad_disponible')
        .eq('id', itemAnterior.producto_variante_id)
        .single();
      
      if (variante) {
        const nuevoStock = (variante.cantidad_disponible || 0) + diferencia;
        const nuevoDisponible = nuevoStock > 0;
        await supabaseAdmin
          .from('producto_variantes')
          .update({ 
            cantidad_disponible: nuevoStock,
            disponible: nuevoDisponible
          })
          .eq('id', itemAnterior.producto_variante_id);
        console.log('✅ Stock variante ajustado:', { variante_id: itemAnterior.producto_variante_id, cantidadAnterior: itemAnterior.cantidad, cantidadNueva: cantidad, diferencia, nuevoStock });
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
    const { data: item, error: getError } = await supabaseAdmin
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

    const { error: deleteError } = await supabaseAdmin
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
      const { data: producto } = await supabaseAdmin
        .from('productos')
        .select('stock')
        .eq('id', item.producto_id)
        .single();

      if (producto) {
        const nuevoStock = producto.stock + item.cantidad;
        await supabaseAdmin
          .from('productos')
          .update({ stock: nuevoStock })
          .eq('id', item.producto_id);
        console.log('✅ Stock devuelto:', { producto_id: item.producto_id, stockAnterior: producto.stock, nuevoStock });
      }
    }

    // Si es un producto variable (con variante), devolver el stock
    if (item.producto_variante_id) {
      console.log('➕ Devolviendo stock de variante:', item.producto_variante_id, 'cantidad:', item.cantidad);
      const { data: variante } = await supabaseAdmin
        .from('producto_variantes')
        .select('cantidad_disponible')
        .eq('id', item.producto_variante_id)
        .single();

      if (variante) {
        const stockAnterior = variante.cantidad_disponible || 0;
        const nuevoStock = stockAnterior + item.cantidad;
        const nuevoDisponible = nuevoStock > 0;
        await supabaseAdmin
          .from('producto_variantes')
          .update({ 
            cantidad_disponible: nuevoStock,
            disponible: nuevoDisponible
          })
          .eq('id', item.producto_variante_id);
        console.log('✅ Stock variante devuelto:', { variante_id: item.producto_variante_id, stockAnterior, nuevoStock, ahora_disponible: nuevoDisponible });
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
