import type { APIRoute } from 'astro';
import { supabaseClient, supabaseAdmin } from '../../../lib/supabase';
import { decrementarStockProducto, incrementarStockProducto, decrementarStockVariante, incrementarStockVariante } from '../../../lib/stock';
import { getAuthenticatedUserId } from '../../../lib/auth-helpers';

export const GET: APIRoute = async ({ cookies, request }) => {
  try {
    // ── Auth: validar JWT (no confiar en x-user-id ni cookies de texto plano) ──
    const { userId: jwtUserId } = await getAuthenticatedUserId(request, cookies);
    // Fallback a cookie user_id solo si no hay JWT (compatibilidad transitoria)
    const userId = jwtUserId || cookies.get('user_id')?.value || null;

    console.log('🔍 GET /api/carrito - User autenticado:', !!userId);

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
        productos:producto_id(id, nombre, precio_centimos, imagen_url, categoria_id, stock)
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

    // Obtener ofertas activas para verificar precios
    const ahoraISO = new Date().toISOString();
    const { data: ofertasActivas } = await supabaseClient
      .from('ofertas')
      .select('producto_id, precio_descuento_centimos, porcentaje_descuento, nombre_oferta')
      .eq('activa', true)
      .lte('fecha_inicio', ahoraISO)
      .gte('fecha_fin', ahoraISO);

    const ofertasMap: Record<number, any> = {};
    ofertasActivas?.forEach((oferta: any) => {
      ofertasMap[oferta.producto_id] = oferta;
    });

    // Obtener stock de variantes si hay items con variante
    const varianteIds = (items || []).filter(i => i.producto_variante_id).map(i => i.producto_variante_id);
    const variantesStockMap: Record<number, number> = {};
    if (varianteIds.length > 0) {
      const { data: variantesData } = await supabaseClient
        .from('producto_variantes')
        .select('id, cantidad_disponible')
        .in('id', varianteIds);
      variantesData?.forEach((v: any) => {
        variantesStockMap[v.id] = v.cantidad_disponible || 0;
      });
    }

    // Enriquecer items con nombre de categoría y corregir precios con ofertas activas
    const itemsEnriquecidos = [];
    for (const item of (items || [])) {
      const oferta = ofertasMap[item.producto_id];
      let precioCorregido = item.precio_unitario;

      // Corregir precio si hay oferta activa
      // NOTA: No escribimos en BD desde GET (viola semántica REST). 
      // El checkout ya valida precios server-side contra BD.
      if (oferta) {
        if (item.producto_variante_id) {
          // Para variantes: el POST ya guardó el precio con descuento aplicado.
          // No re-aplicar el descuento para evitar doble descuento.
          // precioCorregido ya es item.precio_unitario (correcto)
        } else {
          // Para productos simples: usar precio fijo de oferta
          const precioOferta = oferta.precio_descuento_centimos;
          if (item.precio_unitario !== precioOferta) {
            precioCorregido = precioOferta;
          }
        }
      }

      // Calcular stock máximo permitido para este item
      // stock_disponible = stock actual en BD (aún no reservado) + cantidad que ya tiene en carrito
      let stockMaximo: number | null = null;
      if (!item.peso_kg) { // Solo limitar para productos sin peso variable
        if (item.producto_variante_id) {
          const stockVariante = variantesStockMap[item.producto_variante_id] ?? 0;
          stockMaximo = item.cantidad + stockVariante;
        } else if (item.productos?.stock !== undefined) {
          stockMaximo = item.cantidad + (item.productos.stock || 0);
        }
      }

      itemsEnriquecidos.push({
        ...item,
        precio_unitario: precioCorregido,
        stock_maximo: stockMaximo,
        productos: item.productos ? {
          ...item.productos,
          categoria: categoriaMap[item.productos.categoria_id] || 'Sin categoría'
        } : null
      });
    }

    console.log('📦 Items obtenidos del carrito:', itemsEnriquecidos?.length ?? 0, 'items');

    // Verificar si el carrito ha expirado usando el item MÁS ANTIGUO.
    // Si el item más antiguo lleva >15 min con stock reservado, expira todo el carrito.
    let carritoExpirado = false;
    const ahora = new Date();

    if (itemsEnriquecidos && itemsEnriquecidos.length > 0) {
      // Encontrar el item más antiguo
      let itemMasAntiguo = itemsEnriquecidos[0];
      for (const item of itemsEnriquecidos) {
        let fechaStr = item.fecha_agregado;
        if (fechaStr && !fechaStr.endsWith('Z')) {
          fechaStr = fechaStr + 'Z';
        }
        
        let fechaAntiguaStr = itemMasAntiguo.fecha_agregado;
        if (fechaAntiguaStr && !fechaAntiguaStr.endsWith('Z')) {
          fechaAntiguaStr = fechaAntiguaStr + 'Z';
        }

        if (new Date(fechaStr) < new Date(fechaAntiguaStr)) {
          itemMasAntiguo = item;
        }
      }

      // Calcular minutos desde el item más antiguo
      let fechaStr = itemMasAntiguo.fecha_agregado;
      if (fechaStr && !fechaStr.endsWith('Z')) {
        fechaStr = fechaStr + 'Z';
      }

      const fechaMasAntigua = new Date(fechaStr);
      const minutosPasados = (ahora.getTime() - fechaMasAntigua.getTime()) / (1000 * 60);

      if (minutosPasados > 15) {
        console.log(`⏳ Carrito expirado — item más antiguo (${itemMasAntiguo.id}) tiene ${minutosPasados.toFixed(0)} min`);
        carritoExpirado = true;
      }
    }

    // Si el carrito expiró, eliminar TODOS los items y devolver stock
    if (carritoExpirado && itemsEnriquecidos && itemsEnriquecidos.length > 0) {
      // Devolver stock de TODOS los items (simples y variantes) - operaciones atómicas CAS
      const fallosDevolucion: string[] = [];
      for (const item of itemsEnriquecidos) {
        try {
          if (!item.producto_variante_id) {
            console.log('➕ Devolviendo stock del producto simple:', item.producto_id, 'cantidad:', item.cantidad);
            const result = await incrementarStockProducto(item.producto_id, item.cantidad);
            if (!result.success) {
              fallosDevolucion.push(`Producto ${item.producto_id}: ${result.error}`);
            }
          }
          if (item.producto_variante_id) {
            console.log('➕ Devolviendo stock de variante:', item.producto_variante_id, 'cantidad:', item.cantidad);
            const result = await incrementarStockVariante(item.producto_variante_id, item.cantidad);
            if (!result.success) {
              fallosDevolucion.push(`Variante ${item.producto_variante_id}: ${result.error}`);
            }
          }
        } catch (err) {
          console.error('❌ Error devolviendo stock item:', item.id, err);
          fallosDevolucion.push(`Item ${item.id}: excepción`);
        }
      }

      if (fallosDevolucion.length > 0) {
        console.error('⚠️ Fallos parciales devolviendo stock:', fallosDevolucion);
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
    const { producto_id, cantidad, producto_variante_id, peso_kg } = await request.json();

    console.log('🛒 POST /api/carrito - producto:', producto_id, 'cant:', cantidad);

    // ── Auth: validar JWT (ignorar user_id del body — no confiar en el cliente) ──
    const { userId: jwtUserId } = await getAuthenticatedUserId(request, cookies);
    const user_id = jwtUserId || cookies.get('user_id')?.value || null;

    if (!user_id) {
      console.log('❌ Error: No autenticado');
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
      const stockDisponible = variante.cantidad_disponible ?? 0;
      if (stockDisponible <= 0 || cantidad > stockDisponible) {
        console.log('❌ Stock insuficiente para variante:', { variante_id: producto_variante_id, solicitado: cantidad, disponible: stockDisponible });
        return new Response(
          JSON.stringify({ error: 'No hay suficiente stock', success: false }),
          { status: 400 }
        );
      }

      // precio_total ya está en centimos en la BD
      precioUnitario = Math.round(variante.precio_total);
      console.log('✅ Precio variante (centimos):', precioUnitario);

      // Verificar si el producto tiene una oferta activa y aplicar porcentaje de descuento
      const ahoraVariante = new Date().toISOString();
      const { data: ofertaVariante } = await supabaseClient
        .from('ofertas')
        .select('id, porcentaje_descuento, nombre_oferta')
        .eq('producto_id', producto_id)
        .eq('activa', true)
        .lte('fecha_inicio', ahoraVariante)
        .gte('fecha_fin', ahoraVariante)
        .limit(1)
        .maybeSingle();

      if (ofertaVariante && ofertaVariante.porcentaje_descuento > 0) {
        const precioOriginal = precioUnitario;
        precioUnitario = Math.round(precioUnitario * (1 - ofertaVariante.porcentaje_descuento / 100));
        console.log(`🏷️ Oferta activa para variante: "${ofertaVariante.nombre_oferta}" - ${ofertaVariante.porcentaje_descuento}% descuento`);
        console.log(`💰 Precio variante: ${precioOriginal} → ${precioUnitario}`);
      }
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
      console.log('✅ Precio base producto:', precioUnitario);

      // Verificar si el producto tiene una oferta activa
      const ahora = new Date().toISOString();
      const { data: ofertaActiva } = await supabaseClient
        .from('ofertas')
        .select('id, precio_descuento_centimos, porcentaje_descuento, nombre_oferta')
        .eq('producto_id', producto_id)
        .eq('activa', true)
        .lte('fecha_inicio', ahora)
        .gte('fecha_fin', ahora)
        .order('precio_descuento_centimos', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (ofertaActiva) {
        console.log(`🏷️ Oferta activa encontrada: "${ofertaActiva.nombre_oferta}" - ${ofertaActiva.porcentaje_descuento}% descuento`);
        console.log(`💰 Precio original: ${precioUnitario} → Precio oferta: ${ofertaActiva.precio_descuento_centimos}`);
        precioUnitario = ofertaActiva.precio_descuento_centimos;
      } else {
        console.log('ℹ️ Sin oferta activa para este producto');
      }

      console.log('✅ Precio final producto:', precioUnitario);
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
      // Actualizar cantidad - PRIMERO decrementar stock atómicamente, LUEGO actualizar carrito
      console.log('📝 Item existente, actualizando cantidad:', existente.id);
      
      const nuevaCantidad = existente.cantidad + cantidad;

      // 1. Decrementar stock PRIMERO con CAS (atómico)
      let stockResult;
      if (producto_variante_id) {
        stockResult = await decrementarStockVariante(producto_variante_id, cantidad);
      } else {
        stockResult = await decrementarStockProducto(producto_id, cantidad);
      }

      if (!stockResult.success) {
        console.log('❌ Stock insuficiente (CAS):', stockResult.error);
        return new Response(
          JSON.stringify({ error: stockResult.error || 'No hay suficiente stock', success: false }),
          { status: 400 }
        );
      }

      // 2. Stock decrementado OK → actualizar cantidad en carrito
      const { data: actualizado, error: updateError } = await supabaseClient
        .from('carrito_items')
        .update({
          cantidad: nuevaCantidad
        })
        .eq('id', existente.id)
        .select()
        .single();

      if (updateError) {
        // Rollback: devolver stock que ya decrementamos
        console.log('❌ Error actualizando item, devolviendo stock:', updateError);
        if (producto_variante_id) {
          await incrementarStockVariante(producto_variante_id, cantidad);
        } else {
          await incrementarStockProducto(producto_id, cantidad);
        }
        return new Response(
          JSON.stringify({ error: 'Error actualizando item', success: false }),
          { status: 500 }
        );
      }

      console.log('✅ Item actualizado:', actualizado);
      return new Response(
        JSON.stringify({ success: true, item: actualizado, stockRestante: stockResult.stockRestante }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // Crear nuevo item - PRIMERO decrementar stock atómicamente, LUEGO insertar
      console.log('➕ Creando nuevo item en carrito:', carrito.id);

      // 1. Decrementar stock PRIMERO con CAS (atómico)
      let stockResult;
      let variantes = null;
      
      if (producto_variante_id) {
        console.log('📉 Decrementando stock de variante:', producto_variante_id, 'cantidad:', cantidad);
        stockResult = await decrementarStockVariante(producto_variante_id, cantidad);
      } else {
        console.log('📉 Restando stock del producto:', producto_id, 'cantidad:', cantidad);
        stockResult = await decrementarStockProducto(producto_id, cantidad);
      }

      if (!stockResult.success) {
        console.log('❌ Stock insuficiente (CAS):', stockResult.error);
        return new Response(
          JSON.stringify({ error: stockResult.error || 'No hay suficiente stock', success: false }),
          { status: 400 }
        );
      }

      // 2. Stock decrementado OK → insertar item en carrito
      const { data: nuevoItem, error: insertError } = await supabaseClient
        .from('carrito_items')
        .insert({
          carrito_id: carrito.id,
          producto_id,
          cantidad,
          precio_unitario: precioUnitario,
          producto_variante_id: producto_variante_id || null,
          peso_kg: peso_kg || null
        })
        .select()
        .single();

      if (insertError) {
        // Rollback: devolver stock que ya decrementamos
        console.log('❌ Error insertando item, devolviendo stock:', insertError);
        if (producto_variante_id) {
          await incrementarStockVariante(producto_variante_id, cantidad);
        } else {
          await incrementarStockProducto(producto_id, cantidad);
        }
        return new Response(
          JSON.stringify({ error: 'Error agregando item', success: false }),
          { status: 500 }
        );
      }

      // 3. Si es variante, obtener variantes disponibles actualizadas
      if (producto_variante_id && stockResult.success) {
        const { data: todasVariantes } = await supabaseClient
          .from('producto_variantes')
          .select('*')
          .eq('producto_id', producto_id)
          .eq('disponible', true)
          .order('peso_kg', { ascending: true });
        
        variantes = todasVariantes || [];
      }

      console.log('✅ Item agregado:', nuevoItem);
      return new Response(
        JSON.stringify({ success: true, item: nuevoItem, stockRestante: stockResult.stockRestante, variantes }),
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
