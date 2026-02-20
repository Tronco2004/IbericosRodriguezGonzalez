import { defineMiddleware } from 'astro:middleware';
import { supabaseAdmin } from './lib/supabase';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/**
 * Extrae y valida el JWT del request (cookie o header Authorization).
 * Devuelve el userId validado o null.
 */
async function validateAuthToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data?.user?.id) return data.user.id;
  } catch {
    // Token inválido o expirado
  }
  return null;
}

/**
 * Intenta renovar la sesión usando el refresh token.
 */
async function tryRefreshInMiddleware(refreshToken: string, cookies: any): Promise<string | null> {
  try {
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data, error } = await tempClient.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) return null;

    // Actualizar cookies con nuevos tokens
    cookies.set('auth_token', data.session.access_token, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/',
    });
    cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, path: '/',
    });
    if (data.session.refresh_token) {
      cookies.set('sb-refresh-token', data.session.refresh_token, {
        httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, path: '/',
      });
    }
    console.log('🔄 [Middleware] Token renovado para usuario:', data.user.id);
    return data.user.id;
  } catch {
    return null;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const token = context.cookies.get('auth_token')?.value;
  const path = context.url.pathname;

  // Extraer JWT de Authorization header (Flutter / API)
  const authHeader = context.request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const effectiveToken = token || bearerToken;

  // ═══════════════════════════════════════════════════════════
  // PROTECCIÓN DE PÁGINAS ADMIN - Redirigir si no es admin
  // ═══════════════════════════════════════════════════════════
  if (path.startsWith('/admin')) {
    // FIX P1-4: Validar JWT real, no cookies de texto plano
    let validatedUserId = await validateAuthToken(effectiveToken);
    
    // Si el token expiró, intentar renovar
    if (!validatedUserId) {
      const refreshToken = context.cookies.get('sb-refresh-token')?.value;
      if (refreshToken) {
        validatedUserId = await tryRefreshInMiddleware(refreshToken, context.cookies);
      }
    }
    
    if (!validatedUserId) {
      return context.redirect('/login?redirect=' + encodeURIComponent(path));
    }

    // Verificación real contra BD: comprobar rol admin
    try {
      const { data: usuario } = await supabaseAdmin
        .from('usuarios')
        .select('rol')
        .eq('id', validatedUserId)
        .single();

      if (!usuario || usuario.rol !== 'admin') {
        return context.redirect('/login?redirect=' + encodeURIComponent(path));
      }
    } catch {
      return context.redirect('/login?redirect=' + encodeURIComponent(path));
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PROTECCIÓN DE APIs ADMIN - Bloquear acceso sin autenticación
  // ═══════════════════════════════════════════════════════════
  if (path.startsWith('/api/admin')) {
    // FIX P1-4: Validar JWT real
    let validatedUserId = await validateAuthToken(effectiveToken);

    // Si el token expiró, intentar renovar
    if (!validatedUserId) {
      const refreshToken = context.cookies.get('sb-refresh-token')?.value;
      if (refreshToken) {
        validatedUserId = await tryRefreshInMiddleware(refreshToken, context.cookies);
      }
    }

    if (!validatedUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3) Verificar que el usuario es admin consultando la BD
    try {
      const { data: usuario, error } = await supabaseAdmin
        .from('usuarios')
        .select('rol')
        .eq('id', validatedUserId)
        .single();

      if (error || !usuario || usuario.rol !== 'admin') {
        return new Response(
          JSON.stringify({ success: false, error: 'No autorizado - se requiere rol admin' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: 'Error verificando permisos' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PROTECCIÓN DE ENDPOINTS DEBUG - Bloquear en producción
  // ═══════════════════════════════════════════════════════════
  if (path.startsWith('/api/debug')) {
    const validatedUserId = await validateAuthToken(effectiveToken);
    
    if (!validatedUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      const { data: usuario } = await supabaseAdmin
        .from('usuarios')
        .select('rol')
        .eq('id', validatedUserId)
        .single();

      if (!usuario || usuario.rol !== 'admin') {
        return new Response(
          JSON.stringify({ success: false, error: 'No autorizado' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RUTAS PROTEGIDAS GENERALES
  // ═══════════════════════════════════════════════════════════
  const rutasProtegidas: string[] = [];
  const rutasExentas = ['/checkout/exito', '/carrito'];
  const esRutaExenta = rutasExentas.some(ruta => path === ruta);
  
  if (!esRutaExenta && rutasProtegidas.some(ruta => path.startsWith(ruta))) {
    if (!effectiveToken) {
      return context.redirect('/login?redirect=' + encodeURIComponent(path));
    }
  }

  return next();
});
