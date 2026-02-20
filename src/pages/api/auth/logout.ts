import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ cookies, request }) => {
  // Cerrar sesión en Supabase
  try {
    await supabaseClient.auth.signOut();
  } catch (e) {
    console.error('Error cerrando sesión en Supabase:', e);
  }

  // Detectar si estamos en producción (HTTPS)
  const isSecure = request.url.startsWith('https');

  // Cookies httpOnly (auth_token, user_id, sb-access-token, sb-refresh-token)
  const cookiesHttpOnly = ['auth_token', 'user_id', 'sb-access-token', 'sb-refresh-token'];
  // Cookies accesibles al frontend (user_role, user_name)
  const cookiesPublicas = ['user_role', 'user_name'];

  // Forzar expiración con Set-Cookie headers que coinciden EXACTAMENTE
  // con los flags usados al crear las cookies (Secure, HttpOnly, SameSite, Path)
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  const paths = ['/', '/api', '/api/auth'];
  const secureFlag = isSecure ? ' Secure;' : '';

  // Cookies httpOnly: necesitan HttpOnly y Secure para coincidir con las originales
  for (const nombre of cookiesHttpOnly) {
    for (const path of paths) {
      headers.append('Set-Cookie', `${nombre}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax;${secureFlag} HttpOnly`);
    }
  }

  // Cookies públicas: necesitan Secure pero NO HttpOnly
  for (const nombre of cookiesPublicas) {
    for (const path of paths) {
      headers.append('Set-Cookie', `${nombre}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax;${secureFlag}`);
    }
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Sesión cerrada' }),
    { status: 200, headers }
  );
};
