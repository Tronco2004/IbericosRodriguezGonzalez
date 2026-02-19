import type { APIRoute } from 'astro';
import { supabaseClient, supabaseAdmin } from '../../../lib/supabase';

/**
 * POST: Reservar stock (decrementar) cuando invitado agrega producto
 * DELETE: Devolver stock cuando invitado elimina producto del carrito
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const { producto_id, cantidad, producto_variante_id } = await request.json();

    console.log('🔒 POST /api/carrito/reservar - Datos recibidos:', { 
      producto_id, 
      cantidad, 
      producto_variante_id,
      tipo_variante: typeof producto_variante_id
    });

    if (!producto_id || !cantidad || cantidad <= 0) {
      console.log('❌ Error: Datos inválidos', { producto_id, cantidad });
      return new Response(
        JSON.stringify({ error: 'Datos inválidos', success: false }),
        { status: 400 }
      );
    }

    // Si es un producto variable, decrementar stock de la variante
    if (producto_variante_id && producto_variante_id !== 'undefined' && producto_variante_id > 0) {
      console.log('📉 Reservando stock de variante:', producto_variante_id, 'cantidad:', cantidad);
      
      const { data: variante, error: getError } = await supabaseClient
        .from('producto_variantes')
        .select('cantidad_disponible')
        .eq('id', producto_variante_id)
        .single();
      
      if (getError || !variante) {
        console.log('❌ Variante no encontrada:', getError);
        return new Response(
          JSON.stringify({ error: 'Variante no encontrada', success: false }),
          { status: 404 }
        );
      }

      const stockActual = variante.cantidad_disponible || 0;
      if (cantidad > stockActual) {
        console.log('❌ Stock insuficiente:', { disponible: stockActual, solicitado: cantidad });
        return new Response(
          JSON.stringify({ 
            error: 'No hay suficiente stock', 
            success: false,
            stockDisponible: stockActual
          }),
          { status: 400 }
        );
      }

      const nuevoStock = Math.max(0, stockActual - cantidad);
      const nuevoDisponible = nuevoStock > 0;
      
      const { error: updateError } = await supabaseAdmin
        .from('producto_variantes')
        .update({ 
          cantidad_disponible: nuevoStock,
          disponible: nuevoDisponible
        })
        .eq('id', producto_variante_id);
      
      if (updateError) {
        console.log('❌ Error actualizando stock:', updateError);
        return new Response(
          JSON.stringify({ error: 'Error actualizando stock', success: false }),
          { status: 500 }
        );
      }

      console.log('✅ Stock variante reservado:', { 
        variante_id: producto_variante_id, 
        stockAnterior: stockActual,
        nuevoStock,
        ahora_disponible: nuevoDisponible
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          stockRestante: nuevoStock,
          disponible: nuevoDisponible
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // Si es un producto simple, restar stock
      console.log('📉 Reservando stock del producto:', producto_id, 'cantidad:', cantidad);
      
      const { data: producto, error: getError } = await supabaseAdmin
        .from('productos')
        .select('stock')
        .eq('id', producto_id)
        .single();
      
      if (getError || !producto) {
        console.log('❌ Producto no encontrado:', getError);
        return new Response(
          JSON.stringify({ error: 'Producto no encontrado', success: false }),
          { status: 404 }
        );
      }

      const stockActual = producto.stock || 0;
      if (cantidad > stockActual) {
        console.log('❌ Stock insuficiente:', { disponible: stockActual, solicitado: cantidad });
        return new Response(
          JSON.stringify({ 
            error: 'No hay suficiente stock', 
            success: false,
            stockDisponible: stockActual
          }),
          { status: 400 }
        );
      }

      const nuevoStock = Math.max(0, stockActual - cantidad);
      
      const { error: updateError } = await supabaseAdmin
        .from('productos')
        .update({ stock: nuevoStock })
        .eq('id', producto_id);
      
      if (updateError) {
        console.log('❌ Error actualizando stock:', updateError);
        return new Response(
          JSON.stringify({ error: 'Error actualizando stock', success: false }),
          { status: 500 }
        );
      }

      console.log('✅ Stock producto reservado:', { 
        producto_id, 
        stockAnterior: stockActual,
        nuevoStock
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          stockRestante: nuevoStock
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('❌ Error en POST /api/carrito/reservar:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', success: false }),
      { status: 500 }
    );
  }
};

/**
 * DELETE: Devolver stock cuando invitado elimina producto del carrito
 */
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const { producto_id, cantidad, producto_variante_id } = await request.json();

    console.log('↩️ DELETE /api/carrito/reservar - Devolviendo stock:', { 
      producto_id, 
      cantidad, 
      producto_variante_id,
      tipo_variante: typeof producto_variante_id
    });

    if (!producto_id || !cantidad || cantidad <= 0) {
      console.log('❌ Error: Datos inválidos', { producto_id, cantidad });
      return new Response(
        JSON.stringify({ error: 'Datos inválidos', success: false }),
        { status: 400 }
      );
    }

    // Si es un producto variable, devolver stock de la variante
    if (producto_variante_id && producto_variante_id !== 'undefined' && producto_variante_id > 0) {
      console.log('↩️ Devolviendo stock de variante:', producto_variante_id, 'cantidad:', cantidad);
      
      const { data: variante, error: getError } = await supabaseClient
        .from('producto_variantes')
        .select('cantidad_disponible')
        .eq('id', producto_variante_id)
        .single();
      
      if (getError || !variante) {
        console.log('❌ Variante no encontrada:', getError);
        return new Response(
          JSON.stringify({ error: 'Variante no encontrada', success: false }),
          { status: 404 }
        );
      }

      const stockActual = variante.cantidad_disponible || 0;
      const nuevoStock = stockActual + cantidad;
      const nuevoDisponible = nuevoStock > 0;
      
      const { error: updateError } = await supabaseAdmin
        .from('producto_variantes')
        .update({ 
          cantidad_disponible: nuevoStock,
          disponible: nuevoDisponible
        })
        .eq('id', producto_variante_id);
      
      if (updateError) {
        console.log('❌ Error devolviendo stock:', updateError);
        return new Response(
          JSON.stringify({ error: 'Error devolviendo stock', success: false }),
          { status: 500 }
        );
      }

      console.log('✅ Stock variante devuelto:', { 
        variante_id: producto_variante_id, 
        stockAnterior: stockActual,
        nuevoStock
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          stockRestante: nuevoStock
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // Si es un producto simple, devolver stock
      console.log('↩️ Devolviendo stock del producto:', producto_id, 'cantidad:', cantidad);
      
      const { data: producto, error: getError } = await supabaseAdmin
        .from('productos')
        .select('stock')
        .eq('id', producto_id)
        .single();
      
      if (getError || !producto) {
        console.log('❌ Producto no encontrado:', getError);
        return new Response(
          JSON.stringify({ error: 'Producto no encontrado', success: false }),
          { status: 404 }
        );
      }

      const stockActual = producto.stock || 0;
      const nuevoStock = stockActual + cantidad;
      
      const { error: updateError } = await supabaseAdmin
        .from('productos')
        .update({ stock: nuevoStock })
        .eq('id', producto_id);
      
      if (updateError) {
        console.log('❌ Error devolviendo stock:', updateError);
        return new Response(
          JSON.stringify({ error: 'Error devolviendo stock', success: false }),
          { status: 500 }
        );
      }

      console.log('✅ Stock producto devuelto:', { 
        producto_id, 
        stockAnterior: stockActual,
        nuevoStock
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          stockRestante: nuevoStock
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('❌ Error en DELETE /api/carrito/reservar:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', success: false }),
      { status: 500 }
    );
  }
};
