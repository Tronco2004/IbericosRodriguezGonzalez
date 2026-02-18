import type { APIRoute } from 'astro';

// DEPRECATED: La lógica real de agregar al carrito está en /api/carrito/index.ts (POST)
export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({ 
      success: false, 
      message: 'Endpoint deprecado. Usar /api/carrito con método POST.',
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
};
