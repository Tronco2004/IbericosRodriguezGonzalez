import type { APIRoute } from 'astro';
import { supabaseClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId es requerido' }), { status: 400 });
    }

    console.log('\n🧪 ======= DEBUG: Crear pedido de prueba =======');
    console.log('userId:', userId);

    // Crear pedido de prueba
    const { data: pedidoCreado, error: pedidoError } = await supabaseClient
      .from('pedidos')
      .insert({
        usuario_id: userId,
        stripe_session_id: 'TEST_SESSION_' + Date.now(),
        numero_pedido: `TEST-${Date.now()}`,
        estado: 'confirmado',
        subtotal: 25.00,
        envio: 5.00,
        impuestos: 0,
        total: 30.00,
        email_cliente: 'test@example.com',
        fecha_pago: new Date().toISOString(),
      })
      .select('id');

    if (pedidoError) {
      console.error('❌ Error:', pedidoError);
      return new Response(JSON.stringify({ error: pedidoError }), { status: 500 });
    }

    const pedidoId = pedidoCreado[0].id;
    console.log('✅ Pedido creado:', pedidoId);

    // Crear items de prueba
    const { data: itemsCreated, error: itemsError } = await supabaseClient
      .from('pedido_items')
      .insert([
        {
          pedido_id: pedidoId,
          producto_id: 1,
          nombre_producto: 'Jamón de prueba',
          cantidad: 2,
          precio_unitario: 12.50,
          subtotal: 25.00,
        }
      ])
      .select();

    if (itemsError) {
      console.error('❌ Error items:', itemsError);
      return new Response(JSON.stringify({ error: itemsError }), { status: 500 });
    }

    console.log('✅ Verificando que se guardó...');

    // Verificar que se creó
    const { data: verificar } = await supabaseClient
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single();

    console.log('📝 Pedido guardado:', verificar);
    console.log('🧪 ======= FIN =======\n');

    return new Response(JSON.stringify({
      success: true,
      pedidoId,
      mensaje: 'Pedido de prueba creado'
    }), { status: 200 });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error }), { status: 500 });
  }
};
