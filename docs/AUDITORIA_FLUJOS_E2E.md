# Auditoría End-to-End de Flujos — 19 de Febrero de 2026

## Resumen Ejecutivo

| Severidad | Cantidad |
|-----------|----------|
| **P0 (Crítico)** | 5 |
| **P1 (Alto)** | 7 |
| **P2 (Medio)** | 6 |
| **P3 (Bajo)** | 3 |
| **TOTAL** | **21** |

---

## 1. FLUJO DE AUTENTICACIÓN (Auth Flow)

### P0-1. Cookies `auth_token` y `user_id` con httpOnly/secure INCONSISTENTES entre endpoints

| Campo | Detalle |
|---|---|
| **Flujo** | Auth |
| **Archivos** | `src/pages/api/auth/login.ts` (L87-98), `src/pages/api/auth/register.ts` (L125-140), `src/pages/api/auth/callback.ts` (L151-168), `src/pages/api/auth/oauth-session.ts` (L140-172) |
| **Severidad** | **P0** |

**Descripción:** Las cookies de seguridad se configuran con flags completamente diferentes según el endpoint de login:

| Endpoint | `auth_token` httpOnly | `auth_token` secure | `user_id` httpOnly | `user_id` secure |
|---|---|---|---|---|
| `login.ts` | ✅ `true` | ✅ `true` | ✅ `true` | ✅ `true` |
| `callback.ts` | ✅ `true` | ✅ `true` | ✅ `true` | ✅ `true` |
| `register.ts` | ✅ `true` | ❌ `false` | ❌ `false` | ❌ `false` |
| `oauth-session.ts` | ❌ `false` | ❌ `false` | ❌ `false` | ❌ `false` |

**Impacto:** Un usuario que se registra o usa OAuth via `oauth-session.ts` tiene sus tokens expuestos a:
- **XSS**: `httpOnly: false` permite `document.cookie` leer el JWT real.
- **MITM**: `secure: false` permite que la cookie viaje por HTTP sin cifrar.

---

### P0-2. `actualizar-perfil.ts` usa `x-user-id` header — IDOR

| Campo | Detalle |
|---|---|
| **Flujo** | Auth |
| **Archivos** | `src/pages/api/auth/actualizar-perfil.ts` (L6) |
| **Severidad** | **P0** |

**Descripción:** El endpoint de actualización de perfil:
```typescript
const userId = request.headers.get('x-user-id');
```
No usa `requireAuth()` ni `getAuthenticatedUserId()`. Un atacante puede enviar cualquier UUID en el header `x-user-id` y modificar el nombre, teléfono y dirección de cualquier usuario.

**Líneas:** L6 obtiene el userId sin validación. L29-34 actualiza en BD sin verificar identidad.

---

### P0-3. `me.ts` acepta `x-user-id` header con prioridad sobre JWT

| Campo | Detalle |
|---|---|
| **Flujo** | Auth |
| **Archivos** | `src/pages/api/auth/me.ts` (L6-12) |
| **Severidad** | **P0** |

**Descripción:** El endpoint `/api/auth/me` obtiene el userId así:
```typescript
let userId = request.headers.get('x-user-id');  // PRIORIDAD 1 — spoofable
if (!userId) {
  userId = cookies.get('user_id')?.value;        // PRIORIDAD 2 — cookie
}
```
No valida JWT en ningún caso. Un atacante puede enviar `x-user-id: <UUID-de-admin>` y obtener toda la info del admin (email, teléfono, dirección, rol, provider).

---

### P1-1. `solicitar-devolucion.ts` usa `x-user-id` header — spoofable

| Campo | Detalle |
|---|---|
| **Flujo** | Auth / Orders |
| **Archivos** | `src/pages/api/pedidos/solicitar-devolucion.ts` (L7) |
| **Severidad** | **P1** |

**Descripción:** 
```typescript
const userId = request.headers.get('x-user-id');
```
Aunque verifica que el pedido pertenece al `userId` (por `usuario_id` o `email_cliente`), el `userId` en sí viene de un header spoofable. Un atacante que conozca el UUID de otro usuario puede solicitar devoluciones de sus pedidos. Hay mitigación parcial por la verificación de email, pero no es suficiente si el atacante conoce ambos datos.

