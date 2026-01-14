import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    console.log('Cargando estadísticas del dashboard');

    // Obtener usuarios con rol 'cliente' y activo = true
    const { data: usuarios, error } = await supabaseClient
      .from('usuarios')
      .select('id, nombre, rol, activo')
      .eq('rol', 'cliente')
      .eq('activo', true);

    console.log('Usuarios cliente activos:', usuarios?.length);
    console.log('Error:', error);

    if (error) {
      console.log('Error obteniendo usuarios:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          clientesActivos: 0,
          pedidosPendientes: 0,
          error: error.message
        }),
        { status: 200 }
      );
    }

    const clientesActivos = usuarios?.length || 0;

    // Obtener pedidos pendientes (estado = 'pagado')
    const { data: pedidos, error: pedidosError } = await supabaseClient
      .from('pedidos')
      .select('id')
      .eq('estado', 'pagado');

    if (pedidosError) {
      console.log('Error obteniendo pedidos:', pedidosError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          clientesActivos: clientesActivos,
          pedidosPendientes: 0,
          error: pedidosError.message
        }),
        { status: 200 }
      );
    }

    const pedidosPendientes = pedidos?.length || 0;

    console.log('✅ Clientes activos (rol=cliente, activo=true):', clientesActivos);
    console.log('✅ Pedidos pendientes (estado=pagado):', pedidosPendientes);

    return new Response(
      JSON.stringify({
        success: true,
        clientesActivos: clientesActivos,
        pedidosPendientes: pedidosPendientes
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
        error: error.toString()
      }),
      { status: 200 }
    );
  }
};
