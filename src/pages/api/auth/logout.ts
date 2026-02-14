import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ cookies }) => {
  // Cerrar sesión en Supabase
  try {
    await supabaseClient.auth.signOut();
  } catch (e) {
    console.error('Error cerrando sesión en Supabase:', e);
  }

  // Eliminar todas las cookies de sesión
  cookies.delete('auth_token', { path: '/' });
  cookies.delete('user_id', { path: '/' });
  cookies.delete('user_role', { path: '/' });
  cookies.delete('user_name', { path: '/' });

  return new Response(
    JSON.stringify({ success: true, message: 'Sesión cerrada' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