---

### P1-2. Frontend almacena userId como `auth_token` en localStorage

| Campo | Detalle |
|---|---|
| **Flujo** | Auth |
| **Archivos** | `src/pages/login.astro` (L373), `src/pages/api/auth/callback.ts` (L222), `src/pages/auth/callback.astro` (L123), `src/layouts/Layout.astro` (L2370) |
| **Severidad** | **P1** |

**Descripción:** El frontend guarda `localStorage.setItem('auth_token', data.usuario.id)` — esto es el **UUID del usuario**, NO el JWT real. El JWT real está en la cookie httpOnly `auth_token`. Esta confusión de naming:
- Engaña a desarrolladores futuros que crean que `localStorage.auth_token` es un JWT.
- Filtra el UUID del usuario en localStorage (accesible a any XSS payload).
- En `callback.ts` L222-224, el HTML inyectado hace `localStorage.setItem('auth_token', d.id)` donde `d.id` es el UUID.

---

### P2-1. `codigos/verificar-uso.ts` y `codigos/registrar-uso.ts` usan `x-user-id` sin JWT

| Campo | Detalle |
|---|---|
| **Flujo** | Auth / Checkout |
| **Archivos** | `src/pages/api/codigos/verificar-uso.ts` (L6), `src/pages/api/codigos/registrar-uso.ts` (L6) |
| **Severidad** | **P2** |

**Descripción:** Ambos endpoints bajo `/api/codigos/` no están protegidos por middleware (solo `/api/admin/` lo está) y usan `x-user-id` header. Un atacante podría registrar usos de códigos promocionales para otro usuario, o verificar si otro usuario ya usó un código.

---

### P2-2. `admin/codigos-lista.ts` y `admin/codigos-crear.ts` hacen check redundante con `x-user-id`

| Campo | Detalle |
|---|---|
| **Flujo** | Admin |
| **Archivos** | `src/pages/api/admin/codigos-lista.ts` (L6-23), `src/pages/api/admin/codigos-crear.ts` (L6-23) |
| **Severidad** | **P2** |

**Descripción:** Estos endpoints están bajo `/api/admin/`, que el middleware ya protege con JWT+BD. Sin embargo, internamente vuelven a verificar admin via `x-user-id` header. Si el middleware falla o se bypasses, la verificación interna también es spoofable. Deberían usar `requireAdmin()` como los demás endpoints admin corregidos.

---

## 2. FLUJO DEL CARRITO (Cart Flow)

### P0-4. `POST /api/carrito` acepta `user_id` del body del request — IDOR total

| Campo | Detalle |
|---|---|
| **Flujo** | Cart |
| **Archivos** | `src/pages/api/carrito/index.ts` (L279-288) |
| **Severidad** | **P0** |

**Descripción:** El POST del carrito extrae `user_id` directamente del JSON body enviado por el cliente:
```typescript
const { producto_id, cantidad, user_id, producto_variante_id, peso_kg } = await request.json();
if (!user_id) { /* 401 */ }
```
No usa JWT, no usa `getAuthenticatedUserId()`. Un atacante puede enviar:
```json
{"user_id": "UUID-de-victima", "producto_id": 1, "cantidad": 100}
```
Y agregar 100 unidades al carrito de otro usuario, vaciando el stock del producto.

**Líneas clave:** L279 (extrae user_id del body), L284 (valida solo existencia), L304 (usa ese user_id para buscar carrito), L314 (crea carrito con ese user_id).

---

### P0-5. `GET /api/carrito` acepta `x-user-id` header como primera opción — permite leer carrito ajeno

| Campo | Detalle |
|---|---|
| **Flujo** | Cart |
| **Archivos** | `src/pages/api/carrito/index.ts` (L7-11) |
| **Severidad** | **P0** |

