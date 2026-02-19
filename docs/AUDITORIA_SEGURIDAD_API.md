# Auditoría de Seguridad y Lógica — API Endpoints

**Fecha:** 19 de febrero de 2026  
**Alcance:** Todos los archivos `.ts` en `src/pages/api/` (66 archivos)  
**Auditor:** GitHub Copilot

---

## Resumen Ejecutivo

| Severidad | Cantidad |
|-----------|----------|
| **P0 — Crítico** | 14 |
| **P1 — Alto** | 7 |
| **P2 — Medio** | 5 |
| **P3 — Bajo** | 4 |
| **Total** | **30** |

El hallazgo más grave y recurrente es que **la gran mayoría de endpoints en `/api/admin/` no tienen ninguna verificación de autenticación ni de rol admin**. Cualquier usuario anónimo puede leer, crear, modificar y eliminar productos, pedidos, usuarios, categorías, ofertas y datos financieros. Además, varios endpoints fuera de admin siguen confiando en el header `x-user-id` spoofable en lugar de usar la autenticación JWT de `auth-helpers.ts`.

---

## P0 — CRÍTICO

### P0-01: GET `/api/carrito/index.ts` — Auth via `x-user-id` header spoofable

**Archivo:** `src/pages/api/carrito/index.ts` (líneas 8–12)  
**Tipo:** Autenticación rota  

```typescript
let userId = request.headers.get('x-user-id');
if (!userId) {
  userId = cookies.get('user_id')?.value;
}
```

**Impacto:** Cualquier atacante puede enviar `x-user-id: <ID_victima>` para acceder al carrito de otro usuario, ver sus productos, precios y modificar su carrito. También puede provocar que se vacíe el carrito de la víctima mediante el mecanismo de expiración.

---

### P0-02: POST `/api/carrito/index.ts` — Auth via `user_id` del body

**Archivo:** `src/pages/api/carrito/index.ts` (líneas 263–270)  
**Tipo:** Autenticación rota  

```typescript
const { producto_id, cantidad, user_id, producto_variante_id, peso_kg } = await request.json();
// ...
if (!user_id) { return 401 }
// Luego usa user_id directamente para crear/acceder carrito
```

**Impacto:** El `user_id` viene del cuerpo de la request (controlado por el cliente). Un atacante puede especificar cualquier `user_id` para agregar productos al carrito de otro usuario o crear carritos a nombre de otros.

---

### P0-03: GET `/api/auth/me.ts` — Auth via `x-user-id` header spoofable

**Archivo:** `src/pages/api/auth/me.ts` (líneas 7–11)  
**Tipo:** Fuga de datos + Autenticación rota  

```typescript
let userId = request.headers.get('x-user-id');
if (!userId) {
  userId = cookies.get('user_id')?.value;
}
```

**Impacto:** Devuelve email, teléfono, dirección y rol del usuario especificado. Un atacante puede enumerar todos los datos personales de todos los usuarios iterando IDs.

---

### P0-04: POST `/api/auth/actualizar-perfil.ts` — Auth via `x-user-id` header

**Archivo:** `src/pages/api/auth/actualizar-perfil.ts` (línea 6)  
**Tipo:** Autenticación rota  

```typescript
const userId = request.headers.get('x-user-id');
```

**Impacto:** Permite modificar nombre, teléfono y dirección de cualquier usuario mediante un header spoofado.

---

### P0-05: POST `/api/pedidos/solicitar-devolucion.ts` — Auth via `x-user-id` header

**Archivo:** `src/pages/api/pedidos/solicitar-devolucion.ts` (línea 7)  
**Tipo:** Autenticación rota  

```typescript
const userId = request.headers.get('x-user-id');
```

**Impacto:** Un atacante puede solicitar devoluciones de pedidos ajenos. Aunque verifica propiedad después, la verificación usa el userId del header spoofado para buscar el email del usuario — por tanto, si envía el userId del propietario real, aprobará la verificación.

---

### P0-06: GET `/api/pedidos/index.ts` — IDOR total via `x-user-email` header

**Archivo:** `src/pages/api/pedidos/index.ts` (líneas 18, 27–28, 51–57)  
**Tipo:** IDOR (Insecure Direct Object Reference)  

```typescript
const userEmail = request.headers.get('x-user-email');
// ...
let emailBusqueda = userEmail; // Usa el header directamente
// Solo busca en BD si emailBusqueda es null
```

**Impacto:** Incluso un usuario **no autenticado** puede ver todos los pedidos de cualquier persona enviando `x-user-email: victima@email.com`. Devuelve datos completos: nombre, email, teléfono, dirección, items, precios.

