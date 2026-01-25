import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    // Obtener todos los productos con sus stocks actuales
    const { data: productos, error } = await supabaseClient
      .from('productos')
      .select('id, stock, es_variable')
      .eq('activo', true)
      .order('id', { ascending: true });

    if (error) {
      console.error('❌ Error al obtener stocks:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          stocks: {}
        }),
        { status: 500 }
      );
    }

    // Construir mapa de stock por producto
    const stocks = {};
    productos?.forEach(p => {
      stocks[p.id] = p.stock;
    });

    console.log(`✅ Stocks obtenidos para ${Object.keys(stocks).length} productos`);

    return new Response(
      JSON.stringify({
        success: true,
        stocks: stocks,
        totalProductos: productos?.length || 0
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en endpoint stocks:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error), stocks: {} }),
      { status: 500 }
    );
  }
};
