import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { getAuthenticatedUserId } from '../../../lib/auth-helpers';
import { enviarEmailBienvenida } from '../../../lib/email';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // ── Auth: validar JWT (no confiar en x-user-id) ──
    const { userId } = await getAuthenticatedUserId(request, cookies);
    
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, message: 'No autenticado' }),
        { status: 401 }
      );
    }

    const { nombre, telefono, direccion } = await request.json();

    // Validaciones básicas
    if (!nombre || nombre.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'El nombre es requerido' }),
        { status: 400 }
      );
    }

    // ── Detectar si es la primera vez que completa el perfil (usuario Google) ──
    const { data: usuarioActual } = await supabaseAdmin
      .from('usuarios')
      .select('telefono, direccion, email')
      .eq('id', userId)
      .single();

    const esPrimeraVez = usuarioActual && !usuarioActual.telefono && !usuarioActual.direccion;

    // Actualizar usuario en la BD
    const { data: usuarioActualizado, error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({
        nombre: nombre.trim(),
        telefono: telefono?.trim() || null,
        direccion: direccion?.trim() || null,
        fecha_actualizacion: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, nombre, email, telefono, direccion, rol')
      .single();

    if (updateError) {
      console.error('Error actualizando usuario:', updateError);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al actualizar los datos' }),
        { status: 500 }
      );
    }

    // ── Enviar email de bienvenida si es primera vez (registro Google) ──
    if (esPrimeraVez && telefono && direccion) {
      try {
        const emailUsuario = usuarioActualizado?.email || usuarioActual?.email;
        const nombreUsuario = nombre.trim();
        if (emailUsuario) {
          await enviarEmailBienvenida(emailUsuario, nombreUsuario, 'BIENVENIDA');
          console.log('✉️ Email de bienvenida enviado a usuario Google:', emailUsuario);
        }
      } catch (emailError) {
        console.error('⚠️ Error enviando email de bienvenida (no bloquea):', emailError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Información actualizada exitosamente',
        usuario: usuarioActualizado
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en actualizar usuario:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
