import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    console.log('Cargando ingresos diarios del mes actual');

    // Obtener el mes y año actual
    const ahora = new Date();
    const primerDiaDelMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    const ultimoDiaDelMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).toISOString();

    // Obtener todos los pedidos pagados del mes (calcula subtotal desde items)
    const { data: pedidosMes, error: errorPedidos } = await supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        fecha_creacion,
        pedido_items (
          subtotal
        )
      `)
      .eq('estado', 'pagado')
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
    const { data: devolucionesValidadas } = await supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        fecha_creacion,
        pedido_items (
          subtotal
        )
      `)
      .eq('estado', 'devolucion_recibida')
      .gte('fecha_creacion', primerDiaDelMes)
      .lte('fecha_creacion', ultimoDiaDelMes);
    
    if (devolucionesValidadas && devolucionesValidadas.length > 0) {
      devolucionesValidadas.forEach(pedido => {
        const fecha = new Date(pedido.fecha_creacion);
        const dia = fecha.getDate();
        
        // Restar subtotales de los items del pedido
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
