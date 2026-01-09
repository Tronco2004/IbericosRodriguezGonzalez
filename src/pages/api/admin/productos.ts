import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

// Función para generar SKU automáticamente
function generarSKU(categoria: string): string {
  // Mapeo de categorías a prefijos
  const prefijos: { [key: string]: string } = {
    'jamones': 'JAM',
    'quesos': 'QUE',
    'embutidos': 'EMB'
  };

  const prefijo = prefijos[categoria] || 'PRD';
  const numero = Math.floor(Math.random() * 10000).toString().padStart(3, '0');
  return `${prefijo}-${numero}`;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    // Obtener todos los productos con sus categorías
    const { data, error } = await supabaseClient
      .from('productos')
      .select(`
        id,
        nombre,
        descripcion,
        precio_centimos,
        stock,
        imagen_url,
        rating,
        activo,
        categoria_id,
        categorias:categoria_id(nombre, slug)
      `)
      .order('id', { ascending: true });

    if (error) {
      console.error('Error Supabase:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          productos: []
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        productos: data || [],
        source: 'supabase'
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error en GET /api/admin/productos:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno del servidor',
        productos: []
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, producto, id } = body;

    if (action === 'create') {
      // Crear nuevo producto
      // Primero obtener el categoria_id basado en el slug
      const { data: catData, error: catError } = await supabaseClient
        .from('categorias')
        .select('id')
        .eq('slug', producto.categoria)
        .single();

      if (catError || !catData) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Categoría no encontrada'
          }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      const { data, error } = await supabaseClient
        .from('productos')
        .insert([{
          nombre: producto.nombre,
          categoria_id: catData.id,
          precio_centimos: producto.precio,
          stock: producto.stock,
          descripcion: producto.descripcion,
          imagen_url: producto.imagen,
          activo: true,
          sku: generarSKU(producto.categoria)
        }])
        .select();

      if (error) {
        console.error('Error creando producto:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message
          }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Producto creado exitosamente',
          producto: data[0]
        }),
        { 
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (action === 'update') {
      // Actualizar producto existente
      // Primero obtener el categoria_id basado en el slug
      const { data: catData, error: catError } = await supabaseClient
        .from('categorias')
        .select('id')
        .eq('slug', producto.categoria)
        .single();

      if (catError || !catData) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Categoría no encontrada'
          }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      const { data, error } = await supabaseClient
        .from('productos')
        .update({
          nombre: producto.nombre,
          categoria_id: catData.id,
          precio_centimos: producto.precio,
          stock: producto.stock,
          descripcion: producto.descripcion,
          imagen_url: producto.imagen
        })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Error actualizando producto:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message
          }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Producto actualizado exitosamente',
          producto: data[0]
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (action === 'delete') {
      // Eliminar producto
      const { error } = await supabaseClient
        .from('productos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error eliminando producto:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message
          }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Producto eliminado exitosamente'
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Acción no válida'
      }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error en POST /api/admin/productos:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error interno del servidor'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
