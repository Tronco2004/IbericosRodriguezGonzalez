import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, message: 'No autenticado' }),
        { status: 401 }
      );
    }

    const { nombre, telefono, direccion } = await request.json();

    // Validaciones básicas
    if (!nombre || nombre.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'El nombre es requerido' }),
        { status: 400 }
      );
    }

    // Actualizar usuario en la BD
    const { data: usuarioActualizado, error: updateError } = await supabaseClient
      .from('usuarios')
      .update({
        nombre: nombre.trim(),
        telefono: telefono?.trim() || null,
        direccion: direccion?.trim() || null,
        fecha_actualizacion: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, nombre, email, telefono, direccion, rol')
      .single();

    if (updateError) {
      console.error('Error actualizando usuario:', updateError);
      return new Response(
        JSON.stringify({ success: false, message: 'Error al actualizar los datos' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Información actualizada exitosamente',
        usuario: usuarioActualizado
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en actualizar usuario:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
