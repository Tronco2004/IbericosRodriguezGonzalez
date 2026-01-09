import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de ambiente de Supabase');
}

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export const GET: APIRoute = async ({ request, url, cookies }) => {
  try {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      return new Response('Error: No authorization code received', { status: 400 });
    }

    // Cambiar el código por una sesión
    const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error intercambiando código:', error);
      return new Response(
        `<html><body>
          <h1>Error de autenticación</h1>
          <p>${error.message}</p>
          <p><a href="/login">Volver al login</a></p>
        </body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!data.session) {
      return new Response('No session data received', { status: 500 });
    }

    // Guardar la sesión en cookies
    const { access_token, refresh_token } = data.session;

    cookies.set('sb-access-token', access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 año
      path: '/',
    });

    cookies.set('sb-refresh-token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 año
      path: '/',
    });

    // Parsear la redirección del state si existe
    let redirectTo = '/';
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        redirectTo = stateData.redirectTo || '/';
      } catch (e) {
        console.warn('No se pudo parsear el state:', e);
      }
    }

    // Redirigir al dashboard o página solicitada
    const finalRedirect = redirectTo.startsWith('/admin') ? redirectTo : '/';
    return new Response(null, {
      status: 302,
      headers: {
        Location: finalRedirect,
      },
    });
  } catch (error) {
    console.error('Error en callback de autenticación:', error);
    return new Response(
      `<html><body>
        <h1>Error en el callback de autenticación</h1>
        <p>${error instanceof Error ? error.message : 'Error desconocido'}</p>
        <p><a href="/login">Volver al login</a></p>
      </body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
};
