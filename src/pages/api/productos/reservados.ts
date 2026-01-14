import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    // Obtener todos los items del carrito con variantes
    const { data: items, error } = await supabaseClient
      .from('carrito_items')
      .select(`
        id,
        producto_id,
        producto_variante_id,
        fecha_agregado
      `);

    if (error) {
      console.error('Error obteniendo items:', error);
      return new Response(
        JSON.stringify({ variantesReservadas: {} }),
        { status: 200 }
      );
    }

    const ahora = new Date();
    const variantesReservadas: { [key: number]: number[] } = {}; // { producto_id: [variante_id1, variante_id2] }

    // Filtrar items que están dentro del período de 15 minutos
    (items || []).forEach(item => {
      // Agregar 'Z' al timestamp si no lo tiene
      let fechaStr = item.fecha_agregado;
      if (fechaStr && !fechaStr.endsWith('Z')) {
        fechaStr = fechaStr + 'Z';
      }

      if (!fechaStr) return;

      const fechaAgregado = new Date(fechaStr);
      const minutosPasados = (ahora.getTime() - fechaAgregado.getTime()) / (1000 * 60);

      // Si el item está reservado (menos de 15 minutos) y tiene variante
      if (minutosPasados <= 15 && item.producto_variante_id) {
        if (!variantesReservadas[item.producto_id]) {
          variantesReservadas[item.producto_id] = [];
        }
        if (!variantesReservadas[item.producto_id].includes(item.producto_variante_id)) {
          variantesReservadas[item.producto_id].push(item.producto_variante_id);
        }
      }
    });

    return new Response(
      JSON.stringify({ 
        variantesReservadas,
        cantidad: Object.values(variantesReservadas).reduce((sum, arr) => sum + arr.length, 0)
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ variantesReservadas: {} }),
      { status: 200 }
    );
  }
};
