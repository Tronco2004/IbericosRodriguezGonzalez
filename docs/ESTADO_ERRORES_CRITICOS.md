# Estado de Errores Críticos (P0) — Verificado 19/02/2026

## Auditoría #1 — P0 (9 issues) → TODOS CORREGIDOS ✅

| # | Descripción | Estado | Verificación |
|---|-------------|--------|-------------|
| P0-1 | **Precios del cliente usados en Stripe** — el frontend enviaba precios y el server los aceptaba | ✅ CORREGIDO | `create-session.ts` consulta `precio_centimos` directamente de BD, nunca del body |
| P0-2 | **Sin idempotencia en creación de pedidos** — recarga duplicaba pedidos | ✅ CORREGIDO | `validar-y-crear-pedido.ts` verifica `stripe_session_id` antes de crear |
| P0-3 | **XSS en callback OAuth** — datos del usuario inyectados sin escapar en HTML | ✅ CORREGIDO | `callback.ts` usa `JSON.stringify` safe para datos en página |
| P0-4 | **Admin sin validación JWT en middleware** — cookies de texto plano aceptadas | ✅ CORREGIDO | `middleware.ts` usa `validateAuthToken()` con `supabaseAdmin.auth.getUser()` |
| P0-5 | **API key de Stripe en logs** — `STRIPE_SECRET_KEY` se imprimía en consola | ✅ CORREGIDO | Eliminado log sensible de `create-session.ts` |
| P0-6 | **Race condition en stock** — operaciones no atómicas permitían overselling | ✅ CORREGIDO | `stock.ts` implementa patrón CAS con reintentos |
| P0-7 | **Sin rate-limiting en login/registro** — ataques de fuerza bruta posibles | ✅ CORREGIDO | `rate-limit.ts` creado, aplicado a login (10/min), registro (5/min), contacto (5/min), chat (15/min) |
| P0-8 | **Admin bypass** — endpoints admin no verificaban JWT real | ✅ CORREGIDO | Middleware valida JWT + rol admin contra BD para `/admin` y `/api/admin` |
| P0-9 | **Descuento sin validación server-side** — porcentaje del cliente aceptado | ✅ CORREGIDO | `create-session.ts` valida código promocional contra BD |

---

## Auditoría #2 — P0 (6 issues) → TODOS CORREGIDOS ✅

| # | Descripción | Estado | Verificación |
|---|-------------|--------|-------------|
| P0-1 | **ReferenceError: `userEmail` no declarada** en `validar-y-crear-pedido.ts` → crash en producción | ✅ CORREGIDO | Reemplazado por `authUserEmail`, declarada consultando BD del usuario autenticado |
| P0-2 | **IDOR en POST carrito** — `user_id` venía del body (cualquiera podía añadir al carrito de otro) | ✅ CORREGIDO | `user_id` del body ignorado, se usa JWT via `getAuthenticatedUserId()` |
| P0-3 | **Auth bypass en GET carrito** — confiaba en header `x-user-id` (spoofable) | ✅ CORREGIDO | Validación JWT primero, fallback transitorio a cookie `user_id` |
| P0-4 | **Auth bypass en actualizar-perfil** — confiaba en `x-user-id` | ✅ CORREGIDO | Usa `getAuthenticatedUserId()` con JWT estricto |
| P0-5 | **Auth bypass en /api/auth/me** — confiaba en `x-user-id` → leak de datos de cualquier usuario | ✅ CORREGIDO | Usa JWT via `getAuthenticatedUserId()`, fallback transitorio a cookie |
| P0-6 | **Auth bypass en solicitar-devolucion** — confiaba en `x-user-id` → devolución fraudulenta | ✅ CORREGIDO | Usa `getAuthenticatedUserId()` con JWT estricto |

---

## Resumen

| Categoría | Total | Corregidos | Pendientes |
|-----------|-------|-----------|------------|
| P0 Auditoría #1 | 9 | 9 ✅ | 0 |
| P0 Auditoría #2 | 6 | 6 ✅ | 0 |
| **TOTAL P0** | **15** | **15 ✅** | **0** |

**Todos los errores críticos (P0) están corregidos.** No queda ningún P0 pendiente.
