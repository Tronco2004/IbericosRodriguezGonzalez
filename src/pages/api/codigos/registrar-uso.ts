import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const userId = request.headers.get('x-user-id');
    const { codigo, pedido_id, email_usuario } = await request.json();

    if (!codigo || !pedido_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Datos incompletos' }),
        { status: 400 }
      );
    }

    // Obtener el ID del código
    const { data: codigoData, error: errorCodigo } = await supabaseClient
      .from('codigos_promocionales')
      .select('id, valor_descuento, tipo_descuento')
      .eq('codigo', codigo.toUpperCase())
      .single();

    if (errorCodigo || !codigoData) {
      return new Response(
        JSON.stringify({ success: false, message: 'Código no encontrado' }),
        { status: 404 }
      );
    }

    // Calcular descuento aplicado (obtener del pedido o calcular)
    let descuentoAplicado = codigoData.valor_descuento;
    
    // Registrar el uso
    const { error: errorUso } = await supabaseClient
      .from('uso_codigos')
      .insert({
        codigo_id: codigoData.id,
        usuario_id: userId || null,
        pedido_id: pedido_id,
        descuento_aplicado: descuentoAplicado,
        email_usuario: email_usuario
      });

    if (errorUso) {
      console.error('Error registrando uso:', errorUso);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al registrar el uso del código' }),
        { status: 500 }
      );
    }

    // Actualizar contador de usos
    const { error: errorUpdate } = await supabaseClient
      .from('codigos_promocionales')
      .update({ usos_actuales: codigoData.id })
      .eq('id', codigoData.id);

    if (errorUpdate) {
      console.error('Error actualizando contador:', errorUpdate);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Código registrado correctamente' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error registrando código:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
