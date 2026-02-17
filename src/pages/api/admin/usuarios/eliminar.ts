import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const userRole = cookies.get('user_role')?.value;

    if (userRole !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, message: 'No autorizado' }),
        { status: 403 }
      );
    }

    const { usuarioId } = await request.json();

    if (!usuarioId) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID de usuario requerido' }),
        { status: 400 }
      );
    }

    // Eliminar el usuario (esto también elimina auth.users gracias a ON DELETE CASCADE)
    const { error } = await supabaseAdmin
      .from('usuarios')
      .delete()
      .eq('id', usuarioId);

    if (error) {
      console.log('❌ Error eliminando usuario:', error);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al eliminar el usuario' }),
        { status: 400 }
      );
    }

    console.log(`✅ Usuario ${usuarioId} eliminado`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuario eliminado correctamente'
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
