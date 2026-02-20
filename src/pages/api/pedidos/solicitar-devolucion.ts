import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { enviarEmailDevolucion, notificarDevolucionAlAdmin } from '../../../lib/email';
import type { EmailDevolucion } from '../../../lib/email';
import { getAuthenticatedUserId } from '../../../lib/auth-helpers';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // ── Auth: validar JWT (no confiar en x-user-id) ──
    const { userId } = await getAuthenticatedUserId(request, cookies);
    const { pedido_id } = await request.json();

    if (!userId || !pedido_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Datos incompletos' }),
        { status: 400 }
      );
    }

    // Obtener email del usuario para verificar propiedad por email también
    let userEmail: string | null = null;
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('email')
      .eq('id', userId)
      .single();
    if (usuario?.email) userEmail = usuario.email;

    // Buscar pedido por ID (sin filtrar por usuario_id, puede ser null en pedidos de invitado)
    const { data: pedido, error: errorPedido } = await supabaseAdmin
      .from('pedidos')
      .select('id, estado, usuario_id, numero_pedido, email_cliente, nombre_cliente')
      .eq('id', pedido_id)
      .single();

    if (errorPedido || !pedido) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido no encontrado' }),
        { status: 404 }
      );
    }

    // Verificar que el pedido pertenece al usuario (por usuario_id o por email)
    const esPropietario = pedido.usuario_id === userId || 
      (userEmail && pedido.email_cliente === userEmail);

    if (!esPropietario) {
      console.error('❌ El pedido no pertenece al usuario');
      return new Response(
        JSON.stringify({ success: false, error: 'No tienes permiso para solicitar devolución de este pedido' }),
        { status: 403 }
      );
    }

    // Validar que el estado sea "pagado" o "entregado"
    if (pedido.estado !== 'pagado' && pedido.estado !== 'entregado') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Solo puedes solicitar devolución de pedidos pagados o entregados` 
        }),
        { status: 400 }
      );
    }

    // NOTA: El stock NO se restaura aquí. Se restaurará cuando el admin valide la devolución
    // después de recibir físicamente el producto.
    console.log('🔵 Solicitud de devolución recibida para pedido:', pedido_id);

    // Actualizar estado a "devolucion_solicitada"
    const { error: errorUpdate } = await supabaseAdmin
      .from('pedidos')
      .update({ 
        estado: 'devolucion_solicitada',
        fecha_actualizacion: new Date().toISOString()
      })
      .eq('id', pedido_id);

    if (errorUpdate) {
      console.error('Error actualizando estado:', errorUpdate);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al procesar la devolución' }),
        { status: 500 }
      );
    }

    // Obtener items del pedido para la factura rectificativa
    let datosDevolucion: EmailDevolucion | undefined;
    try {
      const { data: pedidoCompleto } = await supabaseAdmin
        .from('pedidos')
        .select('subtotal, envio, total, fecha_creacion')
        .eq('id', pedido_id)
        .single();

      const { data: pedidoItems } = await supabaseAdmin
        .from('pedido_items')
        .select('nombre_producto, cantidad, precio_unitario, peso_kg')
        .eq('pedido_id', pedido_id);

      if (pedidoCompleto && pedidoItems && pedidoItems.length > 0) {
        datosDevolucion = {
          email_cliente: pedido.email_cliente,
          numero_pedido: pedido.numero_pedido,
          fecha_pedido: pedidoCompleto.fecha_creacion,
          nombre_cliente: pedido.nombre_cliente || undefined,
          items: pedidoItems.map((item: any) => ({
            nombre: item.nombre_producto,
            cantidad: item.cantidad,
            precio: Math.round(item.precio_unitario * 100), // convertir a céntimos
            peso_kg: item.peso_kg || undefined
          })),
          subtotal: Math.round((pedidoCompleto.subtotal || 0) * 100),
          envio: Math.round((pedidoCompleto.envio || 0) * 100),
          total: Math.round((pedidoCompleto.total || 0) * 100)
        };
        console.log('📄 Datos de devolución preparados para factura rectificativa');
      }
    } catch (itemsError) {
      console.error('⚠️ Error obteniendo items para factura rectificativa:', itemsError);
    }

    // Enviar email con etiqueta de devolución y factura rectificativa
    try {
      await enviarEmailDevolucion(pedido.email_cliente, pedido.numero_pedido, datosDevolucion);
      console.log('Email de devolución enviado');
    } catch (emailError) {
      console.error('Error enviando email de devolución:', emailError);
      // No fallar si el email no se envía
    }

    // Notificar al admin sobre la devolución con factura rectificativa
    try {
      console.log('📧 Notificando al admin sobre devolución');
      
      await notificarDevolucionAlAdmin(
        pedido.numero_pedido,
        pedido.email_cliente,
        pedido.nombre_cliente,
        datosDevolucion
      );
      console.log('✅ Admin notificado sobre la devolución');
    } catch (adminEmailError) {
      console.error('⚠️ Error notificando al admin:', adminEmailError);
      // No fallar si no se puede notificar al admin
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Solicitud de devolución registrada',
        pedido_id: pedido_id
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error solicitando devolución:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
