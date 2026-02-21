import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

// Helper: obtener fecha actual en zona horaria de España
function getSpainDate() {
  const now = new Date();
  const spainStr = now.toLocaleString('en-CA', { timeZone: 'Europe/Madrid', hour12: false });
  const [datePart] = spainStr.split(',');
  const [year, month, day] = datePart.trim().split('-').map(Number);
  return { year, month: month - 1, day };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const periodo = url.searchParams.get('periodo') || 'mes'; // mes, trimestre, anio, todo

    const spain = getSpainDate();
    let fechaInicio: string | null = null;

    switch (periodo) {
      case 'mes':
        fechaInicio = new Date(Date.UTC(spain.year, spain.month, 1)).toISOString();
        break;
      case 'trimestre':
        fechaInicio = new Date(Date.UTC(spain.year, spain.month - 2, 1)).toISOString();
        break;
      case 'anio':
        fechaInicio = new Date(Date.UTC(spain.year, 0, 1)).toISOString();
        break;
      // 'todo' - sin filtro
    }

    // Obtener TODOS los pedidos del periodo (sin filtro de estado)
    // Mismo enfoque que dashboard-stats: todos los pedidos representan dinero recibido vía Stripe
    let query = supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        usuario_id,
        nombre_cliente,
        email_cliente,
        es_invitado,
        estado,
        fecha_creacion,
        numero_pedido,
        pedido_items (
          subtotal
        )
      `);

    if (fechaInicio) {
      query = query.gte('fecha_creacion', fechaInicio);
    }

    const { data: pedidos, error } = await query.order('fecha_creacion', { ascending: false });

    if (error) {
      console.error('Error obteniendo pedidos:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500 }
      );
    }

    // Obtener devoluciones validadas para restarlas ×2
    // Filtrar por fecha_actualizacion (cuando se aceptó la devolución), igual que en dashboard
    let queryDev = supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        usuario_id,
        nombre_cliente,
        email_cliente,
        es_invitado,
        estado,
        fecha_actualizacion,
        pedido_items (
          subtotal
        )
      `)
      .eq('estado', 'devolucion_recibida');

    if (fechaInicio) {
      queryDev = queryDev.gte('fecha_actualizacion', fechaInicio);
    }

    const { data: devoluciones } = await queryDev;

    // Obtener pedidos cancelados para restarlos ×1
    // Filtrar por fecha_actualizacion (cuando se cancelaron), igual que en dashboard
    let queryCan = supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        usuario_id,
        nombre_cliente,
        email_cliente,
        es_invitado,
        estado,
        fecha_actualizacion,
        pedido_items (
          subtotal
        )
      `)
      .eq('estado', 'cancelado');

    if (fechaInicio) {
      queryCan = queryCan.gte('fecha_actualizacion', fechaInicio);
    }

    const { data: cancelados } = await queryCan;

    // Obtener nombres de usuarios registrados (de todos los pedidos + devoluciones + cancelados)
    const allPedidos = [...(pedidos || []), ...(devoluciones || []), ...(cancelados || [])];
    const usuarioIds = [...new Set(
      allPedidos
        .filter(p => p.usuario_id)
        .map(p => p.usuario_id)
    )];

    let usuariosMap: Record<string, { nombre: string; email: string }> = {};

    if (usuarioIds.length > 0) {
      const { data: usuarios } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombre, email')
        .in('id', usuarioIds);

      if (usuarios) {
        usuarios.forEach(u => {
          usuariosMap[u.id] = { nombre: u.nombre, email: u.email };
        });
      }
    }

    // Agrupar ingresos por email (unifica registrados e invitados con mismo email)
    const ingresosMap: Record<string, {
      nombre: string;
      email: string;
      totalIngresos: number;
      totalPedidos: number;
      pedidos: Array<{
        id: number;
        numeroPedido: string;
        fecha: string;
        subtotal: number;
      }>;
    }> = {};

    // Procesar pedidos pagados
    (pedidos || []).forEach(pedido => {
      const subtotal = pedido.pedido_items?.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item.subtotal) || 0);
      }, 0) || 0;

      // Determinar email como clave de agrupación
      let email = '';
      let nombre = '';

      if (pedido.usuario_id && usuariosMap[pedido.usuario_id]) {
        email = usuariosMap[pedido.usuario_id].email;
        nombre = usuariosMap[pedido.usuario_id].nombre;
      } else if (pedido.email_cliente) {
        email = pedido.email_cliente;
        nombre = pedido.nombre_cliente || pedido.email_cliente;
      }

      const key = email || `unknown_${pedido.id}`;

      if (!ingresosMap[key]) {
        ingresosMap[key] = {
          nombre,
          email,
          totalIngresos: 0,
          totalPedidos: 0,
          pedidos: []
        };
      }

      // Si ya existe y el nombre actual es de un usuario registrado, priorizar ese nombre
      if (pedido.usuario_id && usuariosMap[pedido.usuario_id]) {
        ingresosMap[key].nombre = usuariosMap[pedido.usuario_id].nombre;
      }

      ingresosMap[key].totalIngresos += subtotal;
      ingresosMap[key].totalPedidos += 1;
      ingresosMap[key].pedidos.push({
        id: pedido.id,
        numeroPedido: pedido.numero_pedido,
        fecha: pedido.fecha_creacion,
        subtotal
      });
    });

    // Restar devoluciones ×2: una vez por devolver el dinero + otra por pérdida del producto
    (devoluciones || []).forEach(pedido => {
      const subtotal = pedido.pedido_items?.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item.subtotal) || 0);
      }, 0) || 0;

      let email = '';
      if (pedido.usuario_id && usuariosMap[pedido.usuario_id]) {
        email = usuariosMap[pedido.usuario_id].email;
      } else if (pedido.email_cliente) {
        email = pedido.email_cliente;
      }

      const key = email || `unknown_${pedido.id}`;

      if (ingresosMap[key]) {
        ingresosMap[key].totalIngresos -= (subtotal * 2);
      }
    });

    // Restar cancelados ×1: anula el ingreso que no se concretó
    (cancelados || []).forEach(pedido => {
      const subtotal = pedido.pedido_items?.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item.subtotal) || 0);
      }, 0) || 0;

      let email = '';
      if (pedido.usuario_id && usuariosMap[pedido.usuario_id]) {
        email = usuariosMap[pedido.usuario_id].email;
      } else if (pedido.email_cliente) {
        email = pedido.email_cliente;
      }

      const key = email || `unknown_${pedido.id}`;

      if (ingresosMap[key]) {
        ingresosMap[key].totalIngresos -= subtotal;
      }
    });

    // Convertir a array y ordenar por ingresos descendente
    const ingresosUsuarios = Object.values(ingresosMap)
      .sort((a, b) => b.totalIngresos - a.totalIngresos);

    // Calcular totales
    const totalGeneral = ingresosUsuarios.reduce((sum, u) => sum + u.totalIngresos, 0);
    const totalPedidos = ingresosUsuarios.reduce((sum, u) => sum + u.totalPedidos, 0);

    // Ticket promedio: solo pedidos exitosos (misma lógica que dashboard)
    // Filtrar pedidos que NO son cancelados ni devueltos
    const estadosPagados = ['pagado', 'preparando', 'enviado', 'entregado', 'devolucion_denegada'];
    const pedidosPagados = (pedidos || []).filter(p => estadosPagados.includes(p.estado));
    const sumaPagados = pedidosPagados.reduce((sum, p) => {
      return sum + (p.pedido_items?.reduce((s: number, item: any) => s + (parseFloat(item.subtotal) || 0), 0) || 0);
    }, 0);
    const ticketPromedio = pedidosPagados.length > 0 ? sumaPagados / pedidosPagados.length : 0;

    return new Response(
      JSON.stringify({
        success: true,
        ingresosUsuarios,
        totalGeneral: totalGeneral.toFixed(2),
        totalPedidos,
        ticketPromedio: ticketPromedio.toFixed(2),
        periodo
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error en ingresos-usuarios:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.toString() }),
      { status: 500 }
    );
  }
};
