# Flujo Completo de Checkout y Carrito — Análisis Detallado

> Generado el 22 de febrero de 2026. Análisis exhaustivo del flujo de compra, carrito, pagos, stock, emails, códigos y devoluciones.

---

## Índice

1. [Arquitectura General](#1-arquitectura-general)
2. [Gestión del Carrito](#2-gestión-del-carrito)
3. [Flujo de Compra Completo](#3-flujo-de-compra-completo)
4. [Gestión de Stock (Operaciones Atómicas CAS)](#4-gestión-de-stock-operaciones-atómicas-cas)
5. [Integración con Stripe](#5-integración-con-stripe)
6. [Sistema de Emails](#6-sistema-de-emails)
7. [Códigos Promocionales](#7-códigos-promocionales)
8. [Sistema de Ofertas](#8-sistema-de-ofertas)
9. [Cancelaciones y Devoluciones](#9-cancelaciones-y-devoluciones)
10. [Seguimiento de Pedidos](#10-seguimiento-de-pedidos)
11. [Edge Cases y Problemas Potenciales](#11-edge-cases-y-problemas-potenciales)

---

## 1. Arquitectura General

### Stack tecnológico
- **Frontend**: Astro + TypeScript
- **Backend**: Astro API Routes (SSR)
- **Base de datos**: Supabase (PostgreSQL)
- **Pagos**: Stripe Checkout Sessions
- **Emails**: Nodemailer (Gmail) + PDFKit (facturas PDF)
- **Autenticación**: JWT via `getAuthenticatedUserId()` / `requireAuth()` / `requireAdmin()`

### Endpoints principales

| Ruta | Métodos | Descripción |
|------|---------|-------------|
| `/api/carrito` | GET, POST | Obtener/agregar items al carrito |
| `/api/carrito/[id]` | PUT, DELETE | Actualizar/eliminar item del carrito |
| `/api/carrito/vaciar` | DELETE | Vaciar carrito completo |
| `/api/carrito/reservar` | POST, DELETE | Reservar/devolver stock (invitados) |
| `/api/checkout/create-session` | POST | Crear sesión de Stripe Checkout |
| `/api/checkout/validar-y-crear-pedido` | POST | Validar pago y crear pedido en BD |
| `/api/pedidos` | GET, POST | Listar/crear pedidos |
| `/api/pedidos/cancelar` | POST | Cancelar pedido + reembolso |
| `/api/pedidos/solicitar-devolucion` | POST | Solicitar devolución |
| `/api/pedidos/validar-devolucion` | POST | Admin valida devolución + reembolso |
| `/api/pedidos/denegar-devolucion` | POST | Admin deniega devolución |
| `/api/codigos/validar` | POST | Validar código promocional |
| `/api/codigos/registrar-uso` | POST | Registrar uso de código |
| `/api/codigos/verificar-uso` | GET | Verificar si usuario ya usó código |
| `/api/ofertas` | GET | Obtener ofertas activas |

---

## 2. Gestión del Carrito

### 2.1 Obtener carrito (`GET /api/carrito`)

**Autenticación**: JWT obligatorio (con fallback transitorio a cookie `user_id`).

**Flujo**:
1. Valida JWT del usuario
2. Busca el carrito más reciente del usuario en `carritos` (o crea uno nuevo)
3. Obtiene `carrito_items` con JOIN a `productos` (nombre, precio, imagen, stock)
4. Enriquece los items con:
   - **Categoría** del producto (join a `categorias`)
   - **Ofertas activas** — recalcula precio si hay oferta vigente (para productos simples usa `precio_descuento_centimos`; para variantes NO re-aplica descuento para evitar doble descuento)
   - **Stock máximo** — calcula `cantidad_en_carrito + stock_disponible` (para limitar en UI)
5. **Expiración del carrito** (15 minutos):
   - Busca el item más antiguo del carrito
   - Si tiene > 15 minutos → devuelve stock de TODOS los items (CAS atómico), elimina items, devuelve `itemsExpirados: true`
6. Retorna items con fechas normalizadas a UTC (`Z` suffix)

**Nota importante**: El GET no escribe precios en BD (respeta semántica REST). Solo recalcula para mostrar en UI.

### 2.2 Agregar al carrito (`POST /api/carrito`)

**Solo usuarios logueados** (JWT obligatorio).

**Flujo**:
1. Valida JWT, ignora `user_id` del body (seguridad)
2. Valida `producto_id`, `cantidad > 0`
3. Obtiene o crea carrito del usuario
4. Si es **variante** (`producto_variante_id`):
   - Consulta `producto_variantes` → valida disponibilidad y stock (`cantidad_disponible`)
   - Precio = `precio_total` (céntimos)
   - Aplica descuento porcentual si hay oferta activa para el producto
5. Si es **producto simple**:
   - Consulta `productos` → valida stock
   - Precio = `precio_centimos` (o `precio_descuento_centimos` si hay oferta activa)
6. Verifica si ya existe en carrito (misma variante):
   - **Sí**: incrementa cantidad. Flujo stock: decrementa stock (CAS) → actualiza carrito. Si falla el update, rollback del stock
   - **No**: crea nuevo item. Flujo stock: decrementa stock (CAS) → inserta item. Si falla insert, rollback del stock

**Patrón clave**: SIEMPRE decrementa stock PRIMERO con CAS, LUEGO modifica carrito. Si el segundo paso falla, hace rollback del stock.

### 2.3 Actualizar cantidad (`PUT /api/carrito/[id]`)

**Flujo**:
1. Valida JWT
2. Verificación IDOR: `verificarPropietarioItem()` comprueba que el item pertenece al carrito del usuario
3. Si `cantidad <= 0` → elimina item + devuelve stock (CAS)
4. Si `cantidad > anterior` → decrementa stock adicional (CAS). Si insuficiente → 400
5. Si `cantidad < anterior` → devuelve stock sobrante (CAS)
6. Actualiza cantidad en BD

### 2.4 Eliminar item (`DELETE /api/carrito/[id]`)

**Flujo**:
1. Valida JWT + verificación IDOR
2. Obtiene item antes de eliminar
3. Elimina de BD
4. Devuelve stock (CAS) — producto simple o variante

### 2.5 Vaciar carrito (`DELETE /api/carrito/vaciar`)

**Flujo**:
1. Valida JWT
2. Obtiene todos los items del carrito
3. Devuelve stock de CADA item (CAS, uno por uno)
4. Elimina todos los items de BD

### 2.6 Reservar stock para invitados (`POST/DELETE /api/carrito/reservar`)

**Rate-limited**: 30 requests/minuto por IP.

Este endpoint se usa para invitados que no tienen carrito en BD. Gestiona solo el stock:
- **POST**: Decrementa stock cuando invitado agrega producto
- **DELETE**: Devuelve stock cuando invitado elimina producto

No requiere JWT estricto, pero logea si no hay identificador (prevención de abuso).

---

## 3. Flujo de Compra Completo

### 3.1 Flujo de usuario logueado

```
┌─────────────────────────────────────────────────────────┐
│  1. AGREGAR AL CARRITO                                  │
│  POST /api/carrito                                      │
│  → Stock decrementado atómicamente (CAS)                │
│  → Item guardado en BD (carrito_items)                  │
├─────────────────────────────────────────────────────────┤
│  2. APLICAR CÓDIGO DESCUENTO (opcional)                 │
│  POST /api/codigos/validar                              │
│  → Valida fechas, usos, monto mínimo                   │
│  → Calcula descuento (porcentaje o fijo)                │
├─────────────────────────────────────────────────────────┤
│  3. CREAR SESIÓN STRIPE                                 │
│  POST /api/checkout/create-session                      │
│  → Precios recalculados desde BD (NUNCA del cliente)    │
│  → Ofertas activas aplicadas server-side                │
│  → Descuento validado contra BD, cupón Stripe creado    │
│  → Email del usuario obtenido de BD                     │
│  → Dirección: si tiene → payment_intent_data.shipping   │
│                si no  → shipping_address_collection     │
│  → Retorna sessionId + url de Stripe                    │
├─────────────────────────────────────────────────────────┤
│  4. PAGO EN STRIPE                                      │
│  (Redirect a Stripe Checkout — externo)                 │
├─────────────────────────────────────────────────────────┤
│  5. ÉXITO → /checkout/exito?session_id=xxx              │
│  (Página Astro — client-side JavaScript)                │
│  → Obtiene carrito de BD (o localStorage si invitado)   │
│  → Llama a /api/checkout/validar-y-crear-pedido         │
│  → Limpia localStorage                                  │
│  → Redirect automático a /mis-pedidos (10s)             │
├─────────────────────────────────────────────────────────┤
│  6. VALIDAR Y CREAR PEDIDO                              │
│  POST /api/checkout/validar-y-crear-pedido              │
│  → Idempotencia: verifica si ya existe pedido con       │
│    ese session_id (detecta y limpia "pedidos fantasma") │
│  → Verifica payment_status === 'paid' en Stripe         │
│  → Recalcula totales desde BD                           │
│  → Genera numero_pedido correlativo (PED-AXXXXX)        │
│  → Crea pedido en BD (con retry por colisión UNIQUE)    │
│  → Crea pedido_items desde precios de BD                │
│  → Rollback si falla items: elimina pedido fantasma     │
│  → Recalcula y actualiza totales del pedido             │
│  → Vacía carrito del usuario                            │
│  → Envía email de confirmación con factura PDF          │
│  → Retorna codigoSeguimiento (generado por trigger DB)  │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Flujo de invitado (guest checkout)

```
┌─────────────────────────────────────────────────────────┐
│  1. AGREGAR AL CARRITO (localStorage)                   │
│  + POST /api/carrito/reservar (decrementar stock)       │
│  → Carrito en localStorage (carrito_invitado)           │
│  → Stock reservado en BD via CAS                        │
├─────────────────────────────────────────────────────────┤
│  2. DATOS DE INVITADO                                   │
│  → nombre, email, telefono, direccion                   │
│  → Guardados en localStorage (checkout_invitado)        │
├─────────────────────────────────────────────────────────┤
│  3. CREAR SESIÓN STRIPE                                 │
│  POST /api/checkout/create-session                      │
│  → datosInvitado en body                                │
│  → customerEmail = datosInvitado.email (prioridad)      │
│  → Si invitado tiene dirección → payment_intent_data    │
│  → metadata.es_invitado = 'true'                        │
│  → success_url incluye &guest=true                      │
├─────────────────────────────────────────────────────────┤
│  4-5. PAGO + ÉXITO (igual que logueado)                 │
│  → En exito.astro: obtiene carrito de localStorage      │
│  → Incluye datosInvitado del localStorage               │
├─────────────────────────────────────────────────────────┤
│  6. VALIDAR Y CREAR PEDIDO                              │
│  → Busca si existe usuario con email del invitado       │
│    → Si encuentra: vincula pedido a esa cuenta          │
│    → Si no: pedido con es_invitado=true, usuario_id=null│
│  → Misma lógica de creación que logueado                │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Vinculación de pedidos de invitado

En `validar-y-crear-pedido.ts`, si el invitado compra con un email de un usuario registrado:
- Se busca por `email` en tabla `usuarios`
- Si existe → `finalUserId = usuarioExistente.id`, `esInvitado = false`
- El pedido queda vinculado a la cuenta existente

---

## 4. Gestión de Stock (Operaciones Atómicas CAS)

### Patrón Compare-And-Swap (CAS)

Archivo: `src/lib/stock.ts`

**Principio**: Evita race conditions sin funciones RPC. Lee stock → intenta UPDATE con `WHERE stock = valor_leido`. Si otro proceso modificó entre medias, no coincide y se reintenta.

**Implementación**:
```
MAX_RETRIES = 5
Delay exponencial: min(50 * 2^intento, 500) + random(0-30) ms

decrementarStockProducto(productoId, cantidad):
  loop (max 5):
    stock = SELECT stock FROM productos WHERE id = X
    if stock < cantidad → error "Stock insuficiente"
    nuevoStock = stock - cantidad
    UPDATE productos SET stock = nuevoStock WHERE id = X AND stock = stock_leido
    if rows_affected > 0 → éxito
    else → CAS falló, reintentar
```

### 4 funciones disponibles:

| Función | Tabla | Campo |
|---------|-------|-------|
| `decrementarStockProducto` | `productos` | `stock` |
| `incrementarStockProducto` | `productos` | `stock` |
| `decrementarStockVariante` | `producto_variantes` | `cantidad_disponible` + `disponible` |
| `incrementarStockVariante` | `producto_variantes` | `cantidad_disponible` + `disponible` |

**Para variantes**: además actualiza el campo `disponible` (boolean) cuando `cantidad_disponible` llega a 0.

### Momentos donde se gestiona stock:

| Evento | Acción stock |
|--------|-------------|
| Agregar al carrito (logged) | Decrementa (CAS) |
| Reservar stock (invitado) | Decrementa (CAS) |
| Actualizar cantidad (incremento) | Decrementa diferencia (CAS) |
| Actualizar cantidad (decremento) | Incrementa diferencia (CAS) |
| Eliminar item del carrito | Incrementa (CAS) |
| Vaciar carrito | Incrementa cada item (CAS) |
| Carrito expirado (>15 min) | Incrementa todos los items (CAS) |
| Cancelar pedido (prod. normal) | Incrementa (CAS) |
| Cancelar pedido (variante) | Recrea variante en BD |
| Crear pedido exitoso | NO decrementa (ya se decrementó al agregar al carrito) |
| Devolver stock (invitado) | Incrementa (CAS) |
| Validar devolución | NO restaura stock (decisión manual del admin) |

### Trigger automático para variantes vendidas

Los pedido_items con variante tienen un trigger `trigger_eliminar_variante_vendida` (AFTER INSERT) que elimina automáticamente la variante de `producto_variantes` cuando se vende.

---

## 5. Integración con Stripe

### Archivo: `src/lib/stripe.ts`

**Funcionalidades**:
- Instancia compartida de Stripe (`stripe`)
- `procesarReembolsoStripe(stripeSessionId, motivo)`:
  1. Recupera sesión de Checkout
  2. Extrae `payment_intent`
  3. Verifica estado reembolsable
  4. Comprueba reembolsos existentes (evita doble reembolso)
  5. Crea reembolso por el monto restante
  6. Maneja caso "already refunded" gracefully

### Create-session (`create-session.ts`)

**Seguridad — precios SIEMPRE de BD**:
- Consulta `productos` para precios base
- Consulta `producto_variantes` para precios de variantes
- Consulta `ofertas` activas para descuentos
- Construye `line_items` con `price_data.unit_amount` desde BD
- Añade envío como line item fijo (500 céntimos = 5€)
- Valida que todos los `unit_amount > 0`

**Descuento**:
- Valida `codigoDescuento` contra BD
- Verifica: activo, fechas, usos disponibles, monto mínimo
- Crea cupón Stripe temporal (`duration: 'once'`)
- Tipo porcentaje: calcula sobre subtotal en céntimos
- Tipo fijo: `valor_descuento * 100` (euros → céntimos)

**Dirección de envío**:
- Si usuario tiene dirección completa → `payment_intent_data.shipping`
- Si no → `shipping_address_collection` (países: ES, PT, FR, DE, IT, GB, AD)

### Validar-y-crear-pedido (`validar-y-crear-pedido.ts`)

**Idempotencia**:
- Busca pedido existente con `stripe_session_id`
- Si existe y tiene items → devuelve datos sin duplicar
- Si existe sin items (fantasma, total ≤ envío) → elimina y re-crea

**Generación de número de pedido**:
- Formato: `PED-LXXXXX` (letra + 5 dígitos)
- Rango: PED-A00001 → PED-Z99999 (2.599.974 pedidos)
- Retry hasta 3 veces por colisión UNIQUE

**Código de seguimiento**:
- Generado automáticamente por trigger de BD al insertar pedido

---

## 6. Sistema de Emails

### Archivo: `src/lib/email.ts` (1535 líneas)

**Transporte**: Gmail via Nodemailer (lazy initialization).

### Emails enviados en el sistema:

| Email | Función | Destinatario | Adjuntos |
|-------|---------|--------------|----------|
| Confirmación de pedido | `enviarConfirmacionPedido()` | Cliente + Admin | Factura PDF |
| Cancelación de pedido | `enviarEmailCancelacion()` | Cliente | Factura rectificativa PDF |
| Cancelación (admin) | `notificarCancelacionAlAdmin()` | Admin | Factura rectificativa PDF |
| Instrucciones devolución | `enviarEmailDevolucion()` | Cliente | Factura rectificativa PDF |
| Devolución solicitada | `notificarDevolucionAlAdmin()` | Admin | Factura rectificativa PDF |
| Devolución validada | `notificarDevolucionValidada()` | Cliente + Admin | Factura rectificativa PDF |
| Devolución denegada | `notificarDevolucionDenegada()` | Cliente | — |
| Bienvenida (registro) | `enviarEmailBienvenida()` | Cliente | — |

### PDFs generados:

1. **Factura** (`generarPDFFactura`): A4, con header de empresa, tabla de productos, desglose IVA (10%), total
2. **Factura rectificativa** (`generarPDFFacturaRectificativa`): Nota de crédito con importes negativos, referencia a factura original

### Contenido del email de confirmación:
- Detalles del pedido (número, fecha)
- Código de seguimiento con enlace a `ibericosrodriguezgonzalez.victoriafp.online/seguimiento?codigo=XXX`
- Tabla de productos con precios
- Subtotal, envío, total
- Aviso de factura adjunta
- Entrega estimada: 3-5 días hábiles

### Contenido del email de devolución:
- Instrucciones de empaquetado
- Etiqueta de devolución con código QR (API qrserver.com)
- Dirección de envío (Calle de la Moda 123, 28001 Madrid)
- Referencia del pedido
- Pasos a seguir
- Aviso: reembolso en 5-7 días hábiles

---

## 7. Códigos Promocionales

### 7.1 Validar código (`POST /api/codigos/validar`)

**Requiere**: cookie `user_id` (no JWT — posible inconsistencia de seguridad).

**Validaciones**:
1. Código existe en `codigos_promocionales`
2. Campo `activo = true`
3. Fecha actual entre `fecha_inicio` y `fecha_fin`
4. `usos_actuales < uso_maximo` (si hay límite)
5. `monto_carrito >= restriccion_monto_minimo` (si hay mínimo)

**Cálculo**:
- `porcentaje`: `monto_carrito * valor_descuento / 100`
- `fijo`: `valor_descuento` (directamente en euros)

### 7.2 Registrar uso (`POST /api/codigos/registrar-uso`)

Inserta en tabla `uso_codigos` con:
- `codigo_id`, `usuario_id`, `pedido_id`, `descuento_aplicado`, `email_usuario`

**BUG detectado**: La actualización del contador de usos hace `.update({ usos_actuales: codigoData.id })` — está usando el `id` del código en vez de `usos_actuales + 1`. Esto corrompe el contador.

### 7.3 Verificar uso (`GET /api/codigos/verificar-uso`)

Verifica si un usuario ya usó un código específico consultando `uso_codigos`.

**Nota de seguridad**: Usa `x-user-id` header (spoofable) en vez de JWT.

### 7.4 Validación en checkout (server-side)

En `create-session.ts` y `validar-y-crear-pedido.ts`, el código se re-valida completamente contra BD. Nunca se confía en el valor del cliente.

---

## 8. Sistema de Ofertas

### Endpoint (`GET /api/ofertas`)

Retorna ofertas activas con JOIN a `productos`. Filtros:
- `activa = true`
- `fecha_inicio <= ahora`
- `fecha_fin >= ahora`
- Ordenado por `orden` ASC, luego `fecha_fin` ASC

### Campos de oferta:
- `producto_id`, `nombre_oferta`, `descripcion`
- `precio_original_centimos`, `precio_descuento_centimos`
- `porcentaje_descuento`
- `fecha_inicio`, `fecha_fin`, `imagen_url`, `orden`

### Aplicación de ofertas:

Las ofertas se aplican en múltiples puntos:

1. **Al agregar al carrito** (`POST /api/carrito`):
   - Productos simples: usa `precio_descuento_centimos` como `precioUnitario`
   - Variantes: aplica `porcentaje_descuento` al `precio_total` de la variante

2. **Al obtener carrito** (`GET /api/carrito`):
   - Corrige precios visualmente (sin escribir en BD)
   - Para variantes: NO re-aplica descuento (evita doble descuento)

3. **Al crear sesión Stripe** (`create-session.ts`):
   - Recalcula completamente desde BD
   - Productos simples: `precio_descuento_centimos`
   - Variantes: aplica `porcentaje_descuento`

4. **Al validar y crear pedido** (`validar-y-crear-pedido.ts`):
   - Re-calcula totales desde BD para consistencia

---

## 9. Cancelaciones y Devoluciones

### 9.1 Cancelar pedido (`POST /api/pedidos/cancelar`)

**Requiere**: JWT (`requireAuth`)

**Validaciones**:
- Propiedad: `pedido.usuario_id === userId` OR `pedido.email_cliente === userEmail`
- Estado debe ser `'pagado'`

**Flujo**:
1. Obtiene items del pedido
2. **Restaura stock**:
   - Producto normal → `incrementarStockProducto()` (CAS)
   - Variante/peso variable → **recrea la variante** en `producto_variantes` (recalcula precio desde `precio_por_kg`)
3. **Procesa reembolso en Stripe** via `procesarReembolsoStripe()`
4. Actualiza estado → `'cancelado'`
5. Envía emails (cliente + admin) en paralelo con `Promise.allSettled`
6. Adjunta factura rectificativa PDF

### 9.2 Solicitar devolución (`POST /api/pedidos/solicitar-devolucion`)

**Requiere**: JWT

**Validaciones**:
- Propiedad por `usuario_id` o `email_cliente`
- Estado: `'pagado'` o `'entregado'`

**Flujo**:
1. Actualiza estado → `'devolucion_solicitada'`
2. **NO restaura stock** (se hará cuando el admin valide)
3. Envía email al cliente con instrucciones + etiqueta QR + factura rectificativa
4. Notifica al admin

### 9.3 Validar devolución (`POST /api/pedidos/validar-devolucion`)

**Requiere**: `requireAdmin` (JWT + verificación admin en BD)

**Validaciones**:
- Estado: `'devolucion_solicitada'` o `'devolucion_recibida'`

**Flujo**:
1. **NO restaura stock** — decisión: el producto devuelto puede no estar en condiciones de venta. El admin lo repone manualmente si procede
2. **Procesa reembolso real en Stripe**
3. Actualiza estado → `'devolucion_recibida'`
4. Envía email de confirmación al cliente con factura rectificativa
5. Envía factura rectificativa al admin

### 9.4 Denegar devolución (`POST /api/pedidos/denegar-devolucion`)

**Requiere**: `requireAdmin`

**Flujo**:
1. Actualiza estado → `'devolucion_denegada'`
2. Envía email al cliente con motivo de denegación

### Diagrama de estados de pedido:

```
pagado ──┬──→ cancelado (cliente)
         ├──→ entregado (admin)
         └──→ devolucion_solicitada (cliente)
                    │
                    ├──→ devolucion_recibida (admin valida → reembolso Stripe)
                    └──→ devolucion_denegada (admin)

entregado ──→ devolucion_solicitada (cliente)
```

---

## 10. Seguimiento de Pedidos

### Obtener pedidos (`GET /api/pedidos`)

**Búsqueda**: Por `email_cliente` (no por `usuario_id`). Esto permite:
- Ver pedidos como logueado Y como invitado (si usó el mismo email)
- Obtiene email de BD si solo tiene userId

**Datos retornados**:
- Número, estado, subtotal, envío, total, fechas
- Items con nombre, cantidad, precio, peso
- Flags: `es_invitado`, datos del cliente

### Código de seguimiento

- Generado automáticamente por trigger en PostgreSQL al insertar pedido
- Se usa en la URL: `/seguimiento?codigo=XXX`
- Se incluye en el email de confirmación

---

## 11. Edge Cases y Problemas Potenciales

### Problemas encontrados

#### P1: Bug en `registrar-uso.ts` (CRÍTICO)
```typescript
// Línea actual (INCORRECTA):
.update({ usos_actuales: codigoData.id })
// Debería ser:
.update({ usos_actuales: codigoData.usos_actuales + 1 })
// O mejor, usar RPC para incremento atómico
```
Esto setea `usos_actuales` al `id` del código en vez de incrementar. Corrompe el contador de usos.

#### P2: Autenticación inconsistente en endpoints de códigos
- `validar.ts`: usa `cookies.get('user_id')` (no JWT)
- `registrar-uso.ts`: usa `request.headers.get('x-user-id')` (spoofable)
- `verificar-uso.ts`: usa `request.headers.get('x-user-id')` (spoofable)

Estos endpoints no usan `getAuthenticatedUserId()` como el resto del sistema.

#### P3: Race condition potencial en exito.astro
La página de éxito ejecuta lógica client-side que:
1. Obtiene carrito (BD o localStorage)
2. Llama a `validar-y-crear-pedido`

Si el usuario refresca la página o la abre en dos pestañas:
- **Mitigado** por idempotencia (verifica `stripe_session_id` existente)
- El carrito podría vaciarse en la primera llamada, dejando la segunda sin items → pedido fantasma
- **Mitigado** por detección de pedido fantasma (items=0, total≤envío → elimina y re-crea)

#### P4: Expiración de carrito (15 min) sin notificación previa
El carrito expira silenciosamente. Si un usuario tarda >15 min en completar el checkout:
- Su stock se devuelve
- Al volver al carrito, aparece vacío
- No hay mecanismo de aviso al usuario antes de expirar

#### P5: Stock de invitados sin expiración automática
Si un invitado reserva stock (`/api/carrito/reservar`) pero nunca completa la compra ni devuelve el stock:
- El stock queda decrementado indefinidamente
- No hay mecanismo de limpieza para reservas de invitados
- Solo los carritos de BD (usuarios logueados) tienen expiración de 15 min

#### P6: Precios del carrito pueden quedar desactualizados
Si una oferta expira después de agregar al carrito pero antes del checkout:
- El precio en `carrito_items.precio_unitario` tiene el descuento
- El checkout recalcula desde BD (el descuento habría expirado)
- El cliente podría ver un precio diferente al pagar

#### P7: Descuento en cancelación de variante usa precio con descuento
Al cancelar un pedido con variantes, si `precio_por_kg` no está disponible:
- Usa `precio_unitario` del pedido item (que ya tiene descuento aplicado)
- La variante recreada tendría un precio menor al original

#### P8: Email de cancelación calcula subtotal incorrectamente
```typescript
subtotal: Math.round((pedidoCompleto.total - 5) * 100) // total menos envío
```
Esto asume envío=5€ hardcoded y no usa el subtotal real del pedido.

### Puntos fuertes del diseño

1. **Seguridad de precios**: Nunca confía en precios del cliente. Todo se recalcula server-side desde BD
2. **Idempotencia**: Control de duplicados via `stripe_session_id`
3. **CAS para stock**: Operaciones atómicas sin necesidad de locks de BD
4. **Rollback de stock**: Si falla la inserción del item, devuelve el stock decrementado
5. **IDOR protection**: Verificación de propiedad en items del carrito
6. **JWT auth**: Migración progresiva de cookies/headers a JWT
7. **Reembolsos inteligentes**: Verifica reembolsos existentes antes de crear nuevos
8. **Emails no bloqueantes**: Fallos de email no impiden la operación principal
9. **Facturación automática**: PDFs de factura y factura rectificativa generados automáticamente
10. **Vinculación de pedidos de invitado**: Reconoce emails de usuarios existentes
