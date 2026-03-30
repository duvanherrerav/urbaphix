import { supabase } from '@/services/supabaseClient';

export const testConexion = async () => {

  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .limit(5);

  console.log('DATA:', data);
  console.log('ERROR:', error);
};