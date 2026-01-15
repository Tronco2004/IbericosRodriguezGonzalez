import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Obtener userId del header
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, message: 'No autenticado' }),
        { status: 401 }
      );
    }

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
    const { data: usuario, error: usuarioError } = await supabaseClient
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

    // Verificar contraseña actual intentando re-autenticar
    const { error: authError } = await supabaseClient.auth.signInWithPassword({
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

    // Cambiar contraseña en Supabase Auth
    const { error: updateError } = await supabaseClient.auth.updateUser({
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
