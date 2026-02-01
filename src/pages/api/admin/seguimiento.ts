import type { APIRoute } from 'astro';
import { supabaseClient as supabase } from '../../../lib/supabase';

// GET: Obtener detalles de seguimiento de un pedido
export const GET: APIRoute = async ({ url }) => {
  try {
    const pedidoId = url.searchParams.get('id');

    if (!pedidoId) {
      return new Response(
        JSON.stringify({ error: 'ID de pedido requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        codigo_seguimiento,
        estado_seguimiento,
        estado,
        fecha_creacion,
        fecha_pago,
        fecha_envio,
        fecha_entrega,
        email_cliente
      `)
      .eq('id', pedidoId)
      .single();

    if (error || !pedido) {
      return new Response(
        JSON.stringify({ error: 'Pedido no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(pedido),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error obteniendo seguimiento:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// PUT: Actualizar estado de seguimiento
export const PUT: APIRoute = async ({ request }) => {
  try {
    const { pedidoId, nuevoEstado } = await request.json();

    if (!pedidoId || !nuevoEstado) {
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar que el estado sea válido
    const estadosValidos = ['pagado', 'enviado', 'entregado'];
    if (!estadosValidos.includes(nuevoEstado)) {
      return new Response(
        JSON.stringify({ error: 'Estado no válido. Use: pagado, enviado o entregado' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Preparar datos de actualización
    const updateData: any = {
      estado_seguimiento: nuevoEstado
    };

    // Actualizar fechas según el estado
    const ahora = new Date().toISOString();
    if (nuevoEstado === 'enviado') {
      updateData.fecha_envio = ahora;
      updateData.estado = 'enviado';
    } else if (nuevoEstado === 'entregado') {
      updateData.fecha_entrega = ahora;
      updateData.estado = 'entregado';
    }

    console.log('📦 Actualizando seguimiento:', { pedidoId, nuevoEstado });

    const { data: pedido, error } = await supabase
      .from('pedidos')
      .update(updateData)
      .eq('id', pedidoId)
      .select('id, numero_pedido, codigo_seguimiento, estado_seguimiento, fecha_envio, fecha_entrega')
      .single();

    if (error) {
      console.error('❌ Error actualizando seguimiento:', error);
      return new Response(
        JSON.stringify({ error: 'Error al actualizar estado', details: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Seguimiento actualizado:', pedido);

    return new Response(
      JSON.stringify({
        success: true,
        mensaje: `Estado actualizado a "${nuevoEstado}"`,
        pedido
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error en actualización de seguimiento:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
