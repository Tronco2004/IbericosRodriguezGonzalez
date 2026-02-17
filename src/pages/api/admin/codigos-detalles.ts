import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const codigoId = url.searchParams.get('id') || url.searchParams.get('codigo_id');

    if (!codigoId) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID de código requerido' }),
        { status: 400 }
      );
    }

    // Obtener datos del código
    const { data: codigo, error: errorCodigo } = await supabaseClient
      .from('codigos_promocionales')
      .select('*')
      .eq('id', parseInt(codigoId))
      .single();

    if (errorCodigo || !codigo) {
      return new Response(
        JSON.stringify({ success: false, message: 'Código no encontrado' }),
        { status: 404 }
      );
    }

    // Obtener todos los usos
    const { data: usos, error: errorUsos } = await supabaseClient
      .from('uso_codigos')
      .select('*')
      .eq('codigo_id', parseInt(codigoId))
      .order('fecha_uso', { ascending: false });

    if (errorUsos) {
      console.error('Error obteniendo usos:', errorUsos);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al obtener usos' }),
        { status: 500 }
      );
    }

    // Obtener nombres de usuarios
    const usosConUsuarios = await Promise.all(
      (usos || []).map(async (uso) => {
        let nombreUsuario = uso.email_usuario || 'Anónimo';
        
        if (uso.usuario_id) {
          const { data: usuarioData } = await supabaseClient
            .from('usuarios')
            .select('nombre, email')
            .eq('id', uso.usuario_id)
            .single();
          
          if (usuarioData) {
            nombreUsuario = usuarioData.nombre;
          }
        }

        return {
          ...uso,
          nombre_usuario: nombreUsuario
        };
      })
    );

    const totalDescuentos = usosConUsuarios.reduce((sum, uso) => sum + uso.descuento_aplicado, 0);

    return new Response(
      JSON.stringify({
        success: true,
        codigo,
        usos: usosConUsuarios,
        estadisticas: {
          total_usos: usosConUsuarios.length,
          descuento_total: totalDescuentos,
          promedio_descuento: usosConUsuarios.length > 0 ? (totalDescuentos / usosConUsuarios.length).toFixed(2) : 0
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en detalles código:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const codigoId = url.searchParams.get('id');

    if (!codigoId) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID de código requerido' }),
        { status: 400 }
      );
    }

    // Eliminar los usos del código primero
    await supabaseClient
      .from('uso_codigos')
      .delete()
      .eq('codigo_id', parseInt(codigoId));

    // Eliminar el código
    const { error: errorCodigo } = await supabaseClient
      .from('codigos_promocionales')
      .delete()
      .eq('id', parseInt(codigoId));

    if (errorCodigo) {
      console.error('Error eliminando código:', errorCodigo);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al eliminar el código: ' + errorCodigo.message }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Código eliminado correctamente' }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en DELETE código:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno: ' + error.toString() }),
      { status: 500 }
    );
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const codigoId = url.searchParams.get('id');

    if (!codigoId) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID de código requerido' }),
        { status: 400 }
      );
    }

    const body = await request.json();

    const { data, error } = await supabaseClient
      .from('codigos_promocionales')
      .update({ activo: body.activo })
      .eq('id', parseInt(codigoId))
      .select()
      .single();

    if (error) {
      console.error('Error actualizando código:', error);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al actualizar: ' + error.message }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, codigo: data, message: `Código ${data.activo ? 'activado' : 'desactivado'} correctamente` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en PATCH código:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno: ' + error.toString() }),
      { status: 500 }
    );
  }
};
