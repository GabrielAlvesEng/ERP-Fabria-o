import { supabase } from '@/shared/lib/supabase';
import type { BibTipo, CondicaoTipo, GrupoItem, Origem, PecaProjeto, StatusItem, StatusPedido, StatusRequisicao } from './regras';

// Compras (decisões 101 e 103). Situações mudam só pelas funções do banco (compras_*).

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface Fornecedor {
  id: string; nome: string; razao_social: string; cnpj: string; endereco: string; cidade: string; contato: string; telefone: string; email: string;
  categorias: string; condicao_pagamento: 'antecipado' | 'apos_recebimento' | 'a_combinar'; observacoes: string; ativo: boolean;
}
export interface Requisicao {
  id: string; codigo: string; titulo: string; projeto_id: string | null; projeto_codigo: string; projeto_titulo: string; setor: string; origem: Origem;
  necessario_em: string | null; prioridade: 'normal' | 'urgente'; status: StatusRequisicao;
  observacoes: string; solicitante_id: string | null; criado_em: string; atualizado_em: string;
  solicitante?: { nome: string } | null;
}
export interface ItemRequisicao {
  id: string; requisicao_id: string; ordem: number; grupo: GrupoItem; descricao: string; quantidade: number; unidade: string; observacoes: string;
  bib_tipo: BibTipo | null; bib_id: string | null; status: StatusItem; cotacao_escolhida_id: string | null;
}
export interface Cotacao {
  id: string; requisicao_id: string; fornecedor_id: string; frete: number; prazo_dias: number | null; condicao_pagamento: string;
  condicao_tipo: CondicaoTipo; condicao_dias: number[]; orcamento_caminho: string | null;
  validade: string | null; observacoes: string; criado_em: string;
  fornecedores?: { nome: string } | null;
  compras_cotacao_precos: { item_id: string; valor_unit: number }[];
}
export interface PedidoItem { pedido_id: string; item_id: string; quantidade: number; valor_unit: number; quantidade_recebida: number }
export interface Pedido {
  id: string; codigo: string; requisicao_id: string; cotacao_id: string; fornecedor_id: string; valor_itens: number; frete: number;
  valor_total: number; previsao_entrega: string | null; status: StatusPedido; entregue_em: string | null; observacoes: string; emitido_em: string;
  condicao_tipo: CondicaoTipo; condicao_dias: number[]; condicao_texto: string; orcamento_caminho: string | null; cancelado_motivo: string;
  fornecedores?: { nome: string } | null;
  compras_requisicoes?: { codigo: string; titulo: string; projeto_codigo: string; projeto_titulo: string; origem: Origem } | null;
  compras_pedido_itens?: PedidoItem[];
}
export interface Historico {
  pedido_id: string; item_id: string; bib_tipo: BibTipo | null; bib_id: string | null; grupo: GrupoItem; descricao: string; unidade: string;
  quantidade: number; valor_unit: number; quantidade_recebida: number; pedido_codigo: string; emitido_em: string; pedido_status: StatusPedido;
  fornecedor_id: string; fornecedor_nome: string; requisicao_codigo: string; projeto_codigo: string; origem: Origem;
}
export interface Evento { id: string; tipo: string; de: string | null; para: string | null; justificativa: string; dados: Record<string, unknown>; criado_em: string; usuarios?: { nome: string } | null }
export interface ProjetoCompras { id: string; codigo: string; titulo: string; cliente: string; status: string }
export interface Produto { tipo: BibTipo; id: string; descricao: string; grupo: GrupoItem; unidade: string }

// ---------- Fornecedores ----------
export const listarFornecedores = async (): Promise<Fornecedor[]> => ok(await supabase.from('fornecedores').select('*').order('nome'));
export async function salvarFornecedor(f: Partial<Fornecedor> & { nome: string }): Promise<void> {
  const { id, ...dados } = f;
  ok(id ? await supabase.from('fornecedores').update(dados).eq('id', id) : await supabase.from('fornecedores').insert(dados));
}

