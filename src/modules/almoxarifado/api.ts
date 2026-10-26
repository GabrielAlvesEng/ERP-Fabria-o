import { supabase } from '@/shared/lib/supabase';
import type { TipoMovimento } from './regras';

// Almoxarifado (decisão 104). O saldo só muda pelas funções do banco (alm_*); produtos vêm do cadastro único (Biblioteca).

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface ItemEstoque {
  id: string; bib_tipo: string; bib_id: string; grupo: string; descricao: string; unidade: string;
  saldo: number; minimo: number; local: string; custo_medio: number; ativo: boolean; ultimo_movimento: string | null;
}
export interface Produto { bib_tipo: string; bib_id: string; grupo: string; descricao: string; unidade: string; no_estoque: boolean }
export interface Movimento {
  id: string; item_id: string; tipo: TipoMovimento; quantidade: number; saldo_depois: number; custo_unit: number;
  retirada_id: string | null; origem_id: string | null; pedido_id: string | null; justificativa: string; criado_em: string;
  usuarios?: { nome: string } | null;
  alm_retiradas?: Retirada | null;
}
export interface Retirada {
  id: string; codigo: string; funcionario_id: string; funcionario_nome: string; destino_tipo: 'projeto' | 'setor';
  projeto_id: string | null; projeto_codigo: string; projeto_titulo: string; setor: string; observacao: string; criado_em: string;
}
export interface FuncionarioAlm { id: string; nome: string; funcao: string; setor: string }
export interface ProjetoAlm { id: string; codigo: string; titulo: string; cliente: string }

