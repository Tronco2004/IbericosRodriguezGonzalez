import { defineMiddleware } from 'astro:middleware';
import { supabaseAdmin } from './lib/supabase';

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
    const validatedUserId = await validateAuthToken(effectiveToken);
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
        return context.redirect('/sin-acceso');
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
    const validatedUserId = await validateAuthToken(effectiveToken);

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
