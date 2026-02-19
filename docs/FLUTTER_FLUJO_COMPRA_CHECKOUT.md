# GUÍA PARA FLUTTER: CÓMO HACER UNA COMPRA SIN QUE EXPLOTE

> **Fecha**: 19 de febrero de 2026  
> **Base URL**: `https://ibericosrodriguezgonzalez.victoriafp.online`  
> **LEE TODO. NO TE SALTES NADA. CADA LÍNEA EXISTE POR UNA RAZÓN.**

---

## ⛔ LO PRIMERO: AUTENTICACIÓN

**ANTES** (ya NO funciona): `x-user-id: <UUID>` en el header.  
**AHORA** (lo único que funciona): `Authorization: Bearer <access_token>` en el header.

Si envías `x-user-id`, **SE IGNORA**. El servidor lo tira a la basura. No hace nada.

```dart
// ASÍ se obtiene el token en Flutter:
final token = Supabase.instance.client.auth.currentSession?.accessToken;

// ASÍ se pone en TODOS los headers:
final headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer $token',    // ← ESTO. SIEMPRE. EN TODAS LAS LLAMADAS.
};
```

Si el token es `null`, el usuario NO está logueado. No intentes hacer llamadas autenticadas sin token.

---

## EL FLUJO COMPLETO: 3 PASOS (EN ORDEN, SIN SALTARSE NINGUNO)

```
PASO 1 → POST /api/checkout/create-session       → Te da una URL de Stripe
PASO 2 → El usuario PAGA en esa URL de Stripe     → Stripe cobra el dinero
PASO 3 → POST /api/checkout/validar-y-crear-pedido → Crea el pedido en la BD
```

**SI TE SALTAS EL PASO 3, NO HAY PEDIDO.** Stripe cobra pero no se crea el pedido. Así que NO te lo saltes.

---

## PASO 1: Crear Sesión de Stripe

```
POST /api/checkout/create-session
```

### Headers (OBLIGATORIOS):
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Body (exactamente esto):
```json
{
  "cartItems": [
    {
      "producto_id": 5,
      "nombre": "Jamón Ibérico de Bellota",
      "cantidad": 1,
      "imagen": "https://res.cloudinary.com/..../imagen.jpg",
      "producto_variante_id": null,
      "peso_kg": null
    }
  ],
  "codigoDescuento": null,
  "datosInvitado": null,
  "userEmail": "usuario@email.com"
}
```

### Qué significa cada campo:

| Campo | Tipo | ¿Obligatorio? | Qué pasa si no lo pones |
|-------|------|----------------|-------------------------|
| `cartItems` | Array | **SÍ** | Error 400: "Carrito vacío" |
| `cartItems[].producto_id` | int | **SÍ** | El servidor no puede buscar el precio |
| `cartItems[].nombre` | string | **SÍ** | Stripe muestra "Producto sin nombre" |
| `cartItems[].cantidad` | int | **SÍ** | Se asume 1 (pero ponlo siempre) |
| `cartItems[].imagen` | string | No | Stripe no muestra imagen, no pasa nada |
| `cartItems[].producto_variante_id` | int/null | No | Se usa el precio del producto base |
| `cartItems[].peso_kg` | float/null | No | Solo para productos de peso variable |
| `codigoDescuento` | string/null | No | Sin descuento |
| `datosInvitado` | object/null | No | Solo si compra SIN login (ver abajo) |
| `userEmail` | string/null | No | Fallback, el server ya saca el email del JWT |

### ⚠️ COSAS QUE NO DEBES ENVIAR:

- **NO envíes precios**. Ni `precio`, ni `precio_unitario`, ni `precio_centimos`. El servidor los busca en la base de datos. Lo que envíes se ignora.
- **NO envíes `user_id`**. Se saca del JWT automáticamente.

### Respuesta si todo va bien (200):
```json
{
  "success": true,
  "sessionId": "cs_test_a1b2c3d4e5f6...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_a1b2c3..."
}
```

### LO QUE TIENES QUE HACER CON LA RESPUESTA:

1. **GUARDAR `sessionId`** → Lo necesitas para el PASO 3. Si lo pierdes, no puedes crear el pedido.
2. **GUARDAR los `cartItems` originales** → Los necesitas EXACTAMENTE IGUALES en el PASO 3.
3. **GUARDAR `codigoDescuento`** si lo usaste → También lo necesitas en el PASO 3.
4. **ABRIR `url`** en un WebView o navegador externo → Ahí el usuario paga.

