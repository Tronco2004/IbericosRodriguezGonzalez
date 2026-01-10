import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ cookies, request }) => {
  try {
    // Obtener user_id del header o cookie
    let userId = request.headers.get('x-user-id');
    
    if (!userId) {
      userId = cookies.get('user_id')?.value;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401 }
      );
    }

    // Obtener carrito del usuario
    let { data: carrito, error: carritoError } = await supabaseClient
      .from('carritos')
      .select('*')
      .eq('usuario_id', userId)
      .single();

    if (carritoError || !carrito) {
      const { data: nuevoCarrito, error: createError } = await supabaseClient
        .from('carritos')
        .insert({
          usuario_id: userId,
          fecha_creacion: new Date().toISOString(),
          fecha_actualizacion: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        return new Response(
          JSON.stringify({ error: 'Error creando carrito' }),
          { status: 500 }
        );
      }
      carrito = nuevoCarrito;
    }

    // Obtener items del carrito
    const { data: items, error: itemsError } = await supabaseClient
      .from('carrito_items')
      .select(`
        *,
        productos:producto_id(id, nombre, precio_centimos)
      `)
      .eq('carrito_id', carrito.id)
      .order('fecha_agregado', { ascending: false });

    if (itemsError) {
      return new Response(
        JSON.stringify({ error: 'Error obteniendo items' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        carrito,
        items: items || []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en GET /api/carrito:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { producto_id, cantidad, user_id } = await request.json();

    // Validar user_id
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401 }
      );
    }

    if (!producto_id || !cantidad || cantidad <= 0) {
      return new Response(
        JSON.stringify({ error: 'Datos inválidos' }),
        { status: 400 }
      );
    }

    // Obtener o crear carrito
    let { data: carrito, error: carritoError } = await supabaseClient
      .from('carritos')
      .select('*')
      .eq('usuario_id', user_id)
      .single();

    if (carritoError || !carrito) {
      const { data: nuevoCarrito, error: createError } = await supabaseClient
        .from('carritos')
        .insert({
          usuario_id: user_id,
          fecha_creacion: new Date().toISOString(),
          fecha_actualizacion: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        return new Response(
          JSON.stringify({ error: 'Error creando carrito' }),
          { status: 500 }
        );
      }
      carrito = nuevoCarrito;
    }

    // Obtener precio del producto
    const { data: producto, error: productoError } = await supabaseClient
      .from('productos')
      .select('precio_centimos')
      .eq('id', producto_id)
      .single();

    if (productoError || !producto) {
      return new Response(
        JSON.stringify({ error: 'Producto no encontrado' }),
        { status: 404 }
      );
    }

    // Verificar si el producto ya está en el carrito
    const { data: existente } = await supabaseClient
      .from('carrito_items')
      .select('*')
      .eq('carrito_id', carrito.id)
      .eq('producto_id', producto_id)
      .single();

    if (existente) {
      // Actualizar cantidad
      const { data: actualizado, error: updateError } = await supabaseClient
        .from('carrito_items')
        .update({
          cantidad: existente.cantidad + cantidad,
          fecha_agregado: new Date().toISOString()
        })
        .eq('id', existente.id)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Error actualizando item' }),
          { status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, item: actualizado }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // Crear nuevo item
      const { data: nuevoItem, error: insertError } = await supabaseClient
        .from('carrito_items')
        .insert({
          carrito_id: carrito.id,
          producto_id,
          cantidad,
          precio_unitario: producto.precio_centimos,
          fecha_agregado: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: 'Error agregando item' }),
          { status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, item: nuevoItem }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error en POST /api/carrito:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
