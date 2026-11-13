// SolidAuto (app da Engenharia no Windows): "Entrar com o ERP".
// Quem já está logado no ERP clica em "Entrar no SolidAuto" e o app recebe um código de uso único para abrir
// uma sessão própria, sem digitar a senha. A sessão do navegador não é tocada (o app não recebe o token dela).
// O código é o hashed_token de um link mágico gerado pelo Auth (não manda e-mail). O app troca o código por
// uma sessão em /auth/v1/verify; ele vale uma vez e vence no prazo do Auth (1 hora por padrão).
// Só quem tem engenharia.ler recebe o código. A service_role vem do ambiente e só é usada no generateLink.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGENS = ['https://gabrielalveseng.github.io', 'https://erp-fabriaco-brasil.netlify.app', 'http://localhost:5173', 'http://localhost:4173'];
const cors = (origem: string | null) => ({
  'Access-Control-Allow-Origin': origem && ORIGENS.includes(origem) ? origem : ORIGENS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: h });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: eu } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (!eu?.user?.email) return resposta({ erro: 'Faça login no ERP para entrar no SolidAuto.' }, 401);
    const { data: perms } = await sb.rpc('minhas_permissoes');
    if (!(perms as { modulo: string; acao: string }[] | null)?.some((p) => p.modulo === 'engenharia' && p.acao === 'ler')) {
      return resposta({ erro: 'Seu usuário não tem acesso à Engenharia, que o SolidAuto usa.' }, 403);
    }
    const adm = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data, error } = await adm.auth.admin.generateLink({ type: 'magiclink', email: eu.user.email });
    if (error || !data?.properties?.hashed_token) return resposta({ erro: `Não foi possível gerar o acesso: ${error?.message ?? 'sem código'}.` }, 500);
    return resposta({ token_hash: data.properties.hashed_token, email: eu.user.email });
  } catch (e) {
    return resposta({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
