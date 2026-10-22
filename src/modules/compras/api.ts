import { supabase } from '@/shared/lib/supabase';
import type { GrupoItem, PecaProjeto, StatusPedido, StatusRequisicao } from './regras';

// Compras (decisão 101). Etapas mudam só pelas funções do banco (compras_*).

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface Fornecedor {
  id: string; nome: string; cnpj: string; cidade: string; contato: string; telefone: string; email: string;
  categorias: string; condicao_pagamento: 'antecipado' | 'apos_recebimento' | 'a_combinar'; observacoes: string; ativo: boolean;
}
export interface Requisicao {
  id: string; codigo: string; titulo: string; projeto_id: string | null; projeto_codigo: string; projeto_titulo: string; setor: string;
  necessario_em: string | null; prioridade: 'normal' | 'urgente'; status: StatusRequisicao; cotacao_escolhida_id: string | null;
  observacoes: string; solicitante_id: string | null; criado_em: string; atualizado_em: string;
  solicitante?: { nome: string } | null;
}
export interface ItemRequisicao { id: string; requisicao_id: string; ordem: number; grupo: GrupoItem; descricao: string; quantidade: number; unidade: string; observacoes: string }
export interface Cotacao {
  id: string; requisicao_id: string; fornecedor_id: string; frete: number; prazo_dias: number | null; condicao_pagamento: string;
  validade: string | null; observacoes: string; criado_em: string;
  fornecedores?: { nome: string } | null;
  compras_cotacao_precos: { item_id: string; valor_unit: number }[];
}
export interface Pedido {
  id: string; codigo: string; requisicao_id: string; cotacao_id: string; fornecedor_id: string; valor_itens: number; frete: number;
  valor_total: number; previsao_entrega: string | null; status: StatusPedido; entregue_em: string | null; observacoes: string; emitido_em: string;
  fornecedores?: { nome: string } | null;
  compras_requisicoes?: { codigo: string; titulo: string; projeto_codigo: string; projeto_titulo: string } | null;
}
export interface Evento { id: string; tipo: string; de: string | null; para: string | null; justificativa: string; dados: Record<string, unknown>; criado_em: string; usuarios?: { nome: string } | null }
export interface ProjetoCompras { id: string; codigo: string; titulo: string; cliente: string; status: string }

// ---------- Fornecedores ----------
export const listarFornecedores = async (): Promise<Fornecedor[]> => ok(await supabase.from('fornecedores').select('*').order('nome'));
export async function salvarFornecedor(f: Partial<Fornecedor> & { nome: string }): Promise<void> {
  const { id, ...dados } = f;
  ok(id ? await supabase.from('fornecedores').update(dados).eq('id', id) : await supabase.from('fornecedores').insert(dados));
}

// ---------- Requisições ----------
const COM_SOLICITANTE = '*, solicitante:usuarios!compras_requisicoes_solicitante_id_fkey(nome)';
export const listarRequisicoes = async (): Promise<Requisicao[]> => ok(await supabase.from('compras_requisicoes').select(COM_SOLICITANTE).order('criado_em', { ascending: false }));
export const obterRequisicao = async (id: string): Promise<Requisicao> => ok(await supabase.from('compras_requisicoes').select(COM_SOLICITANTE).eq('id', id).single());

export type DadosRequisicao = Pick<Requisicao, 'titulo' | 'projeto_id' | 'setor' | 'necessario_em' | 'prioridade' | 'observacoes'>;
export type DadosItem = Pick<ItemRequisicao, 'grupo' | 'descricao' | 'quantidade' | 'unidade' | 'observacoes'>;

export async function criarRequisicao(d: DadosRequisicao, itens: DadosItem[]): Promise<string> {
  const r = ok(await supabase.from('compras_requisicoes').insert(d).select('id').single()) as { id: string };
  if (itens.length) ok(await supabase.from('compras_requisicao_itens').insert(itens.map((i, n) => ({ ...i, requisicao_id: r.id, ordem: n }))));
  return r.id;
}
export async function atualizarRequisicao(id: string, d: Partial<DadosRequisicao>): Promise<void> {
  ok(await supabase.from('compras_requisicoes').update(d).eq('id', id));
}

