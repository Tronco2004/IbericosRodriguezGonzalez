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
        disponible: true
      })
      .select()
      .single();

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
export const DELETE: APIRoute = async ({ request, cookies, params }) => {
  try {
    const url = new URL(request.url);
    const varianteId = url.searchParams.get('id');

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
      return new Response(
        JSON.stringify({ error: 'Error eliminando variante' }),
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

// PUT - Actualizar cantidad disponible (cuando se vende)
export const PUT: APIRoute = async ({ request, cookies }) => {
  try {
    const { variante_id, cantidad_disponible } = await request.json();

    if (!variante_id || cantidad_disponible === undefined) {
      return new Response(
        JSON.stringify({ error: 'Datos incompletos' }),
        { status: 400 }
      );
    }

    const { data: variante, error } = await supabaseClient
      .from('producto_variantes')
      .update({
        cantidad_disponible: parseInt(cantidad_disponible),
        disponible: cantidad_disponible > 0
      })
      .eq('id', parseInt(variante_id))
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Error actualizando variante' }),
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
