import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && anonKey);

// Links de convite e de nova senha (RH, entrega 4) chegam com #...type=invite|recovery. O cliente do Supabase
// limpa o endereço ao entrar, então o tipo é lido antes: o app abre a tela de definir senha.
// Os e-mails do RH trazem ?token_hash=...&type=... e o código só é usado quando a pessoa salva a senha: assim o
// antivírus do e-mail, que abre os links antes da pessoa, não gasta o link.
const hash = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.slice(1));
const busca = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
const tipoLink = (v: string | null) => (['invite', 'recovery'] as const).find((t) => t === v) ?? null;
export const linkAuth = {
  tipo: tipoLink(hash.get('type')),
  erro: hash.get('error_description')?.replace(/\+/g, ' ') ?? null,
  tokenHash: busca.get('token_hash') && tipoLink(busca.get('type')) ? { token: busca.get('token_hash')!, tipo: tipoLink(busca.get('type'))! } : null,
};
if (linkAuth.erro && typeof window !== 'undefined') history.replaceState(null, '', window.location.pathname + window.location.search);

// Somente a chave pública (anon/publishable). A service_role nunca entra no frontend.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'nao-configurado');
