import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';
import { enviarEmailBienvenida } from '../../../lib/email';
import { createRateLimiter, getClientIp, rateLimitResponse } from '../../../lib/rate-limit';

// Limitar registro a 5 por minuto por IP (anti spam)
const registerLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

export const POST: APIRoute = async ({ request, cookies }) => {
  const clientIp = getClientIp(request);
  if (!registerLimiter.check(clientIp)) return rateLimitResponse();

  const { email, password, nombre, telefono, direccion } = await request.json();

  if (!email || !password || !nombre) {
    return new Response(
      JSON.stringify({ success: false, message: 'Email, contraseña y nombre son requeridos' }),
      { status: 400 }
    );
  }

  try {
    // 1. Registrar usuario en auth.users con signUp
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.log('Error registrando usuario:', authError.message);
      
      // Traducir mensajes de error de Supabase al español
      let mensajeError = authError.message;
      if (authError.message.toLowerCase().includes('already registered') || 
          authError.message.toLowerCase().includes('already been registered')) {
        mensajeError = 'El usuario ya está registrado';
      } else if (authError.message.toLowerCase().includes('invalid email')) {
        mensajeError = 'El email no es válido';
      } else if (authError.message.toLowerCase().includes('password')) {
        mensajeError = 'La contraseña debe tener al menos 6 caracteres';
      }
      
      return new Response(
        JSON.stringify({ success: false, message: mensajeError }),
        { status: 400 }
      );
    }

    if (!authData.user) {
      console.log('No se pudo obtener el usuario registrado');
      return new Response(
        JSON.stringify({ success: false, message: 'Error al registrar usuario' }),
        { status: 400 }
      );
    }

    const userId = authData.user.id;
    console.log('✅ Usuario registrado en auth.users');

    // 2. Crear registro en tabla usuarios con rol 'cliente' por defecto
    const { data: insertData, error: dbError } = await supabaseClient
      .from('usuarios')
      .insert([
        {
          id: userId,
          nombre,
          email,
          telefono: telefono || null,
          direccion: direccion || null,
          rol: 'cliente',
          activo: true,
        },
      ])
      .select();

    if (dbError) {
      console.log('Error creando usuario en tabla usuarios:', dbError.message);
      // Nota: No podemos eliminar de auth sin service role key
      return new Response(
        JSON.stringify({ success: false, message: 'Error al crear perfil de usuario' }),
        { status: 500 }
      );
    }

    console.log('✅ Usuario registrado en tabla usuarios con rol cliente');

    // 2.5 Vincular pedidos de invitado si existen
    // Busca todos los pedidos hechos con este email sin usuario asociado
    try {
      const { data: pedidosVinculados, error: errorVinculo } = await supabaseClient
        .rpc('vincular_pedidos_invitado', {
          p_usuario_id: userId,
          p_email: email
        });

      if (errorVinculo) {
        console.error('⚠️ Error vinculando pedidos invitados:', errorVinculo.message);
      } else {
        const cantidadVinculada = pedidosVinculados?.[0]?.pedidos_vinculados || 0;
        if (cantidadVinculada > 0) {
          console.log(`✅ Vinculados ${cantidadVinculada} pedidos previos de invitado`);
        }
      }
    } catch (vinculoError) {
      console.error('❌ Error en función RPC:', vinculoError);
      // No fallar el registro si hay error vinculando
    }

    // 3. Iniciar sesión automáticamente
    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      console.log('Error iniciando sesión automáticamente:', signInError);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Registro exitoso. Por favor inicia sesión',
          userId,
          requireLogin: true
        }),
        { status: 201 }
      );
    }

    // Obtener datos del usuario
    const { data: usuarioData } = await supabaseClient
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();

    // Establecer cookies
    cookies.set('auth_token', signInData.session.access_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    cookies.set('user_id', userId, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    cookies.set('user_role', 'cliente', {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    cookies.set('user_name', nombre, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    console.log('🍪 Cookies establecidas para nuevo usuario');

    // Enviar email de bienvenida con código de descuento
    try {
      await enviarEmailBienvenida(email, nombre, 'BIENVENIDA');
      console.log('✉️ Email de bienvenida enviado');
    } catch (emailError) {
      console.error('⚠️ Error enviando email de bienvenida (no bloquea registro):', emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Registro y login exitosos',
        userId,
        email,
        nombre,
        redirect_url: '/productos'
      }),
      { status: 201 }
    );
  } catch (error) {
    console.log('Error inesperado:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
