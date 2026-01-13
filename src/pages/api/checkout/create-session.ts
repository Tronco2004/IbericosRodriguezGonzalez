import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '');

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Obtener el carrito del cliente
    const { cartItems } = await request.json();

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
        unit_amount: Math.round(item.precio * 100), // Stripe usa centavos
      },
      quantity: item.cantidad,
    }));

    // Crear sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: 'payment',
      success_url: `${new URL(request.url).origin}/checkout/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${new URL(request.url).origin}/carrito`,
      customer_email: cookies.get('user_email')?.value,
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
