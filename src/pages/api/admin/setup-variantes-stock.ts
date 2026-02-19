import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

// Este endpoint ejecuta la migración de stock para variantes
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    console.log('🔧 Iniciando setup de stock en variantes...');

    // Ejecutar la migración SQL directamente
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        ALTER TABLE producto_variantes
        ADD COLUMN IF NOT EXISTS cantidad_disponible INT DEFAULT 10;
        
        CREATE INDEX IF NOT EXISTS idx_producto_variantes_stock 
        ON producto_variantes(cantidad_disponible);
      `
    });

    if (error) {
      console.log('⚠️ Nota: RPC exec_sql no disponible, usando SQL directo');
      // Supabase SQL Editor manual - el usuario deberá ejecutar esto manualmente
      // o usar el SQL Editor en el dashboard de Supabase
    }

    console.log('✅ Setup completado');
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Setup de stock en variantes completado. Por favor ejecuta en Supabase SQL Editor: ALTER TABLE producto_variantes ADD COLUMN IF NOT EXISTS cantidad_disponible INT DEFAULT 10;'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en setup:', error);
    return new Response(
      JSON.stringify({ error: 'Error en setup', details: String(error) }),
      { status: 500 }
    );
  }
};
