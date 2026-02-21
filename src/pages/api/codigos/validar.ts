import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar que el usuario esté autenticado
    const userId = cookies.get('user_id')?.value;
    
    if (!userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Debes iniciar sesión para usar códigos de descuento',
          requiresLogin: true
        }),
        { status: 401 }
      );
    }

    const { codigo, monto_carrito } = await request.json();

    if (!codigo) {
      return new Response(
        JSON.stringify({ success: false, message: 'Código requerido' }),
        { status: 400 }
      );
    }

    // Buscar el código
    const { data: codigoData, error: errorCodigo } = await supabaseClient
      .from('codigos_promocionales')
      .select('*')
      .eq('codigo', codigo.toUpperCase())
      .single();

    if (errorCodigo || !codigoData) {
      return new Response(
        JSON.stringify({ success: false, message: 'Código no válido' }),
        { status: 404 }
      );
    }

    // Validar que el código esté activo
    if (!codigoData.activo) {
      return new Response(
        JSON.stringify({ success: false, message: 'Este código no está disponible' }),
        { status: 400 }
      );
    }

    // Validar fechas
    const ahora = new Date();
    const fechaInicio = new Date(codigoData.fecha_inicio);
    const fechaFin = new Date(codigoData.fecha_fin);

    if (ahora < fechaInicio) {
      return new Response(
        JSON.stringify({ success: false, message: 'Este código aún no está disponible' }),
        { status: 400 }
      );
    }

    if (ahora > fechaFin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Este código ha expirado' }),
        { status: 400 }
      );
    }

    // Validar usos máximos
    if (codigoData.uso_maximo && codigoData.usos_actuales >= codigoData.uso_maximo) {
      return new Response(
        JSON.stringify({ success: false, message: 'Este código ya ha alcanzado el límite de usos' }),
        { status: 400 }
      );
    }

    // Validar monto mínimo
    if (codigoData.restriccion_monto_minimo && monto_carrito < codigoData.restriccion_monto_minimo) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `El monto mínimo para usar este código es ${codigoData.restriccion_monto_minimo}€` 
        }),
        { status: 400 }
      );
    }

    // Calcular descuento
    let descuento = 0;
    if (codigoData.tipo_descuento === 'porcentaje') {
      descuento = (monto_carrito * codigoData.valor_descuento) / 100;
    } else {
      descuento = codigoData.valor_descuento;
    }

    return new Response(
      JSON.stringify({
        success: true,
        codigo_id: codigoData.id,
        descuento: descuento,
        tipo_descuento: codigoData.tipo_descuento,
        valor: codigoData.valor_descuento,
        mensaje: `Descuento aplicado: ${descuento.toFixed(2)}€`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error validando código:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error al procesar el código' }),
      { status: 500 }
    );
  }
};
