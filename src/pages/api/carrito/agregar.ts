import type { APIRoute } from 'astro';
import { obtenerUsuarioDelToken } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get('auth_token')?.value;

  if (!token) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Debes iniciar sesión para comprar',
        requireLogin: true
      }),
      { status: 401 }
    );
  }

  const usuario = obtenerUsuarioDelToken(token);

  if (!usuario) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Sesión inválida',
        requireLogin: true
      }),
      { status: 401 }
    );
  }

  const { productoId, cantidad } = await request.json();

  try {
    // Aquí iría la lógica para agregar al carrito a la BD
    // await db.query('INSERT INTO carrito_items ...');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Producto agregado al carrito',
        usuario_rol: usuario.rol
      }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Error al agregar al carrito' 
      }),
      { status: 500 }
    );
  }
};
