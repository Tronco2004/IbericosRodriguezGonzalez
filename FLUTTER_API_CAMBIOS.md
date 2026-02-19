# CAMBIOS EN LA API - Guía para Flutter

> Fecha: 18 de febrero de 2026  
> Base URL: `https://ibericosrodriguezgonzalez.victoriafp.online`

---

## RESUMEN

Se ha añadido un **middleware de seguridad server-side** que protege todas las rutas `/api/admin/*` y `/api/debug/*`. Ahora es **OBLIGATORIO** enviar autenticación en cada petición a esas rutas.

---

## 1. HEADER OBLIGATORIO PARA RUTAS ADMIN

**Todas** las peticiones a `/api/admin/*` deben incluir **al menos uno** de estos headers:

```
x-user-id: <UUID del usuario admin>
```
o
```
Authorization: Bearer <UUID del usuario admin>
```

### Ejemplo en Dart:

```dart
// Opción A: header x-user-id (recomendada)
final response = await http.get(
  Uri.parse('$baseUrl/api/admin/pedidos'),
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': userId,  // UUID del admin logueado
  },
);

// Opción B: header Authorization
final response = await http.get(
  Uri.parse('$baseUrl/api/admin/pedidos'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $userId',  // UUID del admin logueado
  },
);
```

### Respuestas de error:

| Status | Significado | Cuándo ocurre |
|--------|-------------|---------------|
| **401** | `{"success": false, "error": "No autenticado"}` | No se envía ni `x-user-id` ni `Authorization` |
| **403** | `{"success": false, "error": "No autorizado - se requiere rol admin"}` | El usuario existe pero NO tiene rol `admin` |
| **500** | `{"success": false, "error": "Error verificando permisos"}` | Error interno al consultar la BD |

---

## 2. ENDPOINTS ADMIN AFECTADOS (25 endpoints)

Todos estos ahora requieren header de autenticación admin:

### Productos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/productos` | Listar productos (admin) |
| POST | `/api/admin/productos` | Crear producto |
| GET | `/api/admin/productos-list` | Lista simplificada de productos |
| POST | `/api/admin/guardar-producto` | Guardar/actualizar producto |

### Pedidos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/pedidos` | Listar todos los pedidos |
| PUT | `/api/admin/pedidos/actualizar-estado` | Cambiar estado de pedido |
| GET/PUT | `/api/admin/seguimiento` | Seguimiento de pedidos |

### Categorías
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | `/api/admin/categorias` | CRUD de categorías |

### Ofertas
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST | `/api/admin/ofertas` | Listar/crear ofertas |
| PUT/DELETE | `/api/admin/ofertas/[id]` | Actualizar/eliminar oferta |

### Variantes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| * | `/api/admin/variantes` | Gestión de variantes |
| POST | `/api/admin/setup-variantes-stock` | Setup de stock en variantes |

### Usuarios
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| * | `/api/admin/usuarios` | Gestión de usuarios |
| DELETE | `/api/admin/usuarios/eliminar` | Eliminar usuario |
| PUT | `/api/admin/usuarios/actualizar-estado` | Activar/desactivar usuario |

### Códigos descuento
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/codigos-lista` | Listar códigos |
| POST | `/api/admin/codigos-crear` | Crear código |
| GET | `/api/admin/codigos-detalles` | Detalles de código |

### Dashboard y finanzas
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/admin/dashboard-stats` | Estadísticas del dashboard |
| GET | `/api/admin/ingresos-diarios` | Ingresos por día |
| GET | `/api/admin/ingresos-usuarios` | Ingresos por usuario |

### Otros
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/admin/upload` | Subir imagen a Cloudinary |
| POST | `/api/admin/init-data` | Inicializar datos |
| * | `/api/admin/setup` | Setup general |
| * | `/api/admin/clientes-empresariales` | Gestión clientes empresa |

---

## 3. ENDPOINT DEPRECADO

| Endpoint | Antes | Ahora |
|----------|-------|-------|
| `POST /api/carrito/agregar` | Funcionaba (añadía al carrito) | Devuelve **410 Gone** |

**Solución:** Usar `POST /api/carrito` en su lugar (el endpoint principal del carrito que ya tiene toda la lógica).

```dart
// ❌ ANTES (ya no funciona)
await http.post(Uri.parse('$baseUrl/api/carrito/agregar'), ...);

