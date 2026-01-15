import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '');
const SHIPPING_COST = 500; // 5€ en centimos

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Obtener el carrito del cliente
    const { cartItems, codigoDescuento, descuentoAplicado } = await request.json();

    if (!cartItems || cartItems.length === 0) {
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

    // Agregar descuento si existe
    let discounts = [];
    if (descuentoAplicado && descuentoAplicado > 0) {
      // Crear un cupón en Stripe para aplicar el descuento
      const coupon = await stripe.coupons.create({
        duration: 'once',
        amount_off: Math.round(descuentoAplicado * 100), // Convertir a centimos
        currency: 'eur',
        name: codigoDescuento || 'Descuento'
      });

      discounts = [{ coupon: coupon.id }];
    }

    // Crear sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: 'payment',
      success_url: `${new URL(request.url).origin}/checkout/exito?session_id={CHECKOUT_SESSION_ID}${codigoDescuento ? `&codigo=${codigoDescuento}` : ''}`,
      cancel_url: `${new URL(request.url).origin}/carrito`,
      customer_email: cookies.get('user_email')?.value,
      ...(discounts.length > 0 && { discounts })
    });

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
    console.error('Error creando sesión Stripe:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error creando sesión de pago' }),
      { status: 500 }
    );
  }
};
