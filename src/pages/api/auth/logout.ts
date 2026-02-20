import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const POST: APIRoute = async ({ cookies, request }) => {
  // Cerrar sesión en Supabase usando los tokens reales del usuario
  // (el cliente compartido no tiene la sesión cargada, no sirve para revocar)
  const accessToken = cookies.get('auth_token')?.value || cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

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
      // Continuar con borrado de cookies aunque falle
    }
  } else {
    console.log('Logout: no se encontraron tokens para revocar');
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