// ---------- Produtos (Biblioteca de Materiais, decisão 103) ----------
export async function listarProdutos(): Promise<Produto[]> {
  const [c, p, i] = await Promise.all([
    supabase.from('bib_chapas').select('id, descricao').eq('ativo', true).order('descricao').limit(5000),
    supabase.from('bib_perfis').select('id, descricao').eq('ativo', true).order('descricao').limit(5000),
    supabase.from('bib_itens').select('id, descricao, grupo, unidade').eq('ativo', true).order('descricao').limit(10000),
  ]);
  return [
    ...(ok(c) as { id: string; descricao: string }[]).map((x) => ({ tipo: 'chapa' as const, id: x.id, descricao: x.descricao, grupo: 'Chapas' as GrupoItem, unidade: 'kg' })),
    ...(ok(p) as { id: string; descricao: string }[]).map((x) => ({ tipo: 'perfil' as const, id: x.id, descricao: x.descricao, grupo: 'Perfis' as GrupoItem, unidade: 'm' })),
    ...(ok(i) as { id: string; descricao: string; grupo: GrupoItem; unidade: string }[]).map((x) => ({ tipo: 'item' as const, id: x.id, descricao: x.descricao, grupo: x.grupo, unidade: x.unidade || 'un' })),
  ];
}
export const listarHistorico = async (): Promise<Historico[]> => ok(await supabase.from('compras_historico').select('*').order('emitido_em', { ascending: false }).limit(5000));

// ---------- Requisições ----------
const COM_SOLICITANTE = '*, solicitante:usuarios!compras_requisicoes_solicitante_id_fkey(nome)';
export const listarRequisicoes = async (): Promise<Requisicao[]> => ok(await supabase.from('compras_requisicoes').select(COM_SOLICITANTE).order('criado_em', { ascending: false }));
export const obterRequisicao = async (id: string): Promise<Requisicao> => ok(await supabase.from('compras_requisicoes').select(COM_SOLICITANTE).eq('id', id).single());

export type DadosRequisicao = Pick<Requisicao, 'titulo' | 'projeto_id' | 'setor' | 'necessario_em' | 'prioridade' | 'observacoes'>;
export type DadosItem = Pick<ItemRequisicao, 'grupo' | 'descricao' | 'quantidade' | 'unidade' | 'observacoes'> & { bib_tipo?: BibTipo | null; bib_id?: string | null };

export async function solicitar(origem: Origem, d: Partial<DadosRequisicao>, itens: DadosItem[]): Promise<string> {
  return ok(await supabase.rpc('compras_solicitar', { p_origem: origem, p_dados: d, p_itens: itens })) as string;
}
export async function atualizarRequisicao(id: string, d: Partial<DadosRequisicao>): Promise<void> {
  ok(await supabase.from('compras_requisicoes').update(d).eq('id', id));
}

// Itens de todas as requisições (Kanban por item), com o fornecedor escolhido.
export type ItemDoQuadro = ItemRequisicao & {
  compras_requisicoes: Pick<Requisicao, 'codigo' | 'titulo' | 'projeto_codigo' | 'origem' | 'setor' | 'status' | 'prioridade' | 'necessario_em' | 'atualizado_em'>;
  escolhida: { fornecedores: { nome: string } | null } | null;
};
export const listarTodosItens = async (): Promise<ItemDoQuadro[]> =>
  ok(await supabase.from('compras_requisicao_itens')
    .select('*, compras_requisicoes!inner(codigo, titulo, projeto_codigo, origem, setor, status, prioridade, necessario_em, atualizado_em), escolhida:compras_cotacoes!compras_requisicao_itens_cotacao_escolhida_id_fkey(fornecedores(nome))')
    .neq('status', 'cancelado').neq('compras_requisicoes.status', 'cancelada').limit(5000));
export const listarPrecosLancados = async (): Promise<{ item_id: string }[]> => ok(await supabase.from('compras_cotacao_precos').select('item_id').limit(20000));

export const listarItens = async (req: string): Promise<ItemRequisicao[]> => ok(await supabase.from('compras_requisicao_itens').select('*').eq('requisicao_id', req).order('ordem'));
export async function adicionarItens(req: string, itens: DadosItem[], ordemInicial: number): Promise<void> {
  ok(await supabase.from('compras_requisicao_itens').insert(itens.map((i, n) => ({ ...i, requisicao_id: req, ordem: ordemInicial + n }))));
}
export async function atualizarItem(id: string, d: Partial<DadosItem> & { cotacao_escolhida_id?: string | null }): Promise<void> {
  ok(await supabase.from('compras_requisicao_itens').update(d).eq('id', id));
}
export async function removerItem(id: string): Promise<void> {
  ok(await supabase.from('compras_requisicao_itens').delete().eq('id', id));
}