**Descripción:**
```typescript
let userId = request.headers.get('x-user-id');
if (!userId) {
  userId = cookies.get('user_id')?.value;
}
```
El header `x-user-id` tiene prioridad sobre la cookie. Un atacante puede poner cualquier UUID y ver/manipular el carrito de cualquier usuario. Además, como la cookie `user_id` es httpOnly en `login.ts`/`callback.ts` pero NO en `register.ts`/`oauth-session.ts`, el comportamiento depende de cómo se autenticó el usuario.

---

### P1-3. Frontend envía `x-user-id` from `localStorage` — funciona solo por la dualidad

| Campo | Detalle |
|---|---|
| **Flujo** | Cart |
| **Archivos** | `src/pages/carrito.astro` (L760, L772), `src/layouts/Layout.astro` (L2272), `src/pages/productos/[id].astro` (L1840), `src/pages/checkout/exito.astro` (L206) |
| **Severidad** | **P1** |

**Descripción:** Todas las páginas del frontend obtienen `userId` de `localStorage.getItem('user_id')` y lo envían como header `x-user-id`. Esto funciona porque:
1. El login guarda el userId en localStorage (L375 de login.astro).
2. Los APIs aceptan `x-user-id` como identificación.

Pero este flujo es fundamentalmente inseguro: cualquier script XSS puede leer `localStorage.user_id` y usarlo para hacer requests con el identity de la víctima. La cookie httpOnly debería ser la ÚNICA fuente de identidad.

---

### P2-3. Cookie `user_id` httpOnly en login pero se lee desde `cookies.get('user_id')` en GET carrito

| Campo | Detalle |
|---|---|
| **Flujo** | Cart |
| **Archivos** | `src/pages/api/carrito/index.ts` (L11) |
| **Severidad** | **P2** |

**Descripción:** El GET del carrito usa `cookies.get('user_id')?.value` como fallback. Esto funciona server-side (Astro puede leer cookies httpOnly). Pero la cookie NO se valida como JWT — simplemente se confía en su valor. Si un atacante forja la cookie `user_id` (que es un UUID en texto plano), puede acceder al carrito de otro usuario. Debería usar `getAuthenticatedUserId()` que valida el JWT real.

---

## 3. FLUJO DEL CHECKOUT

### P1-4. `exito.astro` crea pedidos client-side — riesgo de datos manipulados

| Campo | Detalle |
|---|---|
| **Flujo** | Checkout |
| **Archivos** | `src/pages/checkout/exito.astro` (L156-260) |
| **Severidad** | **P1** |

**Descripción:** La página de éxito ejecuta `crearPedidoDesdeStripe()` en el cliente, que:
1. Lee `userId` de `localStorage` (L157).
2. Obtiene items del carrito desde API o localStorage (L196-234).
3. Envía todo a `/api/checkout/validar-y-crear-pedido`.

**Mitigaciones existentes:**
- ✅ Idempotencia por `stripe_session_id` (no crea duplicados).
- ✅ Precios recalculados desde BD en el backend.
- ✅ Pago verificado contra Stripe API.

**Riesgos residuales:**
- ❌ `nombre_producto: item.nombre` viene del cliente. Un atacante podría enviar nombres ofensivos o engañosos que aparecerían en facturas.
- ❌ `peso_kg: item.peso_kg` viene del cliente. Podría mentir sobre el peso.
- ❌ Si el usuario cierra la página antes de que el JS ejecute, el pedido nunca se crea (no hay webhook de Stripe como backup).

---

### P1-5. Dos endpoints de creación de pedidos — lógica duplicada con diferencias

| Campo | Detalle |
|---|---|
| **Flujo** | Checkout |
| **Archivos** | `src/pages/api/pedidos/index.ts` POST (L114-375), `src/pages/api/checkout/validar-y-crear-pedido.ts` POST (L1-444) |
| **Severidad** | **P1** |

**Descripción:** Existen dos endpoints que crean pedidos:

