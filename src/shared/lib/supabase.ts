import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && anonKey);

// Somente a chave pública (anon/publishable). A service_role nunca entra no frontend.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'nao-configurado');
