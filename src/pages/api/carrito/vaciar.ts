import type { APIRoute } from 'astro';
import { supabaseClient, supabaseAdmin } from '../../../lib/supabase';
import { getAuthenticatedUserId } from '../../../lib/auth-helpers';
import { incrementarStockProducto, incrementarStockVariante } from '../../../lib/stock';

export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    // FIX: Autenticación via JWT en vez de header spoofable
    const { userId } = await getAuthenticatedUserId(request, cookies);

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Usuario no autenticado' }),
        { status: 401 }
      );
    }

    console.log('🗑️ Vaciando carrito para usuario');

    // Primero obtener todos los items del carrito para devolver el stock
    const { data: carritoData, error: errorCarrito } = await supabaseAdmin
      .from('carritos')
      .select('id')
      .eq('usuario_id', userId);

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
    const { data: items, error: errorItems } = await supabaseAdmin
      .from('carrito_items')
      .select('*')
      .eq('carrito_id', carritoId);

    if (errorItems) {
      console.error('❌ Error obteniendo items:', errorItems);
    }

    if (items && items.length > 0) {
      console.log('Devolviendo stock de', items.length, 'items');
      
      // FIX P1-2: Devolver el stock de cada item con CAS
      for (const item of items) {
        if (item.producto_variante_id) {
          const result = await incrementarStockVariante(item.producto_variante_id, item.cantidad);
          if (result.success) {
            console.log('Stock variante devuelto (CAS):', item.producto_variante_id, '+', item.cantidad, '=', result.stockRestante);
          } else {
            console.error('Error devolviendo stock variante (CAS):', result.error);
          }
        } else {
          const result = await incrementarStockProducto(item.producto_id, item.cantidad);
          if (result.success) {
            console.log('Stock producto devuelto (CAS):', item.producto_id, '+', item.cantidad, '=', result.stockRestante);
          } else {
            console.error('Error devolviendo stock producto (CAS):', result.error);
          }
        }
      }

      // Eliminar todos los items del carrito
      const { error: errorDelete } = await supabaseAdmin
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
