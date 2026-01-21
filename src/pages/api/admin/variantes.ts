import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const prerender = false;

// GET - Obtener todas las variantes de un producto
export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const url = new URL(request.url);
    const productoId = url.searchParams.get('producto_id');

    if (!productoId) {
      return new Response(
        JSON.stringify({ error: 'producto_id requerido' }),
        { status: 400 }
      );
    }

    const { data: variantes, error } = await supabaseClient
      .from('producto_variantes')
      .select('*')
      .eq('producto_id', parseInt(productoId))
      .order('peso_kg', { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Error obteniendo variantes' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        variantes: variantes || [] 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en GET /api/admin/variantes:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};

// POST - Agregar nueva variante
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { producto_id, peso_kg, precio_total } = await request.json();

    if (!producto_id || !peso_kg || !precio_total) {
      return new Response(
        JSON.stringify({ error: 'Datos incompletos' }),
        { status: 400 }
      );
    }

    // Generar SKU automático
    const sku = `VAR-${producto_id}-${peso_kg.toString().replace('.', '')}`;

    const { data: variante, error } = await supabaseClient
      .from('producto_variantes')
      .insert({
        producto_id: parseInt(producto_id),
        peso_kg: parseFloat(peso_kg),
        precio_total: parseFloat(precio_total),
        sku_variante: sku,
        disponible: true,
        cantidad_disponible: 1
      })
      .select()
      .single();

    // Si falla porque el campo no existe, reintentar sin cantidad_disponible
    if (error && error.message.includes('cantidad_disponible')) {
      const { data: varianteRetry, error: errorRetry } = await supabaseClient
        .from('producto_variantes')
        .insert({
          producto_id: parseInt(producto_id),
          peso_kg: parseFloat(peso_kg),
          precio_total: parseFloat(precio_total),
          sku_variante: sku,
          disponible: true
        })
        .select()
        .single();

      if (errorRetry) {
        console.error('Error insertando variante (retry):', errorRetry);
        return new Response(
          JSON.stringify({ error: 'Error creando variante: ' + errorRetry.message }),
          { status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, variante: varianteRetry }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (error) {
      console.error('Error insertando variante:', error);
      return new Response(
        JSON.stringify({ error: 'Error creando variante: ' + error.message }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, variante }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en POST /api/admin/variantes:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};

// DELETE - Eliminar variante
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const url = new URL(request.url);
    // Intentar obtener el ID de la URL path o de los parámetros
    const pathParts = url.pathname.split('/');
    let varianteId = pathParts[pathParts.length - 1];
    
    // Si no está en la URL, buscar en query params
    if (!varianteId || varianteId === 'variantes') {
      varianteId = url.searchParams.get('id');
    }

    if (!varianteId) {
      return new Response(
        JSON.stringify({ error: 'id requerido' }),
        { status: 400 }
      );
    }

    const { error } = await supabaseClient
      .from('producto_variantes')
      .delete()
      .eq('id', parseInt(varianteId));

    if (error) {
      console.error('Error eliminando variante:', error);
      return new Response(
        JSON.stringify({ error: 'Error eliminando variante: ' + error.message }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en DELETE /api/admin/variantes:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};

// PUT - Actualizar variante (precio, peso, disponibilidad, etc.)
export const PUT: APIRoute = async ({ request, cookies }) => {
  try {
    const url = new URL(request.url);
    const varianteId = url.pathname.split('/').pop(); // Obtener ID de la URL
    
    const body = await request.json();
    const { peso_kg, precio_total, cantidad_disponible, disponible } = body;

    if (!varianteId) {
      return new Response(
        JSON.stringify({ error: 'id requerido' }),
        { status: 400 }
      );
    }

    // Construir objeto de actualización solo con campos que vienen
    const updateData: any = {};
    if (peso_kg !== undefined) updateData.peso_kg = parseFloat(peso_kg);
    if (precio_total !== undefined) updateData.precio_total = parseFloat(precio_total);
    if (cantidad_disponible !== undefined) {
      updateData.cantidad_disponible = parseInt(cantidad_disponible);
      updateData.disponible = cantidad_disponible > 0;
    }
    if (disponible !== undefined) {
      updateData.disponible = Boolean(disponible);
    }

    const { data: variante, error } = await supabaseClient
      .from('producto_variantes')
      .update(updateData)
      .eq('id', parseInt(varianteId))
      .select()
      .single();

    if (error) {
      console.error('Error actualizando variante:', error);
      return new Response(
        JSON.stringify({ error: 'Error actualizando variante: ' + error.message }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, variante }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en PUT /api/admin/variantes:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
