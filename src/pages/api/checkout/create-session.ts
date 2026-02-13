import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = import.meta.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY no está configurada');
}

const stripe = new Stripe(STRIPE_SECRET_KEY || '');
const SHIPPING_COST = 500; // 5€ en centimos

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Validar que STRIPE_SECRET_KEY existe
    if (!STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY no está configurada en variables de entorno');
      return new Response(
        JSON.stringify({ error: 'Configuración de pago no disponible. Contacta soporte.' }),
        { status: 500 }
      );
    }

    // Obtener el carrito del cliente (con posibles datos de invitado)
    const { cartItems, codigoDescuento, descuentoAplicado, datosInvitado, userEmail } = await request.json();

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
    const lineItems = cartItems.map((item: any) => {
      // El precio unitario ya está en centimos desde la BD
      let precioEnCentimos = item.precio;
      
      // FIX: Si el precio está muy alto (> 100000), dividir por 100
      // (esto significa que fue guardado mal multiplicado por 100)
      if (precioEnCentimos > 100000) {
        precioEnCentimos = Math.round(precioEnCentimos / 100);
        console.log('⚠️  Precio demasiado alto, dividiendo:', { original: item.precio, corregido: precioEnCentimos });
      }
      
      // Validar que la imagen sea una URL válida
      let validImages: string[] = [];
      if (item.imagen && typeof item.imagen === 'string' && item.imagen.startsWith('http')) {
        validImages = [item.imagen];
      }
      
      console.log('💰 Item Stripe:', { 
        nombre: item.nombre, 
        precio_unitario_centimos: precioEnCentimos,
        cantidad: item.cantidad,
        total_item: precioEnCentimos * item.cantidad,
        imagen: item.imagen,
        imagenes_válidas: validImages
      });
      
      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.nombre || 'Producto sin nombre',
            description: item.peso_kg ? `Peso: ${item.peso_kg} kg` : undefined,
            images: validImages.length > 0 ? validImages : undefined,
          },
          unit_amount: Math.round(precioEnCentimos), // Precio unitario en centimos
        },
        quantity: item.cantidad, // Cantidad multiplica el unit_amount automáticamente
      };
    });

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

    // Determinar email del cliente
    let customerEmail: string | undefined;
    
    if (datosInvitado?.email) {
      // Es invitado
      customerEmail = datosInvitado.email;
      console.log('👻 Invitado - Email:', customerEmail);
    } else if (userEmail) {
      // Es usuario logueado
      customerEmail = userEmail;
      console.log('👤 Usuario logueado - Email:', customerEmail);
    }

    if (!customerEmail) {
      return new Response(
        JSON.stringify({ error: 'Email del cliente no disponible' }),
        { status: 400 }
      );
    }

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
      // Recoger dirección de envío
      shipping_address_collection: {
        allowed_countries: ['ES', 'PT', 'FR', 'DE', 'IT', 'GB', 'AD'],
      },
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
    console.error('❌ Error creando sesión Stripe:', error);
    console.error('Stack:', error?.stack);
    console.error('Mensaje:', error?.message);
    
    // Log más detalles del error de Stripe
    if (error?.type) {
      console.error('Tipo de error Stripe:', error.type);
    }
    if (error?.param) {
      console.error('Parámetro problemático:', error.param);
    }
    if (error?.requestId) {
      console.error('Request ID:', error.requestId);
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Error creando sesión de pago',
        type: error.type,
        param: error.param
      }),
      { status: 500 }
    );
  }
};
