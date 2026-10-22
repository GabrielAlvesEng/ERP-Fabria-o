// RH, entrega 4 (decisão 69, resposta 1): o RH gerencia os logins do ERP.
// criar_login: cria o usuário no Auth e devolve o link de convite (o funcionário escolhe a própria senha).
// link_senha: devolve um link para o funcionário definir uma nova senha. desativar / reativar: bloqueia ou libera o login.
// A chave service_role vem do ambiente da Edge Function (SUPABASE_SERVICE_ROLE_KEY) e nunca vai para o site.
// O ERP nunca vê nem guarda senhas: só gera links. As regras de quem pode mexer em quem são as do banco
// (conferir_gestao_acesso, migration 39), chamadas como o próprio usuário logado.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGENS = ['https://gabrielalveseng.github.io', 'http://localhost:5173', 'http://localhost:4173'];
const cors = (origem: string | null) => ({
  'Access-Control-Allow-Origin': origem && ORIGENS.includes(origem) ? origem : ORIGENS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: h });
  try {
    const corpo = await req.json().catch(() => ({}));
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: eu } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (!eu?.user) return resposta({ erro: 'Faça login para gerenciar acessos.' }, 401);
    const { data: perms } = await sb.rpc('minhas_permissoes');
    if (!(perms as { modulo: string; acao: string }[] | null)?.some((p) => p.modulo === 'rh' && p.acao === 'critica')) {
      return resposta({ erro: 'Sem permissão para gerenciar acessos.' }, 403);
    }
    const adm = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const auditar = (registro: string, acao: string, depois: Record<string, unknown>) =>
      adm.from('auditoria').insert({ tabela: 'auth.users', registro_id: registro, acao, antes: null, depois, usuario_id: eu.user!.id });

    // O link volta para o próprio ERP, na tela de definir senha.
    const voltar = String(corpo.voltar ?? '');
    const redirectTo = ORIGENS.some((o) => voltar.startsWith(`${o}/`)) ? voltar : `${ORIGENS[0]}/ERP-Fabria-o/`;

    if (corpo.acao === 'criar_login') {
      const funcionarioId = String(corpo.funcionario_id ?? '');
      const email = String(corpo.email ?? '').trim().toLowerCase();
      if (!EMAIL.test(email)) return resposta({ erro: 'E-mail inválido.' }, 400);
      // A ficha é lida como o usuário logado: o RLS do RH vale aqui também.
      const { data: ficha } = await sb.from('funcionarios').select('id, nome, usuario_id, situacao').eq('id', funcionarioId).maybeSingle();
      if (!ficha) return resposta({ erro: 'Funcionário não encontrado.' }, 404);
      if (ficha.usuario_id) return resposta({ erro: 'Este funcionário já tem login.' }, 400);
      if (ficha.situacao === 'desligado') return resposta({ erro: 'Funcionário desligado não recebe login.' }, 400);
      const { data: existente } = await adm.from('usuarios').select('id').ilike('email', email).maybeSingle();
      if (existente) return resposta({ erro: 'Já existe um login com este e-mail. Use "Vincular login existente".' }, 400);

      const { data, error } = await adm.auth.admin.generateLink({ type: 'invite', email, options: { data: { nome: ficha.nome }, redirectTo } });
      if (error || !data.user) return resposta({ erro: `Não foi possível criar o login: ${error?.message ?? 'erro desconhecido'}.` }, 400);
      const { error: e2 } = await adm.from('funcionarios').update({ usuario_id: data.user.id }).eq('id', funcionarioId);
      if (e2) return resposta({ erro: `Login criado, mas não foi vinculado à ficha: ${e2.message}.` }, 500);
      await auditar(data.user.id, 'INSERT', { email, funcionario_id: funcionarioId, convite: true });
      return resposta({ usuario_id: data.user.id, link: data.properties.action_link, email });
    }

    const usuarioId = String(corpo.usuario_id ?? '');
    const { data: alvo } = await adm.from('usuarios').select('id, email, ativo').eq('id', usuarioId).maybeSingle();
    if (!alvo) return resposta({ erro: 'Usuário não encontrado.' }, 404);
    if (usuarioId === eu.user.id) return resposta({ erro: 'Você não pode mudar o próprio acesso por aqui. Use "Esqueci minha senha" no login.' }, 400);
    const { error: regra } = await sb.rpc('conferir_gestao_acesso', { p_usuario: usuarioId });
    if (regra) return resposta({ erro: regra.message }, 403);

    if (corpo.acao === 'link_senha') {
      const { data: u } = await adm.auth.admin.getUserById(usuarioId);
      // Quem nunca aceitou o convite recebe um convite novo; quem já entrou recebe o link de nova senha.
      const tipo = u?.user?.email_confirmed_at || u?.user?.last_sign_in_at ? 'recovery' : 'invite';
      const { data, error } = await adm.auth.admin.generateLink({ type: tipo, email: alvo.email, options: { redirectTo } });
      if (error) return resposta({ erro: `Não foi possível gerar o link: ${error.message}.` }, 400);
      await auditar(usuarioId, 'UPDATE', { link_senha: tipo });
      return resposta({ link: data.properties.action_link, email: alvo.email, tipo });
    }

    if (corpo.acao === 'desativar' || corpo.acao === 'reativar') {
      const ativar = corpo.acao === 'reativar';
      if (ativar) {
        const { data: f } = await adm.from('funcionarios').select('situacao').eq('usuario_id', usuarioId).maybeSingle();
        if (f?.situacao === 'desligado') return resposta({ erro: 'O funcionário está desligado. Mude a situação na ficha antes de reativar o login.' }, 400);
      } else {
        // Não deixa o ERP sem ninguém com acesso total.
        const { data: totais } = await adm.from('usuario_perfis').select('usuario_id, perfis!inner(acesso_total), usuarios!inner(ativo)')
          .eq('perfis.acesso_total', true).eq('usuarios.ativo', true);
        const ids = new Set((totais ?? []).map((t: { usuario_id: string }) => t.usuario_id));
        if (ids.has(usuarioId) && ids.size === 1) return resposta({ erro: 'Este é o único usuário com acesso total; dê o acesso total a outra pessoa antes.' }, 400);
      }
      const { error } = await adm.auth.admin.updateUserById(usuarioId, { ban_duration: ativar ? 'none' : '876000h' });
      if (error) return resposta({ erro: `Não foi possível ${ativar ? 'reativar' : 'desativar'} o login: ${error.message}.` }, 400);
      const { error: e2 } = await adm.from('usuarios').update({ ativo: ativar }).eq('id', usuarioId);
      if (e2) return resposta({ erro: e2.message }, 500);
      await auditar(usuarioId, 'UPDATE', { ativo: ativar });
      return resposta({ ativo: ativar });
    }

    return resposta({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    return resposta({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
