import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request }) => {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, message: 'No autenticado' }),
        { status: 401 }
      );
    }

    // Verificar que sea admin
    const { data: usuario, error: errorUsuario } = await supabaseAdmin
      .from('usuarios')
      .select('rol')
      .eq('id', userId)
      .single();

    if (errorUsuario || usuario.rol !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, message: 'No autorizado' }),
        { status: 403 }
      );
    }

    // Obtener todos los códigos
    const { data: codigos, error: errorCodigos } = await supabaseAdmin
      .from('codigos_promocionales')
      .select('*')
      .order('fecha_creacion', { ascending: false });

    if (errorCodigos) {
      console.error('Error obteniendo códigos:', errorCodigos);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al obtener códigos' }),
        { status: 500 }
      );
    }

    // Obtener estadísticas de uso para cada código
    const codigosConEstadisticas = await Promise.all(
      codigos.map(async (codigo) => {
        const { data: usos, error: errorUsos } = await supabaseAdmin
          .from('uso_codigos')
          .select('*')
          .eq('codigo_id', codigo.id);

        const descuentoTotal = usos
          ? usos.reduce((sum, uso) => sum + uso.descuento_aplicado, 0)
          : 0;

        return {
          ...codigo,
          usos_totales: usos ? usos.length : 0,
          descuento_total: descuentoTotal,
          ultima_uso: usos && usos.length > 0 ? usos[0].fecha_uso : null
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        codigos: codigosConEstadisticas
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en listar códigos:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