```dart
// Ejemplo Dart COMPLETO:
final response = await http.post(
  Uri.parse('$baseUrl/api/checkout/create-session'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $accessToken',  // ← OBLIGATORIO
  },
  body: jsonEncode({
    'cartItems': cartItems.map((item) => ({
      'producto_id': item.productoId,       // ← int, OBLIGATORIO
      'nombre': item.nombre,                 // ← string, OBLIGATORIO
      'cantidad': item.cantidad,             // ← int, OBLIGATORIO
      'imagen': item.imagenUrl,              // ← string o null
      'producto_variante_id': item.varianteId, // ← int o null
      'peso_kg': item.pesoKg,                // ← double o null
    })).toList(),
    'codigoDescuento': codigoDescuento,      // ← string o null
    'datosInvitado': null,                    // ← null si está logueado
    'userEmail': userEmail,                   // ← string o null (fallback)
  }),
);

if (response.statusCode == 200) {
  final data = jsonDecode(response.body);
  
  // ⬇️ GUARDA ESTAS TRES COSAS. LAS NECESITAS LUEGO.
  final String sessionId = data['sessionId'];
  final String stripeUrl = data['url'];
  // cartItems y codigoDescuento ya los tienes en memoria
  
  // Abrir stripeUrl en WebView
}
```

### Errores posibles:

| Status | Body | Causa |
|--------|------|-------|
| 400 | `{"error": "Carrito vacío"}` | `cartItems` está vacío o es null |
| 400 | `{"error": "Email del cliente no disponible"}` | No hay email ni en JWT ni en body |
| 400 | `{"error": "Uno o más productos no tienen precio válido..."}` | `producto_id` no existe en la BD |
| 500 | `{"error": "Error creando sesión de pago"}` | Error de Stripe o del servidor |
| 500 | `{"error": "Configuración de pago no disponible..."}` | STRIPE_SECRET_KEY no configurada en el server |

---

## PASO 2: El Usuario Paga en Stripe

Abres la URL del paso 1 en un WebView. El usuario mete su tarjeta y paga.

**Cuando Stripe termina**, redirige a la URL de éxito que incluye el `session_id` como query param:  
`https://ibericosrodriguezgonzalez.victoriafp.online/checkout/exito?session_id=cs_test_a1b2c3...`

En Flutter, puedes detectar esto interceptando la navegación del WebView.

**NO necesitas hacer nada más en este paso.** Solo esperar a que el usuario termine de pagar.

---

## PASO 3: Validar Pago y Crear el Pedido en la BD

**ESTE ES EL PASO QUE CREA EL PEDIDO.** Si no lo llamas, Stripe cobra pero el pedido NO existe en la BD.

```
POST /api/checkout/validar-y-crear-pedido
```

### Headers (OBLIGATORIOS):
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Body (exactamente esto):
```json
{
  "sessionId": "cs_test_a1b2c3d4e5f6...",
  "cartItems": [
    {
      "producto_id": 5,
      "nombre": "Jamón Ibérico de Bellota",
      "cantidad": 1,
      "producto_variante_id": null,
      "peso_kg": null
    }
  ],
  "codigoDescuento": null,
  "datosInvitado": null
}
```

### ⚠️⚠️⚠️ ATENCIÓN:

- **`sessionId`**: Es el que te devolvió el PASO 1. Si lo perdiste, estás jodido. Guárdalo.
- **`cartItems`**: Tienen que ser **LOS MISMOS** items que enviaste en el PASO 1. Mismos `producto_id`, mismas cantidades. Si envías items diferentes, los totales no cuadrarán.
- **`codigoDescuento`**: Si usaste uno en el PASO 1, envíalo también aquí. Si no usaste ninguno, pon `null`.
- **`datosInvitado`**: Si era invitado en el PASO 1, envíalo también aquí. Si no, `null`.

### Qué hace el servidor internamente:

1. Comprueba si ya existe un pedido con ese `sessionId` (por idempotencia). Si ya existe, devuelve el pedido existente sin crear uno nuevo. **Esto significa que puedes llamar a este endpoint 2, 3 o 50 veces con el mismo sessionId y no se crean pedidos duplicados**.
2. Verifica contra Stripe que `payment_status === 'paid'`. Si el usuario no pagó, devuelve error 400.
3. Busca los precios reales de los productos en la BD (no usa los precios del body).
4. Inserta el pedido en la tabla `pedidos` con estos campos:

