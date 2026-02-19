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
