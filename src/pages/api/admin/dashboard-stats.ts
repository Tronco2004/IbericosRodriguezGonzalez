import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

// Helper: obtener fecha actual en zona horaria de España
function getSpainDate() {
  const now = new Date();
  // Obtener la fecha/hora en España como string y parsearla
  const spainStr = now.toLocaleString('en-CA', { timeZone: 'Europe/Madrid', hour12: false });
  // Formato: "2026-02-22, 00:15:30"
  const [datePart] = spainStr.split(',');
  const [year, month, day] = datePart.trim().split('-').map(Number);
  return { year, month: month - 1, day }; // month 0-indexed
}

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

    // 6. Obtener ingresos totales de ESTE MES
    // Incluir SOLO los estados que representan un pago CONFIRMADO:
    // pagado, preparando, enviado, entregado
    // TAMBIÉN: devolucion_denegada (la devolución fue rechazada, se mantiene el pago)
    // NO incluir: cancelado (nunca se pagó), devolucion_solicitada (pendiente de decisión), devolucion_recibida (se resta aparte)
    // IMPORTANTE: No incluir 'devolucion_solicitada' para evitar contar dos veces cuando luego se acepta la devolución
    // Usar zona horaria de España para todas las fechas
    const spain = getSpainDate();
    const primerDiaDelMes = new Date(Date.UTC(spain.year, spain.month, 1)).toISOString();
    const ultimoDiaDelMes = new Date(Date.UTC(spain.year, spain.month + 1, 0, 23, 59, 59, 999)).toISOString();

    console.log('📅 Buscando ingresos entre:', primerDiaDelMes, 'y', ultimoDiaDelMes);

    const estadosPagados = ['pagado', 'preparando', 'enviado', 'entregado', 'devolucion_denegada'];

    // Obtener TODOS los pedidos del mes (sin filtro de estado)
    // Todos los pedidos en la BD fueron pagados vía Stripe, así que representan dinero recibido
    // Si filtramos por estadosPagados, los cancelados/devueltos este mes NO se suman pero SÍ se restan → error
    const { data: todosPedidosMes, error: ingresosError } = await supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        estado,
        fecha_creacion,
        pedido_items (
          subtotal
        )
      `)
      .gte('fecha_creacion', primerDiaDelMes)
      .lte('fecha_creacion', ultimoDiaDelMes);

    // Filtrar pedidos en estados "pagados" (para ticket promedio y conteo de pedidos reales)
    const pedidosMesPagados = todosPedidosMes?.filter(p => estadosPagados.includes(p.estado)) || [];

    console.log('📋 Todos los pedidos del mes:', todosPedidosMes?.length || 0);
    console.log('📋 Pedidos pagados del mes:', pedidosMesPagados.length);

    // Obtener devoluciones validadas del mes para restarlas
    // Filtrar por fecha_actualizacion (cuando se aceptó la devolución), no por fecha_creacion del pedido
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

    console.log('🔄 Devoluciones validadas del mes:', devolucionesValidadas?.length || 0);

    // Obtener pedidos cancelados del mes para restarlos
    // Filtrar por fecha_actualizacion (cuando se cancelaron en el mes), NO por fecha de creación
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

    console.log('❌ Pedidos cancelados del mes:', pedidosCancelados?.length || 0);

    // Obtener pedidos cancelados de HOY (para restar solo hoy)
    // Usar zona horaria de España para definir "hoy"
    const inicioDia = new Date(Date.UTC(spain.year, spain.month, spain.day)).toISOString();
    const finDia = new Date(Date.UTC(spain.year, spain.month, spain.day + 1)).toISOString();
    
    const { data: pedidosCanceladosHoy } = await supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        fecha_actualizacion,
        pedido_items (
          subtotal
        )
      `)
      .eq('estado', 'cancelado')
      .gte('fecha_actualizacion', inicioDia)
      .lt('fecha_actualizacion', finDia);

    let ingresosTotal = 0;
    let ingresosHoy = 0;
    let pedidosHoy = 0;
    
    if (!ingresosError && todosPedidosMes) {
      // Timestamps de inicio/fin del día en España (ya calculados arriba)
      const inicioDiaTs = new Date(inicioDia).getTime();
      const finDiaTs = new Date(finDia).getTime();
      
      // Sumar ingresos de TODOS los pedidos del mes (dinero recibido vía Stripe)
      ingresosTotal = todosPedidosMes.reduce((total, pedido) => {
        const subtotalPedido = pedido.pedido_items?.reduce((sum: number, item: any) => {
          const valor = parseFloat(item.subtotal) || 0;
          return sum + valor;
        }, 0) || 0;
        
        return total + subtotalPedido;
      }, 0);
      
      // Restar ingresos de devoluciones validadas
      // Se resta ×2: una vez por devolver el dinero al cliente + otra por pérdida del producto
      if (devolucionesValidadas && devolucionesValidadas.length > 0) {
        const restoDevoluciones = devolucionesValidadas.reduce((total, pedido) => {
          return total + (pedido.pedido_items?.reduce((sum: number, item: any) => {
            return sum + (parseFloat(item.subtotal) || 0);
          }, 0) || 0);
        }, 0);
        ingresosTotal -= (restoDevoluciones * 2);
      }

      // Restar ingresos de pedidos cancelados del mes
      // Restamos solo una vez: anula el ingreso que nunca se concretó
      if (pedidosCancelados && pedidosCancelados.length > 0) {
        const restoCancelados = pedidosCancelados.reduce((total, pedido) => {
          return total + (pedido.pedido_items?.reduce((sum: number, item: any) => {
            return sum + (parseFloat(item.subtotal) || 0);
          }, 0) || 0);
        }, 0);
        // Restar una vez: anula la venta que no se concretó (no hay pérdida de producto)
        ingresosTotal -= restoCancelados;
      }
      
      // Calcular ingresos de hoy (todos los pedidos creados hoy = dinero recibido hoy)
      // Usar rangos de timestamp con zona horaria española
      const todosDeHoy = todosPedidosMes.filter(pedido => {
        const ts = new Date(pedido.fecha_creacion).getTime();
        return ts >= inicioDiaTs && ts < finDiaTs;
      });
      
      ingresosHoy = todosDeHoy.reduce((total, pedido) => {
        return total + (pedido.pedido_items?.reduce((sum: number, item: any) => {
          return sum + (parseFloat(item.subtotal) || 0);
        }, 0) || 0);
      }, 0);
      
      // Restar devoluciones aprobadas (devolucion_recibida) de hoy
      // Usa fecha_actualizacion (cuándo se aceptó la devolución), no fecha_creacion del pedido
      // Se resta ×2: una vez por devolver el dinero + otra por pérdida del producto
      if (devolucionesValidadas && devolucionesValidadas.length > 0) {
        const devolucionesHoy = devolucionesValidadas.filter(pedido => {
          const ts = new Date(pedido.fecha_actualizacion).getTime();
          return ts >= inicioDiaTs && ts < finDiaTs;
        });
        
        const restaDevolucionesHoy = devolucionesHoy.reduce((total, pedido) => {
          return total + (pedido.pedido_items?.reduce((sum: number, item: any) => {
            return sum + (parseFloat(item.subtotal) || 0);
          }, 0) || 0);
        }, 0);
        
        ingresosHoy -= (restaDevolucionesHoy * 2);
      }

      // Restar pedidos cancelados de hoy
      // Usa fecha_actualizacion (cuándo se cancelaron), no fecha_creacion del pedido
      // Restamos una sola vez: anula el ingreso que no se concretó
      if (pedidosCanceladosHoy && pedidosCanceladosHoy.length > 0) {
        const restaCanceladosHoy = pedidosCanceladosHoy.reduce((total, pedido) => {
          return total + (pedido.pedido_items?.reduce((sum: number, item: any) => {
            return sum + (parseFloat(item.subtotal) || 0);
          }, 0) || 0);
        }, 0);
        
        // Restar una vez: anula la venta que no se concretó
        ingresosHoy -= restaCanceladosHoy;
      }
      
      // Contar pedidos de hoy (solo los que siguen activos/pagados, no cancelados)
      const pedidosPagadosHoy = todosDeHoy.filter(p => estadosPagados.includes(p.estado));
      pedidosHoy = pedidosPagadosHoy.length;
    }
    console.log('✅ Ingresos del mes actual:', ingresosTotal);
    console.log('✅ Ingresos de hoy:', ingresosHoy);
    console.log('✅ Pedidos de hoy:', pedidosHoy);

    // Calcular ticket promedio (media limpia de pedidos exitosos del mes)
    // Solo usa pedidos en estadosPagados (no cancelados ni devueltos)
    let ingresosLimpio = 0;
    if (pedidosMesPagados.length > 0) {
      ingresosLimpio = pedidosMesPagados.reduce((total, pedido) => {
        const subtotalPedido = pedido.pedido_items?.reduce((sum: number, item: any) => {
          const valor = parseFloat(item.subtotal) || 0;
          return sum + valor;
        }, 0) || 0;
        return total + subtotalPedido;
      }, 0);
    }
    
    const totalPedidosMes = pedidosMesPagados.length;
    const ticketPromedio = totalPedidosMes > 0 ? ingresosLimpio / totalPedidosMes : 0;

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
