import type { APIRoute } from 'astro';
import { supabaseClient } from '../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    // Debug: obtener variantes del producto 13 (Queso Montelareina)
    const { data: variantes, error } = await supabaseClient
      .from('producto_variantes')
      .select('*')
      .eq('producto_id', 13);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        producto_id: 13,
        total: variantes?.length ?? 0,
        variantes: variantes || [],
        disponibles: variantes?.filter(v => v.disponible).length ?? 0
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
