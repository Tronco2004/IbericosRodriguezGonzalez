import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    // Obtener todos los pedidos con items del mes actual
    const ahora = new Date();
    const primerDiaDelMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    
    const { data: pedidos } = await supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        estado,
        subtotal,
        total,
        envio,
        fecha_creacion,
        pedido_items (
          id,
          nombre_producto,
          cantidad,
          precio_unitario,
          subtotal
        )
      `)
      .eq('estado', 'pagado')
      .gte('fecha_creacion', primerDiaDelMes)
      .order('fecha_creacion', { ascending: false });

    if (!pedidos || pedidos.length === 0) {
      return new Response(
        JSON.stringify({
          debug: true,
          message: 'No hay pedidos pagados este mes',
          pedidos: []
        }),
        { status: 200 }
      );
    }

    // Calcular ingresos de ambas formas
    let ingresosDesdeSubtotalPedidos = 0;
    let ingresosDesdeItemsSubtotal = 0;

    pedidos.forEach(pedido => {
      // Forma 1: desde pedidos.subtotal
      ingresosDesdeSubtotalPedidos += parseFloat(pedido.subtotal) || 0;

      // Forma 2: sumando items.subtotal
      if (pedido.pedido_items) {
        pedido.pedido_items.forEach((item: any) => {
          ingresosDesdeItemsSubtotal += parseFloat(item.subtotal) || 0;
        });
      }
    });

    return new Response(
      JSON.stringify({
        debug: true,
        total_pedidos: pedidos.length,
        ingresos_desde_pedidos_subtotal_euros: (ingresosDesdeSubtotalPedidos / 100).toFixed(2),
        ingresos_desde_items_subtotal_euros: (ingresosDesdeItemsSubtotal / 100).toFixed(2),
        pedidos_muestra: pedidos.slice(0, 3).map(p => ({
          numero_pedido: p.numero_pedido,
          pedidos_subtotal: p.subtotal,
          items_count: p.pedido_items?.length || 0,
          items_subtotales: p.pedido_items?.map(i => ({
            nombre: i.nombre_producto,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
            subtotal: i.subtotal
          })),
          suma_items_subtotal: p.pedido_items?.reduce((sum: number, i: any) => sum + (parseFloat(i.subtotal) || 0), 0)
        }))
      }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { status: 500 }
    );
  }
};
