# Fixes de Seguridad P0 y P1 — Resumen Completo

## Fecha: Junio 2025

Se han corregido **17 vulnerabilidades** (9 P0 críticas + 8 P1 altas) identificadas en la auditoría de seguridad del proyecto.

---

## Archivo nuevo creado

### `src/lib/auth-helpers.ts`
Módulo centralizado de autenticación server-side:
- **`getAuthenticatedUserId(request, cookies)`** — Valida JWT real de Supabase Auth (cookie `auth_token` o header `Authorization: Bearer`). Nunca confía en `x-user-id`.
- **`requireAuth(request, cookies)`** — Wrapper que devuelve `{ userId }` o `Response 401`.
- **`requireAdmin(request, cookies)`** — Requiere JWT válido + rol admin verificado contra BD.
- **`escapeHtml(str)`** — Escapa `& < > " '` para prevenir XSS/HTML injection.

---

## Fixes P0 (Críticos)

### P0-1: Precios de checkout desde BD
**Archivo:** `src/pages/api/checkout/create-session.ts`  
**Problema:** Los precios venían del frontend (`item.precio`) y se enviaban directamente a Stripe.  
**Fix:** Se consultan `productos.precio_centimos`, `producto_variantes.precio_total` y `ofertas.precio_descuento_centimos` desde la BD. Los precios del cliente se ignoran completamente.

### P0-2: Idempotencia de pedidos
**Archivo:** `src/pages/api/checkout/validar-y-crear-pedido.ts`  
**Problema:** Llamar al endpoint dos veces con el mismo `sessionId` creaba pedidos duplicados.  
**Fix:** Se verifica `SELECT FROM pedidos WHERE stripe_session_id = X` al inicio. Si ya existe, se devuelve el pedido existente con `200 OK`.

### P0-3: Autenticación JWT en endpoints
**Archivos:** Todos los endpoints que usaban `x-user-id`  
**Problema:** `request.headers.get('x-user-id')` es spoofable — cualquiera puede poner cualquier UUID.  
**Fix:** Se usa `getAuthenticatedUserId()` / `requireAuth()` que valida JWT con `supabaseAdmin.auth.getUser(token)`.

### P0-4: Account takeover en establecer-contrasena
**Archivo:** `src/pages/api/auth/establecer-contrasena.ts`  
**Problema:** Usaba `x-user-id` + `supabaseAdmin.auth.admin.updateUserById()` → cualquiera podía cambiar la contraseña de otro usuario.  
**Fix:** Usa `requireAuth()` para obtener el userId desde JWT validado.

### P0-5: Admin bypass en devoluciones
**Archivos:** `src/pages/api/pedidos/validar-devolucion.ts`, `denegar-devolucion.ts`  
**Problema:** Confiaban en `x-user-role: admin` header, que cualquier cliente puede enviar.  
**Fix:** Usan `requireAdmin()` que valida JWT + verifica rol admin contra BD.

### P0-6: Descuento validado server-side
**Archivo:** `src/pages/api/checkout/create-session.ts`  
**Problema:** El frontend enviaba `descuentoAplicado` (monto en euros) y se usaba directamente.  
**Fix:** Solo se acepta `codigoDescuento` (string). Se valida contra tabla `codigos_promocionales`: fechas, usos, tipo (porcentaje/fijo), monto mínimo. El descuento se calcula server-side.

### P0-7: XSS en callback OAuth
**Archivo:** `src/pages/api/auth/callback.ts`  
**Problema:** Datos del usuario (nombre, email) se inyectaban con interpolación directa en `<script>`, permitiendo XSS.  
**Fix:** Se usa `JSON.stringify()` para serializar datos de forma segura. El error en el catch también se sanitiza (no muestra `error.message` al usuario).

### P0-8: Rate-limit y protección en reservar.ts
**Archivo:** `src/pages/api/carrito/reservar.ts`  
**Problema:** Endpoint completamente abierto — sin autenticación ni límite. Permitía ataques de drenaje de stock.  
**Fix:** Rate-limiting por IP (30 req/min) con mapa en memoria y limpieza periódica. Se añade logging de requests sin identificación.

---

## Fixes P1 (Altos)

### P1-1: IDOR en carrito/[id].ts
**Archivo:** `src/pages/api/carrito/[id].ts`  
**Problema:** PUT y DELETE no verificaban que el item del carrito perteneciera al usuario autenticado.  
**Fix:** Se creó `verificarPropietarioItem()` que hace JOIN `carrito_items → carritos` y compara `usuario_id`. Auth via JWT.

### P1-2: CAS en carrito/[id].ts y vaciar.ts
**Archivos:** `src/pages/api/carrito/[id].ts`, `vaciar.ts`  
**Problema:** Usaban read-then-write para stock (race condition).  
**Fix:** Reemplazado con funciones CAS de `stock.ts`: `incrementarStockProducto()`, `decrementarStockProducto()`, `incrementarStockVariante()`, `decrementarStockVariante()`.

