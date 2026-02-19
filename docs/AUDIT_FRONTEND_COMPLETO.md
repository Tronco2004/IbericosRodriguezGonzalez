# Auditoría Completa del Frontend — src/

**Fecha:** Junio 2025  
**Alcance:** middleware, layouts, components, pages, lib  
**Convención de severidad:**

| Severidad | Significado |
|-----------|-------------|
| **P0** | Vulnerabilidad crítica explotable sin autenticación |
| **P1** | Riesgo de seguridad alto o fallo funcional grave |
| **P2** | Riesgo moderado / inconsistencia importante |
| **P3** | Código muerto, calidad de código, mejoras menores |

---

## Resumen Ejecutivo

| Severidad | Cantidad |
|-----------|----------|
| P0 | 0 |
| P1 | 5 |
| P2 | 8 |
| P3 | 12 |

La arquitectura de seguridad server-side (middleware.ts + auth-helpers.ts) es sólida: valida JWT mediante `supabaseAdmin.auth.getUser()`. No hay P0. Los problemas principales son **XSS por uso de `innerHTML` con datos no sanitizados** (P1) y **código muerto** de headers `x-user-id` que el servidor ya ignora (P3).

---

## P1 — Seguridad Alta

### P1-01 · XSS en ChatBot.astro — `innerHTML` sin sanitizar

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/components/ChatBot.astro` |
| **Líneas** | 525, 530-535 |
| **Tipo** | XSS (Cross-Site Scripting) |

```js
// Línea 525
messageDiv.innerHTML = `<div class="message-content">${formatMessage(content)}</div>`;

// Líneas 530-535 — formatMessage NO sanitiza HTML
function formatMessage(content: string): string {
  return content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}
```

**Impacto:** Si la API de IA responde con `<img src=x onerror=alert(document.cookie)>`, se ejecuta en el navegador del usuario. `formatMessage()` convierte markdown a HTML pero **nunca escapa** `<`, `>`, `&`, `"`.

**Corrección:** Escapar HTML antes de aplicar las transformaciones markdown:

```js
function formatMessage(content: string): string {
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}
```

---

### P1-02 · XSS en registro.astro — mensajes del servidor en innerHTML

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/registro.astro` |
| **Líneas** | 274, 306 |
| **Tipo** | XSS reflejado |

```js
// Línea 274
messageContainer.innerHTML = `<div ...>${data.message}</div>`;

// Línea 306
messageContainer.innerHTML = `<div ...>❌ ${data.error || 'Error al registrarse'}</div>`;
```

**Impacto:** Si el endpoint `/api/auth/registro` devuelve un `message` o `error` con HTML malicioso (ej. un atacante que controla un proxy intermedio o un bug en la API), se ejecuta en el DOM. Aunque el servidor es propio, el principio de defensa en profundidad exige sanitizar.

**Corrección:** Usar `textContent` en lugar de `innerHTML`, o escapar antes de insertar.

---

### P1-03 · ProtectedLayout ignora sus props y usa solo localStorage

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/layouts/ProtectedLayout.astro` |
| **Líneas** | 9, 14-28 |
| **Tipo** | Bypass de autenticación client-side |

```astro
// Línea 9 — Props aceptadas pero NUNCA usadas en el script
const { requireAuth = false, requireAdmin = false } = Astro.props;

// Líneas 14-28 — Check basado SOLO en localStorage
<script>
  const userRole = localStorage.getItem('user_role');
  if (currentPath.startsWith('/admin')) {
    if (userRole !== 'admin') {
      window.location.href = '/sin-acceso';
    }
  }
</script>
```

**Impacto:** Un usuario puede ejecutar `localStorage.setItem('user_role', 'admin')` en la consola del navegador y pasar el check del ProtectedLayout. **Mitigación real:** El middleware.ts SÍ protege las rutas `/admin/*` y `/api/admin/*` a nivel servidor, así que los datos no se exponen. Sin embargo, el usuario ve el HTML/estructura de la página admin antes de que las llamadas API fallen con 403.

**Corrección:**
1. Hacer que el ProtectedLayout use las props `requireAuth`/`requireAdmin` o eliminarlas.
2. Idealmente, mover la validación al frontmatter de Astro (server-side) en lugar de un `<script>` client-side.

---

