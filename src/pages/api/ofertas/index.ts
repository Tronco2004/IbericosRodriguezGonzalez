import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '6');

    // Obtener ofertas activas con sus productos
    const { data: ofertas, error } = await supabase
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
        imagen_url,
        orden,
        producto:productos(
          id,
          nombre,
          descripcion,
          imagen_url,
          categoria_id,
          rating
        )
      `)
      .eq('activa', true)
      .lte('fecha_inicio', new Date().toISOString())
      .gte('fecha_fin', new Date().toISOString())
      .order('orden', { ascending: true })
      .order('fecha_fin', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error obteniendo ofertas:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al obtener ofertas' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: ofertas || [],
        count: ofertas?.length || 0
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en endpoint ofertas:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
