import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const validateFrontendEnv = () => {
  const missing = [];
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');

  if (missing.length > 0) {
    logger.error('Variables públicas Vite requeridas no configuradas', { missing: missing.join(', ') });
    throw new Error('Configuración de frontend incompleta');
  }
};

validateFrontendEnv();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
