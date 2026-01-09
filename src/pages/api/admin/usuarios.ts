import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const userRole = cookies.get('user_role')?.value;

    if (userRole !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, message: 'No autorizado' }),
        { status: 403 }
      );
    }

    // Obtener todos los usuarios
    const { data: usuarios, error } = await supabaseClient
      .from('usuarios')
      .select('id, nombre, email, rol, estado')
      .order('nombre', { ascending: true });

    if (error) {
      console.log('❌ Error obteniendo usuarios:', error);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al obtener usuarios' }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        usuarios: usuarios || []
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
