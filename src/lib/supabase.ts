import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || 'https://tu-proyecto.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'tu-clave-anonima';

// Cliente anónimo (para client-side y server-side sin service role)
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
