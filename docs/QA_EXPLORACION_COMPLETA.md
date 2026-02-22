# Exploración Completa del Proyecto — QA Testing Checklist Base

**Fecha:** 22 de febrero de 2026  
**Proyecto:** Ibéricos Rodríguez González  
**URL:** https://ibericosrodriguezgonzalez.victoriafp.online  
**Stack:** Astro 5 SSR + Supabase + Stripe + Cloudinary + Nodemailer + PDFKit

---

## 1. PÁGINAS ADMIN (`src/pages/admin/`) — 14 vistas

| # | Página | Ruta | Descripción |
|---|--------|------|-------------|
| 1 | `dashboard.astro` | `/admin/dashboard` | KPIs: ingresos, pedidos, ticket promedio, stock bajo, clientes |
| 2 | `productos.astro` | `/admin/productos` | CRUD de productos (simples y con variantes peso variable) |
| 3 | `pedidos.astro` | `/admin/pedidos` | Gestión de pedidos, cambio de estados, seguimiento |
| 4 | `categorias.astro` | `/admin/categorias` | CRUD de categorías y subcategorías (jerárquicas) |
| 5 | `ofertas.astro` | `/admin/ofertas` | Gestión de descuentos temporales por producto |
| 6 | `codigos-descuento.astro` | `/admin/codigos-descuento` | Códigos promocionales (porcentaje/fijo) |
| 7 | `usuarios.astro` | `/admin/usuarios` | Gestión de cuentas de usuario, cambiar roles |
| 8 | `clientes.astro` | `/admin/clientes` | Clientes empresariales (B2B) |
| 9 | `empresas.astro` | `/admin/empresas` | Empresas registradas (NIF, dirección, representante) |
| 10 | `ingresos.astro` | `/admin/ingresos` | Desglose financiero por usuario y por día |
| 11 | `estadisticas.astro` | `/admin/estadisticas` | Estadísticas (⚠️ datos hardcodeados, mockup) |
| 12 | `variantes.astro` | `/admin/variantes` | Variantes de peso variable por producto |
| 13 | `subir-imagen.astro` | `/admin/subir-imagen` | Upload de imágenes a Cloudinary |
| 14 | `setup.astro` | `/admin/setup` | Inicialización/setup de datos |

---

