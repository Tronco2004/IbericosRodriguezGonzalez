import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

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
    const updates: Record<string, any> = {
      fecha_actualizacion: new Date().toISOString()
    };

    // Actualizar solo los campos proporcionados
    if (body.nombre_oferta) updates.nombre_oferta = body.nombre_oferta;
    if (body.descripcion !== undefined) updates.descripcion = body.descripcion;
    if (body.precio_original_centimos) updates.precio_original_centimos = body.precio_original_centimos;
    if (body.precio_descuento_centimos) updates.precio_descuento_centimos = body.precio_descuento_centimos;
    if (body.fecha_inicio) updates.fecha_inicio = body.fecha_inicio;
    if (body.fecha_fin) updates.fecha_fin = body.fecha_fin;
    if (body.imagen_url !== undefined) updates.imagen_url = body.imagen_url;
    if (body.orden !== undefined) updates.orden = body.orden;
    if (body.activa !== undefined) updates.activa = body.activa;

    const { data, error } = await supabase
      .from('ofertas')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: 'Error al actualizar oferta' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: data?.[0] }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
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

    const { error } = await supabase
      .from('ofertas')
      .delete()
      .eq('id', id);

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: 'Error al eliminar oferta' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Oferta eliminada' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
