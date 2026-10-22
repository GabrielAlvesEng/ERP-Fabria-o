// RH, entrega 4 (decisão 69, resposta 1): o RH gerencia os logins do ERP.
// criar_login: cria o usuário no Auth e manda o convite por e-mail (o funcionário escolhe a própria senha).
// link_senha: manda por e-mail o link para definir uma nova senha. Se o e-mail não sair, devolve o link para o RH.
// desativar / reativar: bloqueia ou libera o login.
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
    // A service_role só é usada no Auth (criar usuário, gerar link, bloquear login). Tabelas são lidas e gravadas
    // como o usuário logado, pelas funções do banco (migration 42), com as regras de lá.
    const adm = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const auditar = (usuario: string, dados: Record<string, unknown>) => sb.rpc('registrar_acesso_rh', { p_usuario: usuario, p_dados: dados });

    // O link volta para o próprio ERP, na tela de definir senha.
    const voltar = String(corpo.voltar ?? '');
    const redirectTo = ORIGENS.some((o) => voltar.startsWith(`${o}/`)) ? voltar : `${ORIGENS[0]}/ERP-Fabria-o/`;

    // Link para a pessoa definir a senha, mandado por e-mail pelo Supabase Auth (SMTP configurado no painel).
    // Se o e-mail não sair, devolve o link para o RH mandar. Quem nunca entrou aparece como convite.
    async function linkSenha(usuarioId: string, email: string) {
      const { data: u } = await adm.auth.admin.getUserById(usuarioId);
      const tipo = u?.user?.last_sign_in_at ? 'recovery' : 'invite';
      const publico = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
      const { error: falhou } = await publico.auth.resetPasswordForEmail(email, { redirectTo });
      if (!falhou) return { enviado: true, email, tipo };
      const { data, error } = await adm.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } });
      if (error) throw new Error(`Não foi possível gerar o link: ${error.message}.`);
      return { enviado: false, motivo: falhou.message, link: data.properties.action_link, email, tipo };
    }

    if (corpo.acao === 'criar_login') {
      const funcionarioId = String(corpo.funcionario_id ?? '');
      const email = String(corpo.email ?? '').trim().toLowerCase();
      if (!EMAIL.test(email)) return resposta({ erro: 'E-mail inválido.' }, 400);
      const { data: ficha } = await sb.from('funcionarios').select('id, nome, usuario_id, situacao').eq('id', funcionarioId).maybeSingle();
      if (!ficha) return resposta({ erro: 'Funcionário não encontrado.' }, 404);
      if (ficha.usuario_id) return resposta({ erro: 'Este funcionário já tem login.' }, 400);
      if (ficha.situacao === 'desligado') return resposta({ erro: 'Funcionário desligado não recebe login.' }, 400);

      const { data: existente, error: e0 } = await sb.from('usuarios').select('id').ilike('email', email).maybeSingle();
      if (e0) return resposta({ erro: e0.message }, 500);
      if (existente) {
        // Login já existe (ex.: convite criado antes e não ligado): liga à ficha se ninguém mais usa e gera o link de novo.
        const { error } = await sb.rpc('vincular_login_funcionario', { p_funcionario: funcionarioId, p_usuario: existente.id });
        if (error) return resposta({ erro: error.message }, 400);
        const r = await linkSenha(existente.id, email);
        await auditar(existente.id, { email, funcionario_id: funcionarioId, ligado_a_ficha: true, email_enviado: r.enviado });
        return resposta({ usuario_id: existente.id, ...r });
      }

      // Convite por e-mail (Supabase Auth). Se o e-mail não sair, cria pelo link e devolve o link para o RH mandar.
      const convite = await adm.auth.admin.inviteUserByEmail(email, { data: { nome: ficha.nome }, redirectTo });
      let novo = convite.data.user;
      let r: Record<string, unknown> = { enviado: true, email, tipo: 'invite' };
      if (convite.error || !novo) {
        const { data: ja } = await sb.from('usuarios').select('id').ilike('email', email).maybeSingle();
        const { data, error } = await adm.auth.admin.generateLink({ type: ja ? 'recovery' : 'invite', email, options: { data: { nome: ficha.nome }, redirectTo } });
        if (error || !data.user) return resposta({ erro: `Não foi possível criar o login: ${error?.message ?? convite.error?.message ?? 'erro desconhecido'}.` }, 400);
        novo = data.user;
        r = { enviado: false, motivo: convite.error?.message ?? '', link: data.properties.action_link, email, tipo: 'invite' };
      }
      const { error: e2 } = await sb.rpc('vincular_login_funcionario', { p_funcionario: funcionarioId, p_usuario: novo.id });
      if (e2) return resposta({ erro: `Login criado, mas não foi ligado à ficha: ${e2.message}. Clique em "Criar login" de novo.` }, 500);
      await auditar(novo.id, { email, funcionario_id: funcionarioId, convite: true, email_enviado: r.enviado });
      return resposta({ usuario_id: novo.id, ...r });
    }

    const usuarioId = String(corpo.usuario_id ?? '');
    const { data: alvo } = await sb.from('usuarios').select('id, email, ativo').eq('id', usuarioId).maybeSingle();
    if (!alvo) return resposta({ erro: 'Usuário não encontrado.' }, 404);
    if (usuarioId === eu.user.id) return resposta({ erro: 'Você não pode mudar o próprio acesso por aqui. Use "Esqueci minha senha" no login.' }, 400);
    const { error: regra } = await sb.rpc('conferir_gestao_acesso', { p_usuario: usuarioId });
    if (regra) return resposta({ erro: regra.message }, 403);

    if (corpo.acao === 'link_senha') {
      const r = await linkSenha(usuarioId, alvo.email);
      await auditar(usuarioId, { link_senha: r.tipo, email_enviado: r.enviado });
      return resposta(r);
    }

    if (corpo.acao === 'desativar' || corpo.acao === 'reativar') {
      const ativar = corpo.acao === 'reativar';
      // O banco confere as regras (desligado, último com acesso total) e grava a auditoria; depois o Auth.
      const { error: e1 } = await sb.rpc('definir_login_ativo', { p_usuario: usuarioId, p_ativo: ativar });
      if (e1) return resposta({ erro: e1.message }, 400);
      const { error } = await adm.auth.admin.updateUserById(usuarioId, { ban_duration: ativar ? 'none' : '876000h' });
      if (error) return resposta({ erro: `Não foi possível ${ativar ? 'reativar' : 'desativar'} o login no Auth: ${error.message}.` }, 400);
      return resposta({ ativo: ativar });
    }

    return resposta({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    return resposta({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