---

### P0-07: 14 endpoints admin sin autenticación alguna

**Archivos afectados:**

| Archivo | Métodos expuestos |
|---------|-------------------|
| `src/pages/api/admin/pedidos.ts` | GET — Todos los pedidos con PII completa |
| `src/pages/api/admin/productos.ts` | GET, POST — CRUD productos |
| `src/pages/api/admin/usuarios.ts` | GET, PUT, DELETE — CRUD usuarios incl. cambiar roles |
| `src/pages/api/admin/categorias.ts` | GET, POST, PUT, DELETE — CRUD categorías |
| `src/pages/api/admin/ofertas.ts` | GET, POST — CRUD ofertas |
| `src/pages/api/admin/ofertas/[id].ts` | PUT, DELETE — Modificar/eliminar ofertas |
| `src/pages/api/admin/dashboard-stats.ts` | GET — Métricas financieras |
| `src/pages/api/admin/seguimiento.ts` | GET, PUT — Ver/modificar seguimiento pedidos |
| `src/pages/api/admin/pedidos/actualizar-estado.ts` | PUT — Cambiar estado de cualquier pedido |
| `src/pages/api/admin/clientes-empresariales.ts` | GET, POST, PUT, DELETE — CRUD clientes B2B |
| `src/pages/api/admin/ingresos-diarios.ts` | GET — Ingresos diarios detallados |
| `src/pages/api/admin/ingresos-usuarios.ts` | GET — Ingresos por usuario |
| `src/pages/api/admin/debug-ingresos.ts` | GET — Debug con datos de pedidos |
| `src/pages/api/admin/variantes.ts` | GET, POST, DELETE, PUT — CRUD variantes |
| `src/pages/api/admin/upload.ts` | POST — Upload imágenes a Cloudinary |
| `src/pages/api/admin/setup.ts` | POST — Inicialización de datos |
| `src/pages/api/admin/init-data.ts` | POST — Setup inicial |
| `src/pages/api/admin/setup-variantes-stock.ts` | POST — Ejecutar DDL SQL |
| `src/pages/api/admin/productos-list.ts` | GET — Lista productos |

**Tipo:** Bypass total de autenticación y autorización  

**Impacto:** Cualquier persona puede:
- Leer TODOS los pedidos con datos personales de clientes
- Cambiar roles de usuarios (hacerse admin)
- Eliminar usuarios, productos, categorías
- Cambiar estados de pedidos a "cancelado" o "entregado"
- Ver ingresos financieros detallados
- Subir archivos a Cloudinary
- Ejecutar scripts de setup/DDL

---

### P0-08: Admin auth via cookie `user_role` (client-settable) en eliminar/actualizar-estado usuarios

**Archivos:**
- `src/pages/api/admin/usuarios/eliminar.ts` (línea 6)
- `src/pages/api/admin/usuarios/actualizar-estado.ts` (línea 6)

```typescript
const userRole = cookies.get('user_role')?.value;
if (userRole !== 'admin') { return 403 }
```

**Impacto:** La cookie `user_role` se establece como `httpOnly: false` en login/register. Un atacante puede establecer `document.cookie = "user_role=admin"` o enviarla directamente en el header para:
- Eliminar cualquier usuario de la BD
- Activar/desactivar cualquier cuenta

---

### P0-09: Admin auth via `x-user-id` spoofable en codigos-crear y codigos-lista

**Archivos:**
- `src/pages/api/admin/codigos-crear.ts` (líneas 7–17)
- `src/pages/api/admin/codigos-lista.ts` (líneas 7–17)

```typescript
const userId = request.headers.get('x-user-id');
// Luego busca en BD si ese user es admin
```

**Impacto:** Un atacante que conozca el ID de un admin puede suplantar su identidad para crear códigos promocionales ilimitados o ver la lista completa de códigos.

---

### P0-10: Debug endpoints sin auth expuestos en producción

**Archivos:**
- `src/pages/api/debug-variantes.ts`
- `src/pages/api/debug-queso.ts`
- `src/pages/api/debug-categorias.ts`
- `src/pages/api/debug/crear-pedido-prueba.ts`
- `src/pages/api/admin/debug-ingresos.ts`

**Tipo:** Endpoints de debug en producción  

**Impacto:**
- `debug-variantes.ts`: Expone TODAS las variantes de productos con precios, IDs y disponibilidad
- `debug-queso.ts`: Expone variantes de producto específico
- `debug-categorias.ts`: Expone todos los productos y categorías
- `crear-pedido-prueba.ts`: **Cualquier persona puede crear pedidos falsos en la BD** sin pago real (sin auth, sin validación Stripe)
- `debug-ingresos.ts`: Expone datos financieros detallados

