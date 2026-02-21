import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    console.log('Cargando ingresos diarios del mes actual');

    // Obtener el mes y año actual
    const ahora = new Date();
    const primerDiaDelMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    const ultimoDiaDelMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).toISOString();

    // Obtener TODOS los pedidos del mes (sin filtro de estado)
    // Mismo enfoque que dashboard-stats: todos representan dinero recibido vía Stripe
    const { data: pedidosMes, error: errorPedidos } = await supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        fecha_creacion,
        pedido_items (
          subtotal
        )
      `)
      .gte('fecha_creacion', primerDiaDelMes)
      .lte('fecha_creacion', ultimoDiaDelMes);

    if (errorPedidos) {
      console.error('Error obteniendo pedidos:', errorPedidos);
      return new Response(
        JSON.stringify({
          success: false,
          ingresosMatriz: { dias: [], ingresos: [] },
          error: errorPedidos.toString()
        }),
        { status: 200 }
      );
    }

    // Procesar datos por día
    const diasDelMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
    const ingresosMatriz: { [key: number]: number } = {};

    // Inicializar todos los días del mes con 0
    for (let i = 1; i <= diasDelMes; i++) {
      ingresosMatriz[i] = 0;
    }

    // Procesar cada pedido - suma directa de subtotales
    if (pedidosMes && pedidosMes.length > 0) {
      pedidosMes.forEach(pedido => {
        const fecha = new Date(pedido.fecha_creacion);
        const dia = fecha.getDate();
        
        // Sumar todos los subtotales de los items del pedido
        const subtotal = pedido.pedido_items?.reduce((sum: number, item: any) => {
          return sum + (parseFloat(item.subtotal) || 0);
        }, 0) || 0;
        
        ingresosMatriz[dia] += subtotal;
      });
    }
    
    // Restar devoluciones validadas del mes
    // Filtrar por fecha_actualizacion (cuándo se aceptó la devolución), no por fecha_creacion del pedido
    const { data: devolucionesValidadas } = await supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        fecha_actualizacion,
        pedido_items (
          subtotal
        )
      `)
      .eq('estado', 'devolucion_recibida')
      .gte('fecha_actualizacion', primerDiaDelMes)
      .lte('fecha_actualizacion', ultimoDiaDelMes);
    
    if (devolucionesValidadas && devolucionesValidadas.length > 0) {
      devolucionesValidadas.forEach(pedido => {
        const fecha = new Date(pedido.fecha_actualizacion);
        const dia = fecha.getDate();
        
        // Restar ×2: una vez por devolver el dinero + otra por pérdida del producto
        const subtotal = pedido.pedido_items?.reduce((sum: number, item: any) => {
          return sum + (parseFloat(item.subtotal) || 0);
        }, 0) || 0;
        
        ingresosMatriz[dia] -= (subtotal * 2);
      });
    }

    // Restar pedidos cancelados del mes
    // Filtrar por fecha_actualizacion (cuándo se cancelaron en el mes), NO por fecha de creación
    const { data: pedidosCancelados } = await supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        fecha_actualizacion,
        pedido_items (
          subtotal
        )
      `)
      .eq('estado', 'cancelado')
      .gte('fecha_actualizacion', primerDiaDelMes)
      .lte('fecha_actualizacion', ultimoDiaDelMes);
    
    if (pedidosCancelados && pedidosCancelados.length > 0) {
      pedidosCancelados.forEach(pedido => {
        const fecha = new Date(pedido.fecha_actualizacion);
        const dia = fecha.getDate();
        
        // Restar una sola vez: anula la venta que no se concretó (sin pérdida de producto)
        const subtotal = pedido.pedido_items?.reduce((sum: number, item: any) => {
          return sum + (parseFloat(item.subtotal) || 0);
        }, 0) || 0;
        
        ingresosMatriz[dia] -= subtotal;
      });
    }

    // Convertir a arrays
    const dias = Array.from({ length: diasDelMes }, (_, i) => i + 1);
    const ingresos = dias.map(dia => parseFloat(ingresosMatriz[dia].toFixed(2)));

    console.log('✅ Ingresos diarios cargados:', { dias, ingresos });

    return new Response(
      JSON.stringify({
        success: true,
        ingresosMatriz: {
          dias,
          ingresos
        }
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        ingresosMatriz: { dias: [], ingresos: [] },
        error: error instanceof Error ? error.toString() : 'Error desconocido'
      }),
      { status: 200 }
    );
  }
};
