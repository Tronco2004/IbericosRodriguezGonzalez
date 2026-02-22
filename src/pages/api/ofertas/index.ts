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
        producto_id,
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
          rating,
          stock,
          es_variable
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

    // Para productos variables, contar variantes disponibles como stock
    const ofertasEnriquecidas = ofertas || [];
    const productosVariables = ofertasEnriquecidas.filter((o: any) => o.producto?.es_variable);

    if (productosVariables.length > 0) {
      const idsVariables = productosVariables.map((o: any) => o.producto.id);
      const { data: variantes } = await supabase
        .from('producto_variantes')
        .select('producto_id')
        .in('producto_id', idsVariables)
        .eq('disponible', true);

      const conteoVariantes: Record<number, number> = {};
      variantes?.forEach((v: any) => {
        conteoVariantes[v.producto_id] = (conteoVariantes[v.producto_id] || 0) + 1;
      });

      ofertasEnriquecidas.forEach((o: any) => {
        if (o.producto?.es_variable) {
          o.producto.stock_real = conteoVariantes[o.producto.id] || 0;
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: ofertasEnriquecidas,
        count: ofertasEnriquecidas.length
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
