import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
  const token = context.cookies.get('auth_token')?.value;
  const userRole = context.cookies.get('user_role')?.value;
  const userName = context.cookies.get('user_name')?.value;
  const path = context.url.pathname;

  console.log(`\nMiddleware: ${path}`);
  console.log(`Token: ${token ? 'Sí' : 'No'}`);
  console.log(`Rol: ${userRole || 'No'}`);

  // Rutas que requieren autenticación (solo checkout por ahora)
  const rutasProtegidas = ['/checkout'];
  
  // Rutas que NO requieren autenticación (exentas)
  const rutasExentas = ['/checkout/exito'];
  
  const esRutaExenta = rutasExentas.some(ruta => path === ruta);
  
  if (!esRutaExenta && rutasProtegidas.some(ruta => path.startsWith(ruta))) {
    console.log('Ruta protegida detectada');
    
    if (!token) {
      console.log('⛔ No hay token, redirigiendo a login');
      return context.redirect('/login?redirect=' + encodeURIComponent(path));
    }

    console.log('✅ Usuario validado:', userName);
  }

  // Las rutas admin se validan en el layout del lado del cliente
  if (path.startsWith('/admin')) {
    console.log('👑 Ruta admin - validación en cliente');
  }

  return next();
});
