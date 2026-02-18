export type UserRole = 'admin' | 'cliente';

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
}

// La autenticación se gestiona completamente via Supabase Auth.
// Las sesiones se manejan con cookies (auth_token, user_id, user_role).
// Este archivo solo exporta tipos e interfaces compartidas.

export function tieneRol(userRol: UserRole, rolesRequeridos: UserRole[]): boolean {
  const resultado = rolesRequeridos.includes(userRol);
  console.log(`🔍 Validando rol: ${userRol} en [${rolesRequeridos.join(', ')}] = ${resultado}`);
  return resultado;
}

export function cerrarSesion(token: string): void {
  sesiones.delete(token);
  console.log('Sesión cerrada');
}
