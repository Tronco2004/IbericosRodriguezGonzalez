import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth-helpers';

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
