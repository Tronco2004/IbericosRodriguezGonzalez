# Ibéricos Rodríguez González

Tienda online de productos ibéricos con panel de administración.

**URL:** https://ibericosrodriguezgonzalez.victoriafp.online

---

## Stack

| Tecnología | Uso |
|---|---|
| Astro 5 (SSR) | Framework web |
| Supabase | Base de datos + autenticación |
| Stripe | Pagos |
| Cloudinary | Imágenes |
| Nodemailer | Emails |
| PDFKit | Facturas PDF |

---

## Scripts

```bash
npm install      # Instalar dependencias
npm run dev      # Desarrollo
npm run build    # Compilar
npm run start    # Producción
```

---

## Variables de Entorno

```env
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
PUBLIC_STRIPE_PUBLISHABLE_KEY=
PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GMAIL_USER=
GMAIL_PASSWORD=
```

---

## Estructura

```
src/
├── middleware.ts              # Protección rutas admin
├── layouts/
│   ├── Layout.astro           # Layout principal
│   └── ProtectedLayout.astro  # Wrapper admin
├── lib/
│   ├── supabase.ts            # Clientes BD
│   ├── stripe.ts              # Pagos y reembolsos
│   ├── auth-helpers.ts        # Validación JWT
│   ├── email.ts               # Emails + facturas PDF
│   ├── cloudinary.ts          # Subida de imágenes
│   ├── stock.ts               # Control de stock
│   ├── rate-limit.ts          # Límite de peticiones
│   └── categorias-hierarchy.ts # Árbol de categorías
└── pages/
    ├── admin/                 # 14 vistas de administración
    ├── api/                   # 68 endpoints
    └── *.astro                # Páginas públicas
```

---

## Páginas Públicas

- `/` — Inicio
- `/productos` — Catálogo
- `/productos/:id` — Detalle de producto
- `/categoria/:slug` — Productos por categoría
- `/ofertas` — Ofertas activas
- `/carrito` — Carrito de compra
- `/checkout/exito` — Confirmación de pago
- `/login` / `/registro` — Autenticación
- `/mi-perfil` — Perfil del usuario
- `/mis-pedidos` — Historial de pedidos
- `/seguimiento` — Seguimiento por código
- `/contacto` — Contacto
- `/sobre-nosotros` — Sobre nosotros
- `/terminos`, `/privacidad`, `/cookies`, `/devoluciones` — Legales

---

## Panel Admin (`/admin/`)

- **Dashboard** — KPIs: ingresos, pedidos, ticket promedio, stock bajo, clientes
- **Productos** — CRUD de productos (simples y con variantes de peso)
- **Pedidos** — Gestión de pedidos y cambios de estado
- **Categorías** — Categorías y subcategorías
- **Ofertas** — Descuentos temporales en productos
- **Códigos Descuento** — Códigos promocionales
- **Usuarios** — Gestión de cuentas
- **Clientes/Empresas** — Clientes empresariales (B2B)
- **Ingresos** — Desglose por usuario
- **Variantes** — Variantes de peso variable
- **Subir Imagen** — Upload a Cloudinary

---

## Base de Datos (tablas principales)

- **usuarios** — id, nombre, email, rol (admin/cliente), activo
- **productos** — nombre, precio_centimos, stock, categoria_id, precio_por_kg, activo
- **producto_variantes** — producto_id, peso_kg, precio_total, disponible
- **categorias** — nombre, slug, categoria_padre (jerarquía)
- **pedidos** — usuario_id, stripe_session_id, estado, total, email_cliente, es_invitado, codigo_seguimiento
- **pedido_items** — pedido_id, producto_id, cantidad, precio_unitario, subtotal
- **codigos_promocionales** — codigo, tipo_descuento (porcentaje/fijo), valor_descuento, uso_maximo
- **ofertas** — producto_id, precio_original, precio_descuento, fechas, activa
- **clientes_empresariales** — nombre_empresa, NIF, tipo_cliente

---

## Autenticación

- Supabase Auth con JWT.
- Cookies: `auth_token` (7 días), `sb-refresh-token` (1 año).
- Validación: cookie → header Authorization (Flutter) → refresh token.
- `requireAuth()` → 401 si no hay usuario.
- `requireAdmin()` → 403 si no es admin.

---

## Flujo de Compra

1. Usuario añade productos al carrito.
2. En checkout se crea una sesión de Stripe (precios validados server-side).
3. Stripe redirige a `/checkout/exito` tras el pago.
4. Se valida el pago y se crea el pedido en BD.
5. Se envía email de confirmación con factura PDF.

Envío fijo: **5€**. Soporta compra como invitado (sin registro).

---

## Estados de Pedido

```
pagado → preparando → enviado → entregado
  │                                  │
  ├→ cancelado (FINAL)               │
  └→ devolucion_solicitada ←─────────┘
         ├→ devolucion_recibida (FINAL)
         └→ devolucion_denegada
```

- Estados finales (`cancelado`, `devolucion_recibida`): no se pueden modificar.
- Cancelación: solo desde `pagado`, incluye reembolso Stripe + restauración de stock.

---

## Productos con Peso Variable

Piezas únicas (ej: jamón de 7.2 kg). Cada pieza es una variante con peso y precio individual.

- Precio = peso × precio/kg.
- Al venderse, el trigger SQL elimina la variante (pieza única).
- Al cancelarse, se recrea la variante.

---

## Emails

| Email | Cuándo |
|---|---|
| Confirmación de pedido (+ factura PDF) | Pago exitoso |
| Cancelación (+ factura rectificativa) | Pedido cancelado |
| Solicitud de devolución | Cliente solicita |
| Devolución aprobada/denegada | Admin decide |
| Notificación al admin | Cancelación o devolución |
| Bienvenida | Registro |

---

## Ingresos

```
Ingresos mes = todos los pedidos − cancelados (×1) − devoluciones (×2)
Ticket promedio = pedidos exitosos / nº pedidos exitosos
```

- Cancelados restan ×1 (dinero devuelto).
- Devoluciones restan ×2 (dinero + producto perdido).
- Todas las fechas usan zona horaria `Europe/Madrid`.

---

## Seguridad

- **Middleware**: protege `/admin/*` y `/api/admin/*` (JWT + rol admin).
- **RLS**: políticas por tabla en Supabase (catálogo público, pedidos solo propios, admin vía service_role).
- **Rate limiting**: en memoria por IP (30 req/60s por defecto).
- **Stock**: operaciones atómicas con patrón CAS (5 reintentos con backoff).