## 2. PÁGINAS PÚBLICAS (`src/pages/`) — 22 vistas

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/` | `index.astro` | Página de inicio |
| `/productos` | `productos/index.astro` | Catálogo completo de productos |
| `/productos/:id` | `productos/[id].astro` | Detalle de producto individual |
| `/categoria/:slug` | `categoria/[slug].astro` | Productos filtrados por categoría |
| `/categoria/categoria` | `categoria/categoria.astro` | Vista alternativa de categorías |
| `/ofertas` | `ofertas.astro` | Ofertas activas |
| `/carrito` | `carrito.astro` | Carrito de compra (~2191 líneas) |
| `/checkout/exito` | `checkout/exito.astro` | Confirmación post-pago Stripe |
| `/login` | `login.astro` | Login con formulario + OAuth (Google) |
| `/registro` | `registro.astro` | Registro de usuarios |
| `/auth/callback` | `auth/callback.astro` | Callback OAuth |
| `/auth/finish` | `auth/finish.astro` | Finalización OAuth |
| `/mi-perfil` | `mi-perfil.astro` | Perfil del usuario |
| `/mis-pedidos` | `mis-pedidos.astro` | Historial de pedidos del usuario |
| `/pedidos` | `pedidos.astro` | ⚠️ DUPLICADO obsoleto de `mis-pedidos` |
| `/seguimiento` | `seguimiento.astro` | Seguimiento por código |
| `/devoluciones` | `devoluciones.astro` | Información de devoluciones |
| `/contacto` | `contacto.astro` | Formulario de contacto |
| `/sobre-nosotros` | `sobre-nosotros.astro` | Información de la empresa |
| `/terminos` | `terminos.astro` | Términos y condiciones |
| `/privacidad` | `privacidad.astro` | Política de privacidad |
| `/cookies` | `cookies.astro` | Política de cookies |
| `/recuperar-contrasena` | `recuperar-contrasena.astro` | Solicitar recuperación |
| `/restablecer-contrasena` | `restablecer-contrasena.astro` | Restablecer contraseña |
| `/sin-acceso` | `sin-acceso.astro` | Página de acceso denegado |

---

## 3. API ENDPOINTS (`src/pages/api/`) — ~68 endpoints

### 3.1 Auth (`/api/auth/`) — 12 endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `login.ts` | POST | Login con email/password |
| `register.ts` | POST | Registro nuevo usuario |
| `logout.ts` | POST | Cerrar sesión (limpiar cookies) |
| `me.ts` | GET | Obtener datos del usuario autenticado |
| `callback.ts` | GET | Callback OAuth (Google) |
| `oauth-session.ts` | POST | Establecer sesión post-OAuth |
| `social-login.ts` | POST | Iniciar login social |
| `actualizar-perfil.ts` | POST | Actualizar nombre, teléfono, dirección |
| `cambiar-contrasena.ts` | POST | Cambiar contraseña (requiere actual) |
| `establecer-contrasena.ts` | POST | Establecer contraseña (usuarios OAuth) |
| `solicitar-recovery.ts` | POST | Enviar email recuperación |
| `reset-password.ts` | POST | Restablecer contraseña con token |

### 3.2 Carrito (`/api/carrito/`) — 5 endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `index.ts` | GET | Obtener carrito del usuario |
| `index.ts` | POST | Añadir producto al carrito |
| `agregar.ts` | POST | Añadir item (alternativo) |
| `[id].ts` | PUT/DELETE | Actualizar cantidad / eliminar item |
| `reservar.ts` | POST/DELETE | Reservar/liberar stock temporalmente |
| `vaciar.ts` | POST | Vaciar carrito completo |

### 3.3 Checkout (`/api/checkout/`) — 2 endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `create-session.ts` | POST | Crear sesión de pago Stripe (precios desde BD) |
| `validar-y-crear-pedido.ts` | POST | Validar pago Stripe + crear pedido en BD |

### 3.4 Pedidos (`/api/pedidos/`) — 5 endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `index.ts` | GET/POST | Listar pedidos usuario / Crear pedido (legacy) |
| `cancelar.ts` | POST | Cancelar pedido + reembolso Stripe + restaurar stock |
| `solicitar-devolucion.ts` | POST | Solicitar devolución (cliente) |
| `validar-devolucion.ts` | POST | Aprobar devolución (admin) |
| `denegar-devolucion.ts` | POST | Denegar devolución (admin) |

### 3.5 Productos (`/api/productos/`) — 5 endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `lista.ts` | GET | Lista paginada de productos |
| `[id].ts` | GET | Detalle de producto por ID |
| `buscar.ts` | GET | Búsqueda de productos (ilike) |
| `stocks.ts` | GET | Consulta de stocks |
| `reservados.ts` | GET | Productos con stock reservado |

### 3.6 Variantes (`/api/variantes/`) — 3 endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `[productoId].ts` | GET | Variantes de un producto |
| `obtener-disponibles.ts` | GET | Variantes disponibles |
| `eliminar.ts` | DELETE | Eliminar variante |

### 3.7 Códigos Promocionales (`/api/codigos/`) — 3 endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `validar.ts` | POST | Validar código promocional |
| `verificar-uso.ts` | POST | Verificar si usuario ya usó código |
| `registrar-uso.ts` | POST | Registrar uso de código |

### 3.8 Ofertas (`/api/ofertas/`) — 1 endpoint

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `index.ts` | GET | Listar ofertas activas |

### 3.9 Seguimiento (`/api/seguimiento/`) — 1 endpoint

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `index.ts` | GET | Consultar seguimiento por código |

### 3.10 Contacto — 1 endpoint

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `contacto.ts` | POST | Enviar formulario de contacto (email) |

### 3.11 Chat — 1 endpoint

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `chat.ts` | POST | Chat bot IA |

### 3.12 Admin (`/api/admin/`) — ~24 endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `dashboard-stats.ts` | GET | Estadísticas del dashboard |
| `productos.ts` | GET/POST | CRUD productos |
| `productos-list.ts` | GET | ⚠️ Datos hardcodeados (no consulta BD) |
| `guardar-producto.ts` | POST | ⚠️ No hace nada real |
| `pedidos.ts` | GET | Listar todos los pedidos |
| `pedidos/actualizar-estado.ts` | PUT | Cambiar estado de pedido |
| `usuarios.ts` | GET/PUT/DELETE | CRUD usuarios |
| `usuarios/actualizar-estado.ts` | PUT | Activar/desactivar usuario |
| `usuarios/eliminar.ts` | DELETE | Eliminar usuario |
| `categorias.ts` | GET/POST/PUT/DELETE | CRUD categorías |
| `ofertas.ts` | GET/POST | CRUD ofertas |
| `ofertas/[id].ts` | PUT/DELETE | Modificar/eliminar oferta |
| `codigos-crear.ts` | POST | Crear código promocional |
| `codigos-lista.ts` | GET | Listar códigos |
| `codigos-detalles.ts` | GET/DELETE/PATCH | Detalle/eliminar/editar código |
| `clientes-empresariales.ts` | GET/POST/PUT/DELETE | CRUD clientes B2B |
| `ingresos-diarios.ts` | GET | Ingresos por día |
| `ingresos-usuarios.ts` | GET | Ingresos por usuario |
| `debug-ingresos.ts` | GET | Debug datos financieros |
| `seguimiento.ts` | GET/PUT | Seguimiento de envíos |
| `variantes.ts` | GET/POST/PUT/DELETE | CRUD variantes |
| `upload.ts` | POST | Subir imagen a Cloudinary |
| `setup.ts` | POST | Inicialización datos |
| `init-data.ts` | POST | Setup inicial |
| `setup-variantes-stock.ts` | POST | Setup variantes stock (DDL) |

### 3.13 Debug (`/api/debug/`) — 4 endpoints

| Endpoint | Descripción |
|----------|-------------|
| `debug/crear-pedido-prueba.ts` | Crear pedido falso sin pago |
| `debug-variantes.ts` | Exponer variantes |
| `debug-queso.ts` | Debug producto específico |
| `debug-categorias.ts` | Debug categorías |

---

## 4. COMPONENTES (`src/components/`) — 6 componentes

| Componente | Descripción |
|------------|-------------|
| `ChatBot.astro` | Chat bot con IA (formateo markdown) |
| `MegaMenu.astro` | Menú de navegación mega desplegable |
| `OfertasSection.astro` | Sección de ofertas en página de inicio |
| `CategoriaBreadcrumb.astro` | Breadcrumb de navegación por categorías |
| `CategoriaNav.astro` | Navegación lateral por categorías |
| `CategoriaSelector.astro` | Selector de categorías |

---

## 5. LAYOUTS — 3 layouts

| Layout | Descripción |
|--------|-------------|
| `Layout.astro` | Layout principal (~2811 líneas). Header, footer, carrito flotante, mega menú |
| `ProtectedLayout.astro` | Wrapper para páginas admin (check client-side localStorage) |
| `Layout-old.astro` | ⚠️ Obsoleto, no se usa |

---

## 6. MIDDLEWARE (`src/middleware.ts`) — 190 líneas

El middleware protege **3 tipos de rutas**:

### 6.1 Páginas Admin (`/admin/*`)
- Valida JWT real con `supabaseAdmin.auth.getUser()`
- Si token expirado, intenta refresh con `sb-refresh-token`
- Verifica rol `admin` contra tabla `usuarios` en BD
- Si falla → redirect a `/login`

### 6.2 APIs Admin (`/api/admin/*`)
- Misma validación JWT + rol admin
- Si falla → Response 401/403 JSON

### 6.3 Debug Endpoints (`/api/debug/*`)
- Requiere JWT válido + rol admin
- Si falla → Response 403

### 6.4 Rutas Protegidas Generales
- Array `rutasProtegidas` está **VACÍO**
- `/mi-perfil`, `/mis-pedidos` NO están protegidas por middleware (solo client-side)
- `/checkout/exito` y `/carrito` están en la lista de exentas

---

## 7. LIBRERÍAS CLAVE (`src/lib/`)

### 7.1 `auth-helpers.ts` — Autenticación Server-Side
- `getAuthenticatedUserId(request, cookies)` → valida JWT (cookie → Bearer → refresh)
- `requireAuth(request, cookies)` → devuelve `{userId}` o Response 401
- `requireAdmin(request, cookies)` → requiere JWT + rol admin o Response 403
- `escapeHtml(str)` → escapa `& < > " '` contra XSS

### 7.2 `stripe.ts` — Pagos y Reembolsos
- Instancia compartida de Stripe
- `procesarReembolsoStripe(sessionId, motivo)` → reembolso completo vía PaymentIntent
- Verifica reembolsos duplicados antes de crear

### 7.3 `email.ts` — Emails + Factura PDF (~1535 líneas)
- Nodemailer con Gmail
- Genera facturas PDF con PDFKit
- Emails: confirmación, cancelación, devolución (solicitud/aprobación/denegación), bienvenida, notificación admin

### 7.4 `stock.ts` — Control Atómico de Stock (CAS)
- `decrementarStockProducto/Variante()` — patrón Compare-And-Swap con 5 reintentos
- `incrementarStockProducto/Variante()` — restauración de stock
- Previene race conditions sin funciones RPC

### 7.5 `cloudinary.ts` — Gestión de Imágenes
- `uploadToCloudinary(file, folder)` → subir imagen
- `deleteFromCloudinary(publicId)` → eliminar imagen
- `getCloudinaryUrl(publicId, options)` → URL optimizada con transformaciones

### 7.6 `rate-limit.ts` — Rate Limiting en Memoria
- `createRateLimiter({maxRequests, windowMs})` → fábrica de rate limiters
- Aplicado: login (10/min), registro (5/min), contacto (5/min), chat (15/min)
- `getClientIp(request)` → extrae IP de headers

### 7.7 `supabase.ts` — Clientes de BD
- `supabaseClient` → cliente anónimo
- `supabaseAdmin` → cliente con service role (⚠️ fallback silencioso a anónimo si falta key)

### 7.8 `categorias-hierarchy.ts` — Árbol de Categorías
- `construirArbolCategorias()` → jerarquía padre-hijo
- `obtenerRutaCategoria()` → breadcrumb
- `obtenerIdsCategoriaYSubcategorias()` → IDs recursivos

---

## 8. FUNCIONALIDADES PRINCIPALES

### 8.1 Catálogo de Productos
- Productos simples (stock numérico)
- Productos con peso variable (variantes únicas: jamón de 7.2kg → precio individual)
- Categorías jerárquicas (padre → subcategorías)
- Búsqueda por nombre
- Ofertas temporales con precio rebajado
- Imágenes vía Cloudinary

### 8.2 Carrito de Compra
- Persistencia en BD (usuario autenticado)
- Reserva temporal de stock
- Soporte para variantes de peso variable
- Vaciar carrito completo

### 8.3 Checkout / Pagos
- Stripe Checkout Sessions
- Precios validados server-side (nunca confía en el cliente)
- Códigos promocionales (porcentaje o fijo) validados contra BD
- Envío fijo: 5€
- Soporte compra como invitado (sin registro)
- Factura PDF adjunta en email de confirmación

### 8.4 Gestión de Pedidos
- Estados: `pagado → preparando → enviado → entregado`
- Cancelación con reembolso Stripe + restauración de stock
- Devoluciones: solicitud → aprobación/denegación por admin
- Seguimiento por código
- Número de pedido: `PED-{timestamp}-{random}`

### 8.5 Autenticación
- Email/password (Supabase Auth)
- OAuth con Google
- JWT en cookies httpOnly
- Refresh token automático
- Recuperación de contraseña por email
- Roles: `admin`, `cliente`

### 8.6 Panel Admin
- Dashboard con KPIs (ingresos, pedidos, clientes, stock bajo)
- CRUD completo: productos, categorías, ofertas, códigos, usuarios, variantes
- Clientes empresariales (B2B)
- Gestión de pedidos y devoluciones
- Subida de imágenes a Cloudinary
- Ingresos diarios y por usuario

### 8.7 Emails Transaccionales
- Confirmación de pedido (+ factura PDF)
- Cancelación (+ factura rectificativa)
- Solicitud de devolución
- Aprobación/denegación de devolución
- Notificación al admin (cancelación/devolución)
- Email de bienvenida al registrarse

### 8.8 Chat Bot
- Bot con IA integrado
- Rate-limited (15/min)

---

## 9. ERRORES Y PROBLEMAS DOCUMENTADOS

### 9.1 P0 Corregidos (15 issues — TODOS ✅)
Según `ESTADO_ERRORES_CRITICOS.md`, todos los P0 están corregidos:
- Precios del cliente en Stripe → recalculados desde BD
- Sin idempotencia en pedidos → verificación por `stripe_session_id`
- XSS en OAuth callback → `JSON.stringify` seguro
- Admin sin validación JWT → middleware con `supabaseAdmin.auth.getUser()`
- API key Stripe en logs → eliminada
- Race condition en stock → patrón CAS con reintentos
- Sin rate-limiting → creado `rate-limit.ts`
- Admin bypass → middleware JWT + rol admin
- Descuento sin validación → validado contra BD

### 9.2 Problemas Pendientes (según auditorías recientes)

#### AUDITORIA_SEGURIDAD_API.md — 30 issues detectados
**P0 (14 críticos):**
- Endpoints admin sin autenticación interna (dependen 100% del middleware)
- `x-user-id` header spoofable en carrito, me, actualizar-perfil, solicitar-devolucion
- `user_id` del body en POST carrito
- `x-user-email` header en pedidos → IDOR
- Auth por cookie `user_role` en eliminar/actualizar-estado usuarios
- Debug endpoints expuestos
- Stock inflation en DELETE reservar.ts
- Códigos sin auth

**P1 (7 altos):**
- Cookies sin httpOnly/secure en register.ts y oauth-session.ts
- Precios del cliente en POST pedidos (endpoint legacy)
- Bug: `usos_actuales = codigoData.id` (debería ser incremento)
- ReferenceError: `userEmail` no declarada en validar-y-crear-pedido.ts
- SMTP header injection en contacto.ts
- Error de Stripe expone detalles internos

#### AUDIT_FRONTEND_COMPLETO.md — 25 issues
**P1 (5):**
- XSS en ChatBot.astro (`innerHTML` sin sanitizar respuesta IA)
- XSS en registro.astro (mensajes server en innerHTML)
- ProtectedLayout ignora props, usa solo localStorage (spoofable)
- XSS almacenado en admin/usuarios.astro (nombre de usuario en innerHTML)
- supabase.ts fallback silencioso a cliente anónimo

**P2 (8):**
- admin/estadisticas.astro usa Layout en vez de ProtectedLayout
- XSS en admin/ofertas, categorias, clientes, empresas (innerHTML sin sanitizar)
- pedidos.astro duplicado/obsoleto
- Logs de credenciales SMTP en email.ts
- Checks redundantes con localStorage en admin

**P3 (12):**
- 22 instancias de headers `x-user-id` código muerto en frontend
- Login guarda userId como `auth_token` en localStorage
- Console.log de depuración en producción
- `rutasProtegidas` vacío en middleware
- Layout-old.astro obsoleto
- Estadísticas con datos hardcodeados

#### AUDITORIA_FLUJOS_E2E.md — 21 issues
**P0 (5):**
- Cookies inconsistentes entre endpoints (httpOnly/secure)
- IDOR en actualizar-perfil, me, POST carrito, GET carrito

**P1 (7):**
- Creación de pedido client-side (sin webhook Stripe backup)
- Dos endpoints de creación de pedidos con lógica diferente
- Variable `userEmail` no declarada
- Cancelar pedido restaura variantes con datos parciales

**P2 (6):**
- Sin webhook Stripe (si el navegador cierra, pedido no se crea)
- Stock inconsistente entre cancelar y devolver
- `x-user-email` spoofable en pedidos

---

## 10. BASE DE DATOS (Tablas Principales)

| Tabla | Campos Clave |
|-------|-------------|
| `usuarios` | id, nombre, email, rol (admin/cliente/moderador), activo, telefono, direccion |
| `productos` | id, nombre, precio_centimos, stock, categoria_id, precio_por_kg, activo, imagen_url |
| `producto_variantes` | id, producto_id, peso_kg, precio_total, disponible, cantidad_disponible |
| `categorias` | id, nombre, slug, categoria_padre, orden, activa |
| `pedidos` | id, usuario_id, stripe_session_id, estado, total, email_cliente, es_invitado, codigo_seguimiento, numero_pedido |
| `pedido_items` | id, pedido_id, producto_id, cantidad, precio_unitario, subtotal, peso_kg |
| `codigos_promocionales` | id, codigo, tipo_descuento, valor_descuento, uso_maximo, usos_actuales, activo |
| `ofertas` | id, producto_id, precio_original, precio_descuento, fecha_inicio, fecha_fin, activa |
| `clientes_empresariales` | id, nombre_empresa, NIF, tipo_cliente, email_contacto, direccion_fiscal |
| `carritos` | id, usuario_id |
| `carrito_items` | id, carrito_id, producto_id, cantidad, producto_variante_id |

---

## 11. ESTADOS DE PEDIDO

```
pagado → preparando → enviado → entregado
  │                                  │
  ├→ cancelado (FINAL)               │
  └→ devolucion_solicitada ←─────────┘
         ├→ devolucion_recibida (FINAL)
         └→ devolucion_denegada
```

- **Cancelación:** Solo desde `pagado`. Incluye reembolso Stripe + restauración de stock.
- **Devolución:** Solo desde `entregado`. Admin aprueba/deniega.
- **Estados finales:** `cancelado`, `devolucion_recibida` — no modificables.

---

## 12. VARIABLES DE ENTORNO REQUERIDAS

```
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
PUBLIC_STRIPE_PUBLISHABLE_KEY
PUBLIC_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
GMAIL_USER
GMAIL_PASSWORD
```

---

## 13. RESUMEN DE RIESGOS PARA QA

### Áreas de Mayor Riesgo
1. **Checkout/Pagos** — No hay webhook Stripe; pedido depende de JS del navegador
2. **Carrito** — Varios endpoints aún con `x-user-id` spoofable
3. **Admin endpoints** — Sin auth interna (dependen 100% del middleware)
4. **XSS** — `innerHTML` sin sanitizar en 7+ archivos del frontend
5. **Códigos promocionales** — Bug en contador de usos (`usos_actuales = codigoData.id`)
6. **Cookies** — Inconsistencia httpOnly/secure entre register.ts y oauth-session.ts vs login.ts

### Endpoints Legacy/Obsoletos
- `POST /api/pedidos` — Acepta precios del cliente (legacy, no debería usarse)
- `/api/admin/productos-list.ts` — Datos hardcodeados
- `/api/admin/guardar-producto.ts` — No hace nada
- `/pedidos` (página) — Duplicado de `/mis-pedidos`
- `Layout-old.astro` — No se usa
- Debug endpoints expuestos
