import type { APIRoute } from 'astro';
import { supabaseAdmin, supabaseClient } from '../../../lib/supabase';
import { getAuthenticatedUserId } from '../../../lib/auth-helpers';
import { incrementarStockProducto, incrementarStockVariante, decrementarStockProducto, decrementarStockVariante } from '../../../lib/stock';

export const prerender = false;

/**
 * Verifica que un carrito_item pertenece al carrito del usuario autenticado.
 * Previene IDOR (acceso a items de otros usuarios).
 */
async function verificarPropietarioItem(itemId: number, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('carrito_items')
    .select('carrito_id, carritos!inner(usuario_id)')
    .eq('id', itemId)
    .single();

  if (!data) return false;
  // carritos es un objeto con usuario_id
  return (data as any).carritos?.usuario_id === userId;
}

export const PUT: APIRoute = async ({ request, cookies }) => {
  try {
    const { item_id, cantidad } = await request.json();
    
    // ═══════════════════════════════════════════════════════════
    // FIX P1-1: Autenticación via JWT, no confiar en user_id del body
    // ═══════════════════════════════════════════════════════════
    const { userId } = await getAuthenticatedUserId(request, cookies);
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

    // FIX P1-1: Verificar que el item pertenece al usuario
    const esPropietario = await verificarPropietarioItem(item_id, userId);
    if (!esPropietario) {
      return new Response(
        JSON.stringify({ error: 'No tienes permiso para modificar este item', success: false }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
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

      // FIX P1-2: Devolver stock con CAS
      if (itemAnterior && !itemAnterior.producto_variante_id) {
        const result = await incrementarStockProducto(itemAnterior.producto_id, itemAnterior.cantidad);
        if (result.success) {
          console.log('✅ Stock devuelto (CAS, cantidad=0):', { producto_id: itemAnterior.producto_id, nuevoStock: result.stockRestante });
        } else {
          console.error('❌ Error devolviendo stock (CAS):', result.error);
        }
      }

      if (itemAnterior && itemAnterior.producto_variante_id) {
        const result = await incrementarStockVariante(itemAnterior.producto_variante_id, itemAnterior.cantidad);
        if (result.success) {
          console.log('✅ Stock variante devuelto (CAS, cantidad=0):', { variante_id: itemAnterior.producto_variante_id, nuevoStock: result.stockRestante });
        } else {
          console.error('❌ Error devolviendo stock variante (CAS):', result.error);
        }
      }

      return new Response(
        JSON.stringify({ success: true, deleted: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Actualizar cantidad - VALIDAR STOCK con CAS
    if (cantidad > 0 && cantidad > itemAnterior.cantidad) {
      const incremento = cantidad - itemAnterior.cantidad;
      
      // Intentar decrementar stock (CAS valida disponibilidad)
      if (itemAnterior.producto_variante_id) {
        const result = await decrementarStockVariante(itemAnterior.producto_variante_id, incremento);
        if (!result.success) {
          console.log('❌ Stock insuficiente (CAS):', result.error);
          return new Response(
            JSON.stringify({ error: 'No hay suficiente stock', success: false }),
            { status: 400 }
          );
        }
      } else {
        const result = await decrementarStockProducto(itemAnterior.producto_id, incremento);
        if (!result.success) {
          console.log('❌ Stock insuficiente (CAS):', result.error);
          return new Response(
            JSON.stringify({ error: 'No hay suficiente stock', success: false }),
            { status: 400 }
          );
        }
      }
    } else if (cantidad > 0 && cantidad < itemAnterior.cantidad) {
      // Devolver stock sobrante con CAS
      const devolver = itemAnterior.cantidad - cantidad;
      if (itemAnterior.producto_variante_id) {
        await incrementarStockVariante(itemAnterior.producto_variante_id, devolver);
      } else {
        await incrementarStockProducto(itemAnterior.producto_id, devolver);
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
    // FIX P1-1: Auth via JWT
    const { userId } = await getAuthenticatedUserId(request, cookies);
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

    const itemIdNum = parseInt(itemId);

    // FIX P1-1: Verificar propiedad del item
    const esPropietario = await verificarPropietarioItem(itemIdNum, userId);
    if (!esPropietario) {
      return new Response(
        JSON.stringify({ error: 'No tienes permiso para eliminar este item', success: false }),
        { status: 403 }
      );
    }

    // Obtener el item antes de eliminarlo
    const { data: item, error: getError } = await supabaseAdmin
      .from('carrito_items')
      .select('*')
      .eq('id', itemIdNum)
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
      .eq('id', itemIdNum);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: 'Error eliminando item' }),
        { status: 500 }
      );
    }

    console.log('✅ Item eliminado:', itemId);

    // FIX P1-2: Devolver stock con CAS
    if (!item.producto_variante_id) {
      const result = await incrementarStockProducto(item.producto_id, item.cantidad);
      if (result.success) {
        console.log('✅ Stock devuelto (CAS):', { producto_id: item.producto_id, nuevoStock: result.stockRestante });
      } else {
        console.error('❌ Error devolviendo stock (CAS):', result.error);
      }
    } else {
      const result = await incrementarStockVariante(item.producto_variante_id, item.cantidad);
      if (result.success) {
        console.log('✅ Stock variante devuelto (CAS):', { variante_id: item.producto_variante_id, nuevoStock: result.stockRestante });
      } else {
        console.error('❌ Error devolviendo stock variante (CAS):', result.error);
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
