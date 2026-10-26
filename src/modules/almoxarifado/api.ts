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
