import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export const PUT: APIRoute = async ({ request, params }) => {
  try {
    const id = params.id ? parseInt(params.id) : null;
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID de oferta requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
      orden,
      activa
    } = body;

    // Validaciones
    if (precio_descuento_centimos && precio_original_centimos && precio_descuento_centimos >= precio_original_centimos) {
      return new Response(
        JSON.stringify({ success: false, error: 'El precio de descuento debe ser menor que el original' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updates: Record<string, any> = {
      fecha_actualizacion: new Date().toISOString()
    };

    // Actualizar solo los campos proporcionados
    if (producto_id) updates.producto_id = producto_id;
    if (nombre_oferta) updates.nombre_oferta = nombre_oferta;
    if (descripcion !== undefined) updates.descripcion = descripcion;
    if (precio_original_centimos) updates.precio_original_centimos = precio_original_centimos;
    if (precio_descuento_centimos) updates.precio_descuento_centimos = precio_descuento_centimos;
    if (fecha_inicio) updates.fecha_inicio = fecha_inicio;
    if (fecha_fin) updates.fecha_fin = fecha_fin;
    if (imagen_url !== undefined) updates.imagen_url = imagen_url;
    if (orden !== undefined) updates.orden = orden;
    if (activa !== undefined) updates.activa = activa;

    // Usar cliente anónimo - RLS validará que sea admin
    const { data, error } = await supabase
      .from('ofertas')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error actualizando oferta:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message || 'Error al actualizar oferta' }),
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
      JSON.stringify({ success: false, error: 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    const id = params.id ? parseInt(params.id) : null;
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID de oferta requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Usar cliente anónimo - RLS validará que sea admin
    const { error } = await supabase
      .from('ofertas')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando oferta:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message || 'Error al eliminar oferta' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Oferta eliminada' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
