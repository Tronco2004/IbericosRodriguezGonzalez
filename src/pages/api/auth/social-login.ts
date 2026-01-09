import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de ambiente de Supabase');
}

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export const POST: APIRoute = async ({ request }) => {
  try {
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método no permitido' }),
        { status: 405 }
      );
    }

    const body = await request.json();
    const { provider, redirectTo = '/' } = body;

    // Validar que el proveedor sea válido
    const validProviders = ['google', 'apple', 'facebook'];
    if (!provider || !validProviders.includes(provider)) {
      return new Response(
        JSON.stringify({ error: 'Proveedor de autenticación no válido' }),
        { status: 400 }
      );
    }

    // Obtener la URL del sitio desde el header Host
    const protocol = request.url.startsWith('https') ? 'https' : 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const callbackUrl = `${protocol}://${host}/api/auth/callback`;

    // Crear URL de autenticación con Supabase
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: provider as 'google' | 'apple' | 'facebook',
      options: {
        redirectTo: callbackUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Error de Supabase Auth:', error);
      return new Response(
        JSON.stringify({ 
          error: error.message || 'Error al iniciar sesión social',
          success: false 
        }),
        { status: 500 }
      );
    }

    if (!data || !data.url) {
      return new Response(
        JSON.stringify({ 
          error: 'No se pudo obtener la URL de autenticación',
          success: false 
        }),
        { status: 500 }
      );
    }

    // Agregar parámetro de redirección si está disponible
    const authUrl = new URL(data.url);
    if (redirectTo && redirectTo !== '/') {
      authUrl.searchParams.set('state', btoa(JSON.stringify({ redirectTo })));
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: authUrl.toString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en social login:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error desconocido',
        success: false,
      }),
      { status: 500 }
    );
  }
};
