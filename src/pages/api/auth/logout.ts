import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const POST: APIRoute = async ({ cookies, request }) => {
  // Leer tokens ANTES de borrar cookies
  const accessToken = cookies.get('auth_token')?.value || cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  console.log('Logout - tokens encontrados:', {
    accessToken: !!accessToken,
    refreshToken: !!refreshToken,
    cookieHeader: !!request.headers.get('cookie'),
  });

  // Revocar sesión en Supabase si tenemos tokens
  if (accessToken && refreshToken) {
    try {
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      await tempClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      await tempClient.auth.signOut();
      console.log('Sesión Supabase revocada correctamente');
    } catch (e) {
      console.error('Error revocando sesión Supabase:', e);
    }
  } else if (accessToken) {
    // Si solo tenemos access token (login email/password no guarda refresh token),
    // intentar revocar igualmente
    try {
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      // signOut sin sesión cargada: al menos invalida la sesión local del cliente
      await tempClient.auth.signOut();
    } catch (e) {
      // No es crítico, las cookies se borran de todas formas
    }
  }

  // Borrar cookies usando Astro API (método más fiable)
  const allCookieNames = ['auth_token', 'user_id', 'sb-access-token', 'sb-refresh-token', 'user_role', 'user_name'];
  for (const name of allCookieNames) {
    cookies.delete(name, { path: '/' });
  }

  // Headers manuales como respaldo adicional
  // (cubre cookies que pudieron establecerse con flags distintos: secure/no-secure, httpOnly/no-httpOnly)
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  for (const nombre of allCookieNames) {
    // Sin Secure, sin HttpOnly
    headers.append('Set-Cookie', `${nombre}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax`);
    // Con Secure, sin HttpOnly
    headers.append('Set-Cookie', `${nombre}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure`);
    // Sin Secure, con HttpOnly
    headers.append('Set-Cookie', `${nombre}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; HttpOnly`);
    // Con Secure, con HttpOnly
    headers.append('Set-Cookie', `${nombre}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure; HttpOnly`);
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Sesión cerrada' }),
    { status: 200, headers }
  );
};