// ✅ AHORA
await http.post(Uri.parse('$baseUrl/api/carrito'), ...);
```

---

## 4. ENDPOINTS SIN CAMBIOS (no afectados)

Estos endpoints siguen funcionando exactamente igual que antes:

### Auth (sin cambios)
- `POST /api/auth/login`
- `POST /api/auth/registro`
- `GET /api/auth/me`
- `POST /api/auth/cambiar-contrasena`

### Carrito (sin cambios, excepto /agregar)
- `GET/POST/PUT/DELETE /api/carrito` — sigue usando `x-user-id` header
- `DELETE /api/carrito/vaciar`
- `POST /api/carrito/reservar`
- `DELETE /api/carrito/[id]`

### Pedidos públicos (sin cambios)
- `GET /api/pedidos` — sigue usando `x-user-id` header
- `POST /api/pedidos/cancelar`
- `POST /api/pedidos/solicitar-devolucion`
- `POST /api/pedidos/validar-devolucion`
- `POST /api/pedidos/denegar-devolucion`

### Productos públicos (sin cambios)
- `GET /api/productos/lista`
- `GET /api/productos/buscar`
- `GET /api/productos/[id]`
- `GET /api/productos/stocks`
- `GET /api/productos/reservados`

### Checkout (sin cambios)
- `POST /api/checkout/create-session`
- `POST /api/checkout/validar-y-crear-pedido`

### Otros (sin cambios)
- `GET /api/variantes/[productoId]`
- `GET /api/variantes/obtener-disponibles`
- `GET /api/ofertas`
- `POST /api/contacto`
- `POST /api/chat`
- `GET /api/seguimiento`
- `POST /api/codigos/validar`
- `POST /api/codigos/verificar-uso`
- `POST /api/codigos/registrar-uso`

---

## 5. LOGIN - CÓMO OBTENER EL userId

El endpoint de login **NO ha cambiado**, pero es importante saber qué devuelve para luego usar el `id` en las llamadas admin.

### Petición:

```dart
final response = await http.post(
  Uri.parse('$baseUrl/api/auth/login'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'email': 'admin@correo.com',
    'password': 'tu_contraseña',
  }),
);
```

### Respuesta exitosa (200):

```json
{
  "success": true,
  "message": "Login exitoso",
  "redirect_url": "/admin/dashboard",
  "usuario": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "nombre": "Admin Ibéricos",
    "email": "admin@correo.com",
    "rol": "admin"
  }
}
```

### En Flutter - guardar el userId tras login:

```dart
final response = await http.post(
  Uri.parse('$baseUrl/api/auth/login'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'email': email, 'password': password}),
);

if (response.statusCode == 200) {
  final data = jsonDecode(response.body);
  if (data['success'] == true) {
    // ⬇️ GUARDAR ESTOS DATOS - los necesitas para las llamadas admin
    final userId = data['usuario']['id'];     // UUID para x-user-id
    final userRole = data['usuario']['rol'];   // 'admin' o 'cliente'
    final userName = data['usuario']['nombre'];

    // Guardar en SharedPreferences o tu sistema de estado
    await prefs.setString('user_id', userId);
    await prefs.setString('user_role', userRole);
    await prefs.setString('user_name', userName);
  }
}
```

### Respuestas de error del login:

| Status | Significado |
|--------|-------------|
| **400** | Faltan email o password |
| **401** | Credenciales inválidas o usuario no registrado |
| **403** | Usuario inactivo (desactivado por admin) |
| **500** | Error interno del servidor |

---

## 6. IMPLEMENTACIÓN RECOMENDADA EN FLUTTER

### Servicio base con interceptor:

```dart
class ApiService {
  final String baseUrl = 'https://ibericosrodriguezgonzalez.victoriafp.online';
  String? _userId;  // UUID del usuario logueado

  void setUserId(String userId) => _userId = userId;

  /// Headers base para cualquier petición
  Map<String, String> get _baseHeaders => {
    'Content-Type': 'application/json',
  };

  /// Headers para peticiones que requieren autenticación
  Map<String, String> get _authHeaders => {
    ..._baseHeaders,
    if (_userId != null) 'x-user-id': _userId!,
  };

  /// GET a endpoint admin
  Future<http.Response> adminGet(String path) async {
    final response = await http.get(
      Uri.parse('$baseUrl$path'),
      headers: _authHeaders,
    );

    if (response.statusCode == 401) {
      // No autenticado - redirigir a login
      throw NotAuthenticatedException();
    }
    if (response.statusCode == 403) {
      // No es admin
      throw NotAuthorizedException();
    }

    return response;
  }

  /// POST a endpoint admin
  Future<http.Response> adminPost(String path, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: _authHeaders,
      body: jsonEncode(body),
    );

    if (response.statusCode == 401) throw NotAuthenticatedException();
    if (response.statusCode == 403) throw NotAuthorizedException();

    return response;
  }
}
```

### Uso:

```dart
final api = ApiService();
api.setUserId('uuid-del-admin-logueado');

// Obtener pedidos admin
final pedidos = await api.adminGet('/api/admin/pedidos');

// Crear producto
final resultado = await api.adminPost('/api/admin/guardar-producto', {
  'nombre': 'Jamón Ibérico',
  'precio': 45.00,
  ...
});
```

---

## 7. CHECKLIST DE MIGRACIÓN

- [ ] Añadir header `x-user-id` a todas las llamadas a `/api/admin/*`
- [ ] Manejar respuesta 401 (redirigir a login)
- [ ] Manejar respuesta 403 (mostrar mensaje "sin permisos")
- [ ] Cambiar `/api/carrito/agregar` por `/api/carrito` (POST)
- [ ] Verificar que las llamadas a endpoints NO admin siguen sin cambios
