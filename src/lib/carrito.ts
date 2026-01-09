import { supabaseClient } from './supabase';

export interface CarritoItem {
  id: number;
  carrito_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  fecha_agregado: string;
  // Datos del producto para mostrar
  nombre?: string;
  precio_centimos?: number;
}

export interface Carrito {
  id: number;
  usuario_id: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  items?: CarritoItem[];
}

/**
 * Obtener o crear carrito del usuario autenticado
 */
export async function obtenerCarrito(usuarioId: string): Promise<Carrito | null> {
  try {
    let { data: carrito, error } = await supabaseClient
      .from('carritos')
      .select('*')
      .eq('usuario_id', usuarioId)
      .single();

    // Si no existe, crear uno nuevo
    if (error || !carrito) {
      const { data: nuevoCarrito, error: errorCrear } = await supabaseClient
        .from('carritos')
        .insert({
          usuario_id: usuarioId,
          fecha_creacion: new Date().toISOString(),
          fecha_actualizacion: new Date().toISOString()
        })
        .select()
        .single();

      if (errorCrear) {
        console.error('Error creando carrito:', errorCrear);
        return null;
      }
      return nuevoCarrito;
    }

    return carrito;
  } catch (error) {
    console.error('Error en obtenerCarrito:', error);
    return null;
  }
}

/**
 * Obtener items del carrito con detalles del producto
 */
export async function obtenerItemsCarrito(carritoId: number): Promise<CarritoItem[]> {
  try {
    const { data: items, error } = await supabaseClient
      .from('carrito_items')
      .select(`
        *,
        productos:producto_id(nombre, precio_centimos)
      `)
      .eq('carrito_id', carritoId)
      .order('fecha_agregado', { ascending: false });

    if (error) {
      console.error('Error obteniendo items:', error);
      return [];
    }

    return items || [];
  } catch (error) {
    console.error('Error en obtenerItemsCarrito:', error);
    return [];
  }
}

/**
 * Agregar producto al carrito
 */
export async function agregarAlCarrito(
  carritoId: number,
  productoId: number,
  cantidad: number,
  precioUnitario: number
): Promise<CarritoItem | null> {
  try {
    // Verificar si el producto ya está en el carrito
    const { data: existente } = await supabaseClient
      .from('carrito_items')
      .select('*')
      .eq('carrito_id', carritoId)
      .eq('producto_id', productoId)
      .single();

    if (existente) {
      // Actualizar cantidad
      const { data: actualizado, error: errorUpdate } = await supabaseClient
        .from('carrito_items')
        .update({
          cantidad: existente.cantidad + cantidad,
          fecha_agregado: new Date().toISOString()
        })
        .eq('id', existente.id)
        .select()
        .single();

      if (errorUpdate) {
        console.error('Error actualizando item:', errorUpdate);
        return null;
      }
      return actualizado;
    } else {
      // Crear nuevo item
      const { data: nuevoItem, error: errorInsert } = await supabaseClient
        .from('carrito_items')
        .insert({
          carrito_id: carritoId,
          producto_id: productoId,
          cantidad,
          precio_unitario: precioUnitario,
          fecha_agregado: new Date().toISOString()
        })
        .select()
        .single();

      if (errorInsert) {
        console.error('Error insertando item:', errorInsert);
        return null;
      }
      return nuevoItem;
    }
  } catch (error) {
    console.error('Error en agregarAlCarrito:', error);
    return null;
  }
}

/**
 * Actualizar cantidad de un item del carrito
 */
export async function actualizarCantidad(
  itemId: number,
  nuevaCantidad: number
): Promise<CarritoItem | null> {
  try {
    if (nuevaCantidad <= 0) {
      await eliminarDelCarrito(itemId);
      return null;
    }

    const { data: actualizado, error } = await supabaseClient
      .from('carrito_items')
      .update({ cantidad: nuevaCantidad })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Error actualizando cantidad:', error);
      return null;
    }
    return actualizado;
  } catch (error) {
    console.error('Error en actualizarCantidad:', error);
    return null;
  }
}

/**
 * Eliminar item del carrito
 */
export async function eliminarDelCarrito(itemId: number): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from('carrito_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error eliminando item:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error en eliminarDelCarrito:', error);
    return false;
  }
}

/**
 * Vaciar carrito (eliminar todos los items)
 */
export async function vaciarCarrito(carritoId: number): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from('carrito_items')
      .delete()
      .eq('carrito_id', carritoId);

    if (error) {
      console.error('Error vaciando carrito:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error en vaciarCarrito:', error);
    return false;
  }
}

/**
 * Calcular total del carrito
 */
export function calcularTotal(items: CarritoItem[]): number {
  return items.reduce((total, item) => {
    return total + (item.precio_unitario * item.cantidad);
  }, 0);
}

/**
 * Contar total de items en el carrito
 */
export function contarItems(items: CarritoItem[]): number {
  return items.reduce((total, item) => total + item.cantidad, 0);
}
