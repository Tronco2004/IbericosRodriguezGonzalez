import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    console.log('Cargando estadísticas del dashboard');

    // 1. Obtener usuarios activos
    const { data: usuarios, error } = await supabaseClient
      .from('usuarios')
      .select('id, nombre, rol, activo')
      .eq('rol', 'cliente')
      .eq('activo', true);

    const clientesActivos = usuarios?.length || 0;
    console.log('✅ Clientes activos:', clientesActivos);

    // 2. Obtener pedidos pendientes
    const { data: pedidos } = await supabaseClient
      .from('pedidos')
      .select('id, total')
      .eq('estado', 'pagado');

    const pedidosPendientes = pedidos?.length || 0;
    console.log('✅ Pedidos pendientes:', pedidosPendientes);

    // 3. Obtener stock total de productos simples
    const { data: productos, error: productosError } = await supabaseClient
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
    const { data: variantes, error: variantesError } = await supabaseClient
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

    // 6. Obtener ingresos totales (suma de pedidos CON ESTADO PAGADO)
    const { data: todosLosPedidos, error: ingresosError } = await supabaseClient
      .from('pedidos')
      .select('total')
      .eq('estado', 'pagado');

    let ingresosTotal = 0;
    if (!ingresosError && todosLosPedidos) {
      ingresosTotal = todosLosPedidos.reduce((total, pedido) => {
        // total está en centimos, convertir a euros
        return total + (parseFloat(pedido.total) || 0);
      }, 0);
      // Convertir de centimos a euros
      ingresosTotal = ingresosTotal / 100;
    }
    console.log('✅ Ingresos totales (pedidos pagados):', ingresosTotal);

    return new Response(
      JSON.stringify({
        success: true,
        clientesActivos: clientesActivos,
        pedidosPendientes: pedidosPendientes,
        stockTotal: stockTotal,
        ingresosTotal: ingresosTotal.toFixed(2)
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        clientesActivos: 0,
        pedidosPendientes: 0,
        stockTotal: 0,
        ingresosTotal: '0.00',
        error: error.toString()
      }),
      { status: 200 }
    );
  }
};
