import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ cookies }) => {
  // Cerrar sesión en Supabase
  try {
    await supabaseClient.auth.signOut();
  } catch (e) {
    console.error('Error cerrando sesión en Supabase:', e);
  }

  // Cookies con path explícito '/'
  const cookiesConPath = ['sb-access-token', 'sb-refresh-token'];
  // Cookies sin path explícito (se crean en /api/auth/*)
  const cookiesSinPath = ['auth_token', 'user_id', 'user_role', 'user_name'];

  // Eliminar todas con múltiples paths para cubrir todos los casos
  for (const nombre of [...cookiesConPath, ...cookiesSinPath]) {
    cookies.delete(nombre, { path: '/' });
    cookies.delete(nombre, { path: '/api' });
    cookies.delete(nombre, { path: '/api/auth' });
    cookies.delete(nombre);
  }

  // Forzar expiración con Set-Cookie headers individuales (no se pueden combinar con comas)
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  const todasLasCookies = [...cookiesConPath, ...cookiesSinPath];
  const paths = ['/', '/api', '/api/auth'];
  
  for (const nombre of todasLasCookies) {
    for (const path of paths) {
      headers.append('Set-Cookie', `${nombre}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax`);
    }
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Sesión cerrada' }),
    { status: 200, headers }
  );
};
