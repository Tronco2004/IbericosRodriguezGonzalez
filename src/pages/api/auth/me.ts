import type { APIRoute } from 'astro';
import { obtenerUsuarioDelToken } from '../../../lib/auth';

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get('auth_token')?.value;

  if (!token) {
    return new Response(
      JSON.stringify({ success: false, usuario: null }),
      { status: 401 }
    );
  }

  const usuario = obtenerUsuarioDelToken(token);

  if (!usuario) {
    return new Response(
      JSON.stringify({ success: false, usuario: null }),
      { status: 401 }
    );
  }

  return new Response(
    JSON.stringify({ success: true, usuario }),
    { status: 200 }
  );
};
