// Gerador de propostas, entrega 3 (decisão 61): escreve os textos da proposta técnica ou comercial com a OpenAI.
// A chave fica só aqui, como segredo do Supabase (IA_API_KEY, ou OPENAI_API_KEY), nunca no site.
// Só usuário logado com permissão de editar Vendas usa. Preços nunca são escritos pela IA (vêm dos Custos).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGENS = ['https://gabrielalveseng.github.io', 'http://localhost:5173', 'http://localhost:4173'];
const cors = (origem: string | null) => ({
  'Access-Control-Allow-Origin': origem && ORIGENS.includes(origem) ? origem : ORIGENS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const chave = () => Deno.env.get('IA_API_KEY') ?? Deno.env.get('OPENAI_API_KEY') ?? '';
const MODELO = Deno.env.get('IA_MODELO') ?? 'gpt-4.1-mini';

const ESTILO = `Você escreve propostas técnicas e comerciais da FABRIAÇO Montagens Industriais e Caldeiraria (Mococa-SP), empresa de projetos, fabricação e montagem de equipamentos e estruturas metálicas para a indústria.
Escreva em português do Brasil, com linguagem técnica, formal e objetiva, como nas propostas da empresa.
Formato dos textos: parágrafos separados por uma linha em branco; itens de lista em linhas começando com "- "; use **negrito** só em rótulos curtos.
Regras obrigatórias:
- Nunca escreva preços, valores em reais, percentuais de imposto, datas ou prazos em dias: isso vem do sistema.
- Não invente normas inexistentes; cite só normas reais e aplicáveis ao serviço descrito (NR, ABNT NBR, ISO, ASTM, ASME).
- Não invente dados do cliente além dos informados.
- Escreva o nome do cliente e o local como foram informados.

Exemplo do estilo (proposta 26-01-019, Symrise Pet Food, Descalvado-SP):
Objetivo: "A presente proposta técnica tem como objetivo apresentar as condições para o fornecimento, fabricação e instalação de um novo sistema de vedação pneumática para a Rosca MP, localizada na unidade industrial da Symrise Pet Food, em Descalvado – SP.

O projeto contempla a substituição completa do cabeçote removível existente por um novo conjunto fabricado em aço inoxidável, desenvolvido para incorporar um sistema de vedação pneumática por meio de um perfil de borracha com geometria em "H", associado a um ponto de conexão para alimentação de ar comprimido."
Escopo (etapas): "ENGENHARIA E DESENVOLVIMENTO DO PROJETO: Análise das condições construtivas do cabeçote existente, desenvolvimento dos desenhos técnicos necessários à fabricação do novo conjunto e definição dos componentes mecânicos e pneumáticos." / "FABRICAÇÃO DO NOVO CABEÇOTE REMOVÍVEL EM AÇO INOXIDÁVEL: ..." / "TESTES, INSPEÇÃO E ENTREGA TÉCNICA: ..."`;

const texto = { type: 'string' };
const ESQUEMA = {
  tecnica: {
    type: 'object', additionalProperties: false,
    required: ['capa', 'visao', 'objetivo', 'aplicacao', 'normas', 'competencias', 'escopo_intro', 'escopo', 'fora_escopo'],
    properties: {
      capa: { type: 'object', additionalProperties: false, required: ['linha1', 'linha2', 'subtitulo'], properties: { linha1: texto, linha2: texto, subtitulo: texto } },
      visao: { type: 'object', additionalProperties: false, required: ['objeto', 'solucao'], properties: { objeto: texto, solucao: texto } },
      objetivo: texto, aplicacao: texto, normas: texto,
      competencias: {
        type: 'object', additionalProperties: false,
        required: ['Mecânica', 'Civil', 'Automação', 'Elétrica', 'Pneumática', 'Instalação', 'Adequação'],
        properties: Object.fromEntries(['Mecânica', 'Civil', 'Automação', 'Elétrica', 'Pneumática', 'Instalação', 'Adequação'].map((c) => [c, { type: 'string', enum: ['Sim', 'Não', 'N/A'] }])),
      },
      escopo_intro: texto,
      escopo: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['titulo', 'texto'], properties: { titulo: texto, texto } } },
      fora_escopo: texto,
    },
  },
  comercial: {
    type: 'object', additionalProperties: false, required: ['capa', 'abertura', 'objetivo', 'descricoes'],
    properties: {
      capa: { type: 'object', additionalProperties: false, required: ['linha1', 'linha2', 'subtitulo'], properties: { linha1: texto, linha2: texto, subtitulo: texto } },
      abertura: texto, objetivo: texto,
      descricoes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['letra', 'texto'], properties: { letra: texto, texto } } },
    },
  },
} as const;

