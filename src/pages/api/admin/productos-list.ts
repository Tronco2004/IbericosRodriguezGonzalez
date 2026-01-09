import type { APIRoute } from 'astro';

// Datos por defecto como fallback
const productosDefault = [
  { 
    id: 1, 
    nombre: 'Jamón Ibérico Reserva', 
    precio: 9999, 
    stock: 15, 
    categoria: 'jamones', 
    estado: 'activo',
    descripcion: 'Jamón ibérico de bellota de la máxima calidad',
    imagen: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=500&h=500&fit=crop',
    rating: 4.9
  },
  { 
    id: 2, 
    nombre: 'Queso Manchego Premium', 
    precio: 2200, 
    stock: 30, 
    categoria: 'quesos', 
    estado: 'activo',
    descripcion: 'Queso Manchego artesanal añejado',
    imagen: 'https://images.unsplash.com/photo-1452195463300-e83e0a2a7a25?w=500&h=500&fit=crop',
    rating: 4.8
  },
  { 
    id: 3, 
    nombre: 'Chorizo de Bellota', 
    precio: 1800, 
    stock: 25, 
    categoria: 'embutidos', 
    estado: 'activo',
    descripcion: 'Chorizo ibérico de bellota premium',
    imagen: 'https://images.unsplash.com/photo-1557803104268-0ef0f060e15f?w=500&h=500&fit=crop',
    rating: 4.7
  }
];

export const GET: APIRoute = async ({ request }) => {
  try {
    // Los productos se almacenan y sincronizan a través de localStorage del cliente
    // Este endpoint simplemente devuelve los productos por defecto
    // Los productos creados por el usuario se mantienen en localStorage
    
    return new Response(
      JSON.stringify({
        success: true,
        productos: productosDefault,
        source: 'default',
        note: 'Los productos se guardan en localStorage del navegador'
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error en productos-list:', error);
    return new Response(
      JSON.stringify({
        success: true,
        productos: productosDefault,
        source: 'default'
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
