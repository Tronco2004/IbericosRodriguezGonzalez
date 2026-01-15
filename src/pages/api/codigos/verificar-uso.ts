import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request }) => {
  try {
    const userId = request.headers.get('x-user-id');
    const url = new URL(request.url);
    const codigoId = url.searchParams.get('codigo_id');

    if (!userId || !codigoId) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar si el usuario ya usó este código
    const { data: usoExistente, error } = await supabaseClient
      .from('uso_codigos')
      .select('*')
      .eq('codigo_id', parseInt(codigoId))
      .eq('usuario_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return new Response(JSON.stringify({
      yaUsado: !!usoExistente,
      uso: usoExistente || null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error verificando uso:', error);
    return new Response(JSON.stringify({ error: 'Error al verificar' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
