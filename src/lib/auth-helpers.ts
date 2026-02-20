/**
 * Helpers de autenticación server-side.
 * Valida JWT reales de Supabase Auth en lugar de confiar en headers/cookies manipulables.
 * Incluye renovación automática de tokens expirados via refresh token.
 */
import { supabaseAdmin } from './supabase';
import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/**
 * Intenta renovar la sesión usando el refresh token.
 * Devuelve el nuevo access_token o null si falla.
 */
async function tryRefreshSession(
  refreshToken: string,
  cookies: AstroCookies
): Promise<{ userId: string; newAccessToken: string } | null> {
  try {
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await tempClient.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session || !data.user) {
      return null;
    }

    const newAccessToken = data.session.access_token;
    const newRefreshToken = data.session.refresh_token;

    // Actualizar las cookies con los nuevos tokens
    // secure: false para que funcione en HTTP (localhost) y HTTPS (producción)
    cookies.set('auth_token', newAccessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    cookies.set('sb-access-token', newAccessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });

    if (newRefreshToken) {
      cookies.set('sb-refresh-token', newRefreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }

    console.log('🔄 Token renovado exitosamente para usuario:', data.user.id);
    return { userId: data.user.id, newAccessToken };
  } catch (e) {
    console.error('Error renovando token:', e);
    return null;
  }
}

/**
 * Extrae y valida el userId autenticado desde JWT (cookie o header Authorization).
 * Si el token ha expirado, intenta renovarlo automáticamente con el refresh token.
 * NO confía en x-user-id ni en cookies de texto plano.
 */
export async function getAuthenticatedUserId(
  request: Request,
  cookies: AstroCookies
): Promise<{ userId: string | null; error?: string }> {
  // 1. JWT desde cookie auth_token
  const token = cookies.get('auth_token')?.value;
  if (token) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.id) {
        return { userId: data.user.id };
      }
    } catch {
      // Token inválido o expirado, continuar
    }
  }

  // 2. Authorization: Bearer <token> (Flutter / API REST)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7);
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(bearerToken);
      if (!error && data?.user?.id) {
        return { userId: data.user.id };
      }
    } catch {
      // Token inválido
    }
  }

  // 3. Token expirado — intentar renovar con refresh token
  const refreshToken = cookies.get('sb-refresh-token')?.value;
  if (refreshToken) {
    const refreshResult = await tryRefreshSession(refreshToken, cookies);
    if (refreshResult) {
      return { userId: refreshResult.userId };
    }
  }

  return { userId: null, error: 'No autenticado o token inválido' };
}

/**
 * Requiere autenticación. Devuelve userId o un Response 401.
 */
export async function requireAuth(
  request: Request,
  cookies: AstroCookies
): Promise<{ userId: string } | Response> {
  const { userId, error } = await getAuthenticatedUserId(request, cookies);

  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: error || 'No autenticado' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return { userId };
}

/**
 * Requiere rol admin. Devuelve userId o un Response 403.
 */
export async function requireAdmin(
  request: Request,
  cookies: AstroCookies
): Promise<{ userId: string } | Response> {
  const authResult = await requireAuth(request, cookies);

  if (authResult instanceof Response) {
    return authResult;
  }

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('rol')
    .eq('id', authResult.userId)
    .single();

  if (!usuario || usuario.rol !== 'admin') {
    return new Response(
      JSON.stringify({ success: false, error: 'No autorizado - se requiere rol admin' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return { userId: authResult.userId };
}

/**
 * Escapa caracteres HTML para prevenir XSS.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