export const listarEstoque = async (): Promise<ItemEstoque[]> =>
  ok(await supabase.rpc('alm_estoque')).map((i: ItemEstoque) => ({ ...i, saldo: Number(i.saldo), minimo: Number(i.minimo), custo_medio: Number(i.custo_medio) }))
    .sort((a: ItemEstoque, b: ItemEstoque) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
export const listarProdutos = async (): Promise<Produto[]> => ok(await supabase.rpc('alm_produtos'));
export const listarFuncionarios = async (): Promise<FuncionarioAlm[]> => ok(await supabase.rpc('alm_funcionarios'));
export const listarProjetos = async (): Promise<ProjetoAlm[]> => ok(await supabase.rpc('alm_projetos'));
export const listarSetores = async (): Promise<string[]> => (ok(await supabase.rpc('alm_setores')) as { nome: string }[]).map((s) => s.nome);

export async function adicionarItem(p: { bib_tipo: string; bib_id: string; unidade: string; minimo: number; local: string; saldo_inicial: number }): Promise<string> {
  return ok(await supabase.rpc('alm_adicionar_item', {
    p_bib_tipo: p.bib_tipo, p_bib_id: p.bib_id, p_unidade: p.unidade, p_minimo: p.minimo, p_local: p.local, p_saldo_inicial: p.saldo_inicial,
  }));
}
export async function atualizarItem(id: string, d: Partial<Pick<ItemEstoque, 'minimo' | 'local' | 'ativo'>>): Promise<void> {
  ok(await supabase.from('alm_itens').update(d).eq('id', id));
}
export async function ajustarEstoque(item: string, saldoContado: number, motivo: string): Promise<void> {
  ok(await supabase.rpc('alm_ajustar', { p_item: item, p_saldo_contado: saldoContado, p_motivo: motivo }));
}

const COM_DETALHES = '*, usuarios(nome), alm_retiradas(*)';
export const listarMovimentosItem = async (item: string): Promise<Movimento[]> =>
  ok(await supabase.from('alm_movimentos').select(COM_DETALHES).eq('item_id', item).order('criado_em', { ascending: false }).limit(300));
// Movimentos ligados a retiradas (retirada, devolução e estornos) desde uma data.
export const listarMovimentosRetiradas = async (desde: string): Promise<Movimento[]> =>
  ok(await supabase.from('alm_movimentos').select(COM_DETALHES).not('retirada_id', 'is', null).gte('criado_em', desde).order('criado_em', { ascending: false }).limit(2000));

export interface NovaRetirada {
  funcionario_id: string; destino_tipo: 'projeto' | 'setor'; projeto_id: string | null; setor: string; observacao: string;
  itens: { item_id: string; quantidade: number }[];
}
export async function registrarRetirada(r: NovaRetirada): Promise<string> {
  return ok(await supabase.rpc('alm_registrar_retirada', {
    p_funcionario: r.funcionario_id, p_destino_tipo: r.destino_tipo, p_projeto: r.projeto_id, p_setor: r.setor, p_observacao: r.observacao, p_itens: r.itens,
  }));
}
export async function devolver(mov: string, quantidade: number, observacao: string): Promise<void> {
  ok(await supabase.rpc('alm_devolver', { p_mov: mov, p_quantidade: quantidade, p_observacao: observacao }));
}
export async function estornar(mov: string, motivo: string): Promise<void> {
  ok(await supabase.rpc('alm_estornar', { p_mov: mov, p_motivo: motivo }));
}

// ---------- Pedido de compra para Compras (origem "almoxarifado", função de Compras v2) ----------
export interface CompraAberta { item_id: string; requisicao_codigo: string; criado_em: string }
export const listarComprasAbertas = async (): Promise<CompraAberta[]> => ok(await supabase.rpc('alm_compras_abertas'));
export async function solicitarCompra(p: { itens: { item_id: string; quantidade: number }[]; necessario_em: string | null; prioridade: 'normal' | 'urgente'; observacoes: string }): Promise<string> {
  return ok(await supabase.rpc('alm_solicitar_compra', { p_itens: p.itens, p_necessario_em: p.necessario_em, p_prioridade: p.prioridade, p_observacoes: p.observacoes }));
}

// ---------- Recebimento das ordens de compra (decisão 108) ----------
export type DestinoRecebimento = 'estoque' | 'projeto' | 'setor';
export interface ItemOC { item_id: string; descricao: string; unidade: string; grupo: string; quantidade: number; recebida: number; valor_unit: number; destino: DestinoRecebimento }
export interface OCReceber {
  id: string; codigo: string; status: 'aguardando_entrega' | 'entregue_parcial'; previsao: string | null; emitido_em: string; fornecedor: string | null;
  requisicao_codigo: string; requisicao_titulo: string; origem: string; setor: string; projeto_codigo: string; projeto_titulo: string; itens: ItemOC[] | null;
}
export interface Reserva {
  id: string; projeto_codigo: string; projeto_titulo: string; descricao: string; unidade: string; quantidade: number; pedido_codigo: string;
  status: 'reservado' | 'entregue'; entregue_para: string; entregue_em: string | null; criado_em: string;
}
export interface Recebimento {
  id: string; pedido_codigo: string; fornecedor_nome: string; data: string; observacao: string; criado_em: string;
  usuarios?: { nome: string } | null;
  alm_recebimento_itens: { id: string; descricao: string; unidade: string; aceita: number; rejeitada: number; motivo: string; destino: DestinoRecebimento }[];
}
export const recebimentoDisponivel = async (): Promise<boolean> => ok(await supabase.rpc('alm_recebimento_disponivel'));
export const listarOCsReceber = async (): Promise<OCReceber[]> => ok(await supabase.rpc('alm_ocs_a_receber'));
export const listarReservas = async (): Promise<Reserva[]> => ok(await supabase.from('alm_reservas').select('*').order('criado_em', { ascending: false }).limit(500));
export const listarRecebimentos = async (): Promise<Recebimento[]> =>
  ok(await supabase.from('alm_recebimentos').select('*, usuarios(nome), alm_recebimento_itens(*)').order('criado_em', { ascending: false }).limit(50));
export async function receberOC(pedido: string, data: string, itens: { item_id: string; aceita: number; rejeitada: number; motivo: string }[], observacao: string): Promise<void> {
  ok(await supabase.rpc('alm_receber_oc', { p_pedido: pedido, p_data: data, p_itens: itens, p_observacao: observacao }));
}
export async function entregarReserva(id: string, para: string): Promise<void> {
  ok(await supabase.rpc('alm_entregar_reserva', { p_reserva: id, p_para: para }));
}

// ---------- Solicitações de compra do Almoxarifado (decisão 110) ----------
export type SituacaoItemCompra = 'a_comprar' | 'em_cotacao' | 'comprado' | 'recebido' | 'cancelado';
export interface SolicitacaoAlm {
  id: string; codigo: string; titulo: string; status: 'aberta' | 'concluida' | 'cancelada'; prioridade: 'normal' | 'urgente';
  necessario_em: string | null; observacoes: string; criado_em: string; solicitante: string | null;
  itens: { id: string; descricao: string; grupo: string; quantidade: number; unidade: string; cadastrado: boolean; observacoes: string; situacao: SituacaoItemCompra; pedido: string | null; recebida: number }[];
}
export interface LinhaSolicitacao { bib_tipo?: string; bib_id?: string; descricao?: string; grupo?: string; unidade: string; quantidade: number; observacoes: string }
export const listarSolicitacoes = async (): Promise<SolicitacaoAlm[]> => ok(await supabase.rpc('alm_minhas_solicitacoes'));
export async function solicitarItens(itens: LinhaSolicitacao[], necessario_em: string | null, prioridade: 'normal' | 'urgente', observacoes: string): Promise<string> {
  return ok(await supabase.rpc('alm_solicitar_itens', { p_itens: itens, p_necessario_em: necessario_em, p_prioridade: prioridade, p_observacoes: observacoes }));
}