// ---------- Cotações ----------
export const listarCotacoes = async (req: string): Promise<Cotacao[]> =>
  ok(await supabase.from('compras_cotacoes').select('*, fornecedores(nome), compras_cotacao_precos(item_id, valor_unit)').eq('requisicao_id', req).order('criado_em'));
export type DadosCotacao = Pick<Cotacao, 'fornecedor_id' | 'frete' | 'prazo_dias' | 'condicao_pagamento' | 'condicao_tipo' | 'condicao_dias' | 'validade' | 'observacoes'>;
export async function salvarCotacao(req: string, id: string | null, d: DadosCotacao): Promise<string> {
  const r = id ? await supabase.from('compras_cotacoes').update(d).eq('id', id).select('id').single() : await supabase.from('compras_cotacoes').insert({ ...d, requisicao_id: req }).select('id').single();
  return (ok(r) as { id: string }).id;
}
export async function removerCotacao(id: string): Promise<void> {
  ok(await supabase.from('compras_cotacoes').delete().eq('id', id));
}
export async function salvarPreco(cotacao: string, item: string, valor: number | null): Promise<void> {
  if (valor == null) ok(await supabase.from('compras_cotacao_precos').delete().eq('cotacao_id', cotacao).eq('item_id', item));
  else ok(await supabase.from('compras_cotacao_precos').upsert({ cotacao_id: cotacao, item_id: item, valor_unit: valor }));
}

// Orçamento do fornecedor: espaço privado "compras", {cotação}/{arquivo}.
export async function anexarOrcamento(cotacao: string, arquivo: File): Promise<void> {
  const nome = arquivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
  const caminho = `${cotacao}/${Date.now()}_${nome}`;
  const { error } = await supabase.storage.from('compras').upload(caminho, arquivo, { contentType: arquivo.type });
  if (error) throw error;
  ok(await supabase.from('compras_cotacoes').update({ orcamento_caminho: caminho }).eq('id', cotacao));
}
export async function abrirArquivo(caminho: string): Promise<void> {
  const { data, error } = await supabase.storage.from('compras').createSignedUrl(caminho, 300);
  if (error) throw error;
  window.open(data.signedUrl, '_blank');
}

// ---------- Fluxo ----------
export async function gerarPedidos(req: string, observacoes: string): Promise<string[]> {
  return ok(await supabase.rpc('compras_gerar_pedidos', { p_req: req, p_observacoes: observacoes })) as string[];
}
export async function cancelarPedido(pedido: string, motivo: string): Promise<void> {
  ok(await supabase.rpc('compras_cancelar_pedido', { p_pedido: pedido, p_motivo: motivo }));
}
export async function cancelar(req: string, justificativa: string): Promise<void> {
  ok(await supabase.rpc('compras_cancelar', { p_req: req, p_justificativa: justificativa }));
}
// Situação do pagamento vem do Financeiro (função dele); se ainda não existir, fica em branco.
export async function situacaoPagamento(pedido: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('compras_situacao_pagamento', { p_pedido: pedido });
  return error ? null : (data as string | null);
}

// ---------- Ordens de compra e histórico ----------
const PEDIDO = '*, fornecedores(nome), compras_requisicoes(codigo, titulo, projeto_codigo, projeto_titulo, origem), compras_pedido_itens(*)';
export const listarPedidos = async (): Promise<Pedido[]> => ok(await supabase.from('compras_pedidos').select(PEDIDO).order('emitido_em', { ascending: false }));
export const pedidosDaRequisicao = async (req: string): Promise<Pedido[]> => ok(await supabase.from('compras_pedidos').select(PEDIDO).eq('requisicao_id', req).order('emitido_em'));
export async function atualizarPedido(id: string, d: { previsao_entrega?: string | null; observacoes?: string }): Promise<void> {
  ok(await supabase.from('compras_pedidos').update(d).eq('id', id));
}
export const listarEventos = async (req: string): Promise<Evento[]> =>
  ok(await supabase.from('compras_eventos').select('*, usuarios(nome)').eq('requisicao_id', req).order('criado_em', { ascending: false }));

// ---------- Engenharia (só o necessário, por funções do banco) ----------
export const listarProjetos = async (): Promise<ProjetoCompras[]> => ok(await supabase.rpc('compras_projetos'));
export const pecasDoProjeto = async (projeto: string): Promise<PecaProjeto[]> => ok(await supabase.rpc('compras_pecas_projeto_v2', { p_projeto: projeto }));
