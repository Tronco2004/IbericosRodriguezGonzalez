import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';
import { enviarConfirmacionPedido } from '../../../lib/email';

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

    // Obtener email y teléfono del usuario desde la BD
    const { data: usuario, error: errorUsuario } = await supabaseClient
      .from('usuarios')
      .select('email, telefono')
      .eq('id', userId)
      .single();

    if (errorUsuario || !usuario) {
      console.error('Error obteniendo datos del usuario:', errorUsuario);
      return new Response(
        JSON.stringify({ error: 'Error obteniendo datos del usuario' }),
        { status: 500 }
      );
    }

    const emailCliente = usuario.email;
    const telefonoCliente = usuario.telefono || telefono || '';

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
        email_cliente: emailCliente,
        telefono_cliente: telefonoCliente,
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

    const { data: cartData } = await supabaseClient
      .from('carritos')
      .select('id')
      .eq('usuario_id', userId)
      .single();

    if (cartData?.id) {
      await supabaseClient
        .from('carrito_items')
        .delete()
        .eq('carrito_id', cartData.id);
    }

    // Enviar correo de confirmación
    try {
      console.log('📧 Enviando correo de confirmación...');
      console.log('📧 Email del cliente:', emailCliente);
      console.log('📧 Items a enviar:', cartItems.length);
      
      await enviarConfirmacionPedido({
        email_cliente: emailCliente,
        numero_pedido: pedido.numero_pedido,
        fecha: pedido.fecha_pago,
        items: cartItems.map((item: any) => ({
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio: item.precio,
          peso_kg: item.peso_kg
        })),
        subtotal: parseFloat(subtotal),
        envio: request.headers.get('x-envio') ? parseFloat(request.headers.get('x-envio') || '0') : 500,
        total: parseFloat(total)
      });
      console.log('✅ Correo enviado exitosamente');
    } catch (emailError) {
      console.error('❌ Error enviando correo:', emailError);
      // No fallar la transacción si el email falla
    }

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
