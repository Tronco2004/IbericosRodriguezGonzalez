import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '');
const SHIPPING_COST = 500; // 5€ en centimos

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Obtener el carrito del cliente (con posibles datos de invitado)
    const { cartItems, codigoDescuento, descuentoAplicado, datosInvitado } = await request.json();

    console.log('📦 Creando sesión Stripe...');
    console.log('Carrito items:', cartItems);
    console.log('Descuento aplicado:', descuentoAplicado);
    console.log('Es invitado:', !!datosInvitado);

    if (!cartItems || cartItems.length === 0) {
      console.error('❌ Carrito vacío');
      return new Response(
        JSON.stringify({ error: 'Carrito vacío' }),
        { status: 400 }
      );
    }

    // Construir los line items para Stripe
    const lineItems = cartItems.map((item: any) => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.nombre,
          description: item.peso_kg ? `Peso: ${item.peso_kg} kg` : undefined,
          images: item.imagen ? [item.imagen] : [],
        },
        unit_amount: Math.round(item.precio), // El precio ya está en centimos desde la BD
      },
      quantity: item.cantidad,
    }));

    // Agregar envío como un line item
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: {
          name: 'Envío',
          description: 'Costo de envío',
        },
        unit_amount: SHIPPING_COST,
      },
      quantity: 1,
    });

    console.log('📋 Line items para Stripe:', JSON.stringify(lineItems, null, 2));

    // Agregar descuento si existe
    let discounts: { coupon: string }[] = [];
    if (descuentoAplicado && descuentoAplicado > 0) {
      try {
        // Crear un cupón en Stripe para aplicar el descuento
        console.log('🎁 Creando cupón con descuento:', descuentoAplicado);
        const coupon = await stripe.coupons.create({
          duration: 'once',
          amount_off: Math.round(descuentoAplicado * 100), // Convertir a centimos
          currency: 'eur',
          name: codigoDescuento || 'Descuento'
        });

        console.log('✅ Cupón creado:', coupon.id);
        discounts = [{ coupon: coupon.id }];
      } catch (couponError: any) {
        console.error('❌ Error creando cupón:', couponError.message);
        // Continuar sin descuento
      }
    }

    // Determinar email del cliente (invitado o usuario logueado)
    const customerEmail = datosInvitado?.email || cookies.get('user_email')?.value;

    // Crear sesión de Stripe
    console.log('🔗 Creando sesión Stripe...');
    console.log('📧 Email del cliente:', customerEmail);

    // Construir URL de éxito con parámetro de invitado si aplica
    let successUrl = `${new URL(request.url).origin}/checkout/exito?session_id={CHECKOUT_SESSION_ID}`;
    if (codigoDescuento) {
      successUrl += `&codigo=${codigoDescuento}`;
    }
    if (datosInvitado) {
      successUrl += '&guest=true';
    }

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: `${new URL(request.url).origin}/carrito`,
      customer_email: customerEmail,
      ...(discounts.length > 0 && { discounts }),
      // Guardar metadata para identificar invitados
      metadata: {
        es_invitado: datosInvitado ? 'true' : 'false',
        nombre_cliente: datosInvitado?.nombre || '',
        telefono_cliente: datosInvitado?.telefono || ''
      }
    });

    console.log('✅ Sesión creada exitosamente:', session.id);
    console.log('🔗 URL de Stripe:', session.url);

    return new Response(
      JSON.stringify({ 
        success: true,
        sessionId: session.id,
        url: session.url 
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('❌ Error creando sesión Stripe:', error.message || error);
    console.error('Detalles del error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error creando sesión de pago' }),
      { status: 500 }
    );
  }
};