---

### P0-11: DELETE `/api/carrito/reservar.ts` — Inflación de stock sin verificación

**Archivo:** `src/pages/api/carrito/reservar.ts` (líneas 116–207)  
**Tipo:** Lógica de negocio rota  

```typescript
export const DELETE: APIRoute = async ({ request, cookies }) => {
  // Solo rate limit, no verifica que el caller realmente reservó ese stock
  const { producto_id, cantidad, producto_variante_id } = await request.json();
  // Incrementa stock directamente
  await incrementarStockProducto(producto_id, cantidad);
```

**Impacto:** Un atacante puede enviar peticiones DELETE repetidas con `cantidad: 999999` para cualquier `producto_id`, inflando el stock artificialmente. No hay verificación de que el caller haya reservado previamente ese stock ni de que la cantidad sea legítima.

---

### P0-12: `codigos-detalles.ts` — GET, DELETE y PATCH sin auth

**Archivo:** `src/pages/api/admin/codigos-detalles.ts`  
**Tipo:** Sin autenticación  

**Impacto:** Cualquier persona puede:
- Ver detalles de cualquier código promocional y su historial de uso con emails
- Eliminar códigos promocionales
- Modificar valores de descuento, activar/desactivar códigos, cambiar fechas

---

### P0-13: `codigos/verificar-uso.ts` y `codigos/registrar-uso.ts` — Auth via `x-user-id`

**Archivos:**
- `src/pages/api/codigos/verificar-uso.ts` (línea 7)
- `src/pages/api/codigos/registrar-uso.ts` (línea 7)

```typescript
const userId = request.headers.get('x-user-id');
```

**Impacto:** Permite manipular el registro de uso de códigos con identidad suplantada.

---

## P1 — ALTO

### P1-01: `register.ts` y `oauth-session.ts` — Cookies sensibles sin `httpOnly` ni `secure`

**Archivos:**
- `src/pages/api/auth/register.ts` (líneas 108–140)
- `src/pages/api/auth/oauth-session.ts` (líneas 142–166)

```typescript
// register.ts
cookies.set('auth_token', signInData.session.access_token, {
  httpOnly: false, secure: false, ...  // ⚠️
});
cookies.set('user_id', userId, {
  httpOnly: false, secure: false, ...  // ⚠️
});
```

**Impacto:** Los tokens JWT y user_id son accesibles via JavaScript (robo por XSS) y se transmiten por HTTP sin cifrar (MITM). Esto contradice el fix P1-5 aplicado en `login.ts` y `callback.ts` donde sí son `httpOnly: true, secure: true`. Inconsistencia que deja agujero en dos rutas de autenticación.

---

### P1-02: GET `/api/pedidos/index.ts` — Autorización bypass via `x-user-email`

**Archivo:** `src/pages/api/pedidos/index.ts` (línea 18)  
**Tipo:** IDOR  

```typescript
const userEmail = request.headers.get('x-user-email');
```

Aunque el endpoint usa JWT, también acepta un email arbitrario vía header. Si el usuario está autenticado Y envía `x-user-email: otro@email.com`, ve los pedidos de esa otra persona. Peor aún: si NO está autenticado pero envía el header, el endpoint no requiere JWT para funcionar – la comprobación `(!emailBusqueda || emailBusqueda === 'null')` pasa si se envía cualquier email válido.

---

### P1-03: POST `/api/pedidos/index.ts` — item.precio del cliente usado para precio_unitario

**Archivo:** `src/pages/api/pedidos/index.ts` (líneas 236–242)  

```typescript
const itemsData = cartItems.map((item: any) => ({
  pedido_id: pedido_id,
  precio_unitario: item.precio, // ⚠️ Del cliente
  subtotal: item.precio * item.cantidad, // ⚠️ Del cliente
}));
```

**Impacto:** A diferencia del endpoint `validar-y-crear-pedido.ts` (que recalcula precios de BD), `pedidos/index.ts` POST confía en el precio enviado por el cliente. Un atacante podría crear pedidos con `precio: 1` para pagar céntimos por productos caros.

**Nota:** Este endpoint sí valida la sesión Stripe (`payment_status === 'paid'`), pero el pedido se guarda con precios manipulados mientras Stripe cobra el precio correcto. Genera inconsistencias en contabilidad.

---

### P1-04: `codigos/registrar-uso.ts` — Bug: `usos_actuales` se sobreescribe con `codigoData.id`

