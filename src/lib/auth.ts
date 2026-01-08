export type UserRole = 'admin' | 'cliente';

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: UserRole;
}

// Datos de usuarios (en producción usar BD real)
const usuariosDB: Record<string, User & { password: string }> = {
  'admin@ibericosrg.com': {
    id: 1,
    nombre: 'Admin Ibéricos',
    email: 'admin@ibericosrg.com',
    password: 'admin123',
    rol: 'admin'
  },
  'cliente@example.com': {
    id: 2,
    nombre: 'Juan García',
    email: 'cliente@example.com',
    password: 'cliente123',
    rol: 'cliente'
  }
};

// Mapa de sesiones activas
const sesiones: Map<string, { usuario: User; fecha_expiracion: number }> = new Map();

export function generarToken(): string {
  return 'token_' + Math.random().toString(36).substring(2) + Date.now();
}

export function autenticar(email: string, password: string): { token: string; usuario: User } | null {
  // Buscar usuario en la "BD"
  const usuario = usuariosDB[email];
  
  if (!usuario) {
    console.log('❌ Usuario no encontrado:', email);
    return null;
  }

  // Validar contraseña
  if (usuario.password !== password) {
    console.log('❌ Contraseña incorrecta para:', email);
    return null;
  }

  // Generar token y crear sesión
  const token = generarToken();
  const fecha_expiracion = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 días

  const usuarioSinPassword = {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol
  };

  sesiones.set(token, {
    usuario: usuarioSinPassword,
    fecha_expiracion
  });

  console.log('✅ Autenticación exitosa para:', email);
  console.log('🔐 Token generado:', token);
  console.log('👤 Rol:', usuarioSinPassword.rol);

  return {
    token,
    usuario: usuarioSinPassword
  };
}

export function obtenerUsuarioDelToken(token: string): User | null {
  if (!token) {
    console.log('❌ No hay token');
    return null;
  }

  const sesion = sesiones.get(token);

  if (!sesion) {
    console.log('❌ Sesión no encontrada para token:', token);
    return null;
  }

  // Verificar si la sesión ha expirado
  if (Date.now() > sesion.fecha_expiracion) {
    console.log('⏰ Sesión expirada');
    sesiones.delete(token);
    return null;
  }

  console.log('✅ Usuario recuperado:', sesion.usuario.email);
  console.log('👤 Rol:', sesion.usuario.rol);

  return sesion.usuario;
}

export function tieneRol(userRol: UserRole, rolesRequeridos: UserRole[]): boolean {
  const resultado = rolesRequeridos.includes(userRol);
  console.log(`🔍 Validando rol: ${userRol} en [${rolesRequeridos.join(', ')}] = ${resultado}`);
  return resultado;
}

export function cerrarSesion(token: string): void {
  sesiones.delete(token);
  console.log('🚪 Sesión cerrada');
}
