# Ibéricos Rodríguez González - E-commerce

Aplicación web de comercio electrónico para venta de productos ibéricos, construida con Astro SSR, Supabase y Stripe.

## Resumen

El proyecto incluye:
- Catálogo público de productos, ofertas y contenido legal.
- Carrito, checkout y gestión de pedidos.
- Área privada de usuario (perfil, pedidos, seguimiento).
- Panel de administración para productos, categorías, ofertas, usuarios y pedidos.
- Integraciones de email (Nodemailer), PDFs (PDFKit) e imágenes (Cloudinary).

## Stack técnico

- Astro 5 (modo SSR con adaptador Node)
- TypeScript
- Supabase (Auth + PostgreSQL)
- Stripe (pagos)
- Cloudinary (gestión de imágenes)
- Nodemailer + Gmail (emails transaccionales)

## Requisitos

- Node.js 20 o superior
- npm
- Proyecto Supabase configurado
- Cuenta Stripe
- Cuenta Cloudinary
- Cuenta Gmail/App Password (para correos)

## Instalación y ejecución

```bash
npm install
npm run dev
```

Aplicación local en `http://localhost:4321`.

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con:

```env
# Supabase
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=

# Cloudinary
PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email (Nodemailer/Gmail)
GMAIL_USER=
GMAIL_PASSWORD=
ADMIN_EMAIL=

# (Opcional) Chat/IA
GROQ_API_KEY=
```

## Scripts disponibles

- `npm run dev`: entorno de desarrollo
- `npm run build`: build de producción
- `npm run preview`: previsualizar build
- `npm run start`: ejecutar servidor generado en `dist/server/entry.mjs`

## Estructura principal

```text
src/
  pages/         # Rutas públicas, privadas y APIs
  lib/           # Clientes e integraciones (supabase, stripe, email, cloudinary)
  components/    # Componentes UI
  layouts/       # Layouts de página
  middleware.ts  # Protección de rutas/admin y validación de sesión
schema/          # SQL de esquema, RLS, funciones y migraciones manuales
docs/            # Auditorías, QA, flujos y documentación funcional
public/          # Estáticos y uploads públicos
```

## Base de datos

La carpeta `schema/` contiene scripts SQL para:
- Esquema principal
- Políticas RLS
- Funciones RPC
- Ajustes de pedidos, carrito, ofertas, variantes y seguimiento

Aplica los scripts en Supabase según el entorno (desarrollo/producción) y en orden lógico (esquema base → alter/migrations → RLS/functions).

## Seguridad

- Middleware central en `src/middleware.ts` para proteger `/admin` y `/api/admin`.
- Validación de JWT contra Supabase.
- Comprobación de rol `admin` en base de datos.
- Renovación de sesión con refresh token cuando aplica.

## Documentación adicional

Consulta la carpeta `docs/` para detalle funcional y auditorías:
- `docs/DOCUMENTACION_PROYECTO.md`
- `docs/DOCUMENTACION_BASICA_ENTREGA.md`
- `docs/AUDITORIA_SEGURIDAD_API.md`
- `docs/QA_CHECKLIST_COMPLETA.md`
- `docs/FLUJO_CHECKOUT_CARRITO_DETALLADO.md`

## Despliegue

El proyecto está configurado con Astro en modo `server` y adaptador Node (`@astrojs/node` en modo `standalone`).

Flujo recomendado:
1. Definir variables de entorno de producción.
2. Ejecutar `npm run build`.
3. Arrancar con `npm run start`.

## Estado

Proyecto en evolución activa. Revisar `docs/ESTADO_ERRORES_CRITICOS.md` y `ERRORES_DETECTADOS.txt` antes de liberar cambios a producción.