**Archivo:** `src/pages/api/codigos/registrar-uso.ts` (línea 66)  

```typescript
const { error: errorUpdate } = await supabaseClient
  .from('codigos_promocionales')
  .update({ usos_actuales: codigoData.id })  // ⚠️ Bug: debería ser usos_actuales + 1
  .eq('id', codigoData.id);
```

**Impacto:** El contador de usos del código promocional se sobreescribe con el ID del código (ej: si el código tiene id=5, usos_actuales se pone a 5, no a usos+1). Esto rompe la validación de `uso_maximo` — un código con `uso_maximo: 10` y `id: 5` pensaría que tiene 5 usos siempre, sin importar el uso real. Race condition adicional porque no es atómico.

---

### P1-05: `checkout/validar-y-crear-pedido.ts` — ReferenceError `userEmail` 

**Archivo:** `src/pages/api/checkout/validar-y-crear-pedido.ts` (línea 78)  

```typescript
} else if (userEmail) {  // ⚠️ userEmail nunca se declaró
  customerEmail = userEmail;
}
```

**Impacto:** Si `session.customer_email` es null y `datosInvitado?.email` es null, esta línea genera un `ReferenceError` que hace fallar la creación del pedido. El pago en Stripe ya se cobró pero el pedido no se registra en la BD.

---

### P1-06: `contacto.ts` — SMTP header injection potencial en subject

**Archivo:** `src/pages/api/contacto.ts` (línea 107)  

```typescript
subject: `[Contacto Web] ${asunto}`,  // ⚠️ asunto sin sanitizar en header SMTP
```

El `asunto` se sanitiza con `escapeHtml()` para el body HTML, pero el raw `asunto` va directo al subject del email. Si contiene `\r\n`, un atacante podría inyectar headers SMTP adicionales (CC, BCC para spam relay). Depende de la implementación de nodemailer para filtrar esto.

---

### P1-07: `checkout/create-session.ts` — Error de Stripe expone detalles internos

**Archivo:** `src/pages/api/checkout/create-session.ts` (líneas 351–358)  

```typescript
return new Response(
  JSON.stringify({ 
    error: error.message || 'Error creando sesión de pago',
    type: error.type,
    param: error.param  // ⚠️ Leak de parámetro problemático
  }),
  { status: 500 }
);
```

**Impacto:** Expone tipo de error y parámetro de Stripe al cliente, facilitando reconocimiento de stack y explotación.

---

## P2 — MEDIO

### P2-01: `auth/callback.ts` — OAuth `state` parameter no validado criptográficamente

**Archivo:** `src/pages/api/auth/callback.ts` (líneas 198–203)  

```typescript
if (state) {
  try {
    const stateData = JSON.parse(atob(state));
    redirectTo = stateData.redirectTo || '/';
  } catch (e) { }
}
```

**Impacto:** El `state` es un simple base64(JSON), no un token CSRF firmado. Un atacante podría construir un state arbitrario para un ataque CSRF en el flujo OAuth, forzando a la víctima a autenticarse con la cuenta del atacante.

---

### P2-02: `auth/callback.ts` — Open redirect via `redirectTo`

**Archivo:** `src/pages/api/auth/callback.ts` (líneas 207, 215–231)  

```typescript
let finalRedirect = redirectTo;
// ...
window.location.href = ${JSON.stringify(finalRedirect)};
```

**Impacto:** `redirectTo` proviene del `state` controlado por el atacante. Podría contener `https://evil.com` y redirigir al usuario tras login legítimo a un sitio malicioso. Falta validación de que el redirect sea al mismo dominio.

---

### P2-03: `productos/buscar.ts` — Wildcards SQL no sanitizados

**Archivo:** `src/pages/api/productos/buscar.ts` (línea 58)  

```typescript
.ilike('nombre', `%${query}%`)
```

**Impacto:** Supabase parameteriza correctamente (no hay SQL injection), pero los caracteres `%` y `_` en la query actúan como wildcards adicionales. Un atacante podría enviar `q=%` para obtener todos los productos o patrones de wildcard costosos que causen estrés en la BD.

---

### P2-04: `admin/seguimiento.ts` PUT — Usa `supabaseClient` en vez de `supabaseAdmin`

**Archivo:** `src/pages/api/admin/seguimiento.ts` (línea 99)  

```typescript
const { data: pedido, error } = await supabase
  .from('pedidos')
  .update(updateData)
  .eq('id', pedidoId)
```

