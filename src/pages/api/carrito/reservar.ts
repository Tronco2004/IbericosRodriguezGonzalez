import type { APIRoute } from 'astro';
import { supabaseClient, supabaseAdmin } from '../../../lib/supabase';
import { decrementarStockProducto, incrementarStockProducto, decrementarStockVariante, incrementarStockVariante } from '../../../lib/stock';

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
      
      const result = await decrementarStockVariante(producto_variante_id, cantidad);
      
      if (!result.success) {
        console.log('❌ Stock insuficiente (CAS):', result.error);
        return new Response(
          JSON.stringify({ 
            error: result.error || 'No hay suficiente stock', 
            success: false,
            stockDisponible: result.stockRestante
          }),
          { status: 400 }
        );
      }

      console.log('✅ Stock variante reservado (CAS):', { 
        variante_id: producto_variante_id, 
        stockRestante: result.stockRestante,
        disponible: result.disponible
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          stockRestante: result.stockRestante,
          disponible: result.disponible
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // Si es un producto simple, restar stock
      console.log('📉 Reservando stock del producto:', producto_id, 'cantidad:', cantidad);
      
      const result = await decrementarStockProducto(producto_id, cantidad);
      
      if (!result.success) {
        console.log('❌ Stock insuficiente (CAS):', result.error);
        return new Response(
          JSON.stringify({ 
            error: result.error || 'No hay suficiente stock', 
            success: false,
            stockDisponible: result.stockRestante
          }),
          { status: 400 }
        );
      }

      console.log('✅ Stock producto reservado (CAS):', { 
        producto_id, 
        stockRestante: result.stockRestante
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          stockRestante: result.stockRestante
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
      
      const result = await incrementarStockVariante(producto_variante_id, cantidad);
      
      if (!result.success) {
        console.log('❌ Error devolviendo stock variante (CAS):', result.error);
        return new Response(
          JSON.stringify({ error: result.error || 'Error devolviendo stock', success: false }),
          { status: 500 }
        );
      }

      console.log('✅ Stock variante devuelto (CAS):', { 
        variante_id: producto_variante_id, 
        stockRestante: result.stockRestante
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          stockRestante: result.stockRestante
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // Si es un producto simple, devolver stock
      console.log('↩️ Devolviendo stock del producto:', producto_id, 'cantidad:', cantidad);
      
      const result = await incrementarStockProducto(producto_id, cantidad);
      
      if (!result.success) {
        console.log('❌ Error devolviendo stock producto (CAS):', result.error);
        return new Response(
          JSON.stringify({ error: result.error || 'Error devolviendo stock', success: false }),
          { status: 500 }
        );
      }

      console.log('✅ Stock producto devuelto (CAS):', { 
        producto_id, 
        stockRestante: result.stockRestante
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          stockRestante: result.stockRestante
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
