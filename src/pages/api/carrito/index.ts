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

    // Obtener carrito del usuario (más reciente)
    let { data: carrito, error: carritoError } = await supabaseClient
      .from('carritos')
      .select('*')
      .eq('usuario_id', userId)
      .order('fecha_creacion', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!carrito) {
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
        productos:producto_id(id, nombre, precio_centimos, imagen_url, categoria_id)
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

    // Obtener categorías para mapear
    const { data: categorias } = await supabaseClient
      .from('categorias')
      .select('id, nombre, slug');
    
    const categoriaMap = {};
    categorias?.forEach((cat) => {
      categoriaMap[cat.id] = cat.nombre;
    });

    // Enriquecer items con nombre de categoría
    const itemsEnriquecidos = items?.map(item => ({
      ...item,
      productos: item.productos ? {
        ...item.productos,
        categoria: categoriaMap[item.productos.categoria_id] || 'Sin categoría'
      } : null
    })) || [];

    console.log('📦 Items obtenidos del carrito:', itemsEnriquecidos?.length ?? 0, 'items');
    console.log('🔵 Items completos:', JSON.stringify(itemsEnriquecidos, null, 2));

    // Verificar si el carrito ha expirado usando el item más reciente como referencia global
    let carritoExpirado = false;
    const ahora = new Date();

    if (itemsEnriquecidos && itemsEnriquecidos.length > 0) {
      // Encontrar el item más reciente
      let itemMasReciente = itemsEnriquecidos[0];
      for (const item of itemsEnriquecidos) {
        let fechaStr = item.fecha_agregado;
        if (fechaStr && !fechaStr.endsWith('Z')) {
          fechaStr = fechaStr + 'Z';
        }
        
        let fechaMasRecienteStr = itemMasReciente.fecha_agregado;
        if (fechaMasRecienteStr && !fechaMasRecienteStr.endsWith('Z')) {
          fechaMasRecienteStr = fechaMasRecienteStr + 'Z';
        }

        if (new Date(fechaStr) > new Date(fechaMasRecienteStr)) {
          itemMasReciente = item;
        }
      }

      // Calcular minutos desde el item más reciente
      let fechaStr = itemMasReciente.fecha_agregado;
      if (fechaStr && !fechaStr.endsWith('Z')) {
        fechaStr = fechaStr + 'Z';
      }

      const fechaMasReciente = new Date(fechaStr);
      const minutosPasados = (ahora.getTime() - fechaMasReciente.getTime()) / (1000 * 60);

      console.log(`⏱️ Item más reciente (${itemMasReciente.id}): ${minutosPasados.toFixed(2)} minutos`);

      if (minutosPasados > 15) {
        console.log(`❌ CARRITO EXPIRADO - Eliminando TODOS los items`);
        carritoExpirado = true;
      }
    }

    // Si el carrito expiró, eliminar TODOS los items y devolver stock
    if (carritoExpirado && itemsEnriquecidos && itemsEnriquecidos.length > 0) {
      // Devolver stock de TODOS los items (simples y variantes)
      for (const item of itemsEnriquecidos) {
        // Productos simples
        if (!item.producto_variante_id) {
          console.log('➕ Devolviendo stock del producto simple:', item.producto_id, 'cantidad:', item.cantidad);
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
            console.log('✅ Stock devuelto (simple):', { producto_id: item.producto_id, nuevoStock });
          }
        }
        
        // Productos variables (variantes)
        if (item.producto_variante_id) {
          console.log('➕ Devolviendo stock de variante:', item.producto_variante_id, 'cantidad:', item.cantidad);
          const { data: variante } = await supabaseClient
            .from('producto_variantes')
            .select('cantidad_disponible')
            .eq('id', item.producto_variante_id)
            .single();
          
          if (variante) {
            const stockAnterior = variante.cantidad_disponible || 0;
            const nuevoStock = stockAnterior + item.cantidad;
            const nuevoDisponible = nuevoStock > 0;
            await supabaseClient
              .from('producto_variantes')
              .update({ 
                cantidad_disponible: nuevoStock,
                disponible: nuevoDisponible
              })
              .eq('id', item.producto_variante_id);
            console.log('✅ Stock devuelto (variante):', { variante_id: item.producto_variante_id, stockAnterior, nuevoStock, ahora_disponible: nuevoDisponible });
          }
        }
      }

      // Eliminar TODOS los items del carrito
      const { error: deleteError } = await supabaseClient
        .from('carrito_items')
        .delete()
        .eq('carrito_id', carrito.id);

      if (deleteError) {
        console.log('❌ Error eliminando items expirados:', deleteError);
      } else {
        console.log('✅ Todos los items eliminados');
      }

      // Retornar carrito vacío con flag de expiración
      return new Response(
        JSON.stringify({
          carrito,
          items: [],
          itemsExpirados: true
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Carrito válido - devolver todos los items con fechas formateadas
    const itemsConFechas = (itemsEnriquecidos || []).map(item => ({
      ...item,
      fecha_agregado: item.fecha_agregado && !item.fecha_agregado.endsWith('Z') 
        ? item.fecha_agregado + 'Z'
        : item.fecha_agregado
    }));

    console.log('✅ GET /api/carrito - Retornando:', {
      carritoId: carrito.id,
      itemsCount: itemsConFechas.length,
      itemsExpirados: false
    });

    return new Response(
      JSON.stringify({
        carrito,
        items: itemsConFechas,
        itemsExpirados: false
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

    // Obtener o crear carrito (más reciente)
    let { data: carrito, error: carritoError } = await supabaseClient
      .from('carritos')
      .select('*')
      .eq('usuario_id', user_id)
      .order('fecha_creacion', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!carrito) {
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
        .select('precio_total, disponible, cantidad_disponible')
        .eq('id', producto_variante_id)
        .single();

      if (varianteError || !variante) {
        console.log('❌ Variante no encontrada:', varianteError);
        return new Response(
          JSON.stringify({ error: 'Variante no encontrada', success: false }),
          { status: 404 }
        );
      }

      // Validar que la variante esté disponible
      if (!variante.disponible) {
        console.log('❌ Variante no disponible:', producto_variante_id);
        return new Response(
          JSON.stringify({ error: 'Esta variante no está disponible', success: false }),
          { status: 400 }
        );
      }

      // Validar que hay suficiente stock disponible
      // Si cantidad_disponible es null/undefined, asumir que es disponible (compatibilidad con variantes creadas sin cantidad_disponible)
      const stockDisponible = variante.cantidad_disponible ?? 999; // Si no existe, asumir stock ilimitado
      if (cantidad > stockDisponible) {
        console.log('❌ Stock insuficiente para variante:', { variante_id: producto_variante_id, solicitado: cantidad, disponible: stockDisponible });
        return new Response(
          JSON.stringify({ error: 'No hay suficiente stock', success: false }),
          { status: 400 }
        );
      }

      // precio_total ya está en centimos en la BD
      precioUnitario = Math.round(variante.precio_total);
      console.log('✅ Precio variante (centimos):', precioUnitario);
    } else {
      // Obtener precio del producto normal
      console.log('🔍 Buscando producto:', producto_id);
      const { data: producto, error: productoError } = await supabaseClient
        .from('productos')
        .select('precio_centimos, stock')
        .eq('id', producto_id)
        .single();

      if (productoError || !producto) {
        console.log('❌ Producto no encontrado:', productoError);
        return new Response(
          JSON.stringify({ error: 'Producto no encontrado', success: false }),
          { status: 404 }
        );
      }

      // Validar que hay suficiente stock disponible
      const stockDisponible = producto.stock || 0;
      if (cantidad > stockDisponible) {
        console.log('❌ Stock insuficiente para producto:', { producto_id, solicitado: cantidad, disponible: stockDisponible });
        return new Response(
          JSON.stringify({ error: 'No hay suficiente stock', success: false }),
          { status: 400 }
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
      // Actualizar cantidad - VALIDAR STOCK DISPONIBLE
      console.log('📝 Item existente, actualizando cantidad:', existente.id);
      
      const nuevaCantidad = existente.cantidad + cantidad;
      
      // Validar stock disponible para la nueva cantidad total
      let stockDisponible = 0;
      if (producto_variante_id) {
        const { data: variante } = await supabaseClient
          .from('producto_variantes')
          .select('cantidad_disponible')
          .eq('id', producto_variante_id)
          .single();
        stockDisponible = (variante?.cantidad_disponible || 0) + existente.cantidad; // Sumar de vuelta lo que ya estaba reservado
      } else {
        const { data: producto } = await supabaseClient
          .from('productos')
          .select('stock')
          .eq('id', producto_id)
          .single();
        stockDisponible = (producto?.stock || 0) + existente.cantidad; // Sumar de vuelta lo que ya estaba reservado
      }

      if (nuevaCantidad > stockDisponible) {
        console.log('❌ Stock insuficiente para incremento:', { solicitado: nuevaCantidad, disponible: stockDisponible });
        return new Response(
          JSON.stringify({ error: 'No hay suficiente stock', success: false }),
          { status: 400 }
        );
      }

      const { data: actualizado, error: updateError } = await supabaseClient
        .from('carrito_items')
        .update({
          cantidad: nuevaCantidad
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

      // Si es un producto variable (con variante), decrementar stock de la variante
      if (producto_variante_id) {
        console.log('📉 Decrementando stock de variante:', producto_variante_id, 'cantidad:', cantidad);
        
        const { data: variante, error: getError } = await supabaseClient
          .from('producto_variantes')
          .select('cantidad_disponible')
          .eq('id', producto_variante_id)
          .single();
        
        if (!getError && variante) {
          const nuevoStock = Math.max(0, (variante.cantidad_disponible || 0) - cantidad);
          const nuevoDisponible = nuevoStock > 0;
          
          await supabaseClient
            .from('producto_variantes')
            .update({ 
              cantidad_disponible: nuevoStock,
              disponible: nuevoDisponible
            })
            .eq('id', producto_variante_id);
          
          console.log('✅ Stock variante actualizado:', { 
            variante_id: producto_variante_id, 
            stockAnterior: variante.cantidad_disponible,
            nuevoStock,
            ahora_disponible: nuevoDisponible
          });
        }
      }

      // Si es un producto simple (no tiene variante), restar stock
      if (!producto_variante_id) {
        console.log('📉 Restando stock del producto:', producto_id, 'cantidad:', cantidad);
        
        const { data: producto, error: getError } = await supabaseClient
          .from('productos')
          .select('stock')
          .eq('id', producto_id)
          .single();
        
        if (!getError && producto) {
          const nuevoStock = Math.max(0, producto.stock - cantidad);
          const { error: updateError } = await supabaseClient
            .from('productos')
            .update({ stock: nuevoStock })
            .eq('id', producto_id);
          if (updateError) {
            console.log('❌ Error actualizando stock:', updateError);
          } else {
            console.log('✅ Stock actualizado:', { producto_id, stockAnterior: producto.stock, nuevoStock });
          }
        } else {
          console.log('❌ Error obteniendo stock:', getError);
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
