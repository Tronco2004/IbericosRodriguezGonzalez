import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

/**
 * DEPRECATED: Este endpoint ya no se usa.
 * Las variantes se eliminan automáticamente mediante un TRIGGER en la BD
 * cuando se inserta un item de pedido (pedido_items).
 * 
 * Ver: TRIGGER_ELIMINAR_VARIANTES_VENDIDAS.sql
 */

export const DELETE: APIRoute = async ({ request }) => {
  return new Response(
    JSON.stringify({ 
      error: 'Este endpoint está deprecado. Las variantes se eliminan automáticamente mediante trigger en la BD.',
      message: 'Ver TRIGGER_ELIMINAR_VARIANTES_VENDIDAS.sql'
    }),
    { status: 410 }
  );
};