### P1-04 · XSS almacenado en admin/usuarios.astro

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/admin/usuarios.astro` |
| **Líneas** | 98-99 |
| **Tipo** | Stored XSS |

```js
tableBody.innerHTML = data.usuarios.map(usuario => `
  <tr>
    <td><strong>${usuario.nombre}</strong></td>
    <td>${usuario.email}</td>
    ...
  </tr>
`).join('');
```

**Impacto:** Si un usuario se registra con nombre `<img src=x onerror=alert(1)>`, cuando el admin abre la página de usuarios, el XSS se ejecuta en su navegador. Es un XSS **almacenado** — un usuario normal inyecta código que se ejecuta en el contexto del admin.

**Corrección:** Escapar `usuario.nombre` y `usuario.email` antes de insertarlos en innerHTML.

---

### P1-05 · supabase.ts — Fallback silencioso al cliente anónimo

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/lib/supabase.ts` |
| **Líneas** | 17-23 |
| **Tipo** | Fallo silencioso de seguridad |

```ts
export const supabaseAdmin = isValidServiceRoleKey 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { ... })
  : supabaseClient; // ← Fallback al cliente ANÓNIMO
```

**Impacto:** Si `SUPABASE_SERVICE_ROLE_KEY` no está configurada o es inválida, `supabaseAdmin` se convierte en el cliente anónimo sin aviso. Todas las operaciones de `auth-helpers.ts` que llaman `supabaseAdmin.auth.getUser(token)` podrían fallar silenciosamente o tener permisos incorrectos. En producción, si la variable de entorno se borra accidentalmente, la autenticación entera se rompe de forma difícil de diagnosticar.

**Corrección:** Lanzar un error o log de nivel ERROR en lugar de hacer fallback silencioso:

```ts
if (!isValidServiceRoleKey) {
  console.error('CRÍTICO: SUPABASE_SERVICE_ROLE_KEY no configurada o inválida');
}
```

---

## P2 — Riesgo Moderado

### P2-01 · admin/estadisticas.astro usa Layout en vez de ProtectedLayout

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/admin/estadisticas.astro` |
| **Línea** | 2, 6 |
| **Tipo** | Inconsistencia de seguridad |

```astro
import Layout from '../../layouts/Layout.astro';  // ← NO es ProtectedLayout
<Layout>
```

**Impacto:** Las 13 páginas admin restantes usan `ProtectedLayout`. Esta es la única que usa `Layout` directamente. Aunque el middleware protege la ruta `/admin/estadisticas` a nivel servidor (las APIs devuelven 403), el HTML estático de la página (con datos hardcodeados actualmente) se renderiza sin check client-side. Inconsistencia con el resto del panel.

**Corrección:** Cambiar a `import ProtectedLayout from '../../layouts/ProtectedLayout.astro'`.

---

### P2-02 · XSS en admin/ofertas.astro

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/admin/ofertas.astro` |
| **Líneas** | 228-242 |
| **Tipo** | Stored XSS (riesgo bajo — datos controlados por admin) |

```js
html += `<tr>
  <td>${oferta.nombre_oferta}</td>
  <td>${oferta.producto?.nombre || 'Sin producto'}</td>
  ...
</tr>`;
container.innerHTML = html;
```

**Impacto:** Los nombres de ofertas y productos vienen de la BD. Si un admin inserta HTML en el nombre, se ejecuta. Riesgo bajo (self-XSS), pero viola el principio de sanitización.

---

### P2-03 · XSS en admin/categorias.astro

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/admin/categorias.astro` |
| **Líneas** | 215, 336-350 |
| **Tipo** | Stored XSS (riesgo bajo — datos controlados por admin) |

```js
// Línea 215 — select con nombre de categoría
`<option value="${cat.id}">${cat.nombre}</option>`

// Línea 340+
`<div class="cat-nombre">${cat.nombre}...</div>`
```

---

### P2-04 · XSS en admin/clientes.astro

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/admin/clientes.astro` |
| **Líneas** | 171-190 |
| **Tipo** | Stored XSS (riesgo bajo — datos controlados por admin) |

```js
tabla.innerHTML = filtrados.map(c => `
  <td class="font-semibold">${c.nombre_empresa}</td>
  <td class="text-secondary">${c.email_contacto}</td>
  ...
`).join('');
```

---

