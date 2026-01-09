import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { email, password, nombre } = await request.json();

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
      return new Response(
        JSON.stringify({ success: false, message: authError.message }),
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
    console.log('✅ Usuario registrado en auth.users:', userId);

    // 2. Crear registro en tabla usuarios con rol 'cliente' por defecto
    // Nota: Necesitamos crear una sesión o usar RLS policy que permita insertar
    const { data: insertData, error: dbError } = await supabaseClient
      .from('usuarios')
      .insert([
        {
          id: userId,
          nombre,
          email,
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

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Registro exitoso. Ahora inicia sesión',
        userId,
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
