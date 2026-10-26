import { supabase } from '@/shared/lib/supabase';
import type { BibTipo, CondicaoTipo, GrupoItem, Origem, PecaProjeto, StatusItem, StatusPacote, StatusPedido, StatusRequisicao } from './regras';

// Compras (decisões 101, 107 e 111). Situações mudam só pelas funções do banco (compras_*).

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
  bib_tipo: BibTipo | null; bib_id: string | null; status: StatusItem; cotacao_escolhida_id: string | null; pacote_id: string | null;
}
export interface Cotacao {
  id: string; requisicao_id: string | null; pacote_id: string | null; fornecedor_id: string; frete: number; prazo_dias: number | null; condicao_pagamento: string;
  condicao_tipo: CondicaoTipo; condicao_dias: number[]; orcamento_caminho: string | null;
  validade: string | null; observacoes: string; criado_em: string;
  fornecedores?: { nome: string } | null;
  compras_cotacao_precos: { item_id: string; valor_unit: number; ipi: number }[];
}
export interface PedidoItem { pedido_id: string; item_id: string; quantidade: number; valor_unit: number; ipi: number; quantidade_recebida: number }
export interface Pedido {
  id: string; codigo: string; requisicao_id: string | null; pacote_id: string | null; cotacao_id: string; fornecedor_id: string; valor_itens: number; frete: number;
  valor_total: number; previsao_entrega: string | null; status: StatusPedido; entregue_em: string | null; observacoes: string; emitido_em: string;
  condicao_tipo: CondicaoTipo; condicao_dias: number[]; condicao_texto: string; orcamento_caminho: string | null; cancelado_motivo: string;
  fornecedores?: { nome: string } | null;
  compras_requisicoes?: { codigo: string; titulo: string; projeto_codigo: string; projeto_titulo: string; origem: Origem } | null;
  compras_pedido_itens?: PedidoItem[];
  compras_pacotes?: { codigo: string; titulo: string } | null;
}
export interface Historico {
  pedido_id: string; item_id: string; bib_tipo: BibTipo | null; bib_id: string | null; grupo: GrupoItem; descricao: string; unidade: string;
  quantidade: number; valor_unit: number; quantidade_recebida: number; pedido_codigo: string; emitido_em: string; pedido_status: StatusPedido;
  fornecedor_id: string; fornecedor_nome: string; requisicao_codigo: string; projeto_codigo: string; origem: Origem; ipi: number;
}
export interface Evento { id: string; tipo: string; de: string | null; para: string | null; justificativa: string; dados: Record<string, unknown>; criado_em: string; usuarios?: { nome: string } | null }
export interface ProjetoCompras { id: string; codigo: string; titulo: string; cliente: string; status: string }
export interface Produto { tipo: BibTipo; id: string; descricao: string; grupo: GrupoItem; unidade: string }
export interface Pacote {
  id: string; codigo: string; titulo: string; status: StatusPacote; observacoes: string; criado_em: string; atualizado_em: string;
  criador?: { nome: string } | null;
}
// Item com a solicitação dele (À comprar, pacotes e ordens de compra).
export type ItemComSolicitacao = ItemRequisicao & {
  compras_requisicoes: Pick<Requisicao, 'codigo' | 'titulo' | 'projeto_codigo' | 'projeto_titulo' | 'origem' | 'setor' | 'status' | 'prioridade' | 'necessario_em'>;
}

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
// Cadastro rápido de item comercial, fixador ou consumível a partir do À comprar (chapas e perfis vão pela aba Produtos).
export async function cadastrarItemBiblioteca(d: { grupo: 'Comerciais' | 'Fixadores' | 'Consumíveis'; descricao: string; unidade: string }): Promise<string> {
  return (ok(await supabase.from('bib_itens').insert({ ...d, descricao: d.descricao.trim() }).select('id').single()) as { id: string }).id;
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

// À comprar: itens sem pacote e sem OC das solicitações abertas, de qualquer setor.
const COM_REQ = '*, compras_requisicoes!inner(codigo, titulo, projeto_codigo, projeto_titulo, origem, setor, status, prioridade, necessario_em)';
export const listarAComprar = async (): Promise<ItemComSolicitacao[]> =>
  ok(await supabase.from('compras_requisicao_itens').select(COM_REQ)
    .eq('status', 'a_comprar').is('pacote_id', null).eq('compras_requisicoes.status', 'aberta').order('ordem').limit(5000));
export const itensPorIds = async (ids: string[]): Promise<ItemComSolicitacao[]> =>
  ids.length ? ok(await supabase.from('compras_requisicao_itens').select(COM_REQ).in('id', ids)) : [];

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
export const listarCotacoes = async (pacote: string): Promise<Cotacao[]> =>
  ok(await supabase.from('compras_cotacoes').select('*, fornecedores(nome), compras_cotacao_precos(item_id, valor_unit, ipi)').eq('pacote_id', pacote).order('criado_em'));
export type DadosCotacao = Pick<Cotacao, 'fornecedor_id' | 'frete' | 'prazo_dias' | 'condicao_pagamento' | 'condicao_tipo' | 'condicao_dias' | 'validade' | 'observacoes'>;
// Orçamento de um pacote de cotação (decisão 111). Os orçamentos antigos, por requisição, só aparecem para consulta.
export async function salvarCotacao(pacote: string, id: string | null, d: DadosCotacao): Promise<string> {
  const r = id ? await supabase.from('compras_cotacoes').update(d).eq('id', id).select('id').single() : await supabase.from('compras_cotacoes').insert({ ...d, pacote_id: pacote }).select('id').single();
  return (ok(r) as { id: string }).id;
}
export async function removerCotacao(id: string): Promise<void> {
  ok(await supabase.from('compras_cotacoes').delete().eq('id', id));
}
// Preço unitário sem IPI e o IPI % do item (decisão 113); valor vazio tira o preço.
export async function salvarPreco(cotacao: string, item: string, valor: number | null, ipi = 0): Promise<void> {
  if (valor == null) ok(await supabase.from('compras_cotacao_precos').delete().eq('cotacao_id', cotacao).eq('item_id', item));
  else ok(await supabase.from('compras_cotacao_precos').upsert({ cotacao_id: cotacao, item_id: item, valor_unit: valor, ipi }));
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
// ---------- Pacotes de cotação (decisão 111) ----------
export const listarPacotes = async (): Promise<(Pacote & { compras_requisicao_itens: { id: string; status: StatusItem }[]; compras_cotacoes: { id: string }[]; compras_pedidos: { codigo: string; status: StatusPedido; valor_total: number }[] })[]> =>
  ok(await supabase.from('compras_pacotes').select('*, criador:usuarios!compras_pacotes_criado_por_fkey(nome), compras_requisicao_itens(id, status), compras_cotacoes(id), compras_pedidos(codigo, status, valor_total)').order('criado_em', { ascending: false }).limit(500));
export const pacotesAbertos = async (): Promise<Pacote[]> => ok(await supabase.from('compras_pacotes').select('*').eq('status', 'aberto').order('criado_em', { ascending: false }));
export const obterPacote = async (id: string): Promise<Pacote> => ok(await supabase.from('compras_pacotes').select('*, criador:usuarios!compras_pacotes_criado_por_fkey(nome)').eq('id', id).single());
export const itensDoPacote = async (id: string): Promise<ItemComSolicitacao[]> =>
  ok(await supabase.from('compras_requisicao_itens').select(COM_REQ).eq('pacote_id', id).order('grupo').order('descricao'));
export async function atualizarPacote(id: string, d: { titulo?: string; observacoes?: string }): Promise<void> {
  ok(await supabase.from('compras_pacotes').update(d).eq('id', id));
}
export async function criarPacote(titulo: string, itens: string[], observacoes = ''): Promise<string> {
  return ok(await supabase.rpc('compras_criar_pacote', { p_titulo: titulo, p_itens: itens, p_observacoes: observacoes })) as string;
}
export async function adicionarAoPacote(pacote: string, itens: string[]): Promise<void> {
  ok(await supabase.rpc('compras_pacote_adicionar', { p_pacote: pacote, p_itens: itens }));
}
export async function retirarDoPacote(pacote: string, itens: string[]): Promise<void> {
  ok(await supabase.rpc('compras_pacote_retirar', { p_pacote: pacote, p_itens: itens }));
}
export async function cancelarPacote(pacote: string, motivo: string): Promise<void> {
  ok(await supabase.rpc('compras_cancelar_pacote', { p_pacote: pacote, p_motivo: motivo }));
}
export async function gerarPedidoPacote(pacote: string, cotacao: string, previsao: string | null, observacoes: string): Promise<string> {
  return ok(await supabase.rpc('compras_gerar_pedido_pacote', { p_pacote: pacote, p_cotacao: cotacao, p_previsao: previsao, p_observacoes: observacoes })) as string;
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
const PEDIDO = '*, fornecedores(nome), compras_requisicoes(codigo, titulo, projeto_codigo, projeto_titulo, origem), compras_pacotes(codigo, titulo), compras_pedido_itens(*)';
export const listarPedidos = async (): Promise<Pedido[]> => ok(await supabase.from('compras_pedidos').select(PEDIDO).order('emitido_em', { ascending: false }));
export const pedidosDoPacote = async (pacote: string): Promise<Pedido[]> => ok(await supabase.from('compras_pedidos').select(PEDIDO).eq('pacote_id', pacote).order('emitido_em'));
// OCs que têm algum item da solicitação (uma OC de pacote pode juntar várias solicitações).
export async function pedidosDosItens(itens: string[]): Promise<Pedido[]> {
  if (!itens.length) return [];
  const ids = [...new Set((ok(await supabase.from('compras_pedido_itens').select('pedido_id').in('item_id', itens)) as { pedido_id: string }[]).map((x) => x.pedido_id))];
  return ids.length ? ok(await supabase.from('compras_pedidos').select(PEDIDO).in('id', ids).order('emitido_em')) : [];
}
export async function atualizarPedido(id: string, d: { previsao_entrega?: string | null; observacoes?: string }): Promise<void> {
  ok(await supabase.from('compras_pedidos').update(d).eq('id', id));
}
export const listarEventos = async (dono: { requisicao: string } | { pacote: string }): Promise<Evento[]> =>
  ok(await supabase.from('compras_eventos').select('*, usuarios(nome)')
    .eq('requisicao' in dono ? 'requisicao_id' : 'pacote_id', 'requisicao' in dono ? dono.requisicao : dono.pacote).order('criado_em', { ascending: false }));

// ---------- Engenharia (só o necessário, por funções do banco) ----------
export const listarProjetos = async (): Promise<ProjetoCompras[]> => ok(await supabase.rpc('compras_projetos'));
export const pecasDoProjeto = async (projeto: string): Promise<PecaProjeto[]> => ok(await supabase.rpc('compras_pecas_projeto_v2', { p_projeto: projeto }));
