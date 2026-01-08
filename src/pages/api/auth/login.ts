import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { email, password } = await request.json();

  if (!email || !password) {
    return new Response(
      JSON.stringify({ success: false, message: 'Email y contraseña son requeridos' }),
      { status: 400 }
    );
  }

  try {
    // 1. Autenticar en Supabase auth
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      console.log('❌ Error en autenticación:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, message: 'Credenciales inválidas' }),
        { status: 401 }
      );
    }

    const userId = authData.user.id;
    const token = authData.session?.access_token;

    console.log('✅ Autenticación en auth exitosa:', userId);

    // 2. Obtener datos del usuario desde tabla usuarios
    const { data: usuarioData, error: dbError } = await supabaseClient
      .from('usuarios')
      .select('id, nombre, email, rol, activo')
      .eq('id', userId)
      .single();

    console.log('🔍 Query a tabla usuarios:');
    console.log('  Usuario ID:', userId);
    console.log('  Datos encontrados:', usuarioData);
    console.log('  Error:', dbError);

    if (dbError || !usuarioData) {
      console.log('❌ Usuario no encontrado en tabla usuarios:', dbError?.message);
      return new Response(
        JSON.stringify({ success: false, message: 'Usuario no registrado en el sistema. Error: ' + dbError?.message }),
        { status: 401 }
      );
    }

    // Validar que el usuario esté activo
    if (!usuarioData.activo) {
      console.log('❌ Usuario inactivo:', email);
      return new Response(
        JSON.stringify({ success: false, message: 'Usuario inactivo' }),
        { status: 403 }
      );
    }

    console.log('✅ Usuario encontrado:', usuarioData.nombre);
    console.log('👤 Rol:', usuarioData.rol);

    // 3. Guardar sesión en cookies
    cookies.set('auth_token', token || '', {
      httpOnly: true,
      secure: false, // false para desarrollo
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 días
    });

    cookies.set('user_role', usuarioData.rol, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });

    cookies.set('user_name', usuarioData.nombre, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });

    cookies.set('user_id', userId, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });

    // 4. Determinar redirección según rol
    const redirect_url = usuarioData.rol === 'admin' ? '/admin/dashboard' : '/productos';

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login exitoso',
        usuario: usuarioData,
        redirect_url,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.log('❌ Error inesperado:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};