| Aspecto | `pedidos/index.ts` POST | `validar-y-crear-pedido.ts` POST |
|---|---|---|
| Precios | ❌ Confiados del cliente (`item.precio`) | ✅ Recalculados desde BD |
| Auth | ✅ JWT via `getAuthenticatedUserId` | ✅ JWT via `getAuthenticatedUserId` |
| Idempotencia | ✅ Sí (stripe_session_id) | ✅ Sí (stripe_session_id) |
| Envío shipping | ❌ `request.headers.get('x-envio')` | ✅ Hardcoded 5€ |
| Items precio | ❌ `item.precio * item.cantidad` (centimos, del cliente) | ✅ Precios de BD |

El `POST /api/pedidos` es el endpoint antiguo que confía en precios del cliente. Si todavía se usa en algún flujo (Flutter?), permite manipulación de precios.

---

### P2-4. Falta webhook de Stripe — dependencia del JS del navegador

| Campo | Detalle |
|---|---|
| **Flujo** | Checkout |
| **Archivos** | `src/pages/checkout/exito.astro` |
| **Severidad** | **P2** |

**Descripción:** La creación del pedido depende de que el JavaScript de `exito.astro` se ejecute en el navegador del cliente. Si el usuario:
- Cierra el navegador después de pagar pero antes de que cargue la página.
- Tiene JavaScript deshabilitado.
- Experimenta un error de red al volver desde Stripe.

El pago se habrá cobrado en Stripe pero no se creará el pedido en la BD. No hay un webhook (`/api/stripe/webhook`) como backup server-side para crear pedidos garantizados.

---

### P3-1. Header `x-envio` spoofable en `POST /api/pedidos`

| Campo | Detalle |
|---|---|
| **Flujo** | Checkout |
| **Archivos** | `src/pages/api/pedidos/index.ts` (L250) |
| **Severidad** | **P3** |

**Descripción:**
```typescript
p_envio: request.headers.get('x-envio') ? parseFloat(request.headers.get('x-envio') || '500') : 500
```
El coste de envío viene de un header controlable por el cliente. Un atacante podría enviar `x-envio: 0` para no pagar envío. Mitigación: este endpoint no se usa desde `exito.astro` (que usa `validar-y-crear-pedido.ts`), pero podría usarse desde Flutter.

---

## 4. FLUJO DE PEDIDOS (Orders)

### P1-6. Cancelar pedido restaura variantes con datos parciales

| Campo | Detalle |
|---|---|
| **Flujo** | Orders |
| **Archivos** | `src/pages/api/pedidos/cancelar.ts` (L96-118) |
| **Severidad** | **P1** |

**Descripción:** Al cancelar un pedido, para productos con variante (peso variable), se **recrea** la variante eliminada:
```typescript
await supabaseAdmin.from('producto_variantes').insert({
  producto_id: item.producto_id,
  peso_kg: item.peso_kg,
  precio_total: precioTotalCentimos,
  disponible: true,
  cantidad_disponible: 1
});
```
Pero `item.peso_kg` puede ser `null` (L103 verifica `item.peso_kg` OR `item.producto_variante_id`), lo que crearía una variante sin peso. Además, `precioTotalCentimos` se calcula desde `item.precio_unitario * 100`, pero `precio_unitario` está en euros en `pedido_items`, lo que podría tener errores de redondeo.

**Además:** La variante recreada no tiene los mismos metadatos que la original (no tiene el ID original, no tiene información de subcategoría, etc.).

---

### P1-7. Variable no declarada `userEmail` en `validar-y-crear-pedido.ts`

| Campo | Detalle |
|---|---|
| **Flujo** | Checkout/Orders |
| **Archivos** | `src/pages/api/checkout/validar-y-crear-pedido.ts` (L82) |
| **Severidad** | **P1** |

**Descripción:** En la línea 82:
```typescript
} else if (userEmail) {
  customerEmail = userEmail;
}
```
La variable `userEmail` no está declarada en este scope. El destructuring de L18 solo extrae `{ sessionId, cartItems, codigoDescuento, datosInvitado }`. Esto causará un `ReferenceError` en runtime si se llega a esa rama (cuando `session.customer_email` es null y no hay `datosInvitado`). En la práctica, `session.customer_email` siempre se establece en `create-session.ts`, por lo que esta rama rara vez se alcanza.

