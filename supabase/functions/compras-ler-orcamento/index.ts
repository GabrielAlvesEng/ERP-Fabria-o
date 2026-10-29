// Compras → Produtos → "Ler orçamento" (decisão 121): lê o PDF do fornecedor (com texto ou escaneado) e devolve um rascunho
// de itens para o comprador conferir. Não grava nada: quem grava é a tela, pela função compras_gravar_orcamento.
// O PDF fica no espaço privado "compras" e é baixado como o próprio usuário (a regra de acesso é a do banco).
// A chave da IA é a mesma dos textos da proposta (segredo IA_API_KEY no Supabase), nunca no site.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGENS = ['https://gabrielalveseng.github.io', 'https://erp-fabriaco-brasil.netlify.app', 'http://localhost:5173', 'http://localhost:4173'];
const cors = (origem: string | null) => ({
  'Access-Control-Allow-Origin': origem && ORIGENS.includes(origem) ? origem : ORIGENS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const chave = () => Deno.env.get('IA_API_KEY') ?? Deno.env.get('OPENAI_API_KEY') ?? '';
const MODELO = Deno.env.get('IA_MODELO_ORCAMENTO') ?? 'gpt-4.1';
const TIPOS = ['Chapas', 'Perfis', 'Barras', 'Comerciais', 'Fixadores', 'Consumíveis'];

const INSTRUCOES = `Você lê orçamentos de fornecedores da FABRIAÇO (caldeiraria e montagens industriais, Mococa-SP) e extrai os itens.
Leia o PDF inteiro, inclusive tabelas escaneadas. Uma linha por item cotado, na ordem do documento. Não invente itens nem valores.

Para cada item:
- descricao_original: o texto do fornecedor, como está (junte as linhas do mesmo item).
- tipo: Chapas (chapas e bobinas); Perfis (tubos, cantoneiras, vigas, perfis U/T/I, metalon); Barras (barras redondas, chatas,
  quadradas, sextavadas, vergalhões); Fixadores (parafusos, porcas, arruelas, chumbadores, rebites); Consumíveis (discos, eletrodos,
  arames de solda, gases, lixas, tintas); Comerciais (o resto: válvulas, rolamentos, motores, conexões...).
- descricao: reescrita no padrão da Fabriaço, em português, com o material no fim entre parênteses. Exemplos:
  "Chapa lisa 5,00 x 1250 x 3000 (304)" (espessura com 2 casas e vírgula x largura x comprimento, em mm; acabamento como 2B, BQ ou
  Nº4 entra depois das medidas: "Chapa lisa 4,76 x 1500 x 3000 BQ (304)"); "Chapa xadrez 3,00 x 1200 x 3000 (SAE 1020)";
  "Tubo quadrado 30 x 30 x 1,50 (304)"; "Tubo retangular 50 x 30 x 1,50 (304)"; "Tubo redondo 1.1/2\\" x 1,50 (304)";
  "Cantoneira 1\\" x 1/8\\" (304)"; "Barra redonda 5/16\\" (304)"; "Barra chata 1\\" x 1/4\\" (304)";
  "Parafuso sextavado M12 x 40 (inox 304)". Material: 304, 304L, 316, 316L, 310, 430, SAE 1020, SAE 1045, ASTM A36, galvanizado...
  Mantenha polegadas quando o fornecedor usa polegadas. Sem código do fornecedor, NCM, norma (A240, A554) ou quantidade de peças.
  Se a descrição for igual a um produto da lista "Produtos já cadastrados", use exatamente o texto de lá.
- unidade: "kg" se o preço é por quilo (KG), "m" se é por metro (M, MT, MTS), "un" se é por peça ou unidade (PC, PÇ, UN, BR, CJ).
- quantidade: a quantidade cotada, na mesma unidade do preço.
- valor_unit: o preço unitário SEM IPI, como está no documento (número com ponto decimal).
- ipi: a alíquota de IPI em % (0 se não houver).
Cabeçalho: fornecedor (nome fantasia ou razão social de quem emitiu o orçamento, não a Fabriaço), cnpj só com dígitos ('' se não houver),
data de emissão em AAAA-MM-DD ('' se não houver), número do orçamento, condição de pagamento, prazo de entrega e frete como estão escritos.`;

const texto = { type: 'string' };
const numero = { type: 'number' };
const ESQUEMA = {
  type: 'object', additionalProperties: false,
  required: ['fornecedor', 'cnpj', 'data', 'numero', 'condicao_pagamento', 'prazo_entrega', 'frete', 'itens'],
  properties: {
    fornecedor: texto, cnpj: texto, data: texto, numero: texto, condicao_pagamento: texto, prazo_entrega: texto, frete: texto,
    itens: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['descricao_original', 'tipo', 'descricao', 'unidade', 'quantidade', 'valor_unit', 'ipi'],
        properties: {
          descricao_original: texto, tipo: { type: 'string', enum: TIPOS }, descricao: texto,
          unidade: { type: 'string', enum: ['un', 'm', 'kg'] }, quantidade: numero, valor_unit: numero, ipi: numero,
        },
      },
    },
  },
} as const;

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: h });
  try {
    const corpo = await req.json().catch(() => ({}));
    if (corpo.acao === 'situacao') return resposta({ chave_configurada: Boolean(chave()), modelo: MODELO });

    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: usuario } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (!usuario?.user) return resposta({ erro: 'Faça login para ler o orçamento.' }, 401);
    const { data: perms } = await sb.rpc('minhas_permissoes');
    const pode = (perms as { modulo: string; acao: string }[] | null)?.some((p) => p.modulo === 'compras' && p.acao === 'editar');
    if (!pode) return resposta({ erro: 'Sem permissão para editar Compras.' }, 403);
    if (!chave()) return resposta({ erro: 'A chave da IA não está cadastrada no Supabase (Edge Functions → Secrets, IA_API_KEY).' }, 500);

    const caminho = String(corpo.caminho ?? '');
    if (!caminho || caminho.includes('..')) return resposta({ erro: 'Arquivo do orçamento não informado.' }, 400);
    const { data: arquivo, error: erroArquivo } = await sb.storage.from('compras').download(caminho);
    if (erroArquivo || !arquivo) return resposta({ erro: 'Não consegui abrir o PDF enviado.' }, 400);
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    if (bytes.length > 15 * 1024 * 1024) return resposta({ erro: 'PDF maior que 15 MB.' }, 400);

    // Descrições já cadastradas, para a IA repetir o mesmo texto quando for o mesmo produto.
    const { data: produtos } = await sb.from('bib_itens').select('grupo, descricao').eq('ativo', true).order('descricao').limit(1500);
    const lista = (produtos ?? []).map((p: { grupo: string; descricao: string }) => `${p.grupo}: ${p.descricao}`).join('\n');

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        temperature: 0,
        messages: [
          { role: 'system', content: INSTRUCOES },
          {
            role: 'user',
            content: [
              { type: 'file', file: { filename: 'orcamento.pdf', file_data: `data:application/pdf;base64,${base64(bytes)}` } },
              { type: 'text', text: `Extraia os itens deste orçamento.\n\nProdutos já cadastrados:\n${lista || '(nenhum)'}` },
            ],
          },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'orcamento', strict: true, schema: ESQUEMA } },
      }),
    });
    const json = await r.json();
    if (!r.ok) {
      const msg = json?.error?.message ?? `HTTP ${r.status}`;
      const dica = r.status === 401 ? ' A chave pode ter expirado ou estar errada: gere outra e atualize o segredo.' : r.status === 429 ? ' Limite de uso ou créditos da OpenAI esgotados.' : '';
      return resposta({ erro: `OpenAI: ${msg}.${dica}` }, 502);
    }
    return resposta({ orcamento: JSON.parse(json.choices?.[0]?.message?.content ?? '{}'), uso: json.usage ?? null });
  } catch (e) {
    return resposta({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