### P1-3: CAS en cancelar y validar-devolucion
**Archivos:** `src/pages/api/pedidos/cancelar.ts`, `validar-devolucion.ts`  
**Problema:** Restauración de stock con read-then-write.  
**Fix:** Productos simples usan `incrementarStockProducto()` con CAS. Variantes de peso siguen usando INSERT (recrear variante), que es seguro porque crea un nuevo registro.

### P1-4: Middleware valida JWT real
**Archivo:** `src/middleware.ts`  
**Problema:** Aceptaba `x-user-id` header sin validar, y usaba cookies de texto plano para verificar identidad.  
**Fix:** Función `validateAuthToken()` que valida JWT con `supabaseAdmin.auth.getUser()`. Se eliminó toda dependencia de `x-user-id` y cookies `user_role`/`user_id` para decisiones de seguridad.

### P1-5: Cookies httpOnly + secure
**Archivos:** `src/pages/api/auth/login.ts`, `callback.ts`  
**Problema:** `auth_token` y `user_id` tenían `httpOnly: false` y `secure: false`, exponiendo credenciales a XSS y MITM.  
**Fix:** `auth_token` y `user_id` → `httpOnly: true, secure: true`. `user_role` y `user_name` siguen accesibles al frontend (necesarios para UI).

### P1-6: Eliminada heurística de precio
**Archivo:** `src/pages/api/checkout/create-session.ts`  
**Problema:** `if (precioEnCentimos > 100000) precioEnCentimos = Math.round(precioEnCentimos / 100)` — heurística peligrosa que podía alterar precios legítimos.  
**Fix:** Eliminada completamente. Los precios vienen de BD y son fiables.

### P1-7: HTML injection en contacto
**Archivo:** `src/pages/api/contacto.ts`  
**Problema:** `email`, `asunto` y `mensaje` se interpolaban sin escapar en el HTML del email.  
**Fix:** Se usa `escapeHtml()` de `auth-helpers.ts` antes de interpolar.

### P1-8: Verificar Stripe session en pedidos POST
**Archivo:** `src/pages/api/pedidos/index.ts`  
**Problema:** `stripe_session_id` no se verificaba contra la API de Stripe. Se podía enviar cualquier string.  
**Fix:** Se llama a `stripe.checkout.sessions.retrieve(stripe_session_id)` y se verifica `payment_status === 'paid'`. También se añadió idempotencia (check pedido existente).

### P1-9: Session confusion en cambiar-contrasena
**Archivo:** `src/pages/api/auth/cambiar-contrasena.ts`  
**Problema:** `supabaseClient.auth.signInWithPassword()` en el singleton global contaminaba la sesión de todos los requests concurrentes.  
**Fix:** Se crea un cliente Supabase temporal (`createClient` con `persistSession: false`) para verificar la contraseña actual. El cambio se hace con `supabaseAdmin.auth.admin.updateUserById()`. Auth via JWT.

---

## Archivos modificados (resumen)

| Archivo | Fixes aplicados |
|---------|----------------|
| `src/lib/auth-helpers.ts` | **NUEVO** — P0-3 |
| `src/pages/api/checkout/create-session.ts` | P0-1, P0-6, P1-6 |
| `src/pages/api/checkout/validar-y-crear-pedido.ts` | P0-1, P0-2, P0-3 |
| `src/middleware.ts` | P1-4 |
| `src/pages/api/auth/login.ts` | P1-5 |
| `src/pages/api/auth/callback.ts` | P0-7, P1-5 |
| `src/pages/api/auth/establecer-contrasena.ts` | P0-4 |
| `src/pages/api/auth/cambiar-contrasena.ts` | P1-9, P0-3 |
| `src/pages/api/pedidos/validar-devolucion.ts` | P0-5, P1-3 |
| `src/pages/api/pedidos/denegar-devolucion.ts` | P0-5 |
| `src/pages/api/pedidos/cancelar.ts` | P0-3, P1-3 |
| `src/pages/api/carrito/[id].ts` | P1-1, P1-2, P0-3 |
| `src/pages/api/carrito/vaciar.ts` | P1-2, P0-3 |
| `src/pages/api/carrito/reservar.ts` | P0-8 |
| `src/pages/api/contacto.ts` | P1-7 |
| `src/pages/api/pedidos/index.ts` | P1-8, P0-3 |

## Notas importantes

- **La BD no se ha tocado.** Todos los fixes son en código server-side.
- **Compatibilidad Flutter:** Se mantiene soporte para `Authorization: Bearer <token>` en los auth helpers.
- **Invitados:** Los endpoints de carrito/reservar y checkout siguen funcionando para invitados (sin JWT), pero con rate-limiting y precios/descuentos siempre desde BD.
