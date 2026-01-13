# IbericosRG - Tienda Online de Productos Ibéricos Premium

**Descripción**: Tienda online moderna y sofisticada especializada en jamones, quesos, embutidos y productos ibéricos premium. Plataforma completa con sistema de administración, autenticación, carrito de compras y gestión de ofertas.

---

## 📋 Tabla de Contenidos

1. [Características Principales](#características-principales)
2. [Tecnologías Utilizadas](#tecnologías-utilizadas)
3. [Instalación](#instalación)
4. [Configuración](#configuración)
5. [Estructura del Proyecto](#estructura-del-proyecto)
6. [Módulos Implementados](#módulos-implementados)
7. [APIs Disponibles](#apis-disponibles)
8. [Cómo Usar](#cómo-usar)

---

## ✨ Características Principales

### 🛍️ Cliente
- ✅ **Página Principal Mejorada** - Hero section, productos destacados, beneficios
- ✅ **Catálogo de Productos** - Navegación por categorías, filtros, búsqueda
- ✅ **Carrito de Compras** - Agregar/quitar items, persistencia en localStorage
- ✅ **Autenticación** - Login/registro con Supabase
- ✅ **Sección de Ofertas** - Mostrar promociones especiales en página principal y página dedicada
- ✅ **Sistema de Categorías** - Navegación por categorías dinámicas
- ✅ **Página de Detalles de Producto** - Información completa, rating, stock

### 👑 Admin
- ✅ **Dashboard Premium** - Estadísticas, gráficos, KPIs
- ✅ **Gestión de Productos** - Crear, editar, eliminar productos
- ✅ **Gestión de Categorías** - Administrar categorías
- ✅ **Gestión de Ofertas** - Crear promociones con descuentos automáticos
- ✅ **Gestión de Clientes** - Ver usuarios, cambiar estado
- ✅ **Gestión de Empresas** - Clientes empresariales con datos fiscales
- ✅ **Variantes de Productos** - Crear variantes (tallas, colores, etc.)
- ✅ **Sistema de Subida de Imágenes** - Integración con Cloudinary
- ✅ **Panel Hamburguesa** - Menú lateral elegante y responsivo

### 🔐 Seguridad
- ✅ **Rutas Protegidas** - Acceso solo para usuarios autenticados
- ✅ **Control de Roles** - Diferenciación entre admin y cliente
- ✅ **Tokens JWT** - Autenticación segura con Supabase
- ✅ **Middleware** - Validación en todas las rutas sensibles

### 📸 Imágenes
- ✅ **Almacenamiento en Cloudinary** - Optimización automática de imágenes
- ✅ **URLs Adaptativas** - Imágenes optimizadas por resolución
- ✅ **Subida Fácil** - Formulario intuitivo para subir fotos

---

## 🛠️ Tecnologías Utilizadas

| Categoría | Tecnología |
|-----------|-----------|
| **Framework** | Astro 4.1.2 |
| **Lenguaje** | TypeScript 5.3.3 |
| **Backend** | Node.js (Astro SSR) |
| **Base de Datos** | Supabase (PostgreSQL) |
| **Autenticación** | Supabase Auth |
| **Almacenamiento de Imágenes** | Cloudinary |
| **Estilos** | CSS Inline + Tailwind Config |
| **Gráficos** | Chart.js 4.4.0 |
| **Servidor Estático** | @astrojs/node |

---

## 📦 Instalación

### Requisitos Previos
- Node.js 18+ 
- npm o yarn
- Cuenta en Supabase
- Cuenta en Cloudinary

### Pasos de Instalación

```bash
# 1. Clonar o descargar el proyecto
cd IbericosRodriguezGonzalez

# 2. Instalar dependencias
npm install --legacy-peer-deps

# 3. Crear archivo .env.local (no compartir)
cp .env.example .env.local

# 4. Completar credenciales en .env.local
# Ver sección de Configuración

# 5. Iniciar servidor de desarrollo
npm run dev

# 6. Acceder a
# Cliente: http://localhost:4321
# Admin: http://localhost:4321/admin/dashboard
```

---

## ⚙️ Configuración

### Variables de Entorno (.env.local)

```dotenv
# Supabase
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Cloudinary
PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Configuración de Supabase

1. Crear proyecto en https://app.supabase.com
2. Ejecutar scripts SQL:
   - `database.sql` - Tablas principales
   - `ofertas_setup.sql` - Tabla de ofertas
   - `CLIENTES_EMPRESARIALES_SETUP.sql` - Clientes B2B
   - `PRECIOS_EMPRESA_SETUP.sql` - Precios especiales
   - `PRODUCTOS_SETUP.md` - Inserción de datos

3. Copiar credenciales a `.env.local`

### Configuración de Cloudinary

1. Crear cuenta en https://cloudinary.com
2. Ir a Dashboard → Account
3. Copiar:
   - Cloud Name
   - API Key
   - API Secret

---

## 📁 Estructura del Proyecto

```
src/
├── pages/
│   ├── index.astro                 # Página principal
│   ├── login.astro                 # Login
│   ├── registro.astro              # Registro
│   ├── carrito.astro               # Carrito de compras
│   ├── ofertas.astro               # Página de todas las ofertas
│   ├── sin-acceso.astro            # Página 403
│   ├── categoria/
│   │   └── [slug].astro            # Página de categoría dinámica
│   ├── productos/
│   │   ├── index.astro             # Catálogo completo
│   │   └── [id].astro              # Detalle de producto
│   ├── admin/
│   │   ├── dashboard.astro         # Dashboard principal
│   │   ├── productos.astro         # Gestión de productos
│   │   ├── categorias.astro        # Gestión de categorías
│   │   ├── ofertas.astro           # Gestión de ofertas
│   │   ├── empresas.astro          # Clientes empresariales
│   │   ├── clientes.astro          # Usuarios
│   │   ├── pedidos.astro           # Órdenes
│   │   ├── variantes.astro         # Variantes de producto
│   │   ├── estadisticas.astro      # Analytics
│   │   ├── setup.astro             # Inicialización
│   │   └── subir-imagen.astro      # Gestor de imágenes
│   └── api/
│       ├── admin/
│       │   ├── productos.ts        # CRUD productos
│       │   ├── categorias.ts       # CRUD categorías
│       │   ├── ofertas.ts          # CRUD ofertas
│       │   ├── ofertas/[id].ts     # Actualizar/eliminar oferta
│       │   ├── empresas.ts         # Gestión empresas
│       │   ├── usuarios.ts         # Gestión usuarios
│       │   ├── upload.ts           # Subida a Cloudinary
│       │   ├── dashboard-stats.ts  # Estadísticas
│       │   ├── variantes.ts        # Variantes
│       │   └── productos-list.ts   # Lista de productos
│       ├── auth/
│       │   ├── login.ts            # Autenticación
│       │   ├── logout.ts           # Cierre de sesión
│       │   ├── register.ts         # Registro
│       │   ├── callback.ts         # Callback OAuth
│       │   ├── me.ts               # Usuario actual
│       │   └── social-login.ts     # Login social
│       ├── carrito/
│       │   ├── index.ts            # Lista carrito
│       │   ├── agregar.ts          # Agregar al carrito
│       │   └── [id].ts             # Gestión items
│       ├── ofertas/
│       │   └── index.ts            # Ofertas activas
│       └── productos/
│           ├── [id].ts             # Detalle producto
│           └── index.ts            # Lista productos
├── layouts/
│   ├── Layout.astro                # Layout principal
│   ├── ProtectedLayout.astro       # Layout protegido
│   └── Layout-old.astro            # Layout anterior
├── lib/
│   ├── auth.ts                     # Funciones de autenticación
│   ├── supabase.ts                 # Cliente Supabase
│   ├── carrito.ts                  # Lógica del carrito
│   └── cloudinary.ts               # Funciones Cloudinary
├── components/
│   └── OfertasSection.astro        # Componente de ofertas
├── middleware.ts                    # Middleware global
└── env.d.ts                         # Tipos de entorno

public/
└── uploads/                         # (Antiguo, ahora Cloudinary)

Database/
├── database.sql                     # Esquema principal
├── ofertas_setup.sql               # Tabla ofertas
├── CLIENTES_EMPRESARIALES_SETUP.sql # Clientes B2B
└── PRECIOS_EMPRESA_SETUP.sql       # Precios especiales
```

---

## 🚀 Módulos Implementados

### 1. **Autenticación & Usuarios**
- Login con email/contraseña
- Registro de nuevos usuarios
- Persistencia de sesión con tokens JWT
- Roles: admin y cliente
- Endpoints: `/api/auth/*`

### 2. **Productos & Categorías**
- CRUD completo de productos
- Gestión de categorías
- Variantes de productos (tallas, opciones)
- Búsqueda y filtros
- Rating de productos
- Endpoints: `/api/admin/productos*`, `/api/productos*`

### 3. **Carrito de Compras**
- Agregar/quitar items
- Actualizar cantidades
- Persistencia en localStorage
- Cálculo de totales
- Endpoints: `/api/carrito/*`

### 4. **Sistema de Ofertas** ⭐ (Nuevo)
- Crear promociones con descuentos automáticos
- Validación de fechas de vigencia
- Orden de visualización personalizable
- Mostrar en página principal
- Página dedicada `/ofertas`
- Endpoints: `/api/ofertas`, `/api/admin/ofertas*`
- Panel de administración: `/admin/ofertas`

### 5. **Gestión de Imágenes**
- Subida a Cloudinary
- URLs optimizadas
- Eliminación de imágenes
- Formulario intuitivo
- Endpoints: `/api/admin/upload`

### 6. **Dashboard Admin**
- Estadísticas en tiempo real
- Gráficos de ingresos y pedidos
- KPIs (productos, pedidos, clientes, ingresos)
- Menú hamburguesa elegante
- Responsive design

### 7. **Gestión de Empresas**
- Registro de clientes B2B
- Datos fiscales (NIF, RUT, RFC, CUIT)
- Tipos de cliente (Bar, Restaurante, Tienda, etc.)
- Contactos y notas
- Endpoints: `/api/admin/empresas`

### 8. **Rutas Protegidas**
- Middleware que valida tokens
- Redirección a login si no autenticado
- Control de roles
- Protección de rutas admin

---

## 🔌 APIs Disponibles

### Autenticación
```
POST /api/auth/login        # Iniciar sesión
POST /api/auth/register     # Registrar usuario
POST /api/auth/logout       # Cerrar sesión
GET  /api/auth/me           # Datos usuario actual
```

### Productos
```
GET  /api/admin/productos           # Lista productos
POST /api/admin/productos           # Crear producto
GET  /api/productos/[id]            # Detalle producto
POST /api/admin/productos           # Guardar producto
```

### Categorías
```
GET  /api/admin/categorias          # Lista categorías
POST /api/admin/categorias          # Crear categoría
DELETE /api/admin/categorias/[id]   # Eliminar categoría
```

### Ofertas (Nuevo)
```
GET  /api/ofertas?limit=6           # Ofertas activas (público)
GET  /api/admin/ofertas             # Todas las ofertas (admin)
POST /api/admin/ofertas             # Crear oferta
PUT  /api/admin/ofertas/[id]        # Actualizar oferta
DELETE /api/admin/ofertas/[id]      # Eliminar oferta
```

### Carrito
```
GET  /api/carrito                   # Items del carrito
POST /api/carrito/agregar           # Agregar al carrito
DELETE /api/carrito/[id]            # Eliminar del carrito
```

### Imágenes
```
POST /api/admin/upload              # Subir a Cloudinary
```

### Dashboard
```
GET  /api/admin/dashboard-stats     # Estadísticas
```

### Empresas
```
GET  /api/admin/empresas            # Lista empresas
POST /api/admin/empresas            # Crear empresa
```

---

## 📖 Cómo Usar

### 👤 Como Cliente

#### Navegar por Productos
1. Ir a `/productos`
2. Filtrar por categoría
3. Hacer clic en un producto para ver detalles
4. Agregar al carrito

#### Comprar
1. Agregar items al carrito
2. Ir a `/carrito`
3. Revisar y ajustar cantidades
4. (Próximamente) Procesar pago

#### Ver Ofertas
1. En página principal, ver sección "Ofertas Especiales"
2. O ir a `/ofertas` para ver todas
3. Hacer clic en "Ver Oferta" para ir al producto

#### Crear Cuenta
1. Ir a `/registro`
2. Completar formulario
3. Confirmar email
4. Iniciar sesión en `/login`

---

### 👑 Como Administrador

#### Acceder al Dashboard
1. Ir a `/login` como usuario admin
2. Acceder a `/admin/dashboard`
3. Usar menú hamburguesa para navegar

#### Gestionar Productos
1. En dashboard, clic en "Productos" (menú)
2. Ver tabla con productos
3. Crear nuevo: botón "+ Nuevo Producto"
4. Editar: clic en "Editar"
5. Eliminar: clic en "Eliminar"

#### Crear Ofertas
1. En dashboard, clic en "Ofertas" (menú) ⭐
2. Clic en "+ Nueva Oferta"
3. Completar formulario:
   - Seleccionar producto
   - Nombre de oferta (ej: "Black Friday")
   - Precio original y descuento
   - Fechas de inicio y fin
4. Guardar
5. La oferta aparecerá automáticamente en la página principal

#### Subir Imágenes
1. Opción 1: Durante creación de producto
2. Opción 2: Ir a `/admin/subir-imagen`
3. Seleccionar archivo
4. Subir (se guarda en Cloudinary automáticamente)

#### Gestionar Categorías
1. En dashboard, clic en "Categorías"
2. Crear/editar/eliminar categorías
3. Cambiar slug y descripción

#### Ver Estadísticas
1. En `/admin/dashboard`
2. Ver KPIs superiores
3. Ver gráficos de ingresos y pedidos
4. Analytics en tarjetas inferiores

---

## 📊 Ejemplo Práctico: Crear una Oferta

**Escenario**: Tienes un "Jamón Ibérico" a 99.99€ y quieres hacer oferta al 40% hasta el 31 de enero.

**Pasos**:
1. Ve a `/admin/dashboard`
2. Clic en menú hamburguesa → "Ofertas"
3. Clic en "+ Nueva Oferta"
4. Completa:
   - **Producto**: Jamón Ibérico
   - **Nombre**: "40% Off en Jamón Ibérico"
   - **Precio Original**: 99.99
   - **Precio Descuento**: 59.99 (40% off automático)
   - **Fecha Inicio**: Hoy a las 00:00
   - **Fecha Fin**: 31/01/2026 a las 23:59
5. Clic en "Guardar Oferta"
6. ✅ La oferta aparece en:
   - Sección "Ofertas Especiales" en home
   - Página completa `/ofertas`
   - Se muestra automáticamente

**Resultado**: Los clientes ven el descuento del 40% destacado en las tarjetas de oferta.

---

## 🔧 Troubleshooting

### Las ofertas no aparecen
- ✅ Ejecutaste `ofertas_setup.sql` en Supabase
- ✅ La oferta tiene `activa = true`
- ✅ Fecha actual está entre inicio y fin
- ✅ El producto existe y está activo

### Las imágenes no se suben
- ✅ Credenciales de Cloudinary correctas en `.env.local`
- ✅ Tamaño de imagen < 5MB
- ✅ Formato imagen válido (jpg, png, webp, etc.)

### No puedo acceder a admin
- ✅ Usuario tiene rol `admin` en base de datos
- ✅ Token no expirado (revisar cookies)
- ✅ Contraseña correcta

### Los productos no cargan
- ✅ Tabla `productos` existe en Supabase
- ✅ Credenciales Supabase correctas
- ✅ Productos tienen `activo = true`

---

## 📚 Documentación Adicional

| Archivo | Descripción |
|---------|-------------|
| `SUPABASE_SETUP.md` | Guía de configuración de Supabase |
| `OFERTAS_SETUP.md` | Documentación completa del sistema de ofertas |
| `database.sql` | Esquema de base de datos |
| `ofertas_setup.sql` | Tabla y índices de ofertas |

---

## 🎨 Paleta de Colores

| Color | Uso |
|-------|-----|
| `#a89968` | Oro premium (botones, acentos) |
| `#8b7355` | Marrón oscuro (hover, sombras) |
| `#001a33` | Azul marino (textos, fondos) |
| `#f8f7f4` | Crema (fondos claros) |
| `#64748b` | Gris (textos secundarios) |
| `#dc2626` | Rojo (errores, descuentos) |

---

## 📱 Responsividad

El proyecto es **100% responsive** para:
- ✅ Desktop (1920px+)
- ✅ Laptop (1024px - 1920px)
- ✅ Tablet (768px - 1024px)
- ✅ Mobile (320px - 768px)

---

## 🚀 Próximos Pasos Recomendados

- [ ] Implementar sistema de pagos (Stripe, PayPal)
- [ ] Crear sistema de pedidos/órdenes
- [ ] Agregar reseñas de productos
- [ ] Sistema de notificaciones por email
- [ ] Integración con analytics
- [ ] Sistema de cupones/códigos descuento
- [ ] Wishlist de productos
- [ ] Programa de lealtad

---

## 📞 Soporte

Para preguntas o problemas:
1. Revisar archivos de documentación específicos
2. Verificar logs en consola del navegador (F12)
3. Revisar endpoints API en `src/pages/api/`

---

## 📄 Licencia

Proyecto privado - Todos los derechos reservados IbericosRG © 2026

---

**Última actualización**: 13 de enero de 2026
**Versión**: 1.0.0
**Estado**: ✅ En desarrollo activo
