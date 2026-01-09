import type { APIRoute } from 'astro';

// Endpoint para guardar/actualizar productos en localStorage
// Este endpoint simplemente valida y confirma que el cliente
// ha guardado correctamente en localStorage
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, producto, id } = body;

    // Validar que lleguen los datos correctos
    if (!action || !['create', 'update', 'delete'].includes(action)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Acción no válida'
        }),
        { status: 400 }
      );
    }

    if ((action === 'create' || action === 'update') && !producto) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Producto requerido'
        }),
        { status: 400 }
      );
    }

    if ((action === 'delete') && !id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'ID requerido para eliminar'
        }),
        { status: 400 }
      );
    }

    // Todo está validado - el cliente se encargó del almacenamiento en localStorage
    return new Response(
      JSON.stringify({
        success: true,
        mensaje: action === 'create' 
          ? 'Producto creado correctamente'
          : action === 'update'
          ? 'Producto actualizado correctamente'
          : 'Producto eliminado correctamente',
        action,
        id: producto?.id || id
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error en guardar-producto:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error al procesar la solicitud: ' + (error instanceof Error ? error.message : 'desconocido')
      }),
      { status: 500 }
    );
  }
};
