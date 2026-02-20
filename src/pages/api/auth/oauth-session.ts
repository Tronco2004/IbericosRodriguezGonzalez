import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de ambiente de Supabase');
}

// Cliente admin para insertar usuarios sin restricciones RLS
const supabaseAdmin = supabaseServiceRoleKey && supabaseServiceRoleKey.startsWith('eyJ')
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : createClient(supabaseUrl, supabaseAnonKey);

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { access_token, refresh_token } = body;

    if (!access_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se proporcionó access_token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar el token y obtener los datos del usuario autenticado
    const supabaseWithToken = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${access_token}` } }
    });

    const { data: { user: authUser }, error: userError } = await supabaseWithToken.auth.getUser(access_token);

    if (userError || !authUser) {
      console.error('Error verificando token OAuth:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido o expirado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const email = authUser.email || '';
    const nombre = authUser.user_metadata?.full_name
      || authUser.user_metadata?.name
      || email.split('@')[0]
      || 'Usuario';

    console.log('🔐 OAuth session - Usuario verificado');
    console.log('   Provider:', authUser.app_metadata?.provider);

    // Buscar o crear usuario en la tabla "usuarios"
    let usuarioData: { id: string; nombre: string; email: string; rol: string; telefono?: string; direccion?: string } | null = null;
    let esNuevo = false;

    // Buscar por email
    const { data: existingUser } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre, email, rol, activo, telefono, direccion')
      .eq('email', email)
      .single();

    if (existingUser) {
      if (!existingUser.activo) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tu cuenta ha sido desactivada. Contacta con soporte.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      usuarioData = existingUser;
      console.log('✅ Usuario existente:', existingUser.nombre, '- Rol:', existingUser.rol);
    } else {
      // Crear nuevo usuario
      console.log('🆕 Creando usuario en tabla usuarios');
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('usuarios')
        .insert({
          id: authUser.id,
          nombre: nombre,
          email: email,
          rol: 'cliente',
          activo: true,
        })
        .select('id, nombre, email, rol')
        .single();

      if (insertError) {
        console.error('Error creando usuario:', insertError);
        // Reintentar búsqueda por si ya existía
        const { data: retryUser } = await supabaseAdmin
          .from('usuarios')
          .select('id, nombre, email, rol')
          .eq('email', email)
          .single();

        if (retryUser) {
          usuarioData = retryUser;
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'No se pudo crear la cuenta' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } else {
        usuarioData = newUser;
        esNuevo = true;
        console.log('✅ Nuevo usuario creado:', newUser?.nombre);
      }
    }

    if (!usuarioData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Error obteniendo datos del usuario' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Establecer cookies (igual que el login normal)
    cookies.set('sb-access-token', access_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });

    if (refresh_token) {
      cookies.set('sb-refresh-token', refresh_token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }

    cookies.set('auth_token', access_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    cookies.set('user_id', usuarioData.id, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    cookies.set('user_role', usuarioData.rol, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    cookies.set('user_name', usuarioData.nombre, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    console.log('🍪 Cookies OAuth establecidas');

    // Determinar redirección según rol
    const redirect_url = usuarioData.rol === 'admin' ? '/admin/dashboard' : '/productos';

    // Verificar si el perfil está incompleto (sin teléfono o sin contraseña)
    const tieneEmailIdentity = authUser.identities?.some(i => i.provider === 'email') ?? false;
    const perfilIncompleto = esNuevo || !usuarioData.telefono || !tieneEmailIdentity;

    return new Response(
      JSON.stringify({
        success: true,
        redirect_url,
        esNuevo,
        perfilIncompleto,
        usuario: {
          id: usuarioData.id,
          nombre: usuarioData.nombre,
          email: usuarioData.email,
          rol: usuarioData.rol,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en oauth-session:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
