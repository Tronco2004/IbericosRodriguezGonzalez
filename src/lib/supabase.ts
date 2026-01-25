import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || 'https://tu-proyecto.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'tu-clave-anonima';
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Cliente anónimo (para client-side y server-side sin service role)
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cliente con Service Role (para operaciones sensibles que requieren permisos elevados)
export const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabaseClient; // Fallback al cliente anónimo si no hay service role key

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