### P2-05 · XSS en admin/empresas.astro

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/admin/empresas.astro` |
| **Líneas** | 341-395 |
| **Tipo** | Stored XSS (riesgo bajo — datos controlados por admin) |

```js
grid.innerHTML = empresasFiltradas.map(e => `
  <h3 class="empresa-nombre">${e.nombre_empresa}</h3>
  <div class="empresa-section-value">${e.tipo_identificacion}: ${e.numero_identificacion}</div>
  <div class="empresa-section-text">${e.nombre_representante}</div>
  <div ...>${e.email_contacto}</div>
  <div ...>${e.direccion_fiscal}</div>
  ${e.notas ? `<div ...>${e.notas}</div>` : ''}
`).join('');
```

**Nota:** El campo `notas` es texto libre, mayor superficie de ataque.

---

### P2-06 · pedidos.astro es página duplicada/obsoleta

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/pedidos.astro` |
| **Líneas** | Archivo completo (218 líneas) |
| **Tipo** | Código duplicado |

Es una versión antigua de `mis-pedidos.astro` con:
- Colores hardcodeados (sin soporte de tema oscuro/claro)
- Sin funcionalidad de cancelación/devolución
- Envía header `x-user-id` (línea 45)

**Corrección:** Eliminar o redirigir a `/mis-pedidos`.

---

### P2-07 · admin/pedidos.astro — checks redundantes con localStorage

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/admin/pedidos.astro` |
| **Líneas** | 306, 600, 648 |
| **Tipo** | Código redundante / falsa sensación de seguridad |

```js
// Línea 306 (y patrón repetido en 600, 648)
const userRole = localStorage.getItem('user_role');
if (userRole !== 'admin') {
  window.location.href = '/sin-acceso';
  return;
}
```

**Impacto:** Estos checks se repiten dentro de funciones individuales (`actualizarEstado`, etc.) además del check del ProtectedLayout. Son spoofables y redundantes — la protección real está en el middleware server-side.

---

### P2-08 · email.ts — Logs de credenciales en producción

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/lib/email.ts` |
| **Líneas** | 11-12 |
| **Tipo** | Fuga de información |

```ts
console.log('📧 Creando transporter con usuario:', user ? user : '⚠️ NO CONFIGURADO');
console.log('📧 Password configurada:', pass ? 'Sí' : '⚠️ NO');
```

**Impacto:** Loguea el nombre de usuario del GMAIL en la consola del servidor. Aunque no loguea la contraseña directamente, confirma su existencia y expone el email de servicio en los logs.

**Corrección:** Mover a `console.debug` o eliminarlo, o condicionar a `import.meta.env.DEV`.

---

## P3 — Código Muerto / Calidad

### P3-01 · Headers `x-user-id` enviados (22 instancias) — Código muerto

El servidor usa JWT desde cookies (`auth-helpers.ts`) y **ignora** el header `x-user-id`. Estos envíos son código muerto.

| Archivo | Línea(s) |
|---------|----------|
| `src/layouts/Layout.astro` | 2272 |
| `src/pages/carrito.astro` | 772, 1361, 1423, 1452, 1684, 1728, 2006 |
| `src/pages/mi-perfil.astro` | 223, 294, 369 |
| `src/pages/mis-pedidos.astro` | 112, 150, 310 |
| `src/pages/pedidos.astro` | 45 |
| `src/pages/checkout/exito.astro` | 206 |
| `src/pages/productos/[id].astro` | 1840 |
| `src/pages/productos/index.astro` | 1325 |
| `src/pages/categoria/[slug].astro` | 1888, 2032 |
| `src/pages/admin/codigos-descuento.astro` | 486, 717 |

**Corrección:** Eliminar todos los headers `x-user-id` de las peticiones fetch del frontend.

---

### P3-02 · Header `x-user-email` en mis-pedidos.astro — Código muerto

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/mis-pedidos.astro` |
| **Línea** | 311 |

```js
...(userEmail && userEmail !== 'null' && { 'x-user-email': userEmail })
```

Mismo patrón que `x-user-id`: el servidor no usa este header.

---

### P3-03 · login.astro guarda userId como 'auth_token'

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/login.astro` |
| **Línea** | 373 |

```js
localStorage.setItem('auth_token', data.usuario.id);
```

Se guarda el **ID del usuario** (UUID) como `auth_token` en localStorage. El nombre `auth_token` es engañoso — no es un JWT ni un token de sesión. El token real de autenticación se gestiona vía cookies (`auth_token` cookie).

