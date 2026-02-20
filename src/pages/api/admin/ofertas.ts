import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Obtener todas las ofertas (incluyendo inactivas)
    const { data: ofertas, error } = await supabaseAdmin
      .from('ofertas')
      .select(`
        id,
        nombre_oferta,
        descripcion,
        precio_original_centimos,
        precio_descuento_centimos,
        porcentaje_descuento,
        fecha_inicio,
        fecha_fin,
        activa,
        imagen_url,
        orden,
        fecha_creacion,
        fecha_actualizacion,
        producto:productos(
          id,
          nombre,
          descripcion,
          imagen_url
        )
      `)
      .order('fecha_fin', { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: 'Error al obtener ofertas' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: ofertas || [] }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      producto_id,
      nombre_oferta,
      descripcion,
      precio_original_centimos,
      precio_descuento_centimos,
      fecha_inicio,
      fecha_fin,
      imagen_url,
      orden
    } = body;

    // Validaciones
    if (!producto_id || !nombre_oferta || !precio_original_centimos || !precio_descuento_centimos) {
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan campos requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (precio_descuento_centimos >= precio_original_centimos) {
      return new Response(
        JSON.stringify({ success: false, error: 'El precio de descuento debe ser menor que el original' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('ofertas')
      .insert([{
        producto_id,
        nombre_oferta,
        descripcion: descripcion || null,
        precio_original_centimos,
        precio_descuento_centimos,
        fecha_inicio,
        fecha_fin,
        imagen_url: imagen_url || null,
        orden: orden || 0
      }])
      .select();

    if (error) {
      console.error('Error creando oferta:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message || 'Error al crear la oferta' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: data?.[0] }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
