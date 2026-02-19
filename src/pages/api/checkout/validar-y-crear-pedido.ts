import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabaseClient, supabaseAdmin } from '../../../lib/supabase';
import { enviarConfirmacionPedido } from '../../../lib/email';
import { getAuthenticatedUserId } from '../../../lib/auth-helpers';

const STRIPE_SECRET_KEY = import.meta.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(STRIPE_SECRET_KEY || '');

// Constante para el envío
const SHIPPING_COST = 5.00; // 5€

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    console.log('\n✅ ======= [VALIDAR Y CREAR PEDIDO] INICIADO =======');
    
    const { sessionId, cartItems, codigoDescuento, datosInvitado } = await request.json();

    if (!sessionId) {
      console.error('❌ No hay sessionId');
      return new Response(JSON.stringify({ error: 'No hay sessionId' }), { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════
    // IDEMPOTENCIA: verificar si ya existe un pedido con este session_id
    // ═══════════════════════════════════════════════════════════
    const { data: pedidoExistente } = await supabaseAdmin
      .from('pedidos')
      .select('id, numero_pedido, total, codigo_seguimiento')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();

    if (pedidoExistente) {
      console.log('⚠️ Pedido ya existente para session_id:', sessionId, '→', pedidoExistente.numero_pedido);
      return new Response(
        JSON.stringify({
          success: true,
          pedidoId: pedidoExistente.id,
          numeroPedido: pedidoExistente.numero_pedido,
          codigoSeguimiento: pedidoExistente.codigo_seguimiento,
          total: pedidoExistente.total,
          message: 'Pedido ya existente (idempotente)'
        }),
        { status: 200 }
      );
    }

    // ── Auth: obtener userId desde JWT (no de header) ──
    const { userId: jwtUserId } = await getAuthenticatedUserId(request, cookies);

    console.log('📝 Parámetros recibidos:', {
      numItems: cartItems?.length,
      esInvitado: !!datosInvitado
    });

    // Obtener la sesión de Stripe (shipping_details se incluye automáticamente)
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log('📋 Sesión Stripe - payment_status:', session.payment_status);
    
    if (session.payment_status !== 'paid') {
      console.error('❌ El pago no fue completado. Estado:', session.payment_status);
      return new Response(
        JSON.stringify({ error: 'El pago no fue completado', status: session.payment_status }),
        { status: 400 }
      );
    }

    console.log('✅ Pago confirmado en Stripe');

    // Obtener email del usuario autenticado (si existe) para usarlo como fallback
    let authUserEmail: string | null = null;
    if (jwtUserId) {
      const { data: authUsuario } = await supabaseAdmin
        .from('usuarios')
        .select('email')
        .eq('id', jwtUserId)
        .single();
      if (authUsuario?.email) authUserEmail = authUsuario.email;
    }

    // Determinar email
    let customerEmail = session.customer_email;
    if (!customerEmail) {
      if (datosInvitado?.email) {
        customerEmail = datosInvitado.email;
      } else if (authUserEmail) {
        customerEmail = authUserEmail;
      }
    }

    if (!customerEmail) {
      console.error('❌ No hay email del cliente disponible');
      return new Response(
        JSON.stringify({ error: 'No hay email del cliente' }),
        { status: 400 }
      );
    }

    console.log('� Usuario:', jwtUserId ? 'autenticado' : 'invitado');

    // ✅ BUSCAR SI EXISTE UN USUARIO CON ESTE EMAIL (para vincular pedidos de invitados)
    let finalUserId = jwtUserId;
    let esInvitado = !jwtUserId;
    let usuarioDatos: any = {};
    
    if (finalUserId) {
      // Usuario logueado: obtener sus datos (incluyendo dirección)
      console.log('👤 Obteniendo datos del usuario logueado');
      const { data: usuario, error: errorUsuario } = await supabaseClient
        .from('usuarios')
        .select('nombre, email, telefono, direccion')
        .eq('id', finalUserId)
        .single();
      
      if (!errorUsuario && usuario) {
        usuarioDatos = usuario;
        console.log('✅ Datos del usuario obtenidos');
      }
    } else if (!jwtUserId && customerEmail) {
      console.log('🔍 Buscando usuario existente por email');
      const { data: usuarioExistente, error: errorBusqueda } = await supabaseClient
        .from('usuarios')
        .select('id, nombre, email, telefono, direccion')
        .eq('email', customerEmail)
        .single();
      
      if (!errorBusqueda && usuarioExistente) {
        console.log('✅ Usuario encontrado. Vinculando pedido.');
        finalUserId = usuarioExistente.id;
        esInvitado = false; // Ya no es invitado, tiene cuenta
        usuarioDatos = usuarioExistente;
      } else {
        console.log('ℹ️ No se encontró usuario con este email. Será pedido de invitado.');
      }
    }

    // ═══════════════════════════════════════════════════════════
    // CALCULAR TOTALES DESDE BD (no confiar en el cliente)
    // ═══════════════════════════════════════════════════════════
    
    // Obtener precios reales de la BD
    const productoIds = [...new Set(cartItems.map((i: any) => i.producto_id).filter(Boolean))];
    const varianteIds = [...new Set(cartItems.map((i: any) => i.producto_variante_id || i.variante_id).filter(Boolean))];

    const { data: productosDB } = await supabaseAdmin
      .from('productos')
      .select('id, precio_centimos')
      .in('id', productoIds);

    let variantesDB: any[] = [];
    if (varianteIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('producto_variantes')
        .select('id, producto_id, precio_total')
        .in('id', varianteIds);
      variantesDB = data || [];
    }

    // Ofertas activas
    const ahora = new Date().toISOString();
    const { data: ofertasDB } = await supabaseAdmin
      .from('ofertas')
      .select('producto_id, precio_descuento_centimos')
      .in('producto_id', productoIds)
      .eq('activa', true)
      .lte('fecha_inicio', ahora)
      .gte('fecha_fin', ahora);

    const productoMap = new Map((productosDB || []).map((p: any) => [p.id, p]));
    const varianteMap = new Map(variantesDB.map((v: any) => [v.id, v]));
    const ofertaMap = new Map((ofertasDB || []).map((o: any) => [o.producto_id, o]));

    // Calcular subtotal con precios de BD
    let subtotalCentimos = 0;
    for (const item of cartItems) {
      const varianteId = item.producto_variante_id || item.variante_id;
      let precioCentimos: number;
      
      if (varianteId && varianteMap.has(varianteId)) {
        precioCentimos = varianteMap.get(varianteId).precio_total;
      } else {
        const oferta = ofertaMap.get(item.producto_id);
        const producto = productoMap.get(item.producto_id);
        precioCentimos = oferta?.precio_descuento_centimos ?? producto?.precio_centimos ?? 0;
      }
      
      subtotalCentimos += precioCentimos * (item.cantidad || 1);
    }

    const envioCentimos = Math.round(SHIPPING_COST * 100); // 500 centimos
    
    // Validar descuento desde BD si hay código
    let descuentoCentimos = 0;
    if (codigoDescuento && typeof codigoDescuento === 'string') {
      const { data: codigoDB } = await supabaseAdmin
        .from('codigos_promocionales')
        .select('tipo_descuento, valor_descuento, uso_maximo, usos_actuales, fecha_inicio, fecha_fin, activo')
        .eq('codigo', codigoDescuento.trim().toUpperCase())
        .eq('activo', true)
        .single();

      if (codigoDB) {
        const ahoraDate = new Date();
        const valido = new Date(codigoDB.fecha_inicio) <= ahoraDate && 
                       new Date(codigoDB.fecha_fin) >= ahoraDate &&
                       (!codigoDB.uso_maximo || codigoDB.usos_actuales < codigoDB.uso_maximo);
        if (valido) {
          if (codigoDB.tipo_descuento === 'porcentaje') {
            descuentoCentimos = Math.round(subtotalCentimos * codigoDB.valor_descuento / 100);
          } else {
            descuentoCentimos = Math.round(codigoDB.valor_descuento * 100);
          }
        }
      }
    }
    
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

    // Construir dirección de envío desde Stripe o datos del usuario
    let direccionEnvio: string | null = null;
    const shipping = session.shipping_details;
    if (shipping?.address) {
      const a = shipping.address;
      const partes = [a.line1, a.line2, a.postal_code, a.city, a.state, a.country].filter(Boolean);
      direccionEnvio = partes.join(', ');
      if (shipping.name) direccionEnvio = shipping.name + ' - ' + direccionEnvio;
    }
    if (!direccionEnvio) {
      direccionEnvio = datosInvitado?.direccion || usuarioDatos?.direccion || null;
    }

    // ✅ CREAR PEDIDO DIRECTAMENTE con subtotal inicial en 0
    // Usar supabaseAdmin para bypasear RLS (endpoint server-side)
    const { data: pedidoCreado, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .insert({
        usuario_id: finalUserId || null,
        stripe_session_id: sessionId,
        numero_pedido: numeroPedido,
        estado: 'pagado',
        subtotal: 0,
        envio: envio,
        impuestos: 0,
        total: envio,
        email_cliente: customerEmail,
        telefono_cliente: datosInvitado?.telefono || usuarioDatos?.telefono || null,
        direccion_envio: direccionEnvio,
        fecha_pago: new Date().toISOString(),
        es_invitado: esInvitado
      })
      .select('id');

    if (pedidoError || !pedidoCreado || pedidoCreado.length === 0) {
      console.error('❌ Error creando pedido:', pedidoError);
      console.error('❌ Código error:', pedidoError?.code);
      console.error('❌ Mensaje error:', pedidoError?.message);
      console.error('❌ Detalles error:', pedidoError?.details);
      console.error('❌ Hint error:', pedidoError?.hint);
      return new Response(
        JSON.stringify({ error: 'Error al crear pedido en BD', details: pedidoError }),
        { status: 500 }
      );
    }

    const pedidoId = pedidoCreado[0].id;
    console.log('✅ Pedido creado. ID:', pedidoId);

    // ✅ CREAR ITEMS DEL PEDIDO (con precios de BD)
    const itemsData = cartItems.map((item: any) => {
      const varianteId = item.producto_variante_id || item.variante_id || null;
      let precioCentimos: number;
      
      if (varianteId && varianteMap.has(varianteId)) {
        precioCentimos = varianteMap.get(varianteId).precio_total;
      } else {
        const oferta = ofertaMap.get(item.producto_id);
        const producto = productoMap.get(item.producto_id);
        precioCentimos = oferta?.precio_descuento_centimos ?? producto?.precio_centimos ?? 0;
      }
      
      const precioUnitarioEuros = precioCentimos / 100;

      return {
        pedido_id: pedidoId,
        producto_id: item.producto_id,
        producto_variante_id: varianteId,
        nombre_producto: item.nombre,
        cantidad: item.cantidad || 1,
        precio_unitario: precioUnitarioEuros,
        subtotal: precioUnitarioEuros * (item.cantidad || 1),
        peso_kg: item.peso_kg || null
      };
    });

    const { data: itemsCreated, error: itemsError } = await supabaseAdmin
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

    // ✅ ELIMINAR VARIANTES VENDIDAS DE LA BD
    // El stock de productos normales ya se restó al añadir al carrito
    for (const item of cartItems) {
      if (item.producto_variante_id) {
        // Producto con variante: eliminar la variante de la BD
        console.log('🗑️ Eliminando variante vendida:', item.producto_variante_id);
        const { error: deleteError } = await supabaseAdmin
          .from('producto_variantes')
          .delete()
          .eq('id', item.producto_variante_id);
        
        if (deleteError) {
          console.warn('⚠️ Error eliminando variante:', item.producto_variante_id, deleteError);
        } else {
          console.log('✅ Variante eliminada:', item.producto_variante_id);
        }
      }
      // Productos normales: el stock ya se descontó al añadir al carrito
    }

    // ✅ VACIAR EL CARRITO DEL USUARIO (si tiene cuenta)
    if (finalUserId) {
      console.log('🗑️ Vaciando carrito del usuario:', finalUserId);
      
      // Obtener el carrito del usuario
      const { data: carrito } = await supabaseAdmin
        .from('carritos')
        .select('id')
        .eq('usuario_id', finalUserId)
        .single();
      
      if (carrito) {
        // Eliminar todos los items del carrito
        const { error: deleteItemsError } = await supabaseAdmin
          .from('carrito_items')
          .delete()
          .eq('carrito_id', carrito.id);
        
        if (deleteItemsError) {
          console.warn('⚠️ Error eliminando items del carrito:', deleteItemsError);
        } else {
          console.log('✅ Items del carrito eliminados');
        }
      }
    }

    // ✅ RECALCULAR SUBTOTAL Y TOTAL DEL PEDIDO basado en items insertados
    const subtotalCalculado = itemsCreated?.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0) || 0;
    const totalCalculado = subtotalCalculado + envio;

    console.log('💰 Recálculo de totales después de insertar items:', {
      subtotal: subtotalCalculado.toFixed(2),
      envio: envio.toFixed(2),
      total: totalCalculado.toFixed(2)
    });

    // ✅ ACTUALIZAR EL PEDIDO CON LOS TOTALES CORRECTOS
    const { data: pedidoActualizado, error: updateError } = await supabaseAdmin
      .from('pedidos')
      .update({
        subtotal: subtotalCalculado,
        total: totalCalculado
      })
      .eq('id', pedidoId)
      .select('codigo_seguimiento')
      .single();

    if (updateError) {
      console.error('⚠️ Error actualizando totales del pedido:', updateError);
      // Continuar aunque falle la actualización
    } else {
      console.log('✅ Totales del pedido actualizados correctamente');
    }

    // Obtener el código de seguimiento (generado por trigger)
    const codigoSeguimiento = pedidoActualizado?.codigo_seguimiento || null;
    console.log('📦 Código de seguimiento:', codigoSeguimiento);

    // 🎁 ENVIAR EMAIL DE CONFIRMACIÓN
    console.log('📧 Enviando email de confirmación...');
    try {
      await enviarConfirmacionPedido({
        email_cliente: customerEmail,
        numero_pedido: numeroPedido,
        codigo_seguimiento: codigoSeguimiento || undefined,
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
        codigoSeguimiento: codigoSeguimiento,
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
