# Configuración de Supabase

## Pasos para conectar tu aplicación a Supabase:

### 1. Crear un proyecto en Supabase
- Ve a https://supabase.com/
- Crea una cuenta o inicia sesión
- Crea un nuevo proyecto
- Copia tu URL y claves de API

### 2. Configurar variables de entorno
En el archivo `.env.local` coloca:
```
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima
SUPABASE_SERVICE_ROLE_KEY=tu-clave-de-servicio
```

### 3. Ejecutar el SQL en Supabase
- Ve a tu proyecto en Supabase
- Abre el editor de SQL
- Copia todo el contenido de `database.sql`
- Ejecuta el script

### 4. Instalar paquete de Supabase
```bash
npm install @supabase/supabase-js
```

## Flujo de autenticación:

### Registro:
1. Usuario rellena: nombre, email, contraseña
2. Se crea en `auth.users` (Supabase)
3. Se crea en tabla `usuarios` con rol = 'cliente'

### Login:
1. Usuario intenta auth en `auth.users`
2. Si existe, se obtiene sus datos de tabla `usuarios`
3. Se valida que esté activo
4. Se obtiene su rol (admin/cliente)
5. Se setean cookies con token, rol, nombre, id
6. Redirect según rol:
   - admin → /admin/dashboard
   - cliente → /productos

### Middleware:
- Valida que exista `auth_token` en cookies
- Para rutas `/admin/*` valida que `user_role` = 'admin'

## Cambios en admins:
- Los admins NO se pueden crear por registro
- Deben ser asignados manualmente en la BD
- `UPDATE usuarios SET rol = 'admin' WHERE email = 'nuevo-admin@ejemplo.com'`

## Rutas disponibles:
- GET `/registro` - Página de registro
- POST `/api/auth/register` - Registrar nuevo usuario
- POST `/api/auth/login` - Iniciar sesión
- POST `/api/auth/logout` - Cerrar sesión
- GET `/login` - Página de login
- GET `/admin/dashboard` - Panel admin (requiere admin)
- GET `/productos` - Página de productos (requiere cliente)