```
pedidos:
├── usuario_id          → UUID del JWT (o null si invitado)
├── stripe_session_id   → El sessionId que enviaste (UNIQUE)
├── numero_pedido       → Auto-generado: "PED-1708300000000-0001"
├── estado              → 'pagado'
├── subtotal            → Calculado desde precios de BD (se pone 0 primero y se actualiza después)
├── envio               → 5.00 € (fijo)
├── impuestos           → 0
├── total               → subtotal + envio
├── email_cliente       → Del JWT, o datosInvitado, o session.customer_email
├── telefono_cliente    → Del perfil del usuario o datosInvitado
├── direccion_envio     → De Stripe shipping_details, o perfil usuario, o datosInvitado
├── fecha_pago          → NOW()
├── es_invitado         → true/false
└── codigo_seguimiento  → Auto-generado por TRIGGER de la BD: "IRG-XXXXXXXX"
```

5. Inserta los items en `pedido_items`:

```
pedido_items:
├── pedido_id           → ID del pedido recién creado
├── producto_id         → Del cartItem
├── producto_variante_id → Del cartItem (puede ser null)
├── nombre_producto     → Del cartItem.nombre
├── cantidad            → Del cartItem.cantidad
├── precio_unitario     → Calculado desde BD (en EUROS, no centimos)
├── subtotal            → precio_unitario × cantidad
└── peso_kg             → Del cartItem (puede ser null)
```

6. Si hay variantes vendidas (`producto_variante_id` no null), las ELIMINA de la tabla `producto_variantes`.
7. Vacía el carrito del usuario.
8. Actualiza el pedido con los totales correctos calculados desde los items.
9. Envía email de confirmación.
10. Devuelve la respuesta.

### Respuesta si todo va bien (200):
```json
{
  "success": true,
  "pedidoId": 42,
  "numeroPedido": "PED-1708300000000-0001",
  "codigoSeguimiento": "IRG-A3F8B2C1",
  "total": 52.50,
  "message": "Pedido creado exitosamente"
}
```

### Respuesta si ya existía el pedido (200, idempotente):
```json
{
  "success": true,
  "pedidoId": 42,
  "numeroPedido": "PED-1708300000000-0001",
  "codigoSeguimiento": "IRG-A3F8B2C1",
  "total": 52.50,
  "message": "Pedido ya existente (idempotente)"
}
```

### Errores posibles:

| Status | Body | Causa | Solución |
|--------|------|-------|----------|
| 400 | `{"error": "No hay sessionId"}` | No enviaste `sessionId` en el body | Envía el sessionId del PASO 1 |
| 400 | `{"error": "El pago no fue completado", "status": "unpaid"}` | El usuario no pagó todavía | Espera a que pague antes de llamar |
| 400 | `{"error": "No hay email del cliente"}` | No hay email ni en JWT, ni en invitado, ni en Stripe | Pasa `userEmail` en PASO 1 |
| 500 | `{"error": "Error al crear pedido en BD", "details": {...}}` | Error de la BD (ver abajo) | Lee los detalles del error |
| 500 | `{"error": "Error al crear items del pedido", "details": {...}}` | Error insertando items | Lee los detalles del error |

### Ejemplo Dart COMPLETO:

```dart
Future<Map<String, dynamic>?> validarYCrearPedido({
  required String sessionId,
  required List<CartItem> cartItems,
  String? codigoDescuento,
}) async {
  final token = Supabase.instance.client.auth.currentSession?.accessToken;
  if (token == null) {
    throw Exception('No hay sesión activa');
  }

  final response = await http.post(
    Uri.parse('$baseUrl/api/checkout/validar-y-crear-pedido'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',   // ← OBLIGATORIO
    },
    body: jsonEncode({
      'sessionId': sessionId,              // ← OBLIGATORIO, del PASO 1
      'cartItems': cartItems.map((item) => ({
        'producto_id': item.productoId,    // ← int, OBLIGATORIO
        'nombre': item.nombre,              // ← string, OBLIGATORIO
        'cantidad': item.cantidad,          // ← int, OBLIGATORIO
        'producto_variante_id': item.varianteId, // ← int o null
        'peso_kg': item.pesoKg,             // ← double o null
      })).toList(),
      'codigoDescuento': codigoDescuento,  // ← string o null (el MISMO del PASO 1)
      'datosInvitado': null,                // ← null si está logueado
    }),
  );

  final data = jsonDecode(response.body);
  
  if (response.statusCode == 200 && data['success'] == true) {
    return {
      'pedidoId': data['pedidoId'],
      'numeroPedido': data['numeroPedido'],
      'codigoSeguimiento': data['codigoSeguimiento'],
      'total': data['total'],
    };
  } else {
    throw Exception(data['error'] ?? 'Error desconocido');
  }
}
```

