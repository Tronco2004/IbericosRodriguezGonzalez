import type { APIRoute } from 'astro';
import { obtenerUsuarioDelToken } from '../../../lib/auth';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ cookies, request }) => {
  try {
    // Intentar obtener userId del header x-user-id primero
    let userId = request.headers.get('x-user-id');
    
    // Si no viene en header, intentar desde la cookie user_id directamente
    if (!userId) {
      userId = cookies.get('user_id')?.value;
    }
    
    // Si no viene en cookie, intentar desde el token
    if (!userId) {
      const token = cookies.get('auth_token')?.value;
      if (token) {
        const usuario = obtenerUsuarioDelToken(token);
        if (usuario && usuario.id) {
          userId = usuario.id;
        }
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, usuario: null, error: 'No autenticado' }),
        { status: 401 }
      );
    }

    // Obtener datos del usuario desde la BD
    const { data: usuario, error } = await supabaseClient
      .from('usuarios')
      .select('id, nombre, email, telefono, direccion, rol')
      .eq('id', userId)
      .single();

    if (error || !usuario) {
      return new Response(
        JSON.stringify({ success: false, usuario: null, error: 'Usuario no encontrado' }),
        { status: 404 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        usuario: {
          id: usuario.id,
          email: usuario.email,
          nombre: usuario.nombre,
          telefono: usuario.telefono,
          direccion: usuario.direccion,
          rol: usuario.rol
        }
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en GET /api/auth/me:', error);
    return new Response(
      JSON.stringify({ success: false, usuario: null, error: 'Error interno' }),
      { status: 500 }
    );
  }
};