---

### P2-5. `GET /api/pedidos` acepta `x-user-email` header sin validación

| Campo | Detalle |
|---|---|
| **Flujo** | Orders |
| **Archivos** | `src/pages/api/pedidos/index.ts` (L16) |
| **Severidad** | **P2** |

**Descripción:**
```typescript
const userEmail = request.headers.get('x-user-email');
```
Si se envía un `x-user-email` con el email de otra persona, y el JWT no proporciona userId (o el userId no tiene email en BD), podría devolver pedidos de otro usuario. Mitigación parcial: primero se obtiene el email desde BD si hay userId. Pero si el userId no existe en BD (L28-33), se usa `emailBusqueda = userEmail` directamente del header.

---

### P2-6. Inconsistencia deliberada en devolución de stock (cancelar vs. devolver)

| Campo | Detalle |
|---|---|
| **Flujo** | Orders |
| **Archivos** | `src/pages/api/pedidos/cancelar.ts` (L83-130), `src/pages/api/pedidos/validar-devolucion.ts` (L59-60) |
| **Severidad** | **P2** |

**Descripción:** El flujo es inconsistente por diseño, pero podría confundir:
- **Cancelar** (`cancelar.ts`): Restaura stock de productos simples y recrea variantes.
- **Validar devolución** (`validar-devolucion.ts`): NO restaura stock en absoluto (comentario L59: "El stock NO se restaura — el producto devuelto puede no estar en condiciones de venta").

Esto es correcto como decisión de negocio, pero:
1. No hay documentación visible para el admin sobre que debe reponer stock manualmente tras validar una devolución.
2. Si el admin olvida, el stock queda permanentemente reducido.

---

### P3-2. `numero_pedido` generado con `Math.random()` — posible colisión

| Campo | Detalle |
|---|---|
| **Flujo** | Orders |
| **Archivos** | `src/pages/api/checkout/validar-y-crear-pedido.ts` (L222-223), `src/pages/api/pedidos/index.ts` (L238-239) |
| **Severidad** | **P3** |

**Descripción:** El número de pedido se genera así:
```typescript
const random = Math.floor(Math.random() * 10000);
const numero_pedido = `PED-${timestamp}-${random}`;
```
Con `Math.random()` y rango de 0-9999, hay posibilidad de colisión si dos pedidos se crean en el mismo milisegundo. En `pedidos/index.ts` L240 el random ni siquiera se padea con ceros (`padStart`), mientras que en `validar-y-crear-pedido.ts` sí (`padStart(4, '0')`). Otro detalle de inconsistencia.

---

## 5. FLUJO ADMIN

### P2-7. `dashboard-stats.ts` y `productos.ts` sin auth interna — dependen 100% del middleware

| Campo | Detalle |
|---|---|
| **Flujo** | Admin |
| **Archivos** | `src/pages/api/admin/dashboard-stats.ts`, `src/pages/api/admin/productos.ts` |
| **Severidad** | **P2 (defensa en profundidad)** |

**Descripción:** Estos endpoints no tienen ninguna verificación de autenticación propia. Dependen completamente del middleware para `/api/admin/*`. Si un futuro refactoring mueve estos endpoints fuera de `/api/admin/`, quedan completamente abiertos. Los endpoints corregidos (`cancelar.ts`, `validar-devolucion.ts`, `denegar-devolucion.ts`) sí usan `requireAdmin()` internamente como defensa en profundidad.

---

### P3-3. Logs excesivos con datos de sesión en producción

| Campo | Detalle |
|---|---|
| **Flujo** | Todos |
| **Archivos** | `src/pages/api/auth/login.ts` (L52-64, L120-125), `src/pages/api/auth/callback.ts` (L62-63, L174-179), `src/pages/api/carrito/index.ts` (múltiples) |
| **Severidad** | **P3** |