const PEDIDO = {
  tecnica: `Escreva a PROPOSTA TÉCNICA:
- capa.linha1: o assunto, curto (ex.: "Vedação Pneumática"); capa.linha2: o equipamento ou local (ex.: "Rosca MP"); capa.subtitulo: uma frase do fornecimento.
- visao.objeto e visao.solucao: 2 a 4 palavras cada.
- objetivo: 3 a 4 parágrafos. aplicacao: 2 a 3 parágrafos e, no fim, "A aplicação proporcionará os seguintes benefícios:" seguido de 4 a 6 itens de lista no formato "- Rótulo: explicação".
- normas: frase de abertura e lista de 3 a 6 normas aplicáveis, no formato "- NORMA – Título: aplicação".
- competencias: Sim para o que o serviço envolve, Não para o que fica com o cliente e N/A para o que não se aplica.
- escopo_intro: 1 a 2 parágrafos; escopo: 4 a 6 etapas em ordem (título em maiúsculas sem número, texto de 2 a 3 frases).
- fora_escopo: frase "A presente proposta contempla exclusivamente os fornecimentos e serviços descritos na proposta técnica, não estando inclusos os seguintes itens:" e 5 a 8 itens no formato "- **Rótulo:** explicação", adequados a este serviço.`,
  comercial: `Escreva a PROPOSTA COMERCIAL:
- capa.linha1: o assunto, curto; capa.linha2: o equipamento ou local; capa.subtitulo: uma frase do fornecimento.
- abertura: 2 frases apresentando as condições comerciais e citando que o detalhamento técnico está na proposta técnica.
- objetivo: 3 a 4 parágrafos sobre o fornecimento (sem valores).
- descricoes: para CADA item informado (pela letra), uma descrição do fornecimento em 1 a 2 frases, sem valores.`,
};

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: h });
  try {
    const corpo = await req.json().catch(() => ({}));
    if (corpo.acao === 'situacao') return resposta({ chave_configurada: Boolean(chave()), modelo: MODELO });

    // Confere o usuário e a permissão no banco (a mesma regra das telas).
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: usuario } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (!usuario?.user) return resposta({ erro: 'Faça login para usar a IA.' }, 401);
    const { data: perms } = await sb.rpc('minhas_permissoes');
    const pode = (perms as { modulo: string; acao: string }[] | null)?.some((p) => p.modulo === 'vendas' && p.acao === 'editar');
    if (!pode) return resposta({ erro: 'Sem permissão para editar propostas.' }, 403);
    if (!chave()) return resposta({ erro: 'A chave da OpenAI não está cadastrada no Supabase (Edge Functions → Secrets, IA_API_KEY).' }, 500);

    const tipo = corpo.tipo === 'comercial' ? 'comercial' : 'tecnica';
    const explicacao = String(corpo.explicacao ?? '').slice(0, 6000).trim();
    if (explicacao.length < 15) return resposta({ erro: 'Explique a proposta com um pouco mais de detalhe.' }, 400);
    const itens = Array.isArray(corpo.itens) ? corpo.itens.slice(0, 20).map((i: { letra: string; descricao: string }) => `${i.letra} — ${i.descricao}`).join('\n') : '';
    const contexto = `Cliente: ${String(corpo.cliente ?? '').slice(0, 200)}\nLocal: ${String(corpo.local ?? '').slice(0, 200)}\nTítulo da proposta: ${String(corpo.titulo ?? '').slice(0, 300)}\nItens da proposta:\n${itens || '(nenhum item cadastrado)'}\n\nExplicação do vendedor:\n${explicacao}`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        messages: [{ role: 'system', content: ESTILO }, { role: 'user', content: `${PEDIDO[tipo]}\n\n${contexto}` }],
        response_format: { type: 'json_schema', json_schema: { name: `proposta_${tipo}`, strict: true, schema: ESQUEMA[tipo] } },
      }),
    });
    const json = await r.json();
    if (!r.ok) {
      const msg = json?.error?.message ?? `HTTP ${r.status}`;
      const dica = r.status === 401 ? ' A chave pode ter expirado ou estar errada: gere outra e atualize o segredo.' : r.status === 429 ? ' Limite de uso ou créditos da OpenAI esgotados.' : '';
      return resposta({ erro: `OpenAI: ${msg}.${dica}` }, 502);
    }
    const conteudo = json.choices?.[0]?.message?.content;
    return resposta({ tipo, textos: JSON.parse(conteudo), uso: json.usage ?? null });
  } catch (e) {
    return resposta({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
