import type { APIRoute } from 'astro';
import { cerrarSesion } from '../../../lib/auth';

export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get('auth_token')?.value;

  if (token) {
    cerrarSesion(token);
  }

  // Eliminar cookie
  cookies.delete('auth_token');

  return new Response(
    JSON.stringify({ success: true, message: 'Sesión cerrada' }),
    { status: 200 }
  );
};
