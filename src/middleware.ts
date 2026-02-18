import { defineMiddleware } from 'astro:middleware';
import { supabaseAdmin } from './lib/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
  const token = context.cookies.get('auth_token')?.value;
  const userRole = context.cookies.get('user_role')?.value;
  const userId = context.cookies.get('user_id')?.value;
  const userName = context.cookies.get('user_name')?.value;
  const path = context.url.pathname;

  // ═══════════════════════════════════════════════════════════
  // PROTECCIÓN DE PÁGINAS ADMIN - Redirigir si no es admin
  // ═══════════════════════════════════════════════════════════
  if (path.startsWith('/admin')) {
    // Verificación rápida: si no hay cookie de autenticación, redirigir
    if (!userId || !token) {
      return context.redirect('/login?redirect=' + encodeURIComponent(path));
    }

    // Verificación real contra BD: comprobar rol admin
    try {
      const { data: usuario } = await supabaseAdmin
        .from('usuarios')
        .select('rol')
        .eq('id', userId)
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
    // 1) Obtener token: cookie > header Authorization > header x-user-id
    let authToken = token;
    let authUserId = userId;

    // Soporte para header Authorization: Bearer <token> (Flutter / API REST)
    const authHeader = context.request.headers.get('authorization');
    if (!authToken && authHeader?.startsWith('Bearer ')) {
      authToken = authHeader.substring(7);
    }

    // Soporte para header x-user-id (usado por algunos fetch internos)
    const headerUserId = context.request.headers.get('x-user-id');
    if (!authUserId && headerUserId) {
      authUserId = headerUserId;
    }

    // 2) Si no hay ninguna forma de autenticación, denegar
    if (!authToken && !authUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3) Verificar que el usuario es admin consultando la BD
    const idParaVerificar = authUserId || authToken;
    try {
      const { data: usuario, error } = await supabaseAdmin
        .from('usuarios')
        .select('rol')
        .eq('id', idParaVerificar)
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
    const authToken = token || context.request.headers.get('authorization')?.substring(7);
    const authUserId = userId || context.request.headers.get('x-user-id');
    
    if (!authToken && !authUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const idParaVerificar = authUserId || authToken;
    try {
      const { data: usuario } = await supabaseAdmin
        .from('usuarios')
        .select('rol')
        .eq('id', idParaVerificar)
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
    if (!token) {
      return context.redirect('/login?redirect=' + encodeURIComponent(path));
    }
  }

  return next();
});
