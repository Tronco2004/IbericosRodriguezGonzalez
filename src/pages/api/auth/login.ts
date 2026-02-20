import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';
import { createRateLimiter, getClientIp, rateLimitResponse } from '../../../lib/rate-limit';

// Limitar login a 10 intentos por minuto por IP (anti brute-force)
const loginLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });

export const POST: APIRoute = async ({ request, cookies }) => {
  const clientIp = getClientIp(request);
  if (!loginLimiter.check(clientIp)) return rateLimitResponse();

  let email: string;
  let password: string;
  
  try {
    const body = await request.json();
    email = body.email;
    password = body.password;
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: 'Datos de solicitud inválidos' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!email || !password) {
    return new Response(
      JSON.stringify({ success: false, message: 'Email y contraseña son requeridos' }),
      { status: 400 }
    );
  }

  try {
    // 1. Autenticar en Supabase auth
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      console.log('Error en autenticación:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, message: 'Credenciales inválidas' }),
        { status: 401 }
      );
    }

    const userId = authData.user.id;
    const token = authData.session?.access_token;
    const refreshToken = authData.session?.refresh_token;
    const userEmail = authData.user.email;

    console.log('✅ Autenticación en auth exitosa');

    // 2. Obtener datos del usuario desde tabla usuarios usando el email
    const { data: usuarioData, error: dbError } = await supabaseClient
      .from('usuarios')
      .select('id, nombre, email, rol, activo')
      .eq('email', userEmail)
      .single();

    console.log('🔍 Query a tabla usuarios por email');
    console.log('  Encontrado:', !!usuarioData);
    if (dbError) console.log('  Error:', dbError.message);

    if (dbError || !usuarioData) {
      console.log('Usuario no encontrado en tabla usuarios:', dbError?.message);
      return new Response(
        JSON.stringify({ success: false, message: 'Usuario no registrado en el sistema. Error: ' + dbError?.message }),
        { status: 401 }
      );
    }

    // Validar que el usuario esté activo
    if (!usuarioData.activo) {
      console.log('Usuario inactivo');
      return new Response(
        JSON.stringify({ success: false, message: 'Usuario inactivo' }),
        { status: 403 }
      );
    }

    console.log('✅ Usuario encontrado:', usuarioData.nombre);
    console.log('Rol:', usuarioData.rol);

    // 3. Guardar sesión en cookies
    // Detectar si estamos en HTTPS para el flag secure
    const isSecure = new URL(request.url).protocol === 'https:';

    // FIX P1-5: auth_token y user_id son httpOnly para prevenir robo por XSS
    cookies.set('auth_token', token || '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    // Guardar tokens de Supabase para poder revocar sesión en logout
    cookies.set('sb-access-token', token || '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });

    if (refreshToken) {
      cookies.set('sb-refresh-token', refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }

    cookies.set('user_id', usuarioData.id, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    // user_role y user_name accesibles al frontend para UI
    cookies.set('user_role', usuarioData.rol, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    cookies.set('user_name', usuarioData.nombre, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    console.log('🍪 Cookies establecidas:', {
      user_id: usuarioData.id,
      user_name: usuarioData.nombre,
      user_role: usuarioData.rol
    });

    // 4. Determinar redirección según rol
    const redirect_url = usuarioData.rol === 'admin' ? '/admin/dashboard' : '/';

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login exitoso',
        redirect_url: redirect_url,
        usuario: {
          id: usuarioData.id,
          nombre: usuarioData.nombre,
          email: usuarioData.email,
          rol: usuarioData.rol
        }
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.log('Error inesperado:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};