---

## ERRORES COMUNES DE LA BD Y CÓMO EVITARLOS

### Error: `"violates not-null constraint"` en `numero_pedido`
**Causa**: Esto NO debería pasar porque el server lo genera. Si pasa, es un bug del server, no de Flutter.

### Error: `"violates foreign key constraint"` en `usuario_id`
**Causa**: El `usuario_id` extraído del JWT no existe en la tabla `usuarios`.  
**Solución**: Asegúrate de que el usuario tiene una fila en la tabla `usuarios` de Supabase. Si se registró por OAuth y no se creó la fila, ese es el problema.

### Error: `"violates foreign key constraint"` en `producto_id`
**Causa**: El `producto_id` que enviaste en `cartItems` no existe en la tabla `productos`.  
**Solución**: Verifica que el `producto_id` es un ID real de un producto que existe.

### Error: `"violates foreign key constraint"` en `producto_variante_id`
**Causa**: La variante ya se vendió y fue eliminada de la BD, o el ID es incorrecto.  
**Solución**: Verifica que la variante existe antes de enviar el pedido. Si se vendió, el producto no está disponible.

### Error: `"duplicate key value violates unique constraint"` en `stripe_session_id`
**Causa**: Ya existe un pedido con ese `sessionId`. Esto NO es un error de verdad — el endpoint es idempotente y devuelve el pedido existente con status 200. Si te da este error, es que algo raro está pasando en el server.

### Error: `"duplicate key value violates unique constraint"` en `numero_pedido`
**Causa**: Colisión de timestamp (extremadamente raro). El server debería reintentar.

---

## ESQUEMA EXACTO DE LA BD (para que no inventes columnas que no existen)

### Tabla `pedidos`:
```sql
id                    SERIAL PRIMARY KEY          -- Auto-generado, no envíes
usuario_id            UUID (nullable)             -- Del JWT, puede ser NULL si invitado
stripe_session_id     VARCHAR(255) UNIQUE         -- Del sessionId de Stripe
numero_pedido         VARCHAR(50) UNIQUE NOT NULL  -- Auto-generado por el server
estado                VARCHAR(50) DEFAULT 'pendiente'  -- El server pone 'pagado'
subtotal              NUMERIC(10,2) NOT NULL       -- Calculado por el server
envio                 NUMERIC(10,2) DEFAULT 0      -- El server pone 5.00
impuestos             NUMERIC(10,2) DEFAULT 0      -- El server pone 0
total                 NUMERIC(10,2) NOT NULL       -- Calculado por el server
direccion_envio       TEXT                          -- De Stripe o del perfil
email_cliente         VARCHAR(100)                 -- Del JWT o datosInvitado
telefono_cliente      VARCHAR(20)                  -- Del perfil o datosInvitado
notas_pedido          TEXT                          -- No se usa en el checkout
fecha_creacion        TIMESTAMP DEFAULT NOW()      -- Auto
fecha_pago            TIMESTAMP                    -- El server pone NOW()
fecha_envio           TIMESTAMP                    -- NULL hasta que se envíe
fecha_entrega         TIMESTAMP                    -- NULL hasta que se entregue
-- Columnas añadidas después del schema original:
nombre_cliente        VARCHAR(150)                 -- Para invitados
es_invitado           BOOLEAN DEFAULT FALSE        -- true si no hay JWT
codigo_seguimiento    VARCHAR(20) UNIQUE           -- Auto-generado por TRIGGER
estado_seguimiento    VARCHAR(20) DEFAULT 'pagado' -- 'pagado'|'enviado'|'entregado'
descuento_aplicado    DECIMAL(10,2) DEFAULT 0      -- Descuento en euros
```

