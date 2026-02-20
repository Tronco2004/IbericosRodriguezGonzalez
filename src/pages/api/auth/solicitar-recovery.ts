import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { getTransporter } from '../../../lib/email';

// ── Almacén de códigos en memoria ──
interface CodigoRecovery {
  code: string;
  expiresAt: number;
  intentosFallidos: number;
}

export const codigosRecovery = new Map<string, CodigoRecovery>();

// Limpiar expirados cada 10 min
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of codigosRecovery) {
    if (now > data.expiresAt) codigosRecovery.delete(email);
  }
}, 10 * 60 * 1000);

// ── Rate limiting ──
const intentosSolicitud = new Map<string, { count: number; firstAttempt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = intentosSolicitud.get(ip);
  if (!record || now - record.firstAttempt > 10 * 60 * 1000) {
    intentosSolicitud.set(ip, { count: 1, firstAttempt: now });
    return true;
  }
  if (record.count >= 3) return false;
  record.count++;
  return true;
}

// Generar código de 6 dígitos seguro
function generarCodigo(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, '0');
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const ip = clientAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Demasiadas solicitudes. Espera unos minutos.',
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const email = body.email?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Email no válido.',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Verificar que el usuario existe
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .single();

    if (!usuario) {
      // No revelar si el email existe - responder igual que si existiera
      return new Response(JSON.stringify({
        success: true,
        message: 'Si existe una cuenta con ese email, recibirás un código.',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Generar código
    const code = generarCodigo();
    codigosRecovery.set(email, {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutos
      intentosFallidos: 0,
    });

    // Enviar email
    await getTransporter().sendMail({
      from: `"Ibéricos Rodríguez González" <${import.meta.env.GMAIL_USER}>`,
      to: email,
      subject: 'Código de recuperación - Ibéricos Rodríguez González',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #8B4513; text-align: center;">Recuperar Contraseña</h2>
          <p style="color: #333; font-size: 16px;">Has solicitado restablecer tu contraseña. Tu código de recuperación es:</p>
          <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 10px; color: #1a1a1a;">${code}</span>
          </div>
          <p style="color: #666; font-size: 14px;">Este código expira en <strong>15 minutos</strong>.</p>
          <p style="color: #666; font-size: 14px;">Si no has solicitado este cambio, ignora este email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">Ibéricos Rodríguez González</p>
        </div>
      `,
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Si existe una cuenta con ese email, recibirás un código.',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Error en solicitar-recovery:', err);
    return new Response(JSON.stringify({
      success: true,
      message: 'Si existe una cuenta con ese email, recibirás un código.',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};
