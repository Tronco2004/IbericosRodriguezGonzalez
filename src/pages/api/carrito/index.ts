import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const GET: APIRoute = async ({ cookies, request }) => {
  try {
    // Obtener user_id del header o cookie
    let userId = request.headers.get('x-user-id');
    
    if (!userId) {
      userId = cookies.get('user_id')?.value;
    }

    console.log('🔍 GET /api/carrito - User ID:', userId);

    if (!userId) {
      console.log('❌ No autenticado');
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
      console.log('📦 Creando nuevo carrito para usuario:', userId);
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
        console.log('❌ Error creando carrito:', createError);
        return new Response(
          JSON.stringify({ error: 'Error creando carrito' }),
          { status: 500 }
        );
      }
      carrito = nuevoCarrito;
      console.log('✅ Carrito creado:', carrito.id);
    } else {
      console.log('✅ Carrito existente encontrado, ID:', carrito.id);
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
      console.log('❌ Error obteniendo items:', itemsError);
      return new Response(
        JSON.stringify({ error: 'Error obteniendo items' }),
        { status: 500 }
      );
    }

    console.log('📦 Items obtenidos del carrito:', items?.length ?? 0, 'items');

    // Filtrar items válidos (últimos 15 minutos) en el cliente
    const ahora = new Date();
    const itemsValidos: any[] = [];
    const itemsExpirados: number[] = [];

    console.log('🔍 Filtrando items:', items?.length ?? 0, 'items');

    (items || []).forEach(item => {
      // Agregar 'Z' al timestamp si no lo tiene (PostgreSQL lo devuelve sin timezone)
      let fechaStr = item.fecha_agregado;
      if (fechaStr && !fechaStr.endsWith('Z')) {
        fechaStr = fechaStr + 'Z';
      }

      console.log(`📋 Item ${item.id}:`, {
        fecha_original: item.fecha_agregado,
        fecha_con_z: fechaStr,
        tipo: typeof item.fecha_agregado
      });

      if (!fechaStr) {
        console.log(`✅ Item ${item.id} sin fecha, manteniendo como válido`);
        itemsValidos.push(item);
        return;
      }

      const fechaAgregado = new Date(fechaStr);
      const minutosPasados = (ahora.getTime() - fechaAgregado.getTime()) / (1000 * 60);

      console.log(`⏱️ Item ${item.id}: ${minutosPasados.toFixed(2)} minutos (ahora=${ahora.toISOString()}, fecha=${fechaAgregado.toISOString()})`);

      if (minutosPasados > 15) {
        console.log(`❌ Item ${item.id} expirado`);
        itemsExpirados.push(item.id);
      } else {
        console.log(`✅ Item ${item.id} válido`);
        itemsValidos.push(item);
      }
    });

    console.log('📊 Resultado:', { itemsValidos: itemsValidos.length, itemsExpirados: itemsExpirados.length });

    // Eliminar items expirados de la BD
    if (itemsExpirados.length > 0) {
      await supabaseClient
        .from('carrito_items')
        .delete()
        .in('id', itemsExpirados);
      console.log(`🗑️ Eliminados ${itemsExpirados.length} items expirados`);

      // Devolver stock de los items eliminados (solo si son productos simples)
      for (const item of items) {
        if (itemsExpirados.includes(item.id) && !item.producto_variante_id) {
          console.log('➕ Devolviendo stock del producto:', item.producto_id, 'cantidad:', item.cantidad);
          const { data: producto } = await supabaseClient
            .from('productos')
            .select('stock')
            .eq('id', item.producto_id)
            .single();
          
          if (producto) {
            const nuevoStock = producto.stock + item.cantidad;
            await supabaseClient
              .from('productos')
              .update({ stock: nuevoStock })
              .eq('id', item.producto_id);
            console.log('✅ Stock devuelto:', { producto_id: item.producto_id, stockAnterior: producto.stock, nuevoStock });
          }
        }
      }
    }

    // Si hay items expirados, eliminarlos de la BD
    if (itemsExpirados.length > 0) {
      // Eliminar items expirados
      const { error: deleteError } = await supabaseClient
        .from('carrito_items')
        .delete()
        .in('id', itemsExpirados);

      if (deleteError) {
        console.error('Error eliminando items expirados:', deleteError);
      }
      console.log('🗑️ Eliminados items expirados:', itemsExpirados);
    }

    console.log('✅ GET /api/carrito - Retornando:', {
      carritoId: carrito.id,
      itemsCount: itemsValidos.length,
      itemsExpirados: itemsExpirados.length > 0
    });

    // Agregar 'Z' a todas las fechas antes de enviar al cliente
    const itemsConFechas = itemsValidos.map(item => ({
      ...item,
      fecha_agregado: item.fecha_agregado && !item.fecha_agregado.endsWith('Z') 
        ? item.fecha_agregado + 'Z'
        : item.fecha_agregado
    }));

    return new Response(
      JSON.stringify({
        carrito,
        items: itemsConFechas || [],
        itemsExpirados: itemsExpirados.length > 0
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
    const { producto_id, cantidad, user_id, producto_variante_id, peso_kg } = await request.json();

    console.log('🛒 POST /api/carrito - Datos recibidos:', { producto_id, cantidad, user_id, producto_variante_id, peso_kg });

    // Validar user_id
    if (!user_id) {
      console.log('❌ Error: No user_id');
      return new Response(
        JSON.stringify({ error: 'No autenticado', success: false }),
        { status: 401 }
      );
    }

    if (!producto_id || !cantidad || cantidad <= 0) {
      console.log('❌ Error: Datos inválidos', { producto_id, cantidad });
      return new Response(
        JSON.stringify({ error: 'Datos inválidos', success: false }),
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
      console.log('📦 Creando nuevo carrito para usuario:', user_id);
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
        console.log('❌ Error creando carrito:', createError);
        return new Response(
          JSON.stringify({ error: 'Error creando carrito', success: false }),
          { status: 500 }
        );
      }
      carrito = nuevoCarrito;
      console.log('✅ Carrito creado:', carrito.id);
    } else {
      console.log('✅ Carrito existente:', carrito.id);
    }

    // Si es un producto variable, obtener el precio de la variante
    let precioUnitario = null;
    if (producto_variante_id) {
      console.log('🔍 Buscando variante:', producto_variante_id);
      const { data: variante, error: varianteError } = await supabaseClient
        .from('producto_variantes')
        .select('precio_total')
        .eq('id', producto_variante_id)
        .single();

      if (varianteError || !variante) {
        console.log('❌ Variante no encontrada:', varianteError);
        return new Response(
          JSON.stringify({ error: 'Variante no encontrada', success: false }),
          { status: 404 }
        );
      }
      precioUnitario = Math.round(variante.precio_total * 100); // Convertir euros a centimos
      console.log('✅ Precio variante:', precioUnitario);
    } else {
      // Obtener precio del producto normal
      console.log('🔍 Buscando producto:', producto_id);
      const { data: producto, error: productoError } = await supabaseClient
        .from('productos')
        .select('precio_centimos')
        .eq('id', producto_id)
        .single();

      if (productoError || !producto) {
        console.log('❌ Producto no encontrado:', productoError);
        return new Response(
          JSON.stringify({ error: 'Producto no encontrado', success: false }),
          { status: 404 }
        );
      }
      precioUnitario = producto.precio_centimos;
      console.log('✅ Precio producto:', precioUnitario);
    }

    // Verificar si el producto ya está en el carrito (con misma variante si aplica)
    let queryExistente = supabaseClient
      .from('carrito_items')
      .select('*')
      .eq('carrito_id', carrito.id)
      .eq('producto_id', producto_id);

    if (producto_variante_id) {
      queryExistente = queryExistente.eq('producto_variante_id', producto_variante_id);
    } else {
      queryExistente = queryExistente.is('producto_variante_id', null);
    }

    const { data: existente } = await queryExistente.single();

    if (existente) {
      // Actualizar cantidad
      console.log('📝 Item existente, actualizando cantidad:', existente.id);
      const { data: actualizado, error: updateError } = await supabaseClient
        .from('carrito_items')
        .update({
          cantidad: existente.cantidad + cantidad
          // NO actualizar fecha_agregado - mantener la original
        })
        .eq('id', existente.id)
        .select()
        .single();

      if (updateError) {
        console.log('❌ Error actualizando item:', updateError);
        return new Response(
          JSON.stringify({ error: 'Error actualizando item', success: false }),
          { status: 500 }
        );
      }

      console.log('✅ Item actualizado:', actualizado);
      return new Response(
        JSON.stringify({ success: true, item: actualizado }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // Crear nuevo item
      console.log('➕ Creando nuevo item en carrito:', carrito.id);
      const { data: nuevoItem, error: insertError } = await supabaseClient
        .from('carrito_items')
        .insert({
          carrito_id: carrito.id,
          producto_id,
          cantidad,
          precio_unitario: precioUnitario,
          producto_variante_id: producto_variante_id || null,
          peso_kg: peso_kg || null
          // NO incluir fecha_agregado - dejar que PostgreSQL use NOW()
        })
        .select()
        .single();

      if (insertError) {
        console.log('❌ Error insertando item:', insertError);
        return new Response(
          JSON.stringify({ error: 'Error agregando item', success: false }),
          { status: 500 }
        );
      }

      // Si es un producto simple (no tiene variante), restar stock
      if (!producto_variante_id) {
        console.log('📉 Restando stock del producto:', producto_id, 'cantidad:', cantidad);
        const { error: stockError } = await supabaseClient
          .from('productos')
          .update({ stock: supabaseClient.from('productos').select('stock').eq('id', producto_id) })
          .eq('id', producto_id);
        
        // Mejor forma: usar SQL directo con RPC o hacer resta manual
        const { data: producto, error: getError } = await supabaseClient
          .from('productos')
          .select('stock')
          .eq('id', producto_id)
          .single();
        
        if (!getError && producto) {
          const nuevoStock = Math.max(0, producto.stock - cantidad);
          await supabaseClient
            .from('productos')
            .update({ stock: nuevoStock })
            .eq('id', producto_id);
          console.log('✅ Stock actualizado:', { producto_id, stockAnterior: producto.stock, nuevoStock });
        }
      }

      console.log('✅ Item agregado:', nuevoItem);
      return new Response(
        JSON.stringify({ success: true, item: nuevoItem }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('❌ Error en POST /api/carrito:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', success: false }),
      { status: 500 }
    );
  }
};