### Tabla `pedido_items`:
```sql
id                    SERIAL PRIMARY KEY          -- Auto-generado
pedido_id             INT NOT NULL                -- FK → pedidos.id
producto_id           INT NOT NULL                -- FK → productos.id
producto_variante_id  INT                         -- FK → producto_variantes.id (nullable)
nombre_producto       VARCHAR(255) NOT NULL        -- Nombre del producto
cantidad              INT NOT NULL                 -- Cantidad comprada
precio_unitario       NUMERIC(10,2) NOT NULL       -- En EUROS (no céntimos)
subtotal              NUMERIC(10,2) NOT NULL       -- precio_unitario × cantidad
peso_kg               NUMERIC(10,3)               -- Peso en kg (nullable)
fecha_creacion        TIMESTAMP DEFAULT NOW()      -- Auto
```

### ⚠️ NOTA IMPORTANTE SOBRE PRECIOS:

- En la tabla `productos`, los precios están en **CÉNTIMOS** (`precio_centimos`).
- En la tabla `pedido_items`, los precios están en **EUROS** (`precio_unitario`).
- El server hace la conversión: `precio_unitario = precio_centimos / 100`.
- **Tú NO tienes que hacer nada con esto.** El server lo calcula todo. Tú solo envías `producto_id` y `cantidad`.

---

## EL FLUJO COMPLETO EN DART (COPIA ESTO Y ÚSALO)

```dart
class CheckoutService {
  final String baseUrl;
  
  CheckoutService(this.baseUrl);
  
  String? get _token => 
    Supabase.instance.client.auth.currentSession?.accessToken;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  /// PASO 1: Crear sesión de Stripe
  /// Devuelve {sessionId, url} o lanza excepción
  Future<Map<String, String>> crearSesionStripe({
    required List<Map<String, dynamic>> cartItems,
    String? codigoDescuento,
    String? userEmail,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/checkout/create-session'),
      headers: _headers,
      body: jsonEncode({
        'cartItems': cartItems,
        'codigoDescuento': codigoDescuento,
        'datosInvitado': null,
        'userEmail': userEmail,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode != 200 || data['success'] != true) {
      throw Exception(data['error'] ?? 'Error creando sesión');
    }

    return {
      'sessionId': data['sessionId'],
      'url': data['url'],
    };
  }

  /// PASO 3: Validar pago y crear pedido
  /// Llamar DESPUÉS de que el usuario pague en Stripe
  Future<Map<String, dynamic>> validarYCrearPedido({
    required String sessionId,
    required List<Map<String, dynamic>> cartItems,
    String? codigoDescuento,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/checkout/validar-y-crear-pedido'),
      headers: _headers,
      body: jsonEncode({
        'sessionId': sessionId,
        'cartItems': cartItems,       // ← LOS MISMOS del paso 1
        'codigoDescuento': codigoDescuento, // ← EL MISMO del paso 1
        'datosInvitado': null,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode != 200 || data['success'] != true) {
      throw Exception(data['error'] ?? 'Error creando pedido');
    }

    return data;
  }

  /// FLUJO COMPLETO DE COMPRA
  Future<void> comprar({
    required List<Map<String, dynamic>> cartItems,
    String? codigoDescuento,
    String? userEmail,
    required Function(String url) abrirWebView,
    required Function() esperarRetornoDeStripe,
    required Function(Map<String, dynamic> pedido) onPedidoCreado,
  }) async {
    // 1. Crear sesión
    final sesion = await crearSesionStripe(
      cartItems: cartItems,
      codigoDescuento: codigoDescuento,
      userEmail: userEmail,
    );

    // 2. Abrir Stripe para que pague
    abrirWebView(sesion['url']!);
    await esperarRetornoDeStripe();

    // 3. Crear pedido (con los MISMOS datos del paso 1)
    final pedido = await validarYCrearPedido(
      sessionId: sesion['sessionId']!,   // ← Del paso 1
      cartItems: cartItems,               // ← MISMOS items
      codigoDescuento: codigoDescuento,   // ← MISMO código
    );

    onPedidoCreado(pedido);
  }
}
```

### Cómo construir cada item del carrito para enviarlo:

```dart
// ESTO es lo que tienes que enviar en cartItems.
// Cada item es un Map<String, dynamic> con EXACTAMENTE estos campos:
List<Map<String, dynamic>> buildCartItems(List<ProductoEnCarrito> items) {
  return items.map((item) => {
    return {
      'producto_id': item.productoId,               // int, OBLIGATORIO
      'nombre': item.nombreProducto,                  // String, OBLIGATORIO  
      'cantidad': item.cantidad,                      // int, OBLIGATORIO, mínimo 1
      'imagen': item.imagenUrl,                       // String? (puede ser null)
      'producto_variante_id': item.varianteId,       // int? (null si no tiene variante)
      'peso_kg': item.pesoKg,                         // double? (null si no es peso variable)
      // ⛔ NO pongas 'precio', 'user_id', ni nada más
    };
  }).toList();
}
```

---

## APIs DEL CARRITO

| Método | Endpoint | Auth | Body |
|--------|----------|------|------|
| `GET` | `/api/carrito` | **SÍ** `Bearer` | — |
| `POST` | `/api/carrito` | **SÍ** `Bearer` | `{producto_id, cantidad, producto_variante_id?, peso_kg?}` **SIN user_id** |
| `PUT` | `/api/carrito/{itemId}` | **SÍ** `Bearer` | `{cantidad}` |
| `DELETE` | `/api/carrito/{itemId}` | **SÍ** `Bearer` | — |
| `DELETE` | `/api/carrito/vaciar` | **SÍ** `Bearer` | — |

### Ejemplo: Añadir al carrito

```dart
final response = await http.post(
  Uri.parse('$baseUrl/api/carrito'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  },
  body: jsonEncode({
    'producto_id': 5,          // ← OBLIGATORIO
    'cantidad': 2,             // ← OBLIGATORIO
    'producto_variante_id': null, // ← o el ID de la variante
    'peso_kg': null,           // ← o el peso si es variable
    // ⛔ NO pongas 'user_id'. Se saca del JWT automáticamente.
  }),
);
```

---

## FLUJO PARA INVITADOS (SIN LOGIN)

Mismos endpoints, pero:
- **NO** enviar header `Authorization`
- **SÍ** enviar `datosInvitado` en el body de `create-session` y `validar-y-crear-pedido`
- Reservar stock con `POST /api/carrito/reservar` (no requiere auth)

```json
{
  "datosInvitado": {
    "email": "invitado@email.com",
    "nombre": "Juan Pérez",
    "telefono": "612345678",
    "direccion": "Calle Ejemplo 1, 28001 Madrid"
  }
}
```

Rate-limit en reservar: 30 peticiones/minuto por IP.

---

## CÓDIGOS DE ERROR HTTP

| Status | Qué significa | Qué hacer en Flutter |
|--------|---------------|----------------------|
| 200 | Todo OK | Procesar `response.body` |
| 400 | Datos mal enviados | Leer `error` del body y mostrar al usuario |
| 401 | Token expirado o no enviaste auth | Refrescar el token con Supabase y reintentar |
| 429 | Demasiadas peticiones | Esperar 60 segundos y reintentar |
| 500 | Error del servidor | Mostrar "Error del servidor, reinténtalo" |

---

## CHECKLIST ANTES DE ENVIAR UN PEDIDO

- [ ] ¿Tienes el `accessToken`? → `Supabase.instance.client.auth.currentSession?.accessToken`
- [ ] ¿Lo pones en el header `Authorization: Bearer <token>`?
- [ ] ¿`cartItems` tiene al menos 1 item?
- [ ] ¿Cada item tiene `producto_id` (int), `nombre` (string) y `cantidad` (int)?
- [ ] ¿Guardaste el `sessionId` del PASO 1?
- [ ] ¿Esperaste a que el usuario PAGUE en Stripe antes de llamar al PASO 3?
- [ ] ¿En el PASO 3 enviaste los MISMOS `cartItems` y `codigoDescuento` que en el PASO 1?
- [ ] ¿NO estás enviando precios, user_id, ni campos inventados?

Si la respuesta a todas es SÍ, funcionará. Si alguna es NO, ahí está tu error.

---

## RESUMEN DE CAMBIOS VS LA VERSIÓN ANTERIOR

| Qué cambió | ANTES (roto) | AHORA (funciona) |
|-------------|-------------|-------------------|
| Auth header | `x-user-id: <UUID>` | `Authorization: Bearer <JWT>` |
| POST carrito body | incluía `user_id` | **NO incluir** `user_id` |
| Precios en checkout | el cliente enviaba precios | el server los recalcula desde BD |
| Doble-clic en pagar | creaba pedido duplicado | **Idempotente** (no duplica) |
| Rate-limiting | no había | login(10), register(5), contacto(5), chat(15), reservar(30) |
