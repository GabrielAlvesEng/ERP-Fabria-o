// Comunicação (docs/PLANEJAMENTO_COMUNICACAO.md): manda o aviso no celular (Web Push) e, se quem enviou marcou,
// o e-mail. É chamada pela tela logo depois de enviar_comunicado, como o próprio usuário: quem pode mandar para quem,
// os aparelhos e os e-mails vêm das funções do banco (migration 55), que conferem as regras.
// acao 'chave' (chave pública para o navegador se inscrever), 'enviar' (comunicado novo), 'lembrete' (só quem não
// leu) ou 'teste' (os aparelhos de quem chamou).
// Chaves VAPID: criadas aqui na primeira chamada e guardadas em segredos_servidor (migration 56), que só a service_role
// lê; é o único uso da service_role nesta função. Secret SMTP_SENHA: senha de contato@fabriacobrasil.com.br (a mesma do
// SMTP do Auth). Sem ela, o e-mail não sai e a resposta avisa.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import nodemailer from 'npm:nodemailer@6.9.16';
import { type Aparelho, chavePublica, emailComunicado, emLotes, enviarPush, novasChavesVapid, resumo, servidorPush } from './envio.ts';

const ORIGENS = ['https://gabrielalveseng.github.io', 'https://erp-fabriaco-brasil.netlify.app', 'http://localhost:5173', 'http://localhost:4173'];
const cors = (origem: string | null) => ({
  'Access-Control-Allow-Origin': origem && ORIGENS.includes(origem) ? origem : ORIGENS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const SMTP = {
  host: Deno.env.get('SMTP_HOST') ?? 'smtps.email.com.br',
  port: Number(Deno.env.get('SMTP_PORTA') ?? 465),
  usuario: Deno.env.get('SMTP_USUARIO') ?? 'contato@fabriacobrasil.com.br',
};
// E-mails de login sem caixa de e-mail (funcionário que entra por usuário): nunca recebem e-mail.
const SEM_EMAIL = /@sem-email\.fabriacobrasil\.com\.br$/i;

// Lê as chaves VAPID; na primeira vez, cria e guarda (se duas chamadas criarem juntas, vale a que gravou primeiro).
async function chavesVapid(): Promise<string> {
  const adm = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const ler = async () => (await adm.from('segredos_servidor').select('valor').eq('nome', 'vapid').maybeSingle()).data?.valor as string | undefined;
  const atual = await ler();
  if (atual) return atual;
  const { json } = await novasChavesVapid();
  await adm.from('segredos_servidor').upsert({ nome: 'vapid', valor: json }, { onConflict: 'nome', ignoreDuplicates: true });
  const gravada = await ler();
  if (!gravada) throw new Error('Não foi possível guardar as chaves do aviso no celular.');
  return gravada;
}

interface Destinatario { usuario_id: string; nome: string; email: string | null; aparelhos: Aparelho[] }
interface Comunicado { id: string; titulo: string; texto: string; urgente: boolean; enviar_email: boolean; autor: string; destinatarios: Destinatario[] }

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: h });
  try {
    const corpo = await req.json().catch(() => ({}));
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: eu } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (!eu?.user) return resposta({ erro: 'Faça login.' }, 401);

    const vapid = await chavesVapid();
    if (corpo.acao === 'chave') return resposta({ chave: await chavePublica(vapid) });
    const servidor = await servidorPush(vapid, `mailto:${SMTP.usuario}`);

    // Endereço do ERP de quem enviou (para o link do e-mail). Só os endereços conhecidos.
    const voltar = String(corpo.voltar ?? '');
    const base = ORIGENS.some((o) => voltar.startsWith(`${o}/`)) ? voltar : `${ORIGENS[0]}/ERP-Fabria-o/`;

    if (corpo.acao === 'teste') {
      const { data: meus, error } = await sb.from('push_aparelhos').select('id, endpoint, p256dh, auth').eq('ativo', true);
      if (error) return resposta({ erro: error.message }, 400);
      const aviso = { titulo: 'Teste do ERP Fabriaço', corpo: 'Os comunicados vão chegar assim neste aparelho.', url: 'comunicacao', tag: 'teste', urgente: false };
      const r = await emLotes((meus ?? []) as Aparelho[], 10, (a) => enviarPush(servidor, a, aviso));
      const mortos = (meus ?? []).filter((_, i) => r[i] === 'morto');
      for (const a of mortos) await sb.rpc('remover_aparelho', { p_endpoint: a.endpoint });
      return resposta({ aparelhos: r.length, ok: r.filter((x) => x === 'ok').length, desativados: mortos.length });
    }

    if (corpo.acao !== 'enviar' && corpo.acao !== 'lembrete') return resposta({ erro: 'Ação desconhecida.' }, 400);
    const { data, error } = await sb.rpc('comunicado_para_envio', { p_comunicado: String(corpo.comunicado_id ?? ''), p_modo: corpo.acao });
    if (error) return resposta({ erro: error.message }, 400);
    const c = data as Comunicado;
    const link = `${base}comunicacao?c=${c.id}`;
    const aviso = {
      titulo: `${corpo.acao === 'lembrete' ? 'Lembrete: ' : ''}${c.urgente ? '⚠ ' : ''}${c.titulo}`,
      corpo: `${c.autor}: ${resumo(c.texto)}`,
      url: `comunicacao?c=${c.id}`, tag: c.id, urgente: c.urgente,
    };

    // Celular: todos os aparelhos ativos de cada pessoa.
    const tarefas = c.destinatarios.flatMap((d) => d.aparelhos.map((a) => ({ d, a })));
    const res = await emLotes(tarefas, 10, ({ a }) => enviarPush(servidor, a, aviso));
    const aparelhosOk = tarefas.filter((_, i) => res[i] === 'ok').map((t) => t.a.id);
    const mortos = tarefas.filter((_, i) => res[i] === 'morto').map((t) => t.a.id);
    const pessoasPush = [...new Set(tarefas.filter((_, i) => res[i] === 'ok').map((t) => t.d.usuario_id))];
    const semAparelho = c.destinatarios.filter((d) => !pessoasPush.includes(d.usuario_id));

    // E-mail: só no envio (não no lembrete), se quem enviou marcou.
    const emails: string[] = [];
    let avisoEmail = '';
    const comEmail = corpo.acao === 'enviar' && c.enviar_email ? c.destinatarios.filter((d) => d.email && !SEM_EMAIL.test(d.email)) : [];
    if (comEmail.length) {
      const senha = Deno.env.get('SMTP_SENHA');
      if (!senha) avisoEmail = 'O e-mail não saiu: falta cadastrar a senha do e-mail (SMTP_SENHA) no Supabase.';
      else {
        const carteiro = nodemailer.createTransport({ host: SMTP.host, port: SMTP.port, secure: SMTP.port === 465, auth: { user: SMTP.usuario, pass: senha } });
        const m = emailComunicado(c, link);
        for (const d of comEmail) {
          try {
            await carteiro.sendMail({ from: `"Fabriaço" <${SMTP.usuario}>`, to: `"${d.nome.replace(/"/g, '')}" <${d.email}>`, subject: m.assunto, html: m.html, text: m.texto });
            emails.push(d.usuario_id);
          } catch (e) {
            console.error('e-mail falhou', d.email, e);
            avisoEmail = `Alguns e-mails não saíram (${e instanceof Error ? e.message : String(e)}).`;
          }
        }
      }
    }

    const { error: e2 } = await sb.rpc('registrar_envio_comunicado', {
      p_comunicado: c.id, p_push: pessoasPush, p_email: emails, p_aparelhos_ok: aparelhosOk, p_aparelhos_mortos: mortos,
    });
    if (e2) console.error('registrar_envio', e2.message);
    return resposta({
      pessoas: c.destinatarios.length,
      celular: pessoasPush.length,
      sem_celular: semAparelho.map((d) => d.nome),
      email: emails.length,
      aviso_email: avisoEmail,
    });
  } catch (e) {
    return resposta({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
