import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const POST: APIRoute = async ({ cookies, request }) => {
  const accessToken = cookies.get('auth_token')?.value || cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  // Revocar sesión en Supabase si tenemos ambos tokens
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
    } catch {
      // No es crítico, las cookies se borran de todas formas
    }
  }

  // Borrar cookies con Set-Cookie headers explícitos.
  // Solo 2 variantes por cookie: con y sin Secure (cubre login.ts secure:true y oauth-session.ts secure:false)
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  // Necesario para que el navegador no cachée esta respuesta
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  const httpOnlyCookies = ['auth_token', 'user_id', 'sb-access-token', 'sb-refresh-token'];
  const publicCookies = ['user_role', 'user_name'];

  for (const name of httpOnlyCookies) {
    headers.append('Set-Cookie', `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; HttpOnly`);
    headers.append('Set-Cookie', `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure; HttpOnly`);
  }

  for (const name of publicCookies) {
    headers.append('Set-Cookie', `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax`);
    headers.append('Set-Cookie', `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure`);
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Sesión cerrada' }),
    { status: 200, headers }
  );
};
