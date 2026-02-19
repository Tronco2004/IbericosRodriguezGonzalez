# Cambios en la API REST — Guía para Flutter

> **Fecha**: 19 de febrero de 2026  
> **IMPORTANTE**: Este documento REEMPLAZA la guía anterior (`FLUTTER_API_CAMBIOS.md`).  
> **Base URL**: `https://ibericosrodriguezgonzalez.victoriafp.online`

---

## CAMBIO PRINCIPAL: Autenticación por JWT real

**ANTES**: Los endpoints aceptaban el header `x-user-id: <UUID>` (un UUID en texto plano, fácil de falsificar).

**AHORA**: Todos los endpoints protegidos requieren un **JWT real de Supabase** vía:

```
Authorization: Bearer <access_token_de_supabase>
```

El header `x-user-id` **YA NO SE ACEPTA** en ningún endpoint. Si lo envías, se ignora.

---

## 1. CÓMO OBTENER EL JWT (access_token)

### Opción A: Login con email/password (vía API)

```dart
final response = await http.post(
  Uri.parse('$baseUrl/api/auth/login'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'email': 'usuario@correo.com',
    'password': 'contraseña',
  }),
);
```

La respuesta incluye cookies server-side (`auth_token`, `user_id`), pero para Flutter necesitas el token directamente. **Usa el SDK de Supabase para Flutter**:

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

// Login
final response = await Supabase.instance.client.auth.signInWithPassword(
  email: 'usuario@correo.com',
  password: 'contraseña',
);

// ✅ Este es el JWT que necesitas para TODAS las llamadas
final String accessToken = response.session!.accessToken;
```

### Opción B: Login OAuth (Google)

```dart
final response = await Supabase.instance.client.auth.signInWithOAuth(
  OAuthProvider.google,
);
// Después del callback:
final String accessToken = Supabase.instance.client.auth.currentSession!.accessToken;
```

### Guardar y refrescar el token

```dart
// El SDK de Supabase refresca automáticamente el token.
// Para obtener el token actual en cualquier momento:
String? getToken() {
  return Supabase.instance.client.auth.currentSession?.accessToken;
}
```

---

## 2. CÓMO ENVIAR EL JWT EN CADA PETICIÓN

```dart
final token = Supabase.instance.client.auth.currentSession?.accessToken;

final response = await http.get(
  Uri.parse('$baseUrl/api/carrito'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',  // ← OBLIGATORIO
  },
);
```

---

## 3. ENDPOINTS MODIFICADOS (Breaking Changes)

### 3.1 Carrito

#### `GET /api/carrito` — Obtener carrito del usuario

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header | `Authorization: Bearer <JWT>` |

```dart
// ❌ ANTES
final response = await http.get(
  Uri.parse('$baseUrl/api/carrito'),
  headers: {'x-user-id': userId},
);

