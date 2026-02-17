import { supabaseAdmin } from '../../../lib/supabase';

export async function GET(context: any) {
  try {
    // Obtener todos los usuarios
    const { data: usuarios, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre, email, rol, activo, fecha_registro')
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
}

export async function PUT(context: any) {
  try {
    const body = await context.request.json();
    const { id, rol, activo } = body;

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .update({ rol, activo })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error actualizando usuario:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, usuario: data?.[0] }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.toString() }),
      { status: 500 }
    );
  }
}

export async function DELETE(context: any) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, message: 'ID de usuario requerido' }),
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('usuarios')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando usuario:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.toString() }),
      { status: 500 }
    );
  }
}
