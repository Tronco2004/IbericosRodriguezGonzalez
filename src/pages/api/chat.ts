import type { APIRoute } from 'astro';
import { supabaseClient } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Obtener API key en runtime - Astro usa import.meta.env
    const GROQ_API_KEY = import.meta.env.GROQ_API_KEY;
    
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuración del servidor incompleta' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.error('Error parseando JSON:', e);
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Mensaje requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener productos de la base de datos para dar contexto al chatbot
    const { data: productos } = await supabaseClient
      .from('productos')
      .select(`
        id,
        nombre,
        descripcion,
        precio,
        stock,
        es_variable,
        categorias(nombre)
      `)
      .eq('activo', true)
      .limit(50);

    // Obtener categorías
    const { data: categorias } = await supabaseClient
      .from('categorias')
      .select('id, nombre, descripcion')
      .eq('activa', true);

    // Obtener ofertas activas
    const { data: ofertas } = await supabaseClient
      .from('ofertas')
      .select(`
        porcentaje_descuento,
        productos(nombre)
      `)
      .eq('activa', true)
      .lte('fecha_inicio', new Date().toISOString())
      .gte('fecha_fin', new Date().toISOString())
      .limit(10);

    // Construir contexto de productos
    const productosInfo = productos?.map(p => {
      // @ts-ignore - Supabase join returns object
      const categoria = p.categorias?.nombre || 'Sin categoría';
      return `- ${p.nombre} (${categoria}): ${p.precio}€ - ${p.descripcion || 'Sin descripción'}`;
    }).join('\n') || 'No hay productos disponibles';

    const categoriasInfo = categorias?.map(c => `- ${c.nombre}: ${c.descripcion || ''}`).join('\n') || '';

    const ofertasInfo = ofertas?.map(o => {
      // @ts-ignore - Supabase join returns object
      return `- ${o.productos?.nombre || 'Producto'}: ${o.porcentaje_descuento}% de descuento`;
    }).join('\n') || 'No hay ofertas activas actualmente';

    // System prompt con contexto del negocio
    const systemPrompt = `Eres el asistente virtual de "Ibéricos RG", una tienda online de productos ibéricos premium de alta calidad.

TU PERSONALIDAD:
- Eres amable, profesional y conocedor de productos ibéricos
- Respondes de forma concisa pero informativa (máximo 2-3 párrafos)
- Usas un tono cercano pero respetuoso
- Si no sabes algo, lo admites honestamente

INFORMACIÓN DE LA TIENDA:
- Nombre: Ibéricos Rodríguez González (Ibéricos RG)
- Especialidad: Jamones ibéricos, embutidos, quesos y productos gourmet
- Envío: A toda España en 2-3 días laborales
- Garantía: Satisfacción garantizada o devolución

CATEGORÍAS DISPONIBLES:
${categoriasInfo}

PRODUCTOS EN CATÁLOGO:
${productosInfo}

OFERTAS ACTUALES:
${ofertasInfo}

INSTRUCCIONES:
1. Si preguntan por un producto específico, busca en la lista y da información precisa
2. Si preguntan por precios, menciona el precio exacto
3. Si preguntan por recomendaciones, sugiere productos relevantes de la lista
4. Si preguntan algo que no sabes, sugiere contactar por email o teléfono
5. No inventes productos que no estén en la lista
6. Puedes sugerir que visiten la página de productos (/productos) o categorías específicas
7. Si preguntan por disponibilidad, menciona que pueden ver el stock en la web

RESPONDE SIEMPRE EN ESPAÑOL.`;

    // Preparar mensajes para Groq
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6), // Últimos 6 mensajes para contexto
      { role: 'user', content: message }
    ];

    // Llamar a Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
      })
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.text();
      console.error('Error de Groq:', errorData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error al procesar tu mensaje. Por favor, inténtalo de nuevo.' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const groqData = await groqResponse.json();
    const assistantMessage = groqData.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: assistantMessage,
        usage: groqData.usage
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en chat API:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Error interno del servidor' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