// ✅ AHORA
final response = await http.get(
  Uri.parse('$baseUrl/api/carrito'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
```

#### `POST /api/carrito` — Añadir producto al carrito

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `user_id` en el body JSON | `Authorization: Bearer <JWT>` |
| Body | `{producto_id, cantidad, user_id, producto_variante_id?, peso_kg?}` | `{producto_id, cantidad, producto_variante_id?, peso_kg?}` |

**`user_id` en el body se IGNORA.** El servidor extrae el usuario del JWT.

```dart
// ❌ ANTES
final response = await http.post(
  Uri.parse('$baseUrl/api/carrito'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'producto_id': 5,
    'cantidad': 2,
    'user_id': userId,  // ← YA NO SE USA
  }),
);

// ✅ AHORA
final response = await http.post(
  Uri.parse('$baseUrl/api/carrito'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $accessToken',
  },
  body: jsonEncode({
    'producto_id': 5,
    'cantidad': 2,
    // user_id ya NO va en el body
  }),
);
```

#### `PUT /api/carrito/[id]` — Actualizar cantidad de item

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header | `Authorization: Bearer <JWT>` |

#### `DELETE /api/carrito/[id]` — Eliminar item del carrito

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header | `Authorization: Bearer <JWT>` |

#### `DELETE /api/carrito/vaciar` — Vaciar carrito completo

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header | `Authorization: Bearer <JWT>` |

---

### 3.2 Auth / Perfil

#### `GET /api/auth/me` — Obtener datos del usuario actual

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header | `Authorization: Bearer <JWT>` |

```dart
// ✅ AHORA
final response = await http.get(
  Uri.parse('$baseUrl/api/auth/me'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
// Respuesta: { success: true, usuario: { id, email, nombre, telefono, direccion, rol, provider, tienePassword } }
```

#### `POST /api/auth/actualizar-perfil` — Actualizar datos del perfil

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header | `Authorization: Bearer <JWT>` |

```dart
// ✅ AHORA
final response = await http.post(
  Uri.parse('$baseUrl/api/auth/actualizar-perfil'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $accessToken',
  },
  body: jsonEncode({
    'nombre': 'Nuevo Nombre',
    'telefono': '612345678',
    'direccion': 'Calle Example 1',
  }),
);
```

#### `POST /api/auth/cambiar-contrasena` — Cambiar contraseña

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header | `Authorization: Bearer <JWT>` |

#### `POST /api/auth/establecer-contrasena` — Establecer contraseña (OAuth users)

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header | `Authorization: Bearer <JWT>` |

---

### 3.3 Pedidos

#### `GET /api/pedidos` — Listar pedidos del usuario

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header | `Authorization: Bearer <JWT>` |

#### `POST /api/pedidos/cancelar` — Cancelar pedido

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header | `Authorization: Bearer <JWT>` |

#### `POST /api/pedidos/solicitar-devolucion` — Solicitar devolución

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header | `Authorization: Bearer <JWT>` |

```dart
// ✅ AHORA
final response = await http.post(
  Uri.parse('$baseUrl/api/pedidos/solicitar-devolucion'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $accessToken',
  },
  body: jsonEncode({'pedido_id': pedidoId}),
);
```

#### `POST /api/pedidos/validar-devolucion` — Aprobar devolución (ADMIN)

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | middleware + `x-user-id` | middleware + `Authorization: Bearer <JWT>` |

#### `POST /api/pedidos/denegar-devolucion` — Denegar devolución (ADMIN)

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | middleware + `x-user-id` | middleware + `Authorization: Bearer <JWT>` |

---

### 3.4 Checkout

#### `POST /api/checkout/create-session` — Crear sesión de Stripe

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header (opcional) | `Authorization: Bearer <JWT>` (opcional, para invitados no se envía) |

#### `POST /api/checkout/validar-y-crear-pedido` — Validar pago y crear pedido

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header (opcional) | `Authorization: Bearer <JWT>` (opcional, para invitados no se envía) |

---

### 3.5 Rutas Admin (middleware)

Todas las rutas `/api/admin/*` ahora validan el JWT en el middleware **Y** verifican rol admin contra BD.

| Campo | Antes | Ahora |
|-------|-------|-------|
| Auth | `x-user-id` header (UUID texto plano) | `Authorization: Bearer <JWT>` (JWT real de Supabase) |

```dart
// ✅ Ejemplo: obtener pedidos admin
final response = await http.get(
  Uri.parse('$baseUrl/api/admin/pedidos'),
  headers: {'Authorization': 'Bearer $accessToken'},
);
```

**Respuestas de error admin**:

| Status | Body | Causa |
|--------|------|-------|
| 401 | `{"success": false, "error": "No autenticado"}` | JWT ausente o expirado |
| 403 | `{"success": false, "error": "No autorizado - se requiere rol admin"}` | Usuario no es admin |

---

## 4. RATE LIMITING (Nuevo)

Estos endpoints ahora tienen límite de peticiones por IP:

| Endpoint | Límite | Respuesta si se excede |
|----------|--------|----------------------|
| `POST /api/auth/login` | 10 peticiones/minuto | 429 Too Many Requests |
| `POST /api/auth/register` | 5 peticiones/minuto | 429 Too Many Requests |
| `POST /api/contacto` | 5 peticiones/minuto | 429 Too Many Requests |
| `POST /api/chat` | 15 peticiones/minuto | 429 Too Many Requests |
| `POST /api/carrito/reservar` | 30 peticiones/minuto | 429 Too Many Requests |

```dart
// Manejar 429 en Flutter
if (response.statusCode == 429) {
  // Mostrar: "Demasiados intentos. Espera un momento."
}
```

---

## 5. ENDPOINT ELIMINADO

| Endpoint | Estado |
|----------|--------|
| `POST /api/carrito/agregar` | **410 Gone** — usar `POST /api/carrito` en su lugar |

---

## 6. ENDPOINTS SIN CAMBIOS

Estos endpoints NO han cambiado y funcionan igual que antes (no requieren auth):

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/productos/lista` | Listar productos |
| GET | `/api/productos/buscar` | Buscar productos |
| GET | `/api/productos/[id]` | Detalle de producto |
| GET | `/api/productos/stocks` | Stocks actuales |
| GET | `/api/variantes/[productoId]` | Variantes de un producto |
| GET | `/api/variantes/obtener-disponibles` | Variantes disponibles |
| GET | `/api/ofertas` | Ofertas activas |
| GET | `/api/seguimiento` | Seguimiento de pedido (por código) |
| POST | `/api/codigos/validar` | Validar código promocional |
| GET | `/api/categorias` | Listar categorías |

---

## 7. SERVICIO BASE RECOMENDADO PARA FLUTTER

```dart
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class ApiService {
  static const String baseUrl = 'https://ibericosrodriguezgonzalez.victoriafp.online';

  /// Obtiene el JWT actual del usuario logueado
  String? get _accessToken =>
      Supabase.instance.client.auth.currentSession?.accessToken;

  /// Headers para endpoints públicos (sin auth)
  Map<String, String> get _publicHeaders => {
    'Content-Type': 'application/json',
  };

  /// Headers para endpoints protegidos (con JWT)
  Map<String, String> get _authHeaders => {
    'Content-Type': 'application/json',
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };

  // ═══════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════

  /// Obtener datos del usuario actual
  Future<Map<String, dynamic>> getMe() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/auth/me'),
      headers: _authHeaders,
    );
    return _handleResponse(response);
  }

  /// Actualizar perfil
  Future<Map<String, dynamic>> actualizarPerfil({
    required String nombre,
    String? telefono,
    String? direccion,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/actualizar-perfil'),
      headers: _authHeaders,
      body: jsonEncode({
        'nombre': nombre,
        'telefono': telefono,
        'direccion': direccion,
      }),
    );
    return _handleResponse(response);
  }

  // ═══════════════════════════════════════════
  // CARRITO
  // ═══════════════════════════════════════════

  /// Obtener carrito
  Future<Map<String, dynamic>> getCarrito() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/carrito'),
      headers: _authHeaders,
    );
    return _handleResponse(response);
  }

  /// Añadir producto al carrito (SIN user_id en body)
  Future<Map<String, dynamic>> addToCarrito({
    required int productoId,
    required int cantidad,
    int? productoVarianteId,
    double? pesoKg,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/carrito'),
      headers: _authHeaders,
      body: jsonEncode({
        'producto_id': productoId,
        'cantidad': cantidad,
        if (productoVarianteId != null) 'producto_variante_id': productoVarianteId,
        if (pesoKg != null) 'peso_kg': pesoKg,
      }),
    );
    return _handleResponse(response);
  }

  /// Eliminar item del carrito
  Future<Map<String, dynamic>> removeFromCarrito(int itemId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/api/carrito/$itemId'),
      headers: _authHeaders,
    );
    return _handleResponse(response);
  }

  /// Vaciar carrito
  Future<Map<String, dynamic>> vaciarCarrito() async {
    final response = await http.delete(
      Uri.parse('$baseUrl/api/carrito/vaciar'),
      headers: _authHeaders,
    );
    return _handleResponse(response);
  }

  // ═══════════════════════════════════════════
  // PEDIDOS
  // ═══════════════════════════════════════════

  /// Listar pedidos del usuario
  Future<Map<String, dynamic>> getPedidos() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/pedidos'),
      headers: _authHeaders,
    );
    return _handleResponse(response);
  }

  /// Cancelar pedido
  Future<Map<String, dynamic>> cancelarPedido(String pedidoId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/pedidos/cancelar'),
      headers: _authHeaders,
      body: jsonEncode({'pedido_id': pedidoId}),
    );
    return _handleResponse(response);
  }

  /// Solicitar devolución
  Future<Map<String, dynamic>> solicitarDevolucion(String pedidoId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/pedidos/solicitar-devolucion'),
      headers: _authHeaders,
      body: jsonEncode({'pedido_id': pedidoId}),
    );
    return _handleResponse(response);
  }

  // ═══════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════

  /// GET admin genérico
  Future<Map<String, dynamic>> adminGet(String path) async {
    final response = await http.get(
      Uri.parse('$baseUrl$path'),
      headers: _authHeaders,
    );
    return _handleResponse(response);
  }

  /// POST admin genérico
  Future<Map<String, dynamic>> adminPost(String path, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: _authHeaders,
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  // ═══════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════

  Map<String, dynamic> _handleResponse(http.Response response) {
    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 401) {
      throw Exception('No autenticado — token expirado o inválido');
    }
    if (response.statusCode == 403) {
      throw Exception('No autorizado — permisos insuficientes');
    }
    if (response.statusCode == 429) {
      throw Exception('Demasiadas peticiones — espera un momento');
    }

    return data;
  }
}
```

---

## 8. CHECKLIST DE MIGRACIÓN

- [ ] Usar SDK Supabase Flutter para login y obtener `accessToken`
- [ ] Reemplazar TODOS los headers `x-user-id` por `Authorization: Bearer <JWT>`
- [ ] Eliminar `user_id` del body de `POST /api/carrito`
- [ ] Manejar status 401 (token expirado → re-login)
- [ ] Manejar status 403 (sin permisos)
- [ ] Manejar status 429 (rate limit)
- [ ] Cambiar `POST /api/carrito/agregar` por `POST /api/carrito`
- [ ] Verificar que endpoints públicos (productos, ofertas, categorías) siguen sin auth
