import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    console.log('Cargando estadísticas del dashboard');

    // 1. Obtener total de clientes (usuarios con rol cliente)
    const { data: clientesData, error: errorClientes } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('rol', 'cliente');

    if (errorClientes) {
      console.error('Error obteniendo clientes:', errorClientes);
    }

    const clientesActivos = clientesData?.length || 0;
    console.log('✅ Clientes totales:', clientesActivos);

    // 2. Obtener pedidos pendientes
    const { data: pedidos } = await supabaseAdmin
      .from('pedidos')
      .select('id, total')
      .eq('estado', 'pagado');

    const pedidosPendientes = pedidos?.length || 0;
    console.log('✅ Pedidos pendientes:', pedidosPendientes);

    // 3. Obtener stock total de productos simples
    const { data: productos, error: productosError } = await supabaseAdmin
      .from('productos')
      .select('stock');

    console.log('📦 Productos simples obtenidos:', productos?.length || 0);
    
    let stockProductosSimples = 0;
    if (!productosError && productos) {
      stockProductosSimples = productos.reduce((total, producto) => {
        const stock = producto.stock || 0;
        return total + (typeof stock === 'number' ? stock : 0);
      }, 0);
    }
    console.log('✅ Stock productos simples:', stockProductosSimples);

    // 4. Obtener stock total de variantes
    const { data: variantes, error: variantesError } = await supabaseAdmin
      .from('producto_variantes')
      .select('cantidad_disponible, disponible');

    console.log('📦 Variantes obtenidas:', variantes?.length || 0);
    
    let stockVariantes = 0;
    if (!variantesError && variantes) {
      stockVariantes = variantes.reduce((total, variante) => {
        // Usar cantidad_disponible si existe, si no usar disponible como fallback
        const cantidad = variante.cantidad_disponible !== undefined ? variante.cantidad_disponible : variante.disponible;
        
        if (typeof cantidad === 'number') {
          return total + cantidad;
        } else if (typeof cantidad === 'boolean' && cantidad) {
          return total + 1;
        }
        return total;
      }, 0);
    }
    console.log('✅ Stock variantes:', stockVariantes);

    // 5. Stock total = productos simples + variantes
    const stockTotal = stockProductosSimples + stockVariantes;
    console.log('✅ Stock TOTAL:', stockTotal);

    // 6. Obtener ingresos totales de ESTE MES (suma de SUBTOTAL de pedidos CON ESTADO PAGADO del mes actual)
    const ahora = new Date();
    const primerDiaDelMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    const ultimoDiaDelMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).toISOString();
    
    console.log('📅 Buscando ingresos entre:', primerDiaDelMes, 'y', ultimoDiaDelMes);
    
    // Obtener pedidos CON sus items para calcular subtotal desde los items
    const { data: pedidosMes, error: ingresosError } = await supabaseAdmin
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

    console.log('📋 Pedidos pagados del mes:', pedidosMes?.length || 0);

    // Obtener devoluciones validadas del mes para restarlas
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

    console.log('🔄 Devoluciones validadas del mes:', devolucionesValidadas?.length || 0);

    let ingresosTotal = 0;
    let ingresosHoy = 0;
    let pedidosHoy = 0;
    
    if (!ingresosError && pedidosMes) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      // Sumar ingresos de pedidos pagados (suma directa de subtotales)
      ingresosTotal = pedidosMes.reduce((total, pedido) => {
        const subtotalPedido = pedido.pedido_items?.reduce((sum: number, item: any) => {
          const valor = parseFloat(item.subtotal) || 0;
          return sum + valor;
        }, 0) || 0;
        
        return total + subtotalPedido;
      }, 0);
      
      // Restar ingresos de devoluciones validadas
      if (devolucionesValidadas && devolucionesValidadas.length > 0) {
        const restoDevoluciones = devolucionesValidadas.reduce((total, pedido) => {
          return total + (pedido.pedido_items?.reduce((sum: number, item: any) => {
            return sum + (parseFloat(item.subtotal) || 0);
          }, 0) || 0);
        }, 0);
        ingresosTotal -= restoDevoluciones;
      }
      
      // Calcular ingresos de hoy
      const pedidosDeHoy = pedidosMes.filter(pedido => {
        const fechaPedido = new Date(pedido.fecha_creacion);
        fechaPedido.setHours(0, 0, 0, 0);
        return fechaPedido.getTime() === hoy.getTime();
      });
      
      ingresosHoy = pedidosDeHoy.reduce((total, pedido) => {
        return total + (pedido.pedido_items?.reduce((sum: number, item: any) => {
          return sum + (parseFloat(item.subtotal) || 0);
        }, 0) || 0);
      }, 0);
      
      pedidosHoy = pedidosDeHoy.length;
    }
    console.log('✅ Ingresos del mes actual:', ingresosTotal);
    console.log('✅ Ingresos de hoy:', ingresosHoy);
    console.log('✅ Pedidos de hoy:', pedidosHoy);

    // Calcular ticket promedio (ingresos totales / total de pedidos pagados del mes)
    const totalPedidosMes = pedidosMes?.length || 0;
    const ticketPromedio = totalPedidosMes > 0 ? ingresosTotal / totalPedidosMes : 0;

    return new Response(
      JSON.stringify({
        success: true,
        clientesActivos: clientesActivos,
        pedidosPendientes: pedidosPendientes,
        stockTotal: stockTotal,
        ingresosTotal: ingresosTotal.toFixed(2),
        ingresosHoy: ingresosHoy.toFixed(2),
        pedidosHoy: pedidosHoy,
        ticketPromedio: ticketPromedio.toFixed(2)
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en dashboard-stats:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Error interno del servidor'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
