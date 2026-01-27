import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabaseClient } from '../../../lib/supabase';
import { enviarConfirmacionPedido } from '../../../lib/email';

const STRIPE_SECRET_KEY = import.meta.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(STRIPE_SECRET_KEY || '');

// Constante para el envío
const SHIPPING_COST = 5.00; // 5€

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('\n✅ ======= [VALIDAR Y CREAR PEDIDO] INICIADO =======');
    
    const { sessionId, userId, userEmail, cartItems, codigoDescuento, descuentoAplicado, datosInvitado } = await request.json();

    if (!sessionId) {
      console.error('❌ No hay sessionId');
      return new Response(JSON.stringify({ error: 'No hay sessionId' }), { status: 400 });
    }

    console.log('📝 Parámetros recibidos:', {
      sessionId,
      userId,
      userEmail,
      numItems: cartItems?.length,
      esInvitado: !!datosInvitado
    });

    // Obtener la sesión de Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log('📋 Sesión Stripe completa:', {
      id: session.id,
      payment_status: session.payment_status,
      customer_email: session.customer_email,
      customer: session.customer,
      metadata: session.metadata
    });
    
    if (session.payment_status !== 'paid') {
      console.error('❌ El pago no fue completado. Estado:', session.payment_status);
      return new Response(
        JSON.stringify({ error: 'El pago no fue completado', status: session.payment_status }),
        { status: 400 }
      );
    }

    console.log('✅ Pago confirmado en Stripe');

    // Determinar email
    let customerEmail = session.customer_email;
    if (!customerEmail) {
      if (datosInvitado?.email) {
        customerEmail = datosInvitado.email;
      } else if (userEmail) {
        customerEmail = userEmail;
      }
    }

    if (!customerEmail) {
      console.error('❌ No hay email del cliente disponible');
      return new Response(
        JSON.stringify({ error: 'No hay email del cliente' }),
        { status: 400 }
      );
    }

    console.log('📧 Email del cliente:', customerEmail);
    console.log('👤 UserId:', userId || 'Sin usuario (invitado)');

    // Calcular totales (todos en centimos)
    const subtotalCentimos = cartItems.reduce((sum: number, item: any) => {
      // Detectar si el precio está en centimos o euros
      let price = parseFloat(item.precio) || 0;
      // Si el precio es menor a 500, probablemente está en euros, convertir a centimos
      if (price < 500) {
        price = Math.round(price * 100);
      }
      return sum + (price * (item.cantidad || 1));
    }, 0);

    const envioCentimos = Math.round(SHIPPING_COST * 100); // 500 centimos
    const descuentoCentimos = descuentoAplicado ? descuentoAplicado : 0; // ya en centimos
    const totalCentimos = (subtotalCentimos + envioCentimos) - descuentoCentimos;

    // Convertir a euros para guardar
    const subtotal = subtotalCentimos / 100;
    const envio = envioCentimos / 100;
    const descuento = descuentoCentimos / 100;
    const total = totalCentimos / 100;

    console.log('💰 Cálculo de totales:', {
      subtotal: subtotal.toFixed(2),
      envio: envio.toFixed(2),
      total: total.toFixed(2)
    });

    // Generar número de pedido único
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const numeroPedido = `PED-${timestamp}-${random}`;

    console.log('📝 Número de pedido generado:', numeroPedido);

    // ✅ CREAR PEDIDO DIRECTAMENTE con subtotal inicial en 0
    const { data: pedidoCreado, error: pedidoError } = await supabaseClient
      .from('pedidos')
      .insert({
        usuario_id: userId || null, // null si es invitado
        stripe_session_id: sessionId,
        numero_pedido: numeroPedido,
        estado: 'confirmado',
        subtotal: 0, // Será actualizado después de insertar items
        envio: envio, // En euros
        impuestos: 0,
        total: envio, // Será actualizado después de insertar items
        email_cliente: customerEmail,
        telefono_cliente: datosInvitado?.telefono || null,
        fecha_pago: new Date().toISOString(),
        es_invitado: !userId // true si no hay userId
      })
      .select('id');

    if (pedidoError || !pedidoCreado || pedidoCreado.length === 0) {
      console.error('❌ Error creando pedido:', pedidoError);
      return new Response(
        JSON.stringify({ error: 'Error al crear pedido en BD', details: pedidoError }),
        { status: 500 }
      );
    }

    const pedidoId = pedidoCreado[0].id;
    console.log('✅ Pedido creado. ID:', pedidoId);

    // ✅ CREAR ITEMS DEL PEDIDO
    const itemsData = cartItems.map((item: any) => {
      // Detectar si el precio está en centimos o euros
      let precio = parseFloat(item.precio) || 0;
      // Si el precio es menor a 500, probablemente está en euros, convertir a centimos
      if (precio < 500) {
        precio = Math.round(precio * 100);
      }
      // Convertir centimos a euros para guardar en BD
      const precioUnitarioEuros = precio / 100;

      return {
        pedido_id: pedidoId,
        producto_id: item.producto_id,
        producto_variante_id: item.producto_variante_id || item.variante_id || null,
        nombre_producto: item.nombre,
        cantidad: item.cantidad || 1,
        precio_unitario: precioUnitarioEuros,
        subtotal: precioUnitarioEuros * (item.cantidad || 1),
        peso_kg: item.peso_kg || null
      };
    });

    const { data: itemsCreated, error: itemsError } = await supabaseClient
      .from('pedido_items')
      .insert(itemsData)
      .select();

    if (itemsError) {
      console.error('❌ Error creando items:', itemsError);
      return new Response(
        JSON.stringify({ error: 'Error al crear items del pedido', details: itemsError }),
        { status: 500 }
      );
    }

    console.log(`✅ ${itemsCreated?.length || 0} items creados`);

    // ✅ RECALCULAR SUBTOTAL Y TOTAL DEL PEDIDO basado en items insertados
    const subtotalCalculado = itemsCreated?.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0) || 0;
    const totalCalculado = subtotalCalculado + envio;

    console.log('💰 Recálculo de totales después de insertar items:', {
      subtotal: subtotalCalculado.toFixed(2),
      envio: envio.toFixed(2),
      total: totalCalculado.toFixed(2)
    });

    // ✅ ACTUALIZAR EL PEDIDO CON LOS TOTALES CORRECTOS
    const { error: updateError } = await supabaseClient
      .from('pedidos')
      .update({
        subtotal: subtotalCalculado,
        total: totalCalculado
      })
      .eq('id', pedidoId);

    if (updateError) {
      console.error('⚠️ Error actualizando totales del pedido:', updateError);
      // Continuar aunque falle la actualización
    } else {
      console.log('✅ Totales del pedido actualizados correctamente');
    }

    // 🎁 ENVIAR EMAIL DE CONFIRMACIÓN
    console.log('📧 Enviando email de confirmación...');
    try {
      await enviarConfirmacionPedido({
        email_cliente: customerEmail,
        numero_pedido: numeroPedido,
        fecha: new Date().toISOString(),
        items: cartItems.map((item: any) => ({
          nombre: item.nombre,
          cantidad: item.cantidad || 1,
          precio: item.precio || item.precio_unitario || 0,
          peso_kg: item.peso_kg
        })),
        subtotal: Math.round(subtotalCalculado * 100), // Convertir a centimos para email
        envio: Math.round(envio * 100), // Convertir a centimos para email
        total: Math.round(totalCalculado * 100) // Convertir a centimos para email
      });
      console.log('✅ Email de confirmación enviado');
    } catch (emailError) {
      console.error('⚠️ Error enviando email (no bloqueante):', emailError);
    }

    console.log('✅ ======= [VALIDAR Y CREAR PEDIDO] COMPLETADO =======\n');

    return new Response(
      JSON.stringify({
        success: true,
        pedidoId: pedidoId,
        numeroPedido: numeroPedido,
        total: totalCalculado,
        message: 'Pedido creado exitosamente'
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error en validar-y-crear-pedido:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error al procesar pedido', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    );
  }
};
