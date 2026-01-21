import { supabaseClient } from '../../../lib/supabase';

export async function POST(context: any) {
  try {
    const body = await context.request.json();
    const { nombre, slug, descripcion, imagen_url, categoria_padre, orden } = body;

    console.log('Insertando categoría:', { nombre, slug, descripcion, imagen_url, categoria_padre, orden });

    // Insertar en Supabase
    const { data, error } = await supabaseClient
      .from('categorias')
      .insert([
        {
          nombre,
          slug,
          descripcion: descripcion || '',
          imagen_url: imagen_url || 'https://via.placeholder.com/500',
          activa: true,
          categoria_padre: categoria_padre || null,
          orden: orden || 0,
          fecha_creacion: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Error insertando categoría:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message, details: error }),
        { status: 400 }
      );
    }

    console.log('Categoría insertada:', data);
    return new Response(
      JSON.stringify({ success: true, categoria: data?.[0] }),
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

export async function GET() {
  try {
    const { data, error } = await supabaseClient
      .from('categorias')
      .select('*')
      .eq('activa', true)
      .order('categoria_padre', { ascending: true })
      .order('orden', { ascending: true });

    if (error) {
      console.error('Error obteniendo categorías:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, categorias: data || [] }),
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

export async function PUT(context: any) {
  try {
    const body = await context.request.json();
    const { id, nombre, slug, descripcion, imagen_url, activa, categoria_padre, orden } = body;

    const { data, error } = await supabaseClient
      .from('categorias')
      .update({ 
        nombre, 
        slug, 
        descripcion, 
        imagen_url: imagen_url || 'https://via.placeholder.com/500',
        activa: activa !== undefined ? activa : true,
        categoria_padre: categoria_padre || null,
        orden: orden || 0
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error actualizando categoría:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, categoria: data?.[0] }),
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

    const { error } = await supabaseClient
      .from('categorias')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando categoría:', error);
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
