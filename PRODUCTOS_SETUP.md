# Guía: Cómo Guardar Productos en la Base de Datos

## Lo que se ha implementado ✅

### 1. Panel de Administración de Productos
- **Archivo**: `/admin/productos`
- **Funcionalidades**:
  - Crear nuevos productos (nombre, precio, stock, categoría, descripción, imagen)
  - Editar productos existentes
  - Eliminar productos
  - Buscar y filtrar por categoría
  - Subir imágenes con preview

### 2. Endpoints de API Integrados con Supabase

#### `/api/admin/guardar-producto` (POST)
Guarda, actualiza o elimina productos en Supabase:
```javascript
POST /api/admin/guardar-producto
Body: {
  action: 'create' | 'update' | 'delete',
  producto: { nombre, precio, stock, categoria, descripcion, imagen },
  id: number (solo para update/delete)
}
```

**Lo que hace**:
- Crea: Inserta en tabla `productos` con mapeo de `categoria_id`
- Actualiza: Modifica el producto existente
- Elimina: Borra el producto de la BD

#### `/api/admin/productos-list` (GET)
Carga los productos desde Supabase:
- Lee de la tabla `productos` 
- Mapea automáticamente `precio_centimos` → `precio`
- Mapea automáticamente `categoria_id` → slug (`jamones`, `quesos`, `embutidos`)
- Fallback a datos por defecto si Supabase no está disponible

### 3. Sincronización con localStorage
- Los productos se guardan en localStorage como respaldo local
- Las vistas públicas (`/productos`, `/categoria/[slug]`) leen desde localStorage
- Cuando guardes un producto en admin, se sincroniza con Supabase

## Qué falta: Configurar Supabase ⚙️

### Paso 1: Crear un proyecto Supabase
1. Ve a https://supabase.com/
2. Crea una cuenta
3. Crea un nuevo proyecto
4. Espera a que se complete

### Paso 2: Obtener las claves
En tu proyecto Supabase:
- Ve a Settings → API Keys
- Copia:
  - `Project URL` → `PUBLIC_SUPABASE_URL`
  - `anon public` → `PUBLIC_SUPABASE_ANON_KEY`
  - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

### Paso 3: Crear archivo .env.local
En la raíz del proyecto, crea `.env.local`:
```
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Paso 4: Ejecutar el SQL
En Supabase (SQL Editor):
1. Copia TODO el contenido de `database.sql`
2. Ejecuta el script
3. Esto creará las tablas automáticamente

## Después de Supabase ✅

Una vez configurado:
1. Los productos que crees en `/admin/productos` se guardarán en Supabase
2. Las vistas públicas mostrarán los productos de Supabase
3. Los datos persistirán entre sesiones
4. El localStorage sirvirá como respaldo

## Flujo actual de guardado:

```
Panel Admin → Producto Guardado
              ↓
         localStorage (respaldo inmediato)
              ↓
         API /guardar-producto
              ↓
         Supabase BD (guardado permanente)
              ↓
         Vistas públicas (sincronización)
```

## Estado actual (sin Supabase):
- ✅ Los productos se guardan en localStorage
- ✅ Las vistas públicas leen desde localStorage
- ❌ Los productos NO persisten en BD real
- ❌ Al reiniciar servidor, se pierden los productos

## Próximos pasos:
1. Configura Supabase según los pasos arriba
2. Reinicia el servidor
3. Crea un nuevo producto
4. ¡Verás que se guarda en la BD! 🎉
