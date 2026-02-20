import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { codigosRecovery } from './solicitar-recovery';

// ── Rate limiting ──
const intentosVerificacion = new Map<string, { count: number; firstAttempt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = intentosVerificacion.get(ip);
  if (!record || now - record.firstAttempt > 15 * 60 * 1000) {
    intentosVerificacion.set(ip, { count: 1, firstAttempt: now });
    return true;
  }
  if (record.count >= 10) return false;
  record.count++;
  return true;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const ip = clientAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Demasiados intentos. Espera unos minutos.',
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    const code = body.code?.replace(/\D/g, '');
    const password = body.password;

    // Validaciones
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Email no válido.',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!code || code.length !== 6) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Código de 6 dígitos requerido.',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!password || password.length < 6) {
      return new Response(JSON.stringify({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres.',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Verificar código
    const stored = codigosRecovery.get(email);

    if (!stored) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No hay código pendiente para este email. Solicita uno nuevo.',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (Date.now() > stored.expiresAt) {
      codigosRecovery.delete(email);
      return new Response(JSON.stringify({
        success: false,
        message: 'El código ha expirado. Solicita uno nuevo.',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (stored.intentosFallidos >= 5) {
      codigosRecovery.delete(email);
      return new Response(JSON.stringify({
        success: false,
        message: 'Demasiados intentos fallidos. Solicita un nuevo código.',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (stored.code !== code) {
      stored.intentosFallidos++;
      return new Response(JSON.stringify({
        success: false,
        message: `Código incorrecto. Intentos restantes: ${5 - stored.intentosFallidos}.`,
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Código correcto - buscar usuario en Supabase Auth
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .single();

    if (!usuario) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Usuario no encontrado.',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Actualizar contraseña via admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      usuario.id,
      { password }
    );

    if (updateError) {
      console.error('Error actualizando contraseña:', updateError);
      return new Response(JSON.stringify({
        success: false,
        message: 'Error al actualizar la contraseña. Inténtalo de nuevo.',
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Limpiar código usado
    codigosRecovery.delete(email);

    return new Response(JSON.stringify({
      success: true,
      message: 'Contraseña actualizada correctamente.',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Error en reset-password:', err);
    return new Response(JSON.stringify({
      success: false,
      message: 'Error interno. Inténtalo de nuevo.',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
