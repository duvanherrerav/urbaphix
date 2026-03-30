import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dhuerumqizprrudgurla.supabase.co';
const supabaseAnonKey = 'sb_publishable_BEqU5pfW-RA3Fh0oPA4frQ_3E1s1j3J';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);