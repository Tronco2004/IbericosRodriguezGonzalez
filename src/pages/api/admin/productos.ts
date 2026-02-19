import type { APIRoute } from 'astro';
import { supabaseClient, supabaseAdmin } from '../../../lib/supabase';

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
    // Obtener todos los productos
    const { data: productos, error: prodError } = await supabaseAdmin
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('id', { ascending: true });

    if (prodError) {
      console.error('Error Supabase:', prodError);
      return new Response(
        JSON.stringify({
          success: false,
          error: prodError.message,
          productos: []
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Obtener todas las categorías
    const { data: categorias, error: catError } = await supabaseAdmin
      .from('categorias')
      .select('id, nombre, slug');

    if (catError) {
      console.error('Error Supabase categorías:', catError);
    }

    // Mapear categorías
    const categoriaMap = {};
    categorias?.forEach((cat) => {
      categoriaMap[cat.id] = { nombre: cat.nombre, slug: cat.slug };
    });

    // Enriquecer productos con datos de categoría
    const productosEnriquecidos = productos?.map((p) => ({
      ...p,
      categorias: categoriaMap[p.categoria_id] || { nombre: 'Sin categoría', slug: 'sin-categoria' }
    })) || [];

    return new Response(
      JSON.stringify({
        success: true,
        productos: productosEnriquecidos,
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
      const { data: catData, error: catError } = await supabaseAdmin
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

      const { data, error } = await supabaseAdmin
        .from('productos')
        .insert([{
          nombre: producto.nombre,
          categoria_id: catData.id,
          precio_centimos: producto.precio,
          iva: producto.iva ?? 21,
          precio_empresa_centimos: producto.precio_empresa || 0,
          iva_empresa: producto.iva_empresa ?? 21,
          stock: producto.stock,
          descripcion: producto.descripcion,
          imagen_url: producto.imagen,
          activo: true,
          sku: generarSKU(producto.categoria),
          es_variable: producto.es_variable || false,
          precio_por_kg: producto.precio_por_kg || null
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
      console.log('=== UPDATE PRODUCTO ===');
      console.log('ID:', id);
      console.log('Datos recibidos:', {
        iva: producto.iva,
        iva_empresa: producto.iva_empresa,
        precio: producto.precio,
        nombre: producto.nombre
      });

      // Primero obtener el categoria_id basado en el slug
      const { data: catData, error: catError } = await supabaseAdmin
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

      const updateData = {
        nombre: producto.nombre,
        categoria_id: catData.id,
        precio_centimos: producto.precio,
        iva: parseFloat(String(producto.iva)) ?? 21,
        precio_empresa_centimos: producto.precio_empresa || 0,
        iva_empresa: parseFloat(String(producto.iva_empresa)) ?? 21,
        stock: producto.stock,
        descripcion: producto.descripcion,
        imagen_url: producto.imagen,
        es_variable: producto.es_variable || false,
        precio_por_kg: producto.precio_por_kg || null
      };

      console.log('Update data a enviar:', updateData);

      const { data, error } = await supabaseAdmin
        .from('productos')
        .update(updateData)
        .eq('id', id)
        .select();

      console.log('Respuesta Supabase error:', error);
      console.log('Respuesta Supabase data:', data);

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
      const { error } = await supabaseAdmin
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
