import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Faltan variables de entorno de Supabase: PUBLIC_SUPABASE_URL y/o PUBLIC_SUPABASE_ANON_KEY. '
    + 'Configúralas en .env antes de iniciar el servidor.'
  );
}

// Verificar si la service role key es válida (no es placeholder ni vacía)
const isValidServiceRoleKey = SUPABASE_SERVICE_ROLE_KEY && 
  SUPABASE_SERVICE_ROLE_KEY !== 'your-service-role-key' &&
  SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ');

// Cliente anónimo (para client-side y server-side sin service role)
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cliente con Service Role (para operaciones sensibles que requieren permisos elevados)
export const supabaseAdmin = isValidServiceRoleKey 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabaseClient; // Fallback al cliente anónimo si no hay service role key válida

export type Database = {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          nombre: string;
          email: string;
          rol: 'admin' | 'cliente' | 'moderador';
          activo: boolean;
          fecha_registro: string;
          fecha_actualizacion: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          email: string;
          rol?: 'admin' | 'cliente' | 'moderador';
          activo?: boolean;
          fecha_registro?: string;
          fecha_actualizacion?: string;
        };
      };
    };
  };
};
