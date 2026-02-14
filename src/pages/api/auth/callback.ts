import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de ambiente de Supabase');
}

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Cliente admin para insertar/actualizar en tabla usuarios sin restricciones RLS
const supabaseAdmin = supabaseServiceRoleKey && supabaseServiceRoleKey.startsWith('eyJ')
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : supabaseClient;

export const GET: APIRoute = async ({ request, url, cookies }) => {
  try {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      return new Response('Error: No authorization code received', { status: 400 });
    }

    // Cambiar el código por una sesión
    const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error intercambiando código:', error);
      return new Response(
        `<html><body>
          <h1>Error de autenticación</h1>
          <p>${error.message}</p>
          <p><a href="/login">Volver al login</a></p>
        </body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!data.session || !data.user) {
      return new Response('No session data received', { status: 500 });
    }

    const { access_token, refresh_token } = data.session;
    const authUser = data.user;

    // Extraer nombre del usuario de los metadatos de Google
    const nombre = authUser.user_metadata?.full_name 
      || authUser.user_metadata?.name 
      || authUser.email?.split('@')[0] 
      || 'Usuario';
    const email = authUser.email || '';

    console.log('🔐 OAuth callback - Usuario autenticado:', email);
    console.log('   Provider:', authUser.app_metadata?.provider);
    console.log('   Nombre:', nombre);

    // Crear o actualizar el usuario en la tabla "usuarios"
    let usuarioData: { id: string; nombre: string; email: string; rol: string } | null = null;

    // Primero buscar si ya existe por email
    const { data: existingUser, error: findError } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre, email, rol, activo')
      .eq('email', email)
      .single();

    if (existingUser) {
      // Usuario ya existe - verificar que esté activo
      if (!existingUser.activo) {
        console.log('❌ Usuario inactivo:', email);
        return new Response(
          `<html><body>
            <h1>Cuenta desactivada</h1>
            <p>Tu cuenta ha sido desactivada. Contacta con soporte.</p>
            <p><a href="/login">Volver al login</a></p>
          </body></html>`,
          { status: 403, headers: { 'Content-Type': 'text/html' } }
        );
      }
      usuarioData = existingUser;
      console.log('✅ Usuario existente encontrado:', existingUser.nombre, '- Rol:', existingUser.rol);
    } else {
      // Usuario nuevo - crear registro en tabla usuarios
      console.log('🆕 Creando nuevo usuario en tabla usuarios:', email);
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('usuarios')
        .insert({
          id: authUser.id, // Usar el mismo ID de Supabase Auth
          nombre: nombre,
          email: email,
          rol: 'cliente', // Por defecto, rol cliente
          activo: true,
        })
        .select('id, nombre, email, rol')
        .single();

      if (insertError) {
        console.error('Error creando usuario en BD:', insertError);
        // Si falla el insert, intentar buscar por si ya existía con otro ID
        const { data: retryUser } = await supabaseAdmin
          .from('usuarios')
          .select('id, nombre, email, rol')
          .eq('email', email)
          .single();
        
        if (retryUser) {
          usuarioData = retryUser;
        } else {
          return new Response(
            `<html><body>
              <h1>Error al crear la cuenta</h1>
              <p>No se pudo registrar tu cuenta. Inténtalo de nuevo.</p>
              <p><a href="/login">Volver al login</a></p>
            </body></html>`,
            { status: 500, headers: { 'Content-Type': 'text/html' } }
          );
        }
      } else {
        usuarioData = newUser;
        console.log('✅ Nuevo usuario creado:', newUser?.nombre);
      }
    }

    if (!usuarioData) {
      return new Response('Error: No se pudo obtener datos del usuario', { status: 500 });
    }

    // Guardar tokens de Supabase Auth en cookies
    cookies.set('sb-access-token', access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });

    cookies.set('sb-refresh-token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });

    // Guardar las mismas cookies que usa el login normal
    cookies.set('auth_token', access_token, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    cookies.set('user_id', usuarioData.id, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    cookies.set('user_role', usuarioData.rol, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    cookies.set('user_name', usuarioData.nombre, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    console.log('🍪 Cookies establecidas para usuario OAuth:', {
      user_id: usuarioData.id,
      user_name: usuarioData.nombre,
      user_role: usuarioData.rol,
    });

    // Parsear la redirección del state si existe
    let redirectTo = '/';
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        redirectTo = stateData.redirectTo || '/';
      } catch (e) {
        console.warn('No se pudo parsear el state:', e);
      }
    }

    // Redirigir según el rol del usuario
    let finalRedirect = redirectTo;
    if (redirectTo === '/') {
      finalRedirect = usuarioData.rol === 'admin' ? '/admin/dashboard' : '/productos';
    }

    // Usar una página intermedia para guardar datos en localStorage (como hace el login normal)
    return new Response(
      `<html>
        <head><title>Iniciando sesión...</title></head>
        <body>
          <p>Redirigiendo...</p>
          <script>
            localStorage.setItem('auth_token', '${usuarioData.id}');
            localStorage.setItem('user_role', '${usuarioData.rol}');
            localStorage.setItem('user_id', '${usuarioData.id}');
            localStorage.setItem('user_name', '${usuarioData.nombre.replace(/'/g, "\\'")}');
            localStorage.setItem('user_email', '${usuarioData.email}');
            window.location.href = '${finalRedirect}';
          </script>
        </body>
      </html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Error en callback de autenticación:', error);
    return new Response(
      `<html><body>
        <h1>Error en el callback de autenticación</h1>
        <p>${error instanceof Error ? error.message : 'Error desconocido'}</p>
        <p><a href="/login">Volver al login</a></p>
      </body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
};
