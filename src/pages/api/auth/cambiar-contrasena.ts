import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../../../lib/auth-helpers';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // FIX P1-9 + P0-3: Autenticación via JWT, no x-user-id
    const authResult = await requireAuth(request, cookies);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const { contrasenaActual, contrasenaNueva, contrasenaConfirm } = await request.json();

    // Validaciones básicas
    if (!contrasenaActual || !contrasenaNueva || !contrasenaConfirm) {
      return new Response(
        JSON.stringify({ success: false, message: 'Todos los campos son requeridos' }),
        { status: 400 }
      );
    }

    // Verificar que las contraseñas nuevas coincidan
    if (contrasenaNueva !== contrasenaConfirm) {
      return new Response(
        JSON.stringify({ success: false, message: 'Las contraseñas nuevas no coinciden' }),
        { status: 400 }
      );
    }

    // Validar longitud mínima
    if (contrasenaNueva.length < 6) {
      return new Response(
        JSON.stringify({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' }),
        { status: 400 }
      );
    }

    // Obtener email del usuario
    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('email')
      .eq('id', userId)
      .single();

    if (usuarioError || !usuario) {
      console.error('Error obteniendo usuario:', usuarioError);
      return new Response(
        JSON.stringify({ success: false, message: 'Usuario no encontrado' }),
        { status: 404 }
      );
    }

    // FIX P1-9: Crear cliente Supabase temporal para verificar contraseña actual
    // Evita contaminar la sesión del singleton global
    const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error: authError } = await tempClient.auth.signInWithPassword({
      email: usuario.email,
      password: contrasenaActual,
    });

    if (authError) {
      console.log('Contraseña actual incorrecta');
      return new Response(
        JSON.stringify({ success: false, message: 'La contraseña actual es incorrecta' }),
        { status: 401 }
      );
    }

    // Cambiar contraseña usando admin API (no afecta sesiones)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: contrasenaNueva,
    });

    if (updateError) {
      console.error('Error actualizando contraseña:', updateError);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al cambiar la contraseña' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Contraseña cambiada exitosamente' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en cambiar contraseña:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
