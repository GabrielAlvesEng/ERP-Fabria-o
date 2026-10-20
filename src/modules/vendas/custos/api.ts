import { supabase } from '@/shared/lib/supabase';
import type { CustoItem, CustoLinha, LinhaNova } from './regras';
import { modeloLinhas, proximaLetra } from './regras';

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface RefMaterial { id: string; tipo: 'Chapas' | 'Perfis' | 'Comerciais'; descricao: string; unidade: string; preco: number; cod_mat: string | null; kg_m: number | null }

export async function listarRefMateriais(): Promise<RefMaterial[]> {
  // A lista passa de 500 itens: busca tudo (limite padrão da API é 1000).
  return ok(await supabase.from('ref_materiais').select('id, tipo, descricao, unidade, preco, cod_mat, kg_m').eq('ativo', true).order('descricao').limit(5000));
}

export async function listarItens(revisaoId: string): Promise<CustoItem[]> {
  return ok(await supabase.from('custo_itens').select('*').eq('revisao_id', revisaoId).order('ordem').order('letra'));
}

export async function listarLinhas(itemIds: string[]): Promise<CustoLinha[]> {
  if (!itemIds.length) return [];
  return ok(await supabase.from('custo_linhas').select('*').in('item_id', itemIds).order('ordem'));
}

export async function criarItem(revisaoId: string, letrasUsadas: string[], descricao: string): Promise<CustoItem> {
  const [{ data: padrao }, { data: mo }, { data: maq }] = await Promise.all([
    supabase.from('configuracoes').select('valor').eq('chave', 'custos_padrao').maybeSingle(),
    supabase.from('ref_mao_obra').select('etapa, funcao, valor_hora').eq('ativo', true).order('ordem'),
    supabase.from('ref_maquinas').select('nome, terceirizada, valor_hora').eq('ativo', true).order('ordem'),
  ]);
  const p = (padrao?.valor ?? {}) as Partial<CustoItem>;
  const item = ok<CustoItem>(
    await supabase
      .from('custo_itens')
      .insert({
        revisao_id: revisaoId,
        letra: proximaLetra(letrasUsadas),
        descricao,
        ordem: letrasUsadas.length,
        lucro_pct: p.lucro_pct ?? 20,
        negociacao_pct: p.negociacao_pct ?? 5,
        imposto_pct: p.imposto_pct ?? 20,
        imposto_modo: p.imposto_modo ?? 'dentro',
      })
      .select()
      .single(),
  );
  const linhas = modeloLinhas(mo ?? [], maq ?? []).map((l) => ({ ...l, item_id: item.id }));
  ok(await supabase.from('custo_linhas').insert(linhas));
  return item;
}

export async function atualizarItem(id: string, dados: Partial<CustoItem>): Promise<void> {
  ok(await supabase.from('custo_itens').update(dados).eq('id', id));
}

export async function excluirItem(id: string): Promise<void> {
  // Só em revisão em rascunho (RLS). As linhas saem junto (cascade). Fica registrado na auditoria.
  ok(await supabase.from('custo_itens').delete().eq('id', id));
}

export async function adicionarLinha(itemId: string, l: Partial<LinhaNova> & Pick<LinhaNova, 'secao'>): Promise<CustoLinha> {
  return ok(await supabase.from('custo_linhas').insert({ item_id: itemId, quantidade: l.secao === 'acessorios' ? 1 : 0, ...l }).select().single());
}

export async function atualizarLinha(id: string, dados: Partial<CustoLinha>): Promise<CustoLinha> {
  return ok(await supabase.from('custo_linhas').update(dados).eq('id', id).select().single());
}

// Grava a nova ordem das linhas depois de arrastar (só as que mudaram).
export async function reordenarLinhas(mudancas: { id: string; ordem: number }[]): Promise<void> {
  const res = await Promise.all(mudancas.map((m) => supabase.from('custo_linhas').update({ ordem: m.ordem }).eq('id', m.id)));
  res.forEach((r) => ok(r));
}

export interface RefMaoObra { etapa: string; funcao: string; valor_hora: number }
export interface RefMaquina { nome: string; terceirizada: boolean; valor_hora: number }

export async function listarRefMaoObraMaquinas(): Promise<{ maoObra: RefMaoObra[]; maquinas: RefMaquina[] }> {
  const [mo, maq] = await Promise.all([
    supabase.from('ref_mao_obra').select('etapa, funcao, valor_hora').eq('ativo', true).order('ordem'),
    supabase.from('ref_maquinas').select('nome, terceirizada, valor_hora').eq('ativo', true).order('ordem'),
  ]);
  return { maoObra: ok(mo) ?? [], maquinas: ok(maq) ?? [] };
}

export async function removerLinha(id: string): Promise<void> {
  ok(await supabase.from('custo_linhas').delete().eq('id', id));
}
