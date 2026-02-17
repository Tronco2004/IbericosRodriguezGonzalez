import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

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
    const { data: codigo, error: errorCodigo } = await supabaseAdmin
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
    const { data: usos, error: errorUsos } = await supabaseAdmin
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
          const { data: usuarioData } = await supabaseAdmin
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
    await supabaseAdmin
      .from('uso_codigos')
      .delete()
      .eq('codigo_id', parseInt(codigoId));

    // Eliminar el código
    const { error: errorCodigo } = await supabaseAdmin
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

    // Construir objeto de actualización con los campos proporcionados
    const updateData: Record<string, any> = {};
    if (body.activo !== undefined) updateData.activo = body.activo;
    if (body.codigo !== undefined) updateData.codigo = body.codigo;
    if (body.descripcion !== undefined) updateData.descripcion = body.descripcion;
    if (body.tipo_descuento !== undefined) updateData.tipo_descuento = body.tipo_descuento;
    if (body.valor_descuento !== undefined) updateData.valor_descuento = body.valor_descuento;
    if (body.fecha_inicio !== undefined) updateData.fecha_inicio = body.fecha_inicio;
    if (body.fecha_fin !== undefined) updateData.fecha_fin = body.fecha_fin;
    if (body.uso_maximo !== undefined) updateData.uso_maximo = body.uso_maximo;
    if (body.restriccion_monto_minimo !== undefined) updateData.restriccion_monto_minimo = body.restriccion_monto_minimo;
    if (body.usos_totales !== undefined) updateData.usos_totales = body.usos_totales;

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No hay campos para actualizar' }),
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('codigos_promocionales')
      .update(updateData)
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
      JSON.stringify({ success: true, codigo: data, message: 'Código actualizado correctamente' }),
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
