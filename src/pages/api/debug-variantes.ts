import type { APIRoute } from 'astro';
import { supabaseClient } from '../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    // Obtener TODAS las variantes sin filtros
    const { data: todasVariantes, error: varError } = await supabaseClient
      .from('producto_variantes')
      .select('*')
      .order('producto_id', { ascending: true });

    if (varError) {
      console.error('❌ Error al obtener todas las variantes:', varError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: varError.message,
          todasVariantes: []
        }),
        { status: 500 }
      );
    }

    console.log(`✅ Total de variantes en BD: ${todasVariantes?.length || 0}`);
    if (todasVariantes && todasVariantes.length > 0) {
      const porProducto = {};
      todasVariantes.forEach(v => {
        if (!porProducto[v.producto_id]) {
          porProducto[v.producto_id] = [];
        }
        porProducto[v.producto_id].push(v);
      });
      
      Object.entries(porProducto).forEach(([prodId, vars]) => {
        console.log(`  Producto ${prodId}: ${vars.length} variantes`);
        (vars as any[]).forEach(v => {
          console.log(`    - ID: ${v.id}, peso: ${v.peso_kg}kg, disponible: ${v.disponible}, precio: ${v.precio_total}`);
        });
      });
    }

    // Obtener productos variables
    const { data: productosVar, error: prodError } = await supabaseClient
      .from('productos')
      .select('id, nombre, es_variable')
      .eq('es_variable', true)
      .eq('activo', true);

    if (prodError) {
      console.error('❌ Error al obtener productos variables:', prodError);
    }

    console.log(`✅ Productos variables: ${productosVar?.length || 0}`);
    productosVar?.forEach(p => {
      const variantes = todasVariantes?.filter(v => v.producto_id === p.id) || [];
      console.log(`  - Producto ${p.id} (${p.nombre}): ${variantes.length} variantes`);
    });

    return new Response(
      JSON.stringify({
        success: true,
        totalVariantes: todasVariantes?.length || 0,
        todasVariantes: todasVariantes,
        productosVariables: productosVar,
        porProducto: Object.fromEntries(
          Object.entries(
            todasVariantes?.reduce((acc: any, v: any) => {
              if (!acc[v.producto_id]) acc[v.producto_id] = [];
              acc[v.producto_id].push(v);
              return acc;
            }, {}) || {}
          )
        )
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ Error en endpoint debug-variantes:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500 }
    );
  }
};
