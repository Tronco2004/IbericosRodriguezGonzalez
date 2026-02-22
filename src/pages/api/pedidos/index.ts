import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabaseClient, supabaseAdmin } from '../../../lib/supabase';
import { enviarConfirmacionPedido } from '../../../lib/email';
import { getAuthenticatedUserId } from '../../../lib/auth-helpers';

const STRIPE_SECRET_KEY = import.meta.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(STRIPE_SECRET_KEY || '');

export const prerender = false;

// GET - Obtener todos los pedidos del usuario autenticado o por email
export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    // FIX: Auth via JWT
    const { userId } = await getAuthenticatedUserId(request, cookies);
    const userEmail = request.headers.get('x-user-email');

    console.log('🔍 GET /api/pedidos - autenticado:', !!userId);

    // Determinar el email para buscar pedidos
    let emailBusqueda = userEmail;

    // Si hay userId pero no email, obtener el email del usuario desde la BD
    if ((!emailBusqueda || emailBusqueda === 'null') && userId) {
      console.log('🔍 Obteniendo email del usuario desde BD...');
      const { data: usuario, error: userError } = await supabaseAdmin
        .from('usuarios')
        .select('email')
        .eq('id', userId)
        .single();

      if (usuario?.email) {
        emailBusqueda = usuario.email;
        console.log('✅ Email obtenido de BD');
      } else {
        console.warn('⚠️ No se pudo obtener email del usuario:', userError?.message);
      }
    }

    if (!emailBusqueda || emailBusqueda === 'null') {
      console.error('❌ No se pudo determinar email para buscar pedidos');
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado o email no disponible' }),
        { status: 401 }
      );
    }

    console.log('🔍 Buscando pedidos del usuario');

    // Buscar TODOS los pedidos por email (tanto logueado como invitado)
    const { data: pedidos, error } = await supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        usuario_id,
        estado,
        subtotal,
        envio,
        impuestos,
        total,
        descuento_aplicado,
        fecha_creacion,
        fecha_pago,
        es_invitado,
        nombre_cliente,
        email_cliente,
        telefono_cliente,
        direccion_envio,
        pedido_items (
          id,
          nombre_producto,
          cantidad,
          precio_unitario,
          peso_kg
        )
      `)
      .eq('email_cliente', emailBusqueda)
      .order('fecha_creacion', { ascending: false });

    console.log('📦 Pedidos encontrados:', pedidos?.length ?? 0);

    if (error) {
      console.error('❌ Error obteniendo pedidos:', error);
      return new Response(
        JSON.stringify({ error: 'Error obteniendo pedidos: ' + error.message }),
        { status: 500 }
      );
    }

    console.log('✅ Retornando pedidos del usuario');
    return new Response(
      JSON.stringify({ 
        success: true,
        pedidos: pedidos || [] 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error en GET /api/pedidos:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};

// POST - Crear un nuevo pedido (después del pago Stripe)
// Soporta tanto usuarios logueados como invitados
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // FIX: Auth via JWT
    const { userId: jwtUserId } = await getAuthenticatedUserId(request, cookies);
    
    const {
      stripe_session_id,
      cartItems,
      total,
      subtotal,
      email,
      telefono,
      descuento_aplicado,
      // Datos para invitados
      es_invitado,
      nombre_cliente,
      email_cliente,
      telefono_cliente
    } = await request.json();

    const userId = jwtUserId;

    console.log('📦 POST /api/pedidos - Creando pedido...', { esInvitado: es_invitado });

    if (!stripe_session_id || !cartItems || !total) {
      return new Response(
        JSON.stringify({ error: 'Datos incompletos' }),
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FIX P1-8: Verificar stripe_session_id contra Stripe API
    // ═══════════════════════════════════════════════════════════
    try {
      const session = await stripe.checkout.sessions.retrieve(stripe_session_id);
      if (session.payment_status !== 'paid') {
        console.error('❌ Sesión Stripe no pagada:', session.payment_status);
        return new Response(
          JSON.stringify({ error: 'El pago no fue completado' }),
          { status: 400 }
        );
      }
      console.log('✅ Sesión Stripe verificada: payment_status =', session.payment_status);
    } catch (stripeError: any) {
      console.error('❌ Sesión Stripe inválida:', stripeError.message);
      return new Response(
        JSON.stringify({ error: 'Sesión de pago inválida' }),
        { status: 400 }
      );
    }

    // Idempotencia: verificar si ya existe pedido con este session_id
    const { data: pedidoExistente } = await supabaseAdmin
      .from('pedidos')
      .select('id, numero_pedido')
      .eq('stripe_session_id', stripe_session_id)
      .maybeSingle();

    if (pedidoExistente) {
      console.log('⚠️ Pedido ya existente para session_id:', stripe_session_id);
      return new Response(
        JSON.stringify({ success: true, pedido_id: pedidoExistente.id, numero_pedido: pedidoExistente.numero_pedido }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let emailFinal = '';
    let telefonoFinal = '';
    let nombreFinal = '';

    if (es_invitado) {
      // Pedido de invitado
      emailFinal = email_cliente || '';
      telefonoFinal = telefono_cliente || '';
      nombreFinal = nombre_cliente || '';

      if (!emailFinal) {
        return new Response(
          JSON.stringify({ error: 'Email requerido para pedidos de invitados' }),
          { status: 400 }
        );
      }
    } else {
      // Pedido de usuario logueado
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Usuario no autenticado' }),
          { status: 401 }
        );
      }

      console.log('🔍 Obteniendo datos del usuario:', userId);

      // Obtener email y teléfono del usuario desde la BD
      const { data: usuario, error: errorUsuario } = await supabaseClient
        .from('usuarios')
        .select('nombre, email, telefono')
        .eq('id', userId)
        .single();

      if (errorUsuario) {
        console.warn('⚠️  Error obteniendo datos del usuario (continuando):', errorUsuario.message);
        // Si no encontramos el usuario, usar valores por defecto
        // El usuario existe pero no está en la tabla usuarios (puede ser nuevo)
        emailFinal = `usuario-${userId}@tienda.local`;
        telefonoFinal = telefono || '';
        nombreFinal = '';
      } else if (usuario) {
        emailFinal = usuario.email || '';
        telefonoFinal = usuario.telefono || telefono || '';
        nombreFinal = usuario.nombre || '';
        console.log('✅ Usuario encontrado:', { nombre: nombreFinal });
      } else {
        console.warn('⚠️  Usuario no encontrado en BD');
        emailFinal = `usuario-${userId}@tienda.local`;
        telefonoFinal = telefono || '';
        nombreFinal = '';
      }
    }

    // Generar número de pedido correlativo con formato PED-LXXXXX (letra + 5 dígitos)
    const { data: ultimoPedidoDB } = await supabaseAdmin
      .from('pedidos')
      .select('numero_pedido')
      .like('numero_pedido', 'PED-______')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    let siguienteNum = 1;
    let letraNum = 'A';
    if (ultimoPedidoDB?.numero_pedido) {
      const matchNum = ultimoPedidoDB.numero_pedido.match(/^PED-([A-Z])(\d{5})$/);
      if (matchNum) {
        letraNum = matchNum[1];
        const num = parseInt(matchNum[2], 10);
        if (num >= 99999) {
          siguienteNum = 1;
          letraNum = String.fromCharCode(letraNum.charCodeAt(0) + 1);
          if (letraNum > 'Z') letraNum = 'A';
        } else {
          siguienteNum = num + 1;
        }
      }
    }
    const numero_pedido = `PED-${letraNum}${siguienteNum.toString().padStart(5, '0')}`;

    console.log('📋 Creando pedido con función SQL:', { numero_pedido, usuario_id: userId, es_invitado });

    // Usar función SQL para crear el pedido (con supabaseAdmin para bypasear RLS)
    const { data: pedidoResult, error: errorPedido } = await supabaseAdmin
      .rpc('crear_pedido', {
        p_stripe_session_id: stripe_session_id,
        p_numero_pedido: numero_pedido,
        p_subtotal: subtotal,
        p_total: total,
        p_nombre_cliente: nombreFinal,
        p_email_cliente: emailFinal,
        p_telefono_cliente: telefonoFinal,
        p_usuario_id: es_invitado ? null : userId,
        p_descuento_aplicado: descuento_aplicado || 0,
        p_es_invitado: es_invitado || false,
        p_envio: request.headers.get('x-envio') ? parseFloat(request.headers.get('x-envio') || '500') : 500
      });

    if (errorPedido || !pedidoResult || pedidoResult.length === 0) {
      console.error('❌ Error creando pedido:', errorPedido);
      return new Response(
        JSON.stringify({ error: 'Error creando pedido: ' + (errorPedido?.message || 'Error desconocido') }),
        { status: 500 }
      );
    }

    const pedidoInsertado = pedidoResult[0];
    if (!pedidoInsertado.success) {
      console.error('❌ Error en función SQL:', pedidoInsertado.error_msg);
      return new Response(
        JSON.stringify({ error: 'Error creando pedido: ' + pedidoInsertado.error_msg }),
        { status: 500 }
      );
    }

    const pedido_id = pedidoInsertado.pedido_id;
    console.log('✅ Pedido creado:', numero_pedido);

    // Crear items del pedido
    console.log('🔵 Insertando', cartItems?.length, 'items');
    
    const itemsData = cartItems.map((item: any) => ({
      pedido_id: pedido_id,
      producto_id: item.producto_id,
      producto_variante_id: item.producto_variante_id || null,
      nombre_producto: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio, // En centimos
      subtotal: item.precio * item.cantidad, // En centimos
      peso_kg: item.peso_kg || null
    }));

    const { error: errorItems } = await supabaseAdmin
      .from('pedido_items')
      .insert(itemsData);

    if (errorItems) {
      console.error('🔴 Error insertando items:', errorItems.message);
      return new Response(
        JSON.stringify({ error: 'Error creando items del pedido: ' + errorItems.message }),
        { status: 500 }
      );
    }

    console.log('✅ Items insertados exitosamente para pedido:', pedido_id);

    // Limpiar carrito del usuario (solo si está logueado)
    if (userId && !es_invitado) {
      console.log('🧹 Limpiando carrito para usuario:', userId);
      try {
        // Obtener carrito actual
        const { data: cartData, error: cartError } = await supabaseAdmin
          .from('carritos')
          .select('id')
          .eq('usuario_id', userId)
          .single();

        if (cartError) {
          console.warn('⚠️  No se encontró carrito para limpiar:', cartError.message);
        } else if (cartData?.id) {
          console.log('🧹 Borrando items del carrito ID:', cartData.id);
          const { error: deleteError } = await supabaseAdmin
            .from('carrito_items')
            .delete()
            .eq('carrito_id', cartData.id);
          
          if (deleteError) {
            console.error('❌ Error borrando items del carrito:', deleteError);
          } else {
            console.log('✅ Carrito limpiado exitosamente');
          }
        }
      } catch (cleanError) {
        console.error('❌ Error en limpieza de carrito:', cleanError);
        // Continuar aunque falle la limpieza
      }
    }

    // Enviar correo de confirmación
    try {
      console.log('📧 Enviando correo de confirmación...');
      console.log('📧 Items a enviar:', cartItems.length);
      
      await enviarConfirmacionPedido({
        email_cliente: emailFinal,
        numero_pedido: numero_pedido,
        fecha: new Date().toISOString(),
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
        pedido_id: pedido_id,
        numero_pedido: numero_pedido
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
