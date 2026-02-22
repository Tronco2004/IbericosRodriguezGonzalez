import type { APIRoute } from 'astro';
import { supabaseClient as supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ url }) => {
  try {
    const codigo = url.searchParams.get('codigo');

    if (!codigo) {
      return new Response(
        JSON.stringify({ error: 'Código de seguimiento requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Limpiar y formatear el código (quitar espacios, convertir a mayúsculas)
    const codigoLimpio = codigo.trim().toUpperCase();

    console.log('🔍 Buscando pedido con código:', codigoLimpio);

    // Buscar el pedido por código de seguimiento
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select(`
        codigo_seguimiento,
        estado_seguimiento,
        estado,
        fecha_creacion,
        fecha_pago,
        fecha_envio,
        fecha_entrega,
        total
      `)
      .eq('codigo_seguimiento', codigoLimpio)
      .single();

    if (error || !pedido) {
      console.log('❌ Pedido no encontrado:', error?.message);
      return new Response(
        JSON.stringify({ 
          error: 'No se encontró ningún pedido con ese código de seguimiento',
          codigo: codigoLimpio
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Pedido encontrado:', pedido.codigo_seguimiento);

    // Construir la respuesta con información del seguimiento
    const estadoInfo = {
      pagado: {
        titulo: 'Pedido Pagado',
        mensaje: 'Tu pedido ha sido pagado y está siendo preparado para envío',
        icono: '',
        color: '#a89968',
        progreso: 33
      },
      enviado: {
        titulo: 'En Camino',
        mensaje: 'Tu pedido ha sido enviado y está en camino hacia tu dirección',
        icono: '',
        color: '#3b82f6',
        progreso: 66
      },
      entregado: {
        titulo: 'Entregado',
        mensaje: '¡Tu pedido ha sido entregado! Esperamos que lo disfrutes',
        icono: '',
        color: '#22c55e',
        progreso: 100
      },
      cancelado: {
        titulo: 'Pedido Cancelado',
        mensaje: 'Este pedido ha sido cancelado',
        icono: '',
        color: '#ef4444',
        progreso: 0
      }
    };

    // Si el estado del pedido es cancelado, mostrar cancelado independientemente del estado_seguimiento
    const estado = (pedido.estado === 'cancelado') ? 'cancelado' : (pedido.estado_seguimiento || 'pagado');
    const info = estadoInfo[estado as keyof typeof estadoInfo] || estadoInfo.pagado;

    const respuesta = {
      codigo: pedido.codigo_seguimiento,
      estado: estado,
      ...info,
      fechas: {
        creacion: pedido.fecha_creacion,
        pago: pedido.fecha_pago,
        envio: pedido.fecha_envio,
        entrega: pedido.fecha_entrega
      },
      total: pedido.total
    };

    return new Response(
      JSON.stringify(respuesta),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error al buscar seguimiento:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
