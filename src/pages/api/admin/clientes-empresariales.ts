import { supabaseClient } from '../../../lib/supabase';

export async function POST(context: any) {
  try {
    const body = await context.request.json();
    const { 
      nombre_empresa, 
      numero_identificacion, 
      tipo_identificacion,
      direccion_fiscal,
      nombre_representante,
      email_contacto,
      telefono_contacto,
      tipo_cliente,
      notas
    } = body;

    console.log('Insertando cliente empresarial:', { nombre_empresa, numero_identificacion, tipo_cliente });

    const { data, error } = await supabaseClient
      .from('clientes_empresariales')
      .insert([
        {
          nombre_empresa,
          numero_identificacion,
          tipo_identificacion: tipo_identificacion || 'OTRO',
          direccion_fiscal,
          nombre_representante,
          email_contacto,
          telefono_contacto: telefono_contacto || '',
          tipo_cliente,
          estado: true,
          notas: notas || '',
          fecha_registro: new Date().toISOString(),
          fecha_actualizacion: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Error insertando cliente:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message, details: error }),
        { status: 400 }
      );
    }

    console.log('Cliente insertado:', data);
    return new Response(
      JSON.stringify({ success: true, cliente: data?.[0] }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.toString() }),
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseClient
      .from('clientes_empresariales')
      .select('*')
      .order('fecha_registro', { ascending: false });

    if (error) {
      console.error('Error obteniendo clientes:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, clientes: data || [] }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.toString() }),
      { status: 500 }
    );
  }
}

export async function PUT(context: any) {
  try {
    const body = await context.request.json();
    const { 
      id,
      nombre_empresa, 
      numero_identificacion, 
      tipo_identificacion,
      direccion_fiscal,
      nombre_representante,
      email_contacto,
      telefono_contacto,
      tipo_cliente,
      estado,
      notas
    } = body;

    const { data, error } = await supabaseClient
      .from('clientes_empresariales')
      .update({ 
        nombre_empresa, 
        numero_identificacion,
        tipo_identificacion: tipo_identificacion || 'OTRO',
        direccion_fiscal,
        nombre_representante,
        email_contacto,
        telefono_contacto: telefono_contacto || '',
        tipo_cliente,
        estado: estado !== undefined ? estado : true,
        notas: notas || '',
        fecha_actualizacion: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error actualizando cliente:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, cliente: data?.[0] }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.toString() }),
      { status: 500 }
    );
  }
}

export async function DELETE(context: any) {
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');

    const { error } = await supabaseClient
      .from('clientes_empresariales')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando cliente:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.toString() }),
      { status: 500 }
    );
  }
}
