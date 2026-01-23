import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, message: 'No autenticado' }),
        { status: 401 }
      );
    }

    // Verificar que sea admin
    const { data: usuario, error: errorUsuario } = await supabaseClient
      .from('usuarios')
      .select('rol')
      .eq('id', userId)
      .single();

    if (errorUsuario || usuario?.rol !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, message: 'No autorizado: requiere ser admin' }),
        { status: 403 }
      );
    }

    const {
      codigo,
      descripcion,
      tipo_descuento,
      valor_descuento,
      uso_maximo,
      fecha_inicio,
      fecha_fin,
      restriccion_monto_minimo
    } = await request.json();

    // Validaciones
    if (!codigo || !tipo_descuento || !valor_descuento || !fecha_inicio || !fecha_fin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Datos incompletos' }),
        { status: 400 }
      );
    }

    if (!['porcentaje', 'fijo'].includes(tipo_descuento)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Tipo de descuento no válido' }),
        { status: 400 }
      );
    }

    // Crear código
    const { data: nuevoCodigoData, error: errorCrear } = await supabaseClient
      .from('codigos_promocionales')
      .insert({
        codigo: codigo.toUpperCase(),
        descripcion,
        tipo_descuento,
        valor_descuento: parseFloat(valor_descuento),
        uso_maximo: uso_maximo ? parseInt(uso_maximo) : null,
        fecha_inicio,
        fecha_fin,
        restriccion_monto_minimo: restriccion_monto_minimo ? parseFloat(restriccion_monto_minimo) : null,
        activo: true
      })
      .select()
      .single();

    if (errorCrear) {
      console.error('Error creando código:', errorCrear);
      if (errorCrear.message.includes('duplicate')) {
        return new Response(
          JSON.stringify({ success: false, message: 'Este código ya existe' }),
          { status: 400 }
        );
      }
      return new Response(
        JSON.stringify({ success: false, message: errorCrear.message || 'Error al crear el código' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Código creado correctamente',
        codigo: nuevoCodigoData
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en crear código:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
