import type { APIRoute } from 'astro';
import { obtenerUsuarioDelToken } from '../../../lib/auth';
import { supabaseClient, supabaseAdmin } from '../../../lib/supabase';

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
    const { data: usuario, error } = await supabaseAdmin
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

    // Detectar el provider del usuario en auth.users
    let provider = 'email'; // por defecto
    let tienePassword = true;
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authData?.user) {
        provider = authData.user.app_metadata?.provider || 'email';
        // Un usuario tiene password si su provider es 'email' o tiene identities con provider 'email'
        const identities = authData.user.identities || [];
        const tieneEmailIdentity = identities.some((i: any) => i.provider === 'email');
        tienePassword = provider === 'email' || tieneEmailIdentity;
      }
    } catch (e) {
      console.warn('No se pudo obtener provider del usuario:', e);
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
          rol: usuario.rol,
          provider,
          tienePassword
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
