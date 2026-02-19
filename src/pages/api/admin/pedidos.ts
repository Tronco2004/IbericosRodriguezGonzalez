import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

// GET - Obtener todos los pedidos (solo para admin)
export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const url = new URL(request.url);
    const filtro = url.searchParams.get('filtro') || 'todos'; // todos, dia, semana, mes

    let query = supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        codigo_seguimiento,
        estado_seguimiento,
        usuario_id,
        estado,
        subtotal,
        envio,
        impuestos,
        total,
        nombre_cliente,
        email_cliente,
        telefono_cliente,
        direccion_envio,
        fecha_creacion,
        fecha_pago,
        fecha_envio,
        fecha_entrega,
        pedido_items (
          id,
          nombre_producto,
          cantidad,
          precio_unitario,
          subtotal,
          peso_kg
        )
      `)
      .order('fecha_creacion', { ascending: false });

    // Aplicar filtro por fecha
    const ahora = new Date();
    let fechaInicio: Date;

    switch (filtro) {
      case 'dia':
        fechaInicio = new Date(ahora);
        fechaInicio.setHours(0, 0, 0, 0);
        query = query.gte('fecha_creacion', fechaInicio.toISOString());
        break;
      case 'semana':
        fechaInicio = new Date(ahora);
        fechaInicio.setDate(ahora.getDate() - ahora.getDay());
        fechaInicio.setHours(0, 0, 0, 0);
        query = query.gte('fecha_creacion', fechaInicio.toISOString());
        break;
      case 'mes':
        fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        query = query.gte('fecha_creacion', fechaInicio.toISOString());
        break;
      // 'todos' - sin filtro
    }

    const { data: pedidos, error } = await query;

    if (error) {
      console.error('Error obteniendo pedidos:', error);
      return new Response(
        JSON.stringify({ error: 'Error obteniendo pedidos' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        pedidos: pedidos || [],
        filtro
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en GET /api/admin/pedidos:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