**Descripción:** Múltiples endpoints loguean información sensible como:
- `login.ts` L120: `console.log('🍪 Cookies establecidas:', { user_id, user_name, user_role })` — filtra IDs y roles.
- `callback.ts` L175: Mismo patrón.
- Estos logs aparecerán en logs de producción y podrían ser exfiltrados.

---

## Mapa visual de problemas por endpoint

```
┌─────────────────────────────────┬─────────────────────────────────────┐
│ ENDPOINT                        │ PROBLEMA                            │
├─────────────────────────────────┼─────────────────────────────────────┤
│ POST /api/auth/register         │ P0-1: cookies secure:false          │
│ POST /api/auth/oauth-session    │ P0-1: auth_token httpOnly:false     │
│ POST /api/auth/actualizar-perfil│ P0-2: x-user-id sin JWT            │
│ GET  /api/auth/me               │ P0-3: x-user-id prioritario        │
│ POST /api/carrito (body)        │ P0-4: user_id del body              │
│ GET  /api/carrito               │ P0-5: x-user-id prioritario        │
│ POST /api/pedidos/solicitar-dev │ P1-1: x-user-id sin JWT            │
│ Frontend login/callback         │ P1-2: UUID como "auth_token"        │
│ Frontend carrito/productos      │ P1-3: x-user-id desde localStorage │
│ checkout/exito.astro            │ P1-4: creación client-side          │
│ POST /api/pedidos               │ P1-5: precios del cliente           │
│ POST /api/pedidos/cancelar      │ P1-6: variantes con datos parciales │
│ POST validar-y-crear-pedido     │ P1-7: userEmail no declarada        │
│ GET/POST /api/codigos/*         │ P2-1: x-user-id sin JWT            │
│ admin/codigos-lista/crear       │ P2-2: x-user-id redundante          │
│ GET /api/carrito (cookie)       │ P2-3: cookie UUID sin JWT           │
│ checkout sin webhook            │ P2-4: sin backup server-side        │
│ GET /api/pedidos (email header) │ P2-5: x-user-email spoofable       │
│ cancelar vs devolver            │ P2-6: stock inconsistente           │
│ dashboard-stats, productos      │ P2-7: sin auth interna              │
│ numero_pedido                   │ P3-1: colisión posible              │
│ x-envio header                  │ P3-2: envío spoofable               │
│ logs en producción              │ P3-3: datos sensibles logueados     │
└─────────────────────────────────┴─────────────────────────────────────┘
```

## Plan de corrección por prioridad

### P0 — Corregir inmediatamente
1. **Normalizar cookies** en `register.ts` y `oauth-session.ts`: `httpOnly: true, secure: true` para `auth_token` y `user_id`.
2. **`actualizar-perfil.ts`**: Reemplazar `request.headers.get('x-user-id')` por `requireAuth(request, cookies)`.
3. **`me.ts`**: Reemplazar `x-user-id` fallback por `getAuthenticatedUserId(request, cookies)`.
4. **`carrito/index.ts` POST**: Reemplazar `user_id` del body por `getAuthenticatedUserId(request, cookies)`.
5. **`carrito/index.ts` GET**: Reemplazar `x-user-id` header por `getAuthenticatedUserId(request, cookies)`.

### P1 — Corregir esta semana
6. **`solicitar-devolucion.ts`**: Migrar a `requireAuth()`.
7. **Frontend**: Renombrar `localStorage.auth_token` a `localStorage.user_uuid` o eliminar.
8. **Frontend**: Eliminar header `x-user-id` de todos los `fetch()` calls, usar `credentials: 'include'` solamente.
9. **Revisar** `cancelar.ts` recreación de variantes para edge cases con `peso_kg: null`.
10. **`validar-y-crear-pedido.ts`**: Eliminar referencia a `userEmail` no declarada (L82).
11. **Evaluar** eliminar `POST /api/pedidos` o migrar a precios desde BD.

### P2 — Planificar para próxima iteración
12-17. Corregir endpoints de códigos, agregar auth interna a admin endpoints, considerar webhook Stripe.

### P3 — Deuda técnica
18-21. Limpiar logs, usar UUID v4 para pedidos, normalizar `padStart`.
