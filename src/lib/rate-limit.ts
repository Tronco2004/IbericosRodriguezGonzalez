/**
 * Rate-limiter en memoria reutilizable por IP.
 * Cada instancia tiene su propio mapa y configuración.
 *
 * Uso:
 *   const limiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });
 *   if (!limiter.check(ip)) return new Response(..., { status: 429 });
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Máximo de peticiones permitidas en la ventana (default: 30) */
  maxRequests?: number;
  /** Ventana de tiempo en milisegundos (default: 60 000 = 1 min) */
  windowMs?: number;
  /** Intervalo de limpieza del mapa en ms (default: 300 000 = 5 min) */
  cleanupIntervalMs?: number;
}

interface RateLimiter {
  /** Devuelve true si la petición está dentro del límite */
  check(key: string): boolean;
}

export function createRateLimiter(opts: RateLimiterOptions = {}): RateLimiter {
  const maxRequests = opts.maxRequests ?? 30;
  const windowMs = opts.windowMs ?? 60_000;
  const cleanupIntervalMs = opts.cleanupIntervalMs ?? 300_000;

  const map = new Map<string, RateLimitEntry>();

  // Limpieza periódica para evitar memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of map) {
      if (now > entry.resetAt) map.delete(key);
    }
  }, cleanupIntervalMs);

  return {
    check(key: string): boolean {
      const now = Date.now();
      const entry = map.get(key);

      if (!entry || now > entry.resetAt) {
        map.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      if (entry.count >= maxRequests) {
        return false;
      }

      entry.count++;
      return true;
    }
  };
}

/**
 * Extrae la IP del cliente desde los headers del request.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Respuesta 429 estándar.
 */
export function rateLimitResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Demasiadas solicitudes, inténtalo más tarde', success: false }),
    { status: 429, headers: { 'Content-Type': 'application/json' } }
  );
}
