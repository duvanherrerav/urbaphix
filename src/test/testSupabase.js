import { supabase } from '@/services/supabaseClient';
import { logger } from '../utils/logger';

export const testConexion = async () => {

  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .limit(5);

  logger.info('testConexion: pagos consultados', { count: data?.length || 0 });
  logger.error('testConexion: error consultando pagos', error);
};