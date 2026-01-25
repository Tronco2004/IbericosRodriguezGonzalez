import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { productoId } = params;

    if (!productoId) {
      return new Response(
        JSON.stringify({ success: false, error: 'producto_id es requerido' }),
        { status: 400 }
      );
    }

    console.log('📦 [API] Cargando variantes para producto:', productoId);

    const { data, error } = await supabaseClient
      .from('producto_variantes')
      .select('*')
      .eq('producto_id', parseInt(productoId))
      .order('peso_kg', { ascending: true });

    if (error) {
      console.error('❌ Error al cargar variantes:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500 }
      );
    }

    console.log(`✅ [API] Variantes cargadas para producto ${productoId}:`, data?.length || 0, 'registros');
    if (data && data.length > 0) {
      data.forEach(v => {
        console.log(`  - ID: ${v.id}, peso: ${v.peso_kg}kg, disponible: ${v.disponible}, precio: ${v.precio_total}`);
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        variantes: data || []
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('❌ Error en endpoint de variantes:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
