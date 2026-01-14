import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const DELETE: APIRoute = async ({ request }) => {
  console.log('🗑️ [DELETE /api/variantes/eliminar] Iniciando...');
  
  try {
    let body;
    try {
      body = await request.json();
      console.log('📝 Body parseado:', body);
    } catch (parseError) {
      console.error('❌ Error parseando JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'JSON inválido' }),
        { status: 400 }
      );
    }

    const { variante_id } = body;
    console.log('🔍 variante_id extraído:', variante_id);

    if (!variante_id) {
      console.warn('⚠️ variante_id no proporcionado');
      return new Response(
        JSON.stringify({ error: 'variante_id requerido' }),
        { status: 400 }
      );
    }

    console.log('� Marcando variante como no disponible ID:', variante_id);

    // Marcar la variante como no disponible en lugar de eliminarla
    const { data, error } = await supabaseClient
      .from('producto_variantes')
      .update({ disponible: false })
      .eq('id', variante_id)
      .select();

    console.log('📊 Resultado update:', { rowCount: data?.length, error });

    if (error) {
      console.error('❌ Error de Supabase:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Error al marcar la variante como no disponible',
          details: error.message 
        }),
        { status: 500 }
      );
    }

    console.log('✅ Variante marcada como no disponible, filas afectadas:', data?.length);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Variante marcada como no disponible'
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Error en endpoint:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        details: String(error)
      }),
      { status: 500 }
    );
  }
};
