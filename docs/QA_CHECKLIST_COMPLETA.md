# QA Checklist Completa — Ibéricos Rodríguez González

> Checklist exhaustiva para verificar que la tienda funciona al 100%.  
> Fecha: 22 de febrero de 2026

---

## Índice

1. [Navegación y Páginas Públicas](#1-navegación-y-páginas-públicas)
2. [Registro y Autenticación](#2-registro-y-autenticación)
3. [Catálogo de Productos](#3-catálogo-de-productos)
4. [Ofertas](#4-ofertas)
5. [Carrito de Compra](#5-carrito-de-compra)
6. [Checkout y Pago](#6-checkout-y-pago)
7. [Compra como Invitado](#7-compra-como-invitado)
8. [Códigos Promocionales](#8-códigos-promocionales)
9. [Pedidos y Seguimiento](#9-pedidos-y-seguimiento)
10. [Cancelaciones y Devoluciones](#10-cancelaciones-y-devoluciones)
11. [Emails y Facturas PDF](#11-emails-y-facturas-pdf)
12. [Perfil de Usuario](#12-perfil-de-usuario)
13. [Panel Admin — Dashboard](#13-panel-admin--dashboard)
14. [Panel Admin — Productos](#14-panel-admin--productos)
15. [Panel Admin — Pedidos](#15-panel-admin--pedidos)
16. [Panel Admin — Categorías](#16-panel-admin--categorías)
17. [Panel Admin — Ofertas](#17-panel-admin--ofertas)
18. [Panel Admin — Códigos Descuento](#18-panel-admin--códigos-descuento)
19. [Panel Admin — Usuarios](#19-panel-admin--usuarios)
20. [Panel Admin — Clientes Empresariales](#20-panel-admin--clientes-empresariales)
21. [Panel Admin — Ingresos](#21-panel-admin--ingresos)
22. [Panel Admin — Variantes de Peso](#22-panel-admin--variantes-de-peso)
23. [Panel Admin — Subida de Imágenes](#23-panel-admin--subida-de-imágenes)
24. [Seguridad y Autorizaciones](#24-seguridad-y-autorizaciones)
25. [Stock y Concurrencia](#25-stock-y-concurrencia)
26. [Responsive y UX](#26-responsive-y-ux)
27. [SEO y Rendimiento](#27-seo-y-rendimiento)
28. [Páginas Legales y Estáticas](#28-páginas-legales-y-estáticas)
29. [Casos Edge y Errores](#29-casos-edge-y-errores)
30. [API Flutter / Móvil](#30-api-flutter--móvil)

---

## 1. Navegación y Páginas Públicas

### Header y Footer
- [ ] Logo visible y enlaza a `/`
- [ ] Menú de navegación con todos los enlaces funcionando
- [ ] Icono del carrito visible con contador de productos
- [ ] El contador del carrito se actualiza en tiempo real al añadir/quitar productos
- [ ] Enlace a login/registro visible cuando NO estás logueado
- [ ] Enlace a "Mi perfil" / "Mis pedidos" visible cuando SÍ estás logueado
- [ ] Footer con enlaces legales (términos, privacidad, cookies, devoluciones)
- [ ] Footer con información de contacto
- [ ] Navegación funciona correctamente en móvil (menú hamburguesa)

### Página de Inicio (`/`)
- [ ] Se carga correctamente sin errores en consola
- [ ] Muestra productos destacados / nuevos
- [ ] Las imágenes se cargan desde Cloudinary
- [ ] Los precios se muestran correctamente (formato €, decimales)
- [ ] Los enlaces a productos individuales funcionan
- [ ] Las categorías se muestran y enlazan correctamente

### Página Sobre Nosotros (`/sobre-nosotros`)
- [ ] Se carga correctamente
- [ ] Contenido completo sin placeholders ni lorem ipsum

### Página de Contacto (`/contacto`)
- [ ] Formulario de contacto visible
- [ ] Campos obligatorios marcados (nombre, email, mensaje)
- [ ] Validación de email funciona
- [ ] Envío del formulario muestra confirmación
- [ ] El mensaje llega al email configurado
- [ ] No permite enviar formulario vacío
- [ ] Rate limiting funciona (no permite spam)

---

## 2. Registro y Autenticación

### Registro (`/registro`)
- [ ] Formulario con campos: nombre, email, contraseña
- [ ] Validación de email (formato correcto)
- [ ] Validación de contraseña (mínimo de caracteres)
- [ ] No permite registro con email ya existente → muestra error claro
- [ ] Registro exitoso redirige correctamente
- [ ] Se crea el usuario en Supabase Auth + tabla `usuarios`
- [ ] Se envía email de bienvenida
- [ ] Las cookies de sesión se establecen correctamente
- [ ] **XSS**: Probar inyectar `<script>alert(1)</script>` en campo nombre
- [ ] **XSS**: Probar inyectar HTML malicioso en todos los campos

### Login (`/login`)
- [ ] Login con email y contraseña válidos → redirige
- [ ] Login con credenciales incorrectas → error claro, sin revelar si es email o contraseña
- [ ] Login establece cookies `auth_token` y `sb-refresh-token`
- [ ] Sesión persiste al recargar la página
- [ ] Sesión persiste al cerrar y abrir el navegador
- [ ] Botón "Cerrar sesión" funciona y borra cookies

### Recuperar Contraseña (`/recuperar-contrasena`)
- [ ] Formulario pide email
- [ ] Email válido → se envía correo de recuperación
- [ ] Email no registrado → NO revela que no existe (por seguridad)
- [ ] El enlace del email lleva a `/restablecer-contrasena`

### Restablecer Contraseña (`/restablecer-contrasena`)
- [ ] Formulario de nueva contraseña
- [ ] Validación de contraseña segura
- [ ] Contraseña cambiada → puede hacer login con la nueva
- [ ] Token expirado → muestra error

### OAuth (si está configurado)
- [ ] Login con Google funciona
- [ ] Se crea usuario en tabla `usuarios` tras OAuth
- [ ] Cookies se establecen correctamente

---

## 3. Catálogo de Productos

### Listado (`/productos`)
- [ ] Se muestran todos los productos activos
- [ ] Los productos inactivos NO aparecen
- [ ] Las imágenes se cargan correctamente (Cloudinary)
- [ ] Los precios se muestran correctamente en € con 2 decimales
- [ ] Los productos con oferta muestran precio tachado + precio rebajado
- [ ] Los productos sin stock se marcan como "Agotado"
- [ ] Paginación funciona (si hay muchos productos)
- [ ] Filtrado por categoría funciona
- [ ] Búsqueda por nombre funciona (si existe)

### Detalle de Producto (`/productos/:id`)
- [ ] Se muestra nombre, descripción, precio, imagen(es)
- [ ] Productos con variantes de peso: se listan todas las variantes disponibles
- [ ] Variantes: el precio cambia al seleccionar una variante
- [ ] Variantes: muestra peso (kg) y precio total de cada pieza
- [ ] Productos simples: muestra stock disponible
- [ ] Botón "Añadir al carrito" funciona
- [ ] Si ya está en el carrito, permite aumentar cantidad
- [ ] No permite añadir más cantidad que el stock disponible
- [ ] Producto con stock 0 → botón deshabilitado
- [ ] Si el producto tiene oferta activa → muestra precio de oferta
- [ ] Producto inexistente → página 404

### Categorías (`/categoria/:slug`)
- [ ] Se muestran solo los productos de esa categoría
- [ ] Subcategorías se muestran correctamente (jerarquía padre-hijo)
- [ ] Categoría sin productos → mensaje "No hay productos"
- [ ] Categoría inexistente → 404 o mensaje de error
- [ ] Navegación entre categorías funciona

### Ofertas (`/ofertas`)
- [ ] Solo muestra productos con oferta activa (fecha actual dentro del rango)
- [ ] Muestra precio original tachado y precio de oferta
- [ ] Porcentaje de descuento visible
- [ ] Ofertas expiradas NO aparecen
- [ ] Ofertas futuras NO aparecen
- [ ] Click en producto lleva al detalle

---

## 4. Ofertas

- [ ] Producto con oferta activa: precio de oferta en listado, detalle y carrito
- [ ] Producto con oferta expirada: muestra precio normal
- [ ] Oferta que se activa HOY → aparece correctamente
- [ ] Oferta que expira HOY → desaparece al día siguiente
- [ ] Al comprar un producto en oferta, se cobra el precio de oferta (verificar en Stripe)
- [ ] El precio de oferta se valida server-side (no solo frontend)

---

## 5. Carrito de Compra

### Usuario Logueado (carrito en BD)
- [ ] Añadir producto al carrito → aparece en `/carrito`
- [ ] Añadir el mismo producto → incrementa cantidad (no duplica)
- [ ] Aumentar cantidad → verificar que no supere el stock
- [ ] Disminuir cantidad → si llega a 0, se elimina del carrito
- [ ] Eliminar producto del carrito
- [ ] Vaciar carrito completo
- [ ] El carrito persiste entre sesiones (almacenado en BD)
- [ ] El carrito muestra subtotal correcto
- [ ] El carrito muestra total con envío (5€)
- [ ] Los precios se actualizan si cambian en BD (no se cachean localmente)

### Usuario Invitado (carrito en localStorage)
- [ ] Añadir producto al carrito funciona sin estar logueado
- [ ] El carrito se almacena en localStorage
- [ ] Los datos del carrito persisten al recargar
- [ ] Al hacer login, el carrito de localStorage se sincroniza con BD
- [ ] Stock se reserva al iniciar checkout (no antes)

### Productos con Variantes en Carrito
- [ ] Al añadir una variante de peso, se muestra el peso y precio correcto
- [ ] Variantes diferentes del mismo producto aparecen como ítems separados
- [ ] No se puede añadir una variante ya vendida

### Precio y Cálculos
- [ ] Subtotal = Σ(precio_unitario × cantidad) para todos los ítems
- [ ] Total = subtotal + envío (5€)
- [ ] Si hay código promocional aplicado, el descuento se refleja
- [ ] Todos los cálculos muestran 2 decimales
- [ ] Los precios coinciden con los de la BD (no manipulables desde frontend)

---

## 6. Checkout y Pago

### Crear Sesión de Stripe
- [ ] Al hacer click en "Pagar", se crea una sesión de Stripe
- [ ] Los precios en Stripe coinciden con los de la BD (recalculados server-side)
- [ ] Los precios incluyen ofertas activas
- [ ] El envío (5€) aparece como línea separada
- [ ] Si hay código promocional, el descuento se aplica en Stripe
- [ ] Se reduce el stock al crear la sesión (sistema atómico CAS)
- [ ] Si el stock es insuficiente → error claro, no se crea sesión

### Pago en Stripe
- [ ] Tarjeta de prueba `4242 4242 4242 4242` funciona
- [ ] Tarjeta rechazada `4000 0000 0000 0002` muestra error
- [ ] Tarjeta con 3D Secure → funciona la autenticación
- [ ] Al cancelar el pago → se vuelve a la tienda, el stock se restaura
- [ ] No se puede manipular el precio desde el frontend

### Post-pago exitoso (`/checkout/exito`)
- [ ] Se redirige correctamente tras el pago
- [ ] Se valida el `session_id` de Stripe server-side
- [ ] Se verifica que `payment_status === 'paid'`
- [ ] Se crea el pedido en la tabla `pedidos`
- [ ] Se crean los ítems en `pedido_items`
- [ ] Se genera el `codigo_seguimiento`
- [ ] Se envía email de confirmación con factura PDF
- [ ] Si se recarga la página, NO se crea un pedido duplicado
- [ ] Si se accede con un `session_id` ya procesado → muestra el pedido existente
- [ ] Si se accede sin `session_id` → redirect o error

### **(CRÍTICO) Pérdida de sesión post-pago**
- [ ] Si el navegador se cierra justo después de pagar (antes de llegar a `/checkout/exito`) → ¿se crea el pedido? (**NOTA: No hay webhook de Stripe, esto puede fallar**)
- [ ] Simular: abrir pestaña de pago → cerrar navegador → verificar si el pedido se creó

---

## 7. Compra como Invitado

- [ ] Se puede comprar sin estar registrado
- [ ] Se pide email, nombre y dirección de envío
- [ ] Se reserva stock al iniciar checkout
- [ ] El pago funciona igual que con usuario logueado
- [ ] Se crea el pedido con `es_invitado = true`
- [ ] Se genera `codigo_seguimiento` para el invitado
- [ ] Se envía email de confirmación al email proporcionado
- [ ] El invitado puede ver su pedido con el código de seguimiento en `/seguimiento`
- [ ] Si el invitado luego se registra con el mismo email → ¿se vinculan los pedidos?

---

## 8. Códigos Promocionales

### Aplicar Código
- [ ] Campo para introducir código en el carrito/checkout
- [ ] Código válido → se aplica el descuento (porcentaje o fijo)
- [ ] Código inválido → error claro
- [ ] Código expirado → error
- [ ] Código con usos agotados → error
- [ ] Código con mínimo de compra → error si no se alcanza
- [ ] El descuento se refleja en el total
- [ ] El descuento pasa correctamente a Stripe
- [ ] **BUG CONOCIDO**: Verificar que `usos_actuales` se incrementa correctamente al usar un código (hay un bug documentado donde se asigna el `id` del código en vez de incrementar)
- [ ] Un código no se puede usar más veces de las permitidas
- [ ] El código se puede quitar después de aplicarlo

### Tipos de Descuento
- [ ] Descuento porcentual (ej: 10%) → cálculo correcto
- [ ] Descuento fijo (ej: 5€) → cálculo correcto
- [ ] Descuento no puede hacer el total negativo
- [ ] Descuento se aplica solo al subtotal (no al envío, o sí, según lógica)

---

## 9. Pedidos y Seguimiento

### Mis Pedidos (`/mis-pedidos`)
- [ ] Solo se ven los pedidos del usuario logueado (no los de otros)
- [ ] Se muestran todos los pedidos, ordenados por fecha
- [ ] Cada pedido muestra: fecha, estado, total, código de seguimiento
- [ ] Se pueden ver los detalles (productos, cantidades, precios)
- [ ] El estado se muestra con colores/iconos claros
- [ ] Pedidos con devolución muestran estado de devolución
- [ ] Pedidos cancelados se marcan visualmente
- [ ] **SEGURIDAD**: Un usuario NO puede ver los pedidos de otro usuario (probar cambiando IDs en URL/API)

### Seguimiento (`/seguimiento`)
- [ ] Formulario para introducir código de seguimiento
- [ ] Código válido → muestra estado del pedido
- [ ] Código inválido → error claro
- [ ] Funciona para pedidos de invitados
- [ ] Funciona para pedidos de usuarios registrados
- [ ] No revela información sensible (solo estado y productos)

### Detalle del Pedido
- [ ] Lista todos los productos con cantidades y precios
- [ ] Muestra subtotal, envío, descuento (si hay) y total
- [ ] Si hay código de descuento aplicado, se muestra cuál
- [ ] Botón de "Solicitar devolución" visible si el estado lo permite

---

## 10. Cancelaciones y Devoluciones

### Cancelación (solo desde estado "pagado")
- [ ] Botón de cancelar visible solo en pedidos con estado "pagado"
- [ ] Al cancelar → se procesa reembolso en Stripe
- [ ] Al cancelar → se restaura el stock de todos los productos
- [ ] Al cancelar → se restauran las variantes de peso (piezas únicas)
- [ ] Al cancelar → estado cambia a "cancelado"
- [ ] Al cancelar → se envía email de cancelación al cliente con factura rectificativa
- [ ] Al cancelar → se envía email al admin notificando la cancelación
- [ ] Pedido cancelado → NO se puede volver a cancelar
- [ ] Pedido cancelado → NO se puede cambiar de estado

### Devolución
- [ ] Solicitar devolución: visible en pedidos con estado "entregado"
- [ ] El cliente puede escribir motivo de la devolución
- [ ] Al solicitar → estado cambia a "devolucion_solicitada"
- [ ] Se envía email al cliente con instrucciones y etiqueta QR
- [ ] Se envía email al admin notificando la solicitud
- [ ] El admin puede aprobar o denegar la devolución
- [ ] Devolución aprobada → estado "devolucion_recibida" (final)
- [ ] Devolución aprobada → se procesa reembolso en Stripe
- [ ] Devolución aprobada → se restaura el stock
- [ ] Devolución aprobada → email al cliente confirmando
- [ ] Devolución denegada → estado "devolucion_denegada"
- [ ] Devolución denegada → email al cliente con motivo
- [ ] Desde "devolucion_denegada", ¿se puede volver a solicitar?

---

## 11. Emails y Facturas PDF

### Emails que deben llegar
- [ ] **Bienvenida**: tras registro
- [ ] **Confirmación de pedido**: tras pago exitoso, incluye factura PDF adjunta
- [ ] **Cancelación (cliente)**: tras cancelar pedido, incluye factura rectificativa PDF
- [ ] **Cancelación (admin)**: notificación al admin cuando un cliente cancela
- [ ] **Devolución solicitada (cliente)**: instrucciones + etiqueta QR
- [ ] **Devolución solicitada (admin)**: notificación al admin
- [ ] **Devolución aprobada**: email al cliente
- [ ] **Devolución denegada**: email al cliente con motivo

### Factura PDF
- [ ] La factura incluye datos del comprador (nombre, email)
- [ ] La factura incluye datos de la empresa
- [ ] La factura incluye lista de productos con cantidades y precios
- [ ] La factura incluye subtotal, envío, descuento (si hay) y total
- [ ] La factura incluye número de factura y fecha
- [ ] Los precios en la factura coinciden con el pedido real
- [ ] La factura rectificativa referencia la factura original
- [ ] El PDF se abre correctamente (no está corrupto)
- [ ] Los caracteres especiales (ñ, tildes, €) se muestran bien en el PDF

### Verificaciones de Email
- [ ] Los emails no van a spam
- [ ] Los emails tienen formato HTML correcto
- [ ] Los enlaces en los emails funcionan
- [ ] El remitente es correcto
- [ ] El asunto es descriptivo y correcto

---

## 12. Perfil de Usuario

### Mi Perfil (`/mi-perfil`)
- [ ] Se muestra nombre, email del usuario
- [ ] Se puede editar el nombre
- [ ] Se puede cambiar la contraseña
- [ ] Se puede añadir/editar dirección de envío
- [ ] Los cambios se guardan correctamente en BD
- [ ] Validación de campos (email válido, contraseña segura)
- [ ] **SEGURIDAD**: ¿Se puede acceder a `/mi-perfil` sin estar logueado? (debería requerir auth)
- [ ] **SEGURIDAD**: Un usuario no puede ver/editar el perfil de otro

---

## 13. Panel Admin — Dashboard

### Acceso
- [ ] Solo accesible para usuarios con rol `admin`
- [ ] Usuario normal → redirect a `/sin-acceso` o 403
- [ ] Usuario no logueado → redirect a `/login`
- [ ] Intentar acceder a `/admin/*` directamente por URL → protegido

### KPIs del Dashboard
- [ ] Ingresos del mes se calculan correctamente
  - Fórmula: todos los pedidos − cancelados (×1) − devoluciones (×2)
- [ ] Número total de pedidos
- [ ] Ticket promedio = ingresos / nº pedidos exitosos
- [ ] Productos con stock bajo se listan
- [ ] Número de clientes registrados
- [ ] Los datos se actualizan al recargar
- [ ] Las fechas usan timezone `Europe/Madrid`
- [ ] Verificar con datos reales que los números cuadran

---

## 14. Panel Admin — Productos

### CRUD de Productos
- [ ] Listar todos los productos (activos e inactivos)
- [ ] Crear producto nuevo (nombre, descripción, precio, stock, categoría, imagen)
- [ ] Precio se almacena en céntimos internamente pero se muestra en € al admin
- [ ] Subir imagen → se sube a Cloudinary
- [ ] Editar producto existente
- [ ] Desactivar/activar producto
- [ ] Eliminar producto (soft delete o hard delete?)
- [ ] **Producto simple**: tiene stock numérico directo
- [ ] **Producto con variantes**: activar `precio_por_kg`, crear variantes con peso y precio

### Validaciones Admin
- [ ] No se puede crear producto sin nombre
- [ ] No se puede crear producto con precio negativo o 0
- [ ] No se puede crear producto con stock negativo
- [ ] La categoría debe existir
- [ ] La imagen es obligatoria (o no?)
- [ ] Descripción tiene límite de caracteres (o no?)

---

## 15. Panel Admin — Pedidos

### Gestión de Pedidos
- [ ] Listar todos los pedidos con filtros (estado, fecha, búsqueda)
- [ ] Ver detalle de cada pedido (productos, cliente, dirección, total)
- [ ] Cambiar estado: `pagado → preparando → enviado → entregado`
- [ ] No se puede retroceder de estado (ej: de "enviado" a "preparando")
- [ ] No se puede cambiar el estado de un pedido cancelado
- [ ] No se puede cambiar el estado de un pedido con devolución recibida
- [ ] Aprobar devolución → reembolso + cambio de estado
- [ ] Denegar devolución → cambio de estado + email con motivo
- [ ] Al marcar como "enviado" → ¿se envía email al cliente?
- [ ] Información del pedido de invitado se muestra completa (email, nombre)

---

## 16. Panel Admin — Categorías

- [ ] Listar todas las categorías
- [ ] Crear categoría (nombre, slug)
- [ ] Crear subcategoría (con categoría padre)
- [ ] Editar categoría
- [ ] Eliminar categoría (¿qué pasa con los productos asociados?)
- [ ] Slug se genera automáticamente o se valida formato
- [ ] No permitir categorías duplicadas (mismo nombre/slug)
- [ ] La jerarquía padre-hijo se muestra visualmente

---

## 17. Panel Admin — Ofertas

- [ ] Listar todas las ofertas (activas, expiradas, futuras)
- [ ] Crear oferta: seleccionar producto, precio de descuento, fecha inicio y fin
- [ ] El precio de oferta debe ser menor al precio original
- [ ] Editar oferta existente
- [ ] Eliminar/desactivar oferta
- [ ] Oferta se activa automáticamente en la fecha de inicio
- [ ] Oferta se desactiva automáticamente en la fecha de fin
- [ ] No crear ofertas duplicadas para el mismo producto
- [ ] La oferta se refleja en el catálogo público

---

## 18. Panel Admin — Códigos Descuento

- [ ] Listar todos los códigos promocionales
- [ ] Crear código: nombre, tipo (porcentaje/fijo), valor, uso máximo, fecha expiración
- [ ] Editar código existente
- [ ] Eliminar/desactivar código
- [ ] Ver cuántas veces se ha usado cada código
- [ ] Código con formato válido (sin espacios, mayúsculas)
- [ ] No crear códigos duplicados
- [ ] **BUG CONOCIDO**: Verificar que el contador de usos se incrementa correctamente (no se sobreescribe con el ID)

---

## 19. Panel Admin — Usuarios

- [ ] Listar todos los usuarios registrados
- [ ] Ver detalle de usuario (nombre, email, fecha registro, rol)
- [ ] Activar/desactivar usuario
- [ ] Cambiar rol (cliente ↔ admin) — con precaución
- [ ] Buscar usuario por nombre o email
- [ ] **XSS**: Verificar que nombres con HTML/JS se renderizan de forma segura (sin ejecutar scripts)
- [ ] **SEGURIDAD**: Solo admin puede acceder a esta sección

---

## 20. Panel Admin — Clientes Empresariales

- [ ] Listar clientes empresariales (B2B)
- [ ] Crear nuevo cliente empresarial (nombre empresa, NIF, tipo)
- [ ] Editar datos de cliente empresarial
- [ ] Validar formato NIF
- [ ] Vincular con usuario registrado (si aplica)
- [ ] Eliminar cliente empresarial

---

## 21. Panel Admin — Ingresos

- [ ] Desglose de ingresos por período (mes/semana/día)
- [ ] Ingresos por usuario/cliente
- [ ] Ingresos descuentan cancelaciones (×1) y devoluciones (×2)
- [ ] Los totales cuadran con los pedidos reales
- [ ] Verificar cálculos con calculadora manual
- [ ] Las fechas usan timezone `Europe/Madrid`
- [ ] Exportar datos (si existe la función)

---

## 22. Panel Admin — Variantes de Peso

- [ ] Listar variantes de peso de todos los productos
- [ ] Crear variante: producto, peso (kg), precio total
- [ ] Precio se calcula automáticamente: peso × precio/kg
- [ ] Editar variante existente
- [ ] Eliminar variante manualmente
- [ ] Variante vendida → se elimina automáticamente del catálogo
- [ ] Variante de pedido cancelado → se recrea automáticamente
- [ ] Validar que peso > 0
- [ ] Validar que precio > 0

---

## 23. Panel Admin — Subida de Imágenes

- [ ] Subir imagen desde admin
- [ ] Se sube a Cloudinary correctamente
- [ ] Formatos aceptados: JPG, PNG, WEBP
- [ ] Tamaño máximo de archivo (validar en frontend y backend)
- [ ] La URL de la imagen se devuelve correctamente
- [ ] Imagen se puede previsualizar antes de subir
- [ ] Manejo de errores: archivo inválido, Cloudinary caído, file too large

---

## 24. Seguridad y Autorizaciones

### Autenticación
- [ ] Todas las rutas `/admin/*` requieren JWT + rol admin
- [ ] Todas las rutas `/api/admin/*` requieren JWT + rol admin
- [ ] Token JWT expirado → se intenta refresh automático
- [ ] Token JWT inválido → 401
- [ ] Cookies `auth_token` son `httpOnly: true` y `secure: true`
- [ ] Cookies `sb-refresh-token` son `httpOnly: true`
- [ ] **VERIFICAR**: ¿`register.ts` y `oauth-session.ts` usan `httpOnly: false`? (bug documentado)

### IDOR (Insecure Direct Object Reference)
- [ ] `/api/carrito/me` solo devuelve el carrito del usuario autenticado
- [ ] `/api/pedidos/:id` solo devuelve pedidos del usuario autenticado
- [ ] Un usuario NO puede ver/modificar pedidos de otro cambiando el ID
- [ ] Un usuario NO puede modificar el carrito de otro
- [ ] Un usuario NO puede acceder al perfil de otro

### XSS (Cross-Site Scripting)
- [ ] Probar `<script>alert('XSS')</script>` en:
  - [ ] Campo nombre de registro
  - [ ] Campo de contacto
  - [ ] Búsqueda de productos
  - [ ] Chat/chatbot (si existe)
  - [ ] Nombre de producto (admin)
  - [ ] Motivo de devolución
  - [ ] Cualquier campo de texto que se renderice en HTML
- [ ] Los datos se sanitizan antes de usar `innerHTML` (7 archivos reportados con `innerHTML` sin sanitizar)

### Rate Limiting
- [ ] Endpoints públicos tienen rate limiting (30 req/60s por defecto)
- [ ] Hacer >30 peticiones rápidas → devuelve 429
- [ ] El rate limiting se aplica por IP

### CSRF/Headers
- [ ] Verificar que los endpoints POST/PUT/DELETE validan correctamente el origen
- [ ] API endpoints no permiten acceso desde orígenes no autorizados (CORS)

### Endpoints de Debug
- [ ] `/api/debug/*` NO son accesibles por usuarios normales
- [ ] `/api/debug/*` NO son accesibles sin autenticación
- [ ] **RECOMENDACIÓN**: Estos endpoints deberían estar deshabilitados en producción

---

## 25. Stock y Concurrencia

### Control de Stock Atómico
- [ ] Al añadir al carrito → se decrementa el stock (usuario logueado)
- [ ] Al eliminar del carrito → se restaura el stock
- [ ] Al vaciar el carrito → se restaura todo el stock
- [ ] Al completar el pago → el stock ya estaba decrementado
- [ ] Al cancelar pedido → se restaura el stock
- [ ] Al cancelar pedido con variantes → se recrean las variantes (piezas únicas)

### Pruebas de Concurrencia
- [ ] 2 usuarios intentan comprar el último producto a la vez → solo uno lo consigue
- [ ] 2 usuarios intentan la misma variante de peso → solo uno la obtiene
- [ ] Si falla el pago → el stock se restaura correctamente
- [ ] Timeout de sesión Stripe → el stock se restaura

### Stock de Invitados
- [ ] Stock reservado por invitados ¿tiene expiración? (15 min documentado)
- [ ] Si el invitado abandona el checkout → ¿se libera el stock?
- [ ] **RIESGO**: Stock "fantasma" bloqueado por invitados que nunca pagan

### Consistencia
- [ ] Verificar que el stock en BD coincide con el stock mostrado en la tienda
- [ ] Verificar que no hay stock negativo en ningún momento
- [ ] Verificar stock tras una secuencia: añadir → comprar → cancelar → devolver

---

## 26. Responsive y UX

### Dispositivos Móviles (< 768px)
- [ ] Todas las páginas se ven bien en iPhone SE (320px)
- [ ] Todas las páginas se ven bien en iPhone 12 (390px)
- [ ] Todas las páginas se ven bien en Samsung Galaxy (360px)
- [ ] El menú de navegación funciona (hamburguesa)
- [ ] El carrito es usable en móvil
- [ ] El checkout es usable en móvil
- [ ] Las tablas del admin se adaptan o tienen scroll horizontal
- [ ] Los formularios son usables (teclado no tapa inputs)
- [ ] Los botones tienen tamaño mínimo 44x44px (touch-friendly)

### Tablets (768px - 1024px)
- [ ] Páginas se ven correctamente
- [ ] Orientación portrait y landscape
- [ ] Panel admin es usable

### Desktop (> 1024px)
- [ ] Layout aprovecha el espacio
- [ ] No hay contenido demasiado estrecho o demasiado ancho
- [ ] Imágenes no se deforman

### UX General
- [ ] Loading states: spinners o skeletons mientras carga
- [ ] Errores muestran mensajes claros al usuario (no errores técnicos)
- [ ] Confirmaciones antes de acciones destructivas (eliminar, cancelar)
- [ ] Toasts/notificaciones para acciones exitosas
- [ ] Formularios mantienen datos tras error de validación
- [ ] Navegación con teclado funciona (Tab, Enter)
- [ ] Focus visible en elementos interactivos
- [ ] Animaciones suaves (no saltos bruscos)
- [ ] Botones deshabilitados durante peticiones (evitar doble click)

---

## 27. SEO y Rendimiento

### SEO
- [ ] Cada página tiene `<title>` único y descriptivo
- [ ] Cada página tiene `<meta name="description">` único
- [ ] Imágenes tienen atributo `alt`
- [ ] URLs amigables (slugs en categorías y productos)
- [ ] `robots.txt` configurado correctamente
- [ ] Sitemap generado (si existe)
- [ ] Canonical URLs configuradas
- [ ] Open Graph tags para redes sociales

### Rendimiento
- [ ] Lighthouse score > 90 para Performance
- [ ] Lighthouse score > 90 para Accessibility
- [ ] Lighthouse score > 90 para Best Practices
- [ ] Lighthouse score > 90 para SEO
- [ ] Imágenes optimizadas (Cloudinary con transformaciones)
- [ ] No hay imágenes enormes sin comprimir
- [ ] CSS y JS minimizados en producción
- [ ] Lazy loading de imágenes debajo del fold
- [ ] TTFB (Time to First Byte) < 1s
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] CLS (Cumulative Layout Shift) < 0.1

---

## 28. Páginas Legales y Estáticas

- [ ] `/terminos` — Términos y Condiciones: contenido completo y legal
- [ ] `/privacidad` — Política de Privacidad: incluye RGPD
- [ ] `/cookies` — Política de Cookies: banner de cookies funciona
- [ ] `/devoluciones` — Política de Devoluciones: plazo y condiciones claras
- [ ] `/sin-acceso` — Página de acceso denegado
- [ ] Todas las páginas legales tienen contenido real (no placeholder)
- [ ] Los enlaces internos en las páginas legales funcionan
- [ ] Banner de cookies: se muestra al primer acceso
- [ ] Banner de cookies: al aceptar, no se vuelve a mostrar
- [ ] Banner de cookies: se puede rechazar (si aplica RGPD)

---

## 29. Casos Edge y Errores

### Errores HTTP
- [ ] Página 404 personalizada para rutas inexistentes
- [ ] Error 500 → página amigable (no stack trace)
- [ ] Error de red (offline) → comportamiento graceful

### Datos Edge
- [ ] Producto con precio = 0.01€ (mínimo) → funciona correctamente
- [ ] Producto con precio muy alto (9999.99€) → se muestra y cobra bien
- [ ] Pedido con 1 solo producto → funciona
- [ ] Pedido con 20+ productos → funciona
- [ ] Cantidad = 99 de un producto → ¿se permite?
- [ ] Nombre de usuario con caracteres especiales (ñ, ü, é, 中文, emoji 🎉)
- [ ] Email con subdominios (user@sub.domain.com)
- [ ] Descripción de producto muy larga
- [ ] Sin productos en la tienda → la página maneja el estado vacío
- [ ] Sin categorías → la navegación no se rompe

### Navegador
- [ ] Funciona en Chrome (última versión)
- [ ] Funciona en Firefox (última versión)
- [ ] Funciona en Safari (última versión)
- [ ] Funciona en Edge (última versión)
- [ ] Funciona en Chrome mobile (Android)
- [ ] Funciona en Safari mobile (iOS)
- [ ] Con JavaScript deshabilitado → ¿se degrada gracefully?
- [ ] Con cookies deshabilitadas → ¿qué pasa con la sesión?

### Múltiples Pestañas
- [ ] Abrir la tienda en 2 pestañas, añadir productos en ambas → el carrito es consistente
- [ ] Cerrar sesión en una pestaña → la otra pestaña refleja el cambio
- [ ] Hacer checkout en una pestaña mientras la otra está abierta → no hay conflictos

---

## 30. API Flutter / Móvil

- [ ] Login desde app móvil funciona (Authorization header con JWT)
- [ ] Los endpoints de la API devuelven JSON válido
- [ ] Los endpoints de la API manejan correctamente errores (códigos HTTP adecuados)
- [ ] El flujo de compra desde la app funciona end-to-end
- [ ] Las imágenes de Cloudinary se cargan en la app
- [ ] Los precios se muestran correctamente (formato correcto)
- [ ] La paginación de productos funciona
- [ ] La sesión no expira prematuramente

---

## Resumen de Bugs Conocidos (Verificar si siguen presentes)

| # | Severidad | Bug | Dónde verificar |
|---|-----------|-----|-----------------|
| 1 | **CRÍTICO** | Sin webhook de Stripe — si el navegador cierra post-pago, el pedido no se crea | Checkout → cerrar navegador tras pagar |
| 2 | **CRÍTICO** | `usos_actuales` del código promo se sobreescribe con el `id` en vez de incrementar | Usar un código promo 2 veces y verificar contador |
| 3 | **ALTO** | XSS: `innerHTML` sin sanitizar en 7+ archivos | Inyectar `<img src=x onerror=alert(1)>` en campos de texto |
| 4 | **ALTO** | Cookies de `register.ts` y `oauth-session.ts` con `httpOnly: false` | Verificar cookies en DevTools |
| 5 | **ALTO** | `userEmail` no declarada en `validar-y-crear-pedido.ts` | Forzar un error en la validación del pedido |
| 6 | **MEDIO** | `/mi-perfil` y `/mis-pedidos` no protegidas server-side | Acceder sin estar logueado |
| 7 | **MEDIO** | Stock de invitados sin expiración automática real | Reservar stock como invitado y esperar |
| 8 | **MEDIO** | Endpoints de debug accesibles | Probar `/api/debug/*` sin auth |
| 9 | **BAJO** | `console.log` en producción | Ver consola del navegador |
| 10 | **BAJO** | Código muerto `x-user-id` header | Inspeccionar requests en DevTools |

---

> **Total: ~250 comprobaciones** en 30 categorías.  
> Priorizar los bugs CRÍTICOS y ALTOS primero.