export const listarItens = async (req: string): Promise<ItemRequisicao[]> => ok(await supabase.from('compras_requisicao_itens').select('*').eq('requisicao_id', req).order('ordem'));
export async function adicionarItens(req: string, itens: DadosItem[], ordemInicial: number): Promise<void> {
  ok(await supabase.from('compras_requisicao_itens').insert(itens.map((i, n) => ({ ...i, requisicao_id: req, ordem: ordemInicial + n }))));
}
export async function atualizarItem(id: string, d: Partial<DadosItem>): Promise<void> {
  ok(await supabase.from('compras_requisicao_itens').update(d).eq('id', id));
}
export async function removerItem(id: string): Promise<void> {
  ok(await supabase.from('compras_requisicao_itens').delete().eq('id', id));
}

// ---------- Cotações ----------
export const listarCotacoes = async (req: string): Promise<Cotacao[]> =>
  ok(await supabase.from('compras_cotacoes').select('*, fornecedores(nome), compras_cotacao_precos(item_id, valor_unit)').eq('requisicao_id', req).order('criado_em'));
export type DadosCotacao = Pick<Cotacao, 'fornecedor_id' | 'frete' | 'prazo_dias' | 'condicao_pagamento' | 'validade' | 'observacoes'>;
export async function salvarCotacao(req: string, id: string | null, d: DadosCotacao): Promise<void> {
  ok(id ? await supabase.from('compras_cotacoes').update(d).eq('id', id) : await supabase.from('compras_cotacoes').insert({ ...d, requisicao_id: req }));
}
export async function removerCotacao(id: string): Promise<void> {
  ok(await supabase.from('compras_cotacoes').delete().eq('id', id));
}
export async function salvarPreco(cotacao: string, item: string, valor: number | null): Promise<void> {
  if (valor == null) ok(await supabase.from('compras_cotacao_precos').delete().eq('cotacao_id', cotacao).eq('item_id', item));
  else ok(await supabase.from('compras_cotacao_precos').upsert({ cotacao_id: cotacao, item_id: item, valor_unit: valor }));
}

// ---------- Fluxo ----------
export async function enviarAprovacao(req: string, cotacao: string): Promise<void> {
  ok(await supabase.rpc('compras_enviar_aprovacao', { p_req: req, p_cotacao: cotacao }));
}
export async function decidir(req: string, aprovar: boolean, justificativa: string): Promise<void> {
  ok(await supabase.rpc('compras_decidir', { p_req: req, p_aprovar: aprovar, p_justificativa: justificativa }));
}
export async function emitirPedido(req: string, previsao: string | null, observacoes: string): Promise<void> {
  ok(await supabase.rpc('compras_emitir_pedido', { p_req: req, p_previsao: previsao, p_observacoes: observacoes }));
}
export async function registrarEntrega(pedido: string, total: boolean, data: string, observacao: string): Promise<void> {
  ok(await supabase.rpc('compras_registrar_entrega', { p_pedido: pedido, p_total: total, p_data: data, p_observacao: observacao }));
}
export async function cancelar(req: string, justificativa: string): Promise<void> {
  ok(await supabase.rpc('compras_cancelar', { p_req: req, p_justificativa: justificativa }));
}

// ---------- Ordens de compra e histórico ----------
const PEDIDO = '*, fornecedores(nome), compras_requisicoes(codigo, titulo, projeto_codigo, projeto_titulo)';
export const listarPedidos = async (): Promise<Pedido[]> => ok(await supabase.from('compras_pedidos').select(PEDIDO).order('emitido_em', { ascending: false }));
export const pedidoDaRequisicao = async (req: string): Promise<Pedido | null> => ok(await supabase.from('compras_pedidos').select(PEDIDO).eq('requisicao_id', req).maybeSingle());
export async function atualizarPedido(id: string, d: { previsao_entrega?: string | null; observacoes?: string }): Promise<void> {
  ok(await supabase.from('compras_pedidos').update(d).eq('id', id));
}
export const listarEventos = async (req: string): Promise<Evento[]> =>
  ok(await supabase.from('compras_eventos').select('*, usuarios(nome)').eq('requisicao_id', req).order('criado_em', { ascending: false }));

// ---------- Engenharia (só o necessário, por funções do banco) ----------
export const listarProjetos = async (): Promise<ProjetoCompras[]> => ok(await supabase.rpc('compras_projetos'));
export const pecasDoProjeto = async (projeto: string): Promise<PecaProjeto[]> => ok(await supabase.rpc('compras_pecas_projeto', { p_projeto: projeto }));
