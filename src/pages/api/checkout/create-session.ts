import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthenticatedUserId } from '../../../lib/auth-helpers';

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
    const { cartItems, codigoDescuento, datosInvitado, userEmail } = await request.json();

    console.log('📦 Creando sesión Stripe...');
    console.log('Carrito items:', cartItems?.length);
    console.log('Es invitado:', !!datosInvitado);

    // ── Obtener datos del usuario desde JWT si está logueado ──
    const { userId } = await getAuthenticatedUserId(request, cookies);

    let dbUser: { nombre: string; email: string; telefono: string | null; direccion: string | null } | null = null;
    if (userId) {
      const { data } = await supabaseAdmin
        .from('usuarios')
        .select('nombre, email, telefono, direccion')
        .eq('id', userId)
        .single();
      if (data) {
        dbUser = data;
        console.log('👤 Datos del usuario obtenidos de BD');
      }
    }

    if (!cartItems || cartItems.length === 0) {
      console.error('❌ Carrito vacío');
      return new Response(
        JSON.stringify({ error: 'Carrito vacío' }),
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PRECIOS DESDE BD (nunca confiar en el cliente)
    // ═══════════════════════════════════════════════════════════
    
    // Recopilar IDs de productos y variantes
    const productoIds = [...new Set(cartItems.map((i: any) => i.producto_id).filter(Boolean))];
    const varianteIds = [...new Set(cartItems.map((i: any) => i.producto_variante_id || i.variante_id).filter(Boolean))];

    // Consultar precios reales de productos desde BD
    const { data: productosDB } = await supabaseAdmin
      .from('productos')
      .select('id, nombre, precio_centimos, imagen_url')
      .in('id', productoIds);

    // Consultar variantes si las hay
    let variantesDB: any[] = [];
    if (varianteIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('producto_variantes')
        .select('id, producto_id, precio_total, peso_kg')
        .in('id', varianteIds);
      variantesDB = data || [];
    }

    // Consultar ofertas activas para estos productos
    const ahora = new Date().toISOString();
    const { data: ofertasDB } = await supabaseAdmin
      .from('ofertas')
      .select('producto_id, precio_descuento_centimos, porcentaje_descuento')
      .in('producto_id', productoIds)
      .eq('activa', true)
      .lte('fecha_inicio', ahora)
      .gte('fecha_fin', ahora);

    // Crear mapas de lookup
    const productoMap = new Map((productosDB || []).map((p: any) => [p.id, p]));
    const varianteMap = new Map(variantesDB.map((v: any) => [v.id, v]));
    const ofertaMap = new Map((ofertasDB || []).map((o: any) => [o.producto_id, o]));

    // Construir los line items con PRECIOS DE LA BD
    const lineItems = cartItems.map((item: any) => {
      const varianteId = item.producto_variante_id || item.variante_id;
      let precioEnCentimos: number;

      if (varianteId && varianteMap.has(varianteId)) {
        // Variante: usar precio_total de la variante
        precioEnCentimos = varianteMap.get(varianteId).precio_total;
        // Aplicar descuento de oferta si existe para este producto
        const ofertaVariante = ofertaMap.get(item.producto_id);
        if (ofertaVariante?.porcentaje_descuento > 0) {
          precioEnCentimos = Math.round(precioEnCentimos * (1 - ofertaVariante.porcentaje_descuento / 100));
        }
      } else {
        // Producto simple: verificar si tiene oferta activa
        const oferta = ofertaMap.get(item.producto_id);
        const producto = productoMap.get(item.producto_id);
        
        if (oferta) {
          precioEnCentimos = oferta.precio_descuento_centimos;
        } else if (producto) {
          precioEnCentimos = producto.precio_centimos;
        } else {
          console.error('❌ Producto no encontrado en BD:', item.producto_id);
          precioEnCentimos = 0; // Se detectará como error
        }
      }

      if (precioEnCentimos <= 0) {
        console.error('❌ Precio inválido para producto:', item.producto_id, precioEnCentimos);
      }

      // Validar que la imagen sea una URL válida
      const productoDB = productoMap.get(item.producto_id);
      const imagenDB = productoDB?.imagen_url || item.imagen;
      let validImages: string[] = [];
      if (imagenDB && typeof imagenDB === 'string' && imagenDB.startsWith('http')) {
        validImages = [imagenDB];
      }
      
      const nombreProducto = productoDB?.nombre || item.nombre || 'Producto sin nombre';

      console.log('💰 Item Stripe:', { 
        nombre: nombreProducto, 
        precio_bd_centimos: precioEnCentimos,
        cantidad: item.cantidad,
        total_item: precioEnCentimos * item.cantidad
      });
      
      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: nombreProducto,
            description: item.peso_kg ? `Peso: ${item.peso_kg} kg` : undefined,
            images: validImages.length > 0 ? validImages : undefined,
          },
          unit_amount: Math.round(precioEnCentimos),
        },
        quantity: item.cantidad,
      };
    });

    // Verificar que todos los precios son válidos
    const itemInvalido = lineItems.find((li: any) => !li.price_data.unit_amount || li.price_data.unit_amount <= 0);
    if (itemInvalido) {
      return new Response(
        JSON.stringify({ error: 'Uno o más productos no tienen precio válido en la base de datos' }),
        { status: 400 }
      );
    }

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

    console.log('📋 Line items para Stripe:', lineItems.length, 'items');

    // ═══════════════════════════════════════════════════════════
    // DESCUENTO VALIDADO DESDE BD (nunca confiar en el cliente)
    // ═══════════════════════════════════════════════════════════
    let discounts: { coupon: string }[] = [];
    if (codigoDescuento && typeof codigoDescuento === 'string') {
      try {
        // Validar código promocional contra la BD
        const { data: codigoDB } = await supabaseAdmin
          .from('codigos_promocionales')
          .select('id, codigo, tipo_descuento, valor_descuento, uso_maximo, usos_actuales, fecha_inicio, fecha_fin, activo, restriccion_monto_minimo')
          .eq('codigo', codigoDescuento.trim().toUpperCase())
          .eq('activo', true)
          .single();

        if (!codigoDB) {
          console.warn('⚠️ Código promocional no encontrado o inactivo:', codigoDescuento);
        } else {
          const ahoraDate = new Date();
          const inicioOk = new Date(codigoDB.fecha_inicio) <= ahoraDate;
          const finOk = new Date(codigoDB.fecha_fin) >= ahoraDate;
          const usosOk = !codigoDB.uso_maximo || codigoDB.usos_actuales < codigoDB.uso_maximo;

          if (!inicioOk || !finOk) {
            console.warn('⚠️ Código promocional fuera de fechas:', codigoDescuento);
          } else if (!usosOk) {
            console.warn('⚠️ Código promocional agotado:', codigoDescuento);
          } else {
            // Calcular subtotal en euros para verificar monto mínimo
            const subtotalEuros = lineItems
              .filter((_: any, i: number) => i < lineItems.length - 1) // excluir envío
              .reduce((sum: number, li: any) => sum + (li.price_data.unit_amount * li.quantity) / 100, 0);

            if (codigoDB.restriccion_monto_minimo && subtotalEuros < codigoDB.restriccion_monto_minimo) {
              console.warn('⚠️ Monto mínimo no alcanzado:', subtotalEuros, '<', codigoDB.restriccion_monto_minimo);
            } else {
              // Calcular descuento real desde BD
              let descuentoCentimos: number;
              if (codigoDB.tipo_descuento === 'porcentaje') {
                const subtotalCentimos = lineItems
                  .filter((_: any, i: number) => i < lineItems.length - 1)
                  .reduce((sum: number, li: any) => sum + li.price_data.unit_amount * li.quantity, 0);
                descuentoCentimos = Math.round(subtotalCentimos * codigoDB.valor_descuento / 100);
              } else {
                // tipo fijo: valor_descuento está en euros
                descuentoCentimos = Math.round(codigoDB.valor_descuento * 100);
              }

              console.log('🎁 Descuento validado desde BD:', { codigo: codigoDB.codigo, tipo: codigoDB.tipo_descuento, descuentoCentimos });
              
              const coupon = await stripe.coupons.create({
                duration: 'once',
                amount_off: descuentoCentimos,
                currency: 'eur',
                name: codigoDB.codigo
              });

              discounts = [{ coupon: coupon.id }];
              console.log('✅ Cupón Stripe creado:', coupon.id);
            }
          }
        }
      } catch (couponError: any) {
        console.error('❌ Error procesando descuento:', couponError.message);
        // Continuar sin descuento
      }
    }

    // Determinar email del cliente (prioridad: BD > frontend > invitado)
    let customerEmail: string | undefined;
    
    if (dbUser?.email) {
      // Usuario logueado: obtener email de la BD (fuente fiable)
      customerEmail = dbUser.email;
      console.log('👤 Email: usuario BD');
    } else if (datosInvitado?.email) {
      // Es invitado
      customerEmail = datosInvitado.email;
      console.log('👻 Email: invitado');
    } else if (userEmail) {
      // Fallback: email enviado desde el frontend
      customerEmail = userEmail;
      console.log('📧 Email: frontend');
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

    // ── Determinar si el usuario ya tiene dirección guardada ──
    const tieneNombre = !!(dbUser?.nombre || datosInvitado?.nombre);
    const tieneDireccion = !!(dbUser?.direccion || datosInvitado?.direccion);
    const nombreCliente = dbUser?.nombre || datosInvitado?.nombre || '';
    const telefonoCliente = dbUser?.telefono || datosInvitado?.telefono || '';
    const direccionCliente = dbUser?.direccion || datosInvitado?.direccion || '';

    console.log('📍 Dirección guardada:', direccionCliente, '| Tiene dirección:', tieneDireccion);

    // Configurar la sesión de Stripe
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: `${new URL(request.url).origin}/carrito`,
      customer_email: customerEmail,
      ...(discounts.length > 0 && { discounts }),
      // Guardar metadata para identificar invitados y datos del cliente
      metadata: {
        es_invitado: datosInvitado ? 'true' : 'false',
        nombre_cliente: nombreCliente,
        telefono_cliente: telefonoCliente,
        direccion_cliente: direccionCliente
      }
    };

    // Si el usuario YA tiene dirección guardada, no pedirla de nuevo en Stripe
    if (tieneDireccion && tieneNombre) {
      console.log('✅ Usuario con dirección completa, no se pedirá en Stripe');
      sessionConfig.payment_intent_data = {
        shipping: {
          name: nombreCliente,
          phone: telefonoCliente || undefined,
          address: {
            line1: direccionCliente,
            country: 'ES', // Por defecto España
          }
        }
      };
    } else {
      // Si NO tiene dirección, pedirla en Stripe
      console.log('📝 Usuario sin dirección completa, se pedirá en Stripe');
      sessionConfig.shipping_address_collection = {
        allowed_countries: ['ES', 'PT', 'FR', 'DE', 'IT', 'GB', 'AD'],
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('✅ Sesión Stripe creada');

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
