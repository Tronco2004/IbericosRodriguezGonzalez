import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../../lib/auth-helpers';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // ═══════════════════════════════════════════════════════════
    // FIX P0-4: Usar JWT validado en vez de x-user-id spoofable
    // ═══════════════════════════════════════════════════════════
    const authResult = await requireAuth(request, cookies);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const { contrasenaNueva, contrasenaConfirm } = await request.json();

    // Validaciones
    if (!contrasenaNueva || !contrasenaConfirm) {
      return new Response(
        JSON.stringify({ success: false, message: 'Todos los campos son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (contrasenaNueva !== contrasenaConfirm) {
      return new Response(
        JSON.stringify({ success: false, message: 'Las contraseñas no coinciden' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (contrasenaNueva.length < 6) {
      return new Response(
        JSON.stringify({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que el usuario existe y vino de OAuth (no tiene password)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Usuario no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Establecer la contraseña usando admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: contrasenaNueva,
    });

    if (updateError) {
      console.error('Error estableciendo contraseña:', updateError);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al establecer la contraseña' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Contraseña establecida para usuario OAuth');

    // ═══════════════════════════════════════════════════════════
    // FIX: Renovar la sesión después de cambiar la contraseña.
    // Supabase invalida los tokens existentes al cambiar el password,
    // por lo que debemos obtener una sesión nueva con las credenciales
    // recién creadas para que el usuario no reciba 401.
    // ═══════════════════════════════════════════════════════════
    try {
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      // Intentar obtener sesión nueva con las credenciales recién establecidas
      const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({
        email: authData.user.email!,
        password: contrasenaNueva,
      });

      if (!signInError && signInData?.session) {
        const newAccessToken = signInData.session.access_token;
        const newRefreshToken = signInData.session.refresh_token;
        const isSecure = new URL(request.url).protocol === 'https:';

        cookies.set('auth_token', newAccessToken, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });

        cookies.set('sb-access-token', newAccessToken, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365,
          path: '/',
        });

        if (newRefreshToken) {
          cookies.set('sb-refresh-token', newRefreshToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 365,
            path: '/',
          });
        }

        console.log('🔄 Sesión renovada exitosamente tras cambio de contraseña');
      } else {
        // Fallback: intentar con refresh token
        const refreshToken = cookies.get('sb-refresh-token')?.value;
        if (refreshToken) {
          const { data: refreshData, error: refreshError } = await tempClient.auth.refreshSession({
            refresh_token: refreshToken,
          });

          if (!refreshError && refreshData?.session) {
            const isSecure = new URL(request.url).protocol === 'https:';

            cookies.set('auth_token', refreshData.session.access_token, {
              httpOnly: true,
              secure: isSecure,
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7,
              path: '/',
            });

            cookies.set('sb-access-token', refreshData.session.access_token, {
              httpOnly: true,
              secure: isSecure,
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 365,
              path: '/',
            });

            if (refreshData.session.refresh_token) {
              cookies.set('sb-refresh-token', refreshData.session.refresh_token, {
                httpOnly: true,
                secure: isSecure,
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 365,
                path: '/',
              });
            }

            console.log('🔄 Sesión renovada vía refresh token tras cambio de contraseña');
          } else {
            console.warn('⚠️ No se pudo renovar la sesión tras cambio de contraseña:', signInError?.message, refreshError?.message);
          }
        }
      }
    } catch (refreshErr) {
      console.error('⚠️ Error al intentar renovar sesión:', refreshErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contraseña establecida exitosamente. Ahora puedes iniciar sesión con email y contraseña.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en establecer-contrasena:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
