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

    const { usuarioId, activo } = await request.json();

    if (!usuarioId || typeof activo !== 'boolean') {
      return new Response(
        JSON.stringify({ success: false, message: 'Datos inválidos' }),
        { status: 400 }
      );
    }

    // Actualizar el estado del usuario
    const { error } = await supabaseAdmin
      .from('usuarios')
      .update({ activo })
      .eq('id', usuarioId);

    if (error) {
      console.log('❌ Error actualizando estado:', error);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al actualizar el estado' }),
        { status: 400 }
      );
    }

    console.log(`✅ Usuario ${usuarioId} actualizado a activo=${activo}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Estado actualizado correctamente'
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
