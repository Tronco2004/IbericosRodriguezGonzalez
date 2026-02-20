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
  // En Coolify/Docker con proxy reverso, usar X-Forwarded-Proto
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const isSecure = forwardedProto === 'https' || request.url.startsWith('https');
  
  console.log('Logout - isSecure:', isSecure, 'forwardedProto:', forwardedProto, 'url:', request.url);

  // Cookies httpOnly (auth_token, user_id, sb-access-token, sb-refresh-token)
  const cookiesHttpOnly = ['auth_token', 'user_id', 'sb-access-token', 'sb-refresh-token'];
  // Cookies accesibles al frontend (user_role, user_name)
  const cookiesPublicas = ['user_role', 'user_name'];

  // Forzar expiración con Set-Cookie headers que coinciden EXACTAMENTE
  // con los flags usados al crear las cookies (Secure, HttpOnly, SameSite, Path)
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  const paths = ['/', '/api', '/api/auth'];
  
  // Borrar cookies TANTO con Secure como sin él para cubrir ambos casos
  // (las cookies pueden haberse creado con secure:false por error)
  
  // Cookies httpOnly
  for (const nombre of cookiesHttpOnly) {
    for (const path of paths) {
      // Sin Secure
      headers.append('Set-Cookie', `${nombre}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; HttpOnly`);
      // Con Secure
      headers.append('Set-Cookie', `${nombre}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure; HttpOnly`);
    }
  }

  // Cookies públicas
  for (const nombre of cookiesPublicas) {
    for (const path of paths) {
      // Sin Secure
      headers.append('Set-Cookie', `${nombre}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax`);
      // Con Secure
      headers.append('Set-Cookie', `${nombre}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure`);
    }
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Sesión cerrada' }),
    { status: 200, headers }
  );
};
