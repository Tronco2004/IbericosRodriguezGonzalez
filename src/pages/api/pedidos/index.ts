import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const prerender = false;

// GET - Obtener todos los pedidos del usuario autenticado
export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { status: 401 }
      );
    }

    // Obtener pedidos del usuario
    const { data: pedidos, error } = await supabaseClient
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        estado,
        subtotal,
        envio,
        impuestos,
        total,
        fecha_creacion,
        fecha_pago,
        pedido_items (
          id,
          nombre_producto,
          cantidad,
          precio_unitario,
          peso_kg
        )
      `)
      .eq('usuario_id', userId)
      .order('fecha_creacion', { ascending: false });

    if (error) {
      console.error('Error obteniendo pedidos:', error);
      return new Response(
        JSON.stringify({ error: 'Error obteniendo pedidos' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        pedidos: pedidos || [] 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en GET /api/pedidos:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};

// POST - Crear un nuevo pedido (después del pago Stripe)
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { status: 401 }
      );
    }

    const {
      stripe_session_id,
      cartItems,
      total,
      subtotal,
      email,
      telefono
    } = await request.json();

    if (!stripe_session_id || !cartItems || !total) {
      return new Response(
        JSON.stringify({ error: 'Datos incompletos' }),
        { status: 400 }
      );
    }

    // Generar número de pedido único
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const numero_pedido = `PED-${timestamp}-${random}`;

    // Crear el pedido
    const { data: pedido, error: errorPedido } = await supabaseClient
      .from('pedidos')
      .insert({
        usuario_id: userId,
        stripe_session_id,
        numero_pedido,
        subtotal: parseFloat(subtotal),
        total: parseFloat(total),
        email_cliente: email,
        telefono_cliente: telefono,
        estado: 'pagado',
        fecha_pago: new Date().toISOString()
      })
      .select()
      .single();

    if (errorPedido) {
      console.error('Error creando pedido:', errorPedido);
      return new Response(
        JSON.stringify({ error: 'Error creando pedido' }),
        { status: 500 }
      );
    }

    // Crear items del pedido
    const itemsData = cartItems.map((item: any) => ({
      pedido_id: pedido.id,
      producto_id: item.producto_id,
      producto_variante_id: item.producto_variante_id || null,
      nombre_producto: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio,
      subtotal: item.precio * item.cantidad,
      peso_kg: item.peso_kg || null
    }));

    const { error: errorItems } = await supabaseClient
      .from('pedido_items')
      .insert(itemsData);

    if (errorItems) {
      console.error('Error creando items del pedido:', errorItems);
      return new Response(
        JSON.stringify({ error: 'Error creando items del pedido' }),
        { status: 500 }
      );
    }

    // Vaciar el carrito del usuario
    await supabaseClient
      .from('carrito_items')
      .delete()
      .eq('carrito_id', (
        await supabaseClient
          .from('carritos')
          .select('id')
          .eq('usuario_id', userId)
          .single()
      ).data.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        pedido,
        numero_pedido: pedido.numero_pedido
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error en POST /api/pedidos:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
