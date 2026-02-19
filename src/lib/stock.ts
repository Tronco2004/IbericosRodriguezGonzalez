/**
 * Operaciones atómicas de stock usando Compare-And-Swap (CAS).
 * Evita race conditions sin necesidad de funciones RPC en la base de datos.
 * 
 * Patrón: leer stock → intentar UPDATE con WHERE stock = valor_leído.
 * Si otro proceso modificó el stock entre medias, no coincide y se reintenta.
 */
import { supabaseAdmin } from './supabase';

const MAX_RETRIES = 5;

/** Delay exponencial entre reintentos CAS para reducir contención */
function casDelay(intento: number): Promise<void> {
  const ms = Math.min(50 * Math.pow(2, intento), 500) + Math.random() * 30;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Normaliza stock a 3 decimales para evitar problemas de precisión float */
function normStock(val: number | null | undefined): number {
  const n = Number(val) || 0;
  return Math.round(n * 1000) / 1000;
}

interface StockResult {
  success: boolean;
  stockRestante: number;
  error?: string;
  disponible?: boolean;
}

// ─── PRODUCTOS SIMPLES ───────────────────────────────────────

export async function decrementarStockProducto(
  productoId: number, 
  cantidad: number
): Promise<StockResult> {
  for (let intento = 0; intento < MAX_RETRIES; intento++) {
    if (intento > 0) await casDelay(intento);

    const { data: producto, error: getError } = await supabaseAdmin
      .from('productos')
      .select('stock')
      .eq('id', productoId)
      .single();

    if (getError || !producto) {
      return { success: false, stockRestante: 0, error: 'Producto no encontrado' };
    }

    const stockActual = normStock(producto.stock);
    if (stockActual < cantidad) {
      return { success: false, stockRestante: stockActual, error: 'Stock insuficiente' };
    }

    const nuevoStock = normStock(stockActual - cantidad);

    // CAS: solo actualiza si stock sigue siendo el mismo que leímos
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('productos')
      .update({ stock: nuevoStock })
      .eq('id', productoId)
      .eq('stock', stockActual)
      .select('stock')
      .maybeSingle();

    if (updateError) {
      console.error('❌ Error en CAS decrementar producto:', updateError);
      return { success: false, stockRestante: stockActual, error: 'Error actualizando stock' };
    }

    if (updated) {
      console.log(`✅ Stock producto decrementado (CAS ok): producto=${productoId}, ${stockActual} → ${updated.stock}`);
      return { success: true, stockRestante: updated.stock };
    }

    // CAS falló: otro proceso cambió el stock, reintentar
    console.log(`⚠️ CAS fallido producto ${productoId}, stockLeido=${stockActual}, reintentando (${intento + 1}/${MAX_RETRIES})`);
  }

  return { success: false, stockRestante: 0, error: 'Conflicto de concurrencia, inténtalo de nuevo' };
}

export async function incrementarStockProducto(
  productoId: number, 
  cantidad: number
): Promise<StockResult> {
  for (let intento = 0; intento < MAX_RETRIES; intento++) {
    if (intento > 0) await casDelay(intento);

    const { data: producto, error: getError } = await supabaseAdmin
      .from('productos')
      .select('stock')
      .eq('id', productoId)
      .single();

    if (getError || !producto) {
      return { success: false, stockRestante: 0, error: 'Producto no encontrado' };
    }

    const stockActual = normStock(producto.stock);
    const nuevoStock = normStock(stockActual + cantidad);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('productos')
      .update({ stock: nuevoStock })
      .eq('id', productoId)
      .eq('stock', stockActual)
      .select('stock')
      .maybeSingle();

    if (updateError) {
      console.error('❌ Error en CAS incrementar producto:', updateError);
      return { success: false, stockRestante: stockActual, error: 'Error actualizando stock' };
    }

    if (updated) {
      console.log(`✅ Stock producto incrementado (CAS ok): producto=${productoId}, ${stockActual} → ${updated.stock}`);
      return { success: true, stockRestante: updated.stock };
    }

    console.log(`⚠️ CAS fallido producto ${productoId}, stockLeido=${stockActual}, reintentando (${intento + 1}/${MAX_RETRIES})`);
  }

  return { success: false, stockRestante: 0, error: 'Conflicto de concurrencia, inténtalo de nuevo' };
}

// ─── VARIANTES ───────────────────────────────────────────────

export async function decrementarStockVariante(
  varianteId: number, 
  cantidad: number
): Promise<StockResult> {
  for (let intento = 0; intento < MAX_RETRIES; intento++) {
    if (intento > 0) await casDelay(intento);

    const { data: variante, error: getError } = await supabaseAdmin
      .from('producto_variantes')
      .select('cantidad_disponible')
      .eq('id', varianteId)
      .single();

    if (getError || !variante) {
      return { success: false, stockRestante: 0, error: 'Variante no encontrada', disponible: false };
    }

    const stockActual = normStock(variante.cantidad_disponible);
    if (stockActual < cantidad) {
      return { success: false, stockRestante: stockActual, error: 'Stock insuficiente', disponible: stockActual > 0 };
    }

    const nuevoStock = normStock(stockActual - cantidad);
    const nuevoDisponible = nuevoStock > 0;

    // CAS: solo actualiza si cantidad_disponible sigue siendo la misma
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('producto_variantes')
      .update({ cantidad_disponible: nuevoStock, disponible: nuevoDisponible })
      .eq('id', varianteId)
      .eq('cantidad_disponible', stockActual)
      .select('cantidad_disponible, disponible')
      .maybeSingle();

    if (updateError) {
      console.error('❌ Error en CAS decrementar variante:', updateError);
      return { success: false, stockRestante: stockActual, error: 'Error actualizando stock', disponible: stockActual > 0 };
    }

    if (updated) {
      console.log(`✅ Stock variante decrementado (CAS ok): variante=${varianteId}, ${stockActual} → ${updated.cantidad_disponible}`);
      return { success: true, stockRestante: updated.cantidad_disponible, disponible: updated.disponible };
    }

    console.log(`⚠️ CAS fallido variante ${varianteId}, stockLeido=${stockActual}, reintentando (${intento + 1}/${MAX_RETRIES})`);
  }

  return { success: false, stockRestante: 0, error: 'Conflicto de concurrencia, inténtalo de nuevo', disponible: false };
}

export async function incrementarStockVariante(
  varianteId: number, 
  cantidad: number
): Promise<StockResult> {
  for (let intento = 0; intento < MAX_RETRIES; intento++) {
    if (intento > 0) await casDelay(intento);

    const { data: variante, error: getError } = await supabaseAdmin
      .from('producto_variantes')
      .select('cantidad_disponible')
      .eq('id', varianteId)
      .single();

    if (getError || !variante) {
      return { success: false, stockRestante: 0, error: 'Variante no encontrada', disponible: false };
    }

    const stockActual = normStock(variante.cantidad_disponible);
    const nuevoStock = normStock(stockActual + cantidad);
    const nuevoDisponible = nuevoStock > 0;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('producto_variantes')
      .update({ cantidad_disponible: nuevoStock, disponible: nuevoDisponible })
      .eq('id', varianteId)
      .eq('cantidad_disponible', stockActual)
      .select('cantidad_disponible, disponible')
      .maybeSingle();

    if (updateError) {
      console.error('❌ Error en CAS incrementar variante:', updateError);
      return { success: false, stockRestante: stockActual, error: 'Error actualizando stock', disponible: stockActual > 0 };
    }

    if (updated) {
      console.log(`✅ Stock variante incrementado (CAS ok): variante=${varianteId}, ${stockActual} → ${updated.cantidad_disponible}`);
      return { success: true, stockRestante: updated.cantidad_disponible, disponible: updated.disponible };
    }

    console.log(`⚠️ CAS fallido variante ${varianteId}, stockLeido=${stockActual}, reintentando (${intento + 1}/${MAX_RETRIES})`);
  }

  return { success: false, stockRestante: 0, error: 'Conflicto de concurrencia, inténtalo de nuevo', disponible: false };
}