**Corrección:** Renombrar a `user_id` o eliminar si ya existe `localStorage.setItem('user_id', ...)`.

---

### P3-04 · ProtectedLayout — console.log de depuración en producción

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/layouts/ProtectedLayout.astro` |
| **Líneas** | 16-20 |

```js
console.log('Validando acceso:');
console.log('  Path:', currentPath);
console.log('  Rol desde localStorage:', userRole);
```

Logs de depuración visibles en la consola del navegador de cualquier usuario que visite `/admin/*`. Revelan el mecanismo de autenticación.

---

### P3-05 · rate-limit.ts — `setInterval` nunca se limpia

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/lib/rate-limit.ts` |
| **Líneas** | 40-44 |

```ts
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of map) {
    if (now > entry.resetAt) map.delete(key);
  }
}, cleanupIntervalMs);
```

El intervalo de limpieza se ejecuta indefinidamente y no es cancelable. En entornos serverless (Vercel Edge, Cloudflare Workers) esto puede causar comportamiento inesperado. En un servidor persistente, es aceptable pero el intervalo debería ser cancelable.

---

### P3-06 · cloudinary.ts — Tipado débil con `Promise<any>`

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/lib/cloudinary.ts` |
| **Líneas** | 54, 82 |

```ts
export async function uploadToCloudinary(...): Promise<any> { ... }
export async function deleteFromCloudinary(publicId: string): Promise<any> { ... }
```

**Corrección:** Crear interfaces para los tipos de respuesta de Cloudinary.

---

### P3-07 · middleware.ts — Array `rutasProtegidas` vacío

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/middleware.ts` |
| **Línea** | 126 |

```ts
const rutasProtegidas: string[] = [];
```

El bloque de "rutas protegidas generales" (no admin) está preparado pero vacío. Rutas como `/mi-perfil`, `/mis-pedidos` no están protegidas por middleware — la protección es solo client-side (localStorage check o ninguna).

**Impacto:** Un usuario no autenticado puede visitar `/mi-perfil` y verá la estructura HTML. Las llamadas API fallarán por falta de token, pero la página se carga. Decide si esto es aceptable.

---

### P3-08 · auth.ts — Comentario incorrecto

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/lib/auth.ts` |

El comentario dice: *"Las sesiones se manejan con cookies (auth_token, user_id, user_role)"*. En realidad, `user_id` y `user_role` ya no se envían como cookies — solo `auth_token` es una cookie de sesión. El resto se maneja vía localStorage.

---

### P3-09 · registro.astro — Guardado parcial de datos en localStorage

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/registro.astro` |
| **Líneas** | 265-267 |

```js
localStorage.setItem('user_id', data.userId);
localStorage.setItem('user_email', email);
localStorage.setItem('user_name', nombre);
```

No se guarda `user_role` ni `auth_token` en el flujo de registro con formulario, a diferencia del flujo de login que sí los establece. Posible inconsistencia en el estado de la sesión post-registro.

---

### P3-10 · login.astro — Duplicación de cliente Supabase

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/login.astro` |

Tiene dos bloques `<script>` separados: uno para login social y otro para login con formulario. Ambos crean su propio cliente Supabase de formas distintas. Deberían unificarse.

---

### P3-11 · Layout-old.astro — Archivo obsoleto

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/layouts/Layout-old.astro` |

Versión anterior del layout. No referenciado por ninguna página (todas usan `Layout.astro`). Debería eliminarse o archivarse.

---

### P3-12 · admin/estadisticas.astro — Datos hardcodeados

| Campo | Detalle |
|-------|---------|
| **Archivo** | `src/pages/admin/estadisticas.astro` |
| **Líneas** | 20-50 |

Todos los valores están hardcodeados (`2.550 €`, `8 nuevos clientes`, `24 pedidos completados`). No consulta la API. Parece una página de mockup.

---

## Patrón Sistémico: innerHTML con datos dinámicos

El problema más extendido es el uso de `innerHTML` con template literals que contienen datos dinámicos sin sanitizar. Astro auto-escapa las expresiones en templates `.astro` (server-side), pero el código `<script>` client-side que usa `innerHTML` **no** se beneficia de ese escape.

### Archivos afectados (que requieren `escapeHtml` o `textContent`):

| Archivo | Línea(s) | Datos sin sanitizar |
|---------|----------|---------------------|
| `ChatBot.astro` | 525 | Respuesta del bot IA |
| `registro.astro` | 274, 306 | `data.message`, `data.error` |
| `admin/usuarios.astro` | 98-99 | `usuario.nombre`, `usuario.email` |
| `admin/ofertas.astro` | 228-242 | `oferta.nombre_oferta`, `producto.nombre` |
| `admin/categorias.astro` | 215, 340 | `cat.nombre` |
| `admin/clientes.astro` | 171-190 | `c.nombre_empresa`, `c.email_contacto`, etc. |
| `admin/empresas.astro` | 341-395 | `e.nombre_empresa`, `e.notas`, etc. |

### Función `escapeHtml` ya existe

En `src/lib/auth-helpers.ts` existe `escapeHtml()`, pero es una función **server-side** (no disponible en `<script>` client-side). Se recomienda crear una utilidad equivalente en un script compartido del frontend:

```js
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

---

## Lista de Archivos Auditados

### Middleware y Lib
- [x] `src/middleware.ts` (140 líneas)
- [x] `src/lib/auth-helpers.ts` (100 líneas)
- [x] `src/lib/auth.ts` (12 líneas)
- [x] `src/lib/supabase.ts` (51 líneas)
- [x] `src/lib/email.ts` (1198 líneas)
- [x] `src/lib/stock.ts` (223 líneas) — ✅ sin issues
- [x] `src/lib/stripe.ts` (170 líneas) — ✅ sin issues
- [x] `src/lib/rate-limit.ts` (85 líneas)
- [x] `src/lib/cloudinary.ts` (82 líneas)
- [x] `src/lib/categorias-hierarchy.ts` (140 líneas) — ✅ sin issues

### Layouts
- [x] `src/layouts/Layout.astro` (2811 líneas)
- [x] `src/layouts/ProtectedLayout.astro` (35 líneas)
- [x] `src/layouts/Layout-old.astro` — obsoleto

### Componentes
- [x] `src/components/ChatBot.astro` (576 líneas)
- [x] `src/components/MegaMenu.astro` (416 líneas) — ✅ sin issues (datos server-rendered)
- [x] `src/components/OfertasSection.astro` — server-rendered por Astro
- [x] `src/components/CategoriaBreadcrumb.astro` — server-rendered
- [x] `src/components/CategoriaNav.astro` — server-rendered
- [x] `src/components/CategoriaSelector.astro` — server-rendered

### Páginas Públicas
- [x] `src/pages/index.astro`
- [x] `src/pages/login.astro` (398 líneas)
- [x] `src/pages/registro.astro` (318 líneas)
- [x] `src/pages/carrito.astro` (2191 líneas)
- [x] `src/pages/mi-perfil.astro` (428 líneas)
- [x] `src/pages/mis-pedidos.astro` (658 líneas)
- [x] `src/pages/pedidos.astro` (218 líneas) — duplicado
- [x] `src/pages/checkout/exito.astro` (363 líneas)
- [x] `src/pages/auth/callback.astro` (160 líneas)
- [x] `src/pages/ofertas.astro`
- [x] `src/pages/seguimiento.astro`
- [x] `src/pages/devoluciones.astro`
- [x] `src/pages/contacto.astro` — ✅ sin issues
- [x] `src/pages/sin-acceso.astro` — ✅ estática
- [x] `src/pages/productos/[id].astro`
- [x] `src/pages/productos/index.astro`
- [x] `src/pages/categoria/[slug].astro`

### Páginas Admin
- [x] `src/pages/admin/dashboard.astro` (822 líneas)
- [x] `src/pages/admin/pedidos.astro` (752 líneas)
- [x] `src/pages/admin/usuarios.astro` (203 líneas)
- [x] `src/pages/admin/productos.astro` (1254 líneas)
- [x] `src/pages/admin/ofertas.astro` (574 líneas)
- [x] `src/pages/admin/categorias.astro` (506 líneas)
- [x] `src/pages/admin/clientes.astro` (346 líneas)
- [x] `src/pages/admin/empresas.astro` (427 líneas)
- [x] `src/pages/admin/estadisticas.astro` (206 líneas)
- [x] `src/pages/admin/codigos-descuento.astro`
- [x] `src/pages/admin/ingresos.astro`
- [x] `src/pages/admin/variantes.astro`
- [x] `src/pages/admin/subir-imagen.astro`
- [x] `src/pages/admin/setup.astro`