**Impacto:** Si RLS está habilitado, este endpoint podría no funcionar correctamente para actualizar pedidos (dependiendo de las políticas RLS). Además, dado que no tiene auth, combinado con P0-07, cualquiera puede falsificar estados de envío.

---

### P2-05: `admin/ofertas.ts` y `admin/ofertas/[id].ts` — RLS como única defensa

**Archivos:** `src/pages/api/admin/ofertas.ts`, `src/pages/api/admin/ofertas/[id].ts`  

Estos endpoints usan `supabaseClient` (anon key) y dependen de RLS para protección. Comentan: `"Usar cliente anónimo - RLS validará que sea admin"`. Pero no hay lógica server-side para validar la sesión/token del usuario en la request, así que el RLS no puede asociar la request con un usuario admin.

---

## P3 — BAJO

### P3-01: console.log excesivo con datos sensibles

**Archivos afectados:** Prácticamente todos los endpoints.

**Ejemplos:**
- `login.ts` línea 94: `console.log('🍪 Cookies establecidas:', { user_id, user_name, user_role })`
- `carrito/index.ts` línea 14: `console.log('📦 Creando nuevo carrito para usuario:', userId)`
- `pedidos/cancelar.ts`: Logs completos de items, precios, refund IDs
- `callback.ts` línea 68: `console.log('   Provider:', authUser.app_metadata?.provider)`
- `admin/productos.ts`: Log completo de datos de productos

**Impacto:** En producción, estos logs exponen user IDs, emails, roles, datos de pedidos y tokens en los archivos de log del servidor.

---

### P3-02: `admin/productos-list.ts` y `admin/guardar-producto.ts` — Endpoints obsoletos

- `productos-list.ts`: Devuelve datos hardcodeados (no consulta BD)
- `guardar-producto.ts`: No hace nada real (confirma éxito sin guardar)

**Impacto:** Confusión del equipo de desarrollo. Superficie de ataque innecesaria.

---

### P3-03: `admin/setup-variantes-stock.ts` — Intenta ejecutar DDL SQL via RPC

**Archivo:** `src/pages/api/admin/setup-variantes-stock.ts`  

```typescript
const { data, error } = await supabaseAdmin.rpc('exec_sql', {
  sql: `ALTER TABLE producto_variantes ADD COLUMN IF NOT EXISTS cantidad_disponible INT DEFAULT 10;`
});
```

**Impacto:** Sin auth (P0-07), un atacante podría intentar ejecutar SQL arbitrario. Normalmente `exec_sql` no existe como RPC, pero si se creara, sería catastrófico.

---

### P3-04: Falta de rate limiting en endpoints admin y varios públicos

**Archivos sin rate limiting:**
- Todos los endpoints admin
- `codigos/validar.ts`, `codigos/verificar-uso.ts`, `codigos/registrar-uso.ts`
- `seguimiento/index.ts`
- `productos/buscar.ts`

**Impacto:** Brute force, enumeración y DoS.

---

## Resumen de Acciones Requeridas

### Prioridad Inmediata (P0)
1. **Agregar `requireAdmin()` a TODOS los endpoints `admin/`** — 18+ endpoints vulnerables
2. **Reemplazar `x-user-id` header por `getAuthenticatedUserId()`** en: `carrito/index.ts`, `auth/me.ts`, `auth/actualizar-perfil.ts`, `pedidos/solicitar-devolucion.ts`, `codigos/verificar-uso.ts`, `codigos/registrar-uso.ts`, `admin/codigos-crear.ts`, `admin/codigos-lista.ts`
3. **Reemplazar `user_id` del body por JWT** en POST de `carrito/index.ts`
4. **Eliminar header `x-user-email`** de `pedidos/index.ts` — obtener email siempre desde BD
5. **Eliminar o proteger debug endpoints** en producción
6. **Proteger `DELETE /carrito/reservar`** — verificar que el stock fue realmente reservado
7. **Reemplazar auth por cookie `user_role`** en `admin/usuarios/eliminar.ts` y `actualizar-estado.ts` por `requireAdmin()`

### Prioridad Alta (P1)
8. **Uniformar cookies** en `register.ts` y `oauth-session.ts` para usar `httpOnly: true, secure: true` como login.ts
9. **Corregir bug** de `usos_actuales: codigoData.id` → incremento atómico
10. **Corregir `userEmail` undefined** en `validar-y-crear-pedido.ts`
11. **Usar precios de BD** en POST de `pedidos/index.ts` (como ya hace `validar-y-crear-pedido.ts`)
12. **Sanitizar subject** de email en `contacto.ts`
13. **No exponer detalles de error** de Stripe al cliente
