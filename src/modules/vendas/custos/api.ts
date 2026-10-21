import { supabase } from '@/shared/lib/supabase';
import type { CustoItem, CustoLinha, LinhaNova } from './regras';
import { modeloLinhas, proximaLetra } from './regras';

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

// Biblioteca de Materiais e Predefinições usadas na aba Custos (decisões 48 a 50).
export interface RefChapa { id: string; cod_mat: string; tipo_id: string; descricao: string; peso_kg: number; valor_kg: number | null }
export interface RefPerfil { id: string; cod_mat: string | null; descricao: string; kg_m: number | null; preco_modo: 'm' | 'kg'; valor: number }
export interface RefItem { id: string; grupo: 'Comerciais' | 'Fixadores' | 'Consumíveis'; descricao: string; material: string; unidade: string; valor: number }
export interface RefServico { id: string; servico: string; valor: number; fornecedor: string }
export interface RefMaoObra { etapa: string; funcao: string; valor_hora: number }
export interface RefMaquina { nome: string; valor_hora: number }
export interface Referencias {
  chapas: RefChapa[]; precosChapa: { cod_mat: string; tipo_id: string; valor_kg: number }[]; perfis: RefPerfil[]; itens: RefItem[];
  servicos: RefServico[]; maoObra: RefMaoObra[]; maquinas: RefMaquina[];
}

export async function listarReferencias(): Promise<Referencias> {
  const [ch, pc, pf, it, sv, mo, maq] = await Promise.all([
    supabase.from('bib_chapas').select('id, cod_mat, tipo_id, descricao, peso_kg, valor_kg').eq('ativo', true).order('descricao').limit(5000),
    supabase.from('bib_chapa_precos').select('cod_mat, tipo_id, valor_kg'),
    supabase.from('bib_perfis').select('id, cod_mat, descricao, kg_m, preco_modo, valor').eq('ativo', true).order('descricao').limit(5000),
    supabase.from('bib_itens').select('id, grupo, descricao, material, unidade, valor').eq('ativo', true).order('descricao').limit(5000),
    supabase.from('fornecedor_servicos').select('id, servico, valor, unidade, fornecedores!inner(nome, ativo)').eq('ativo', true).eq('unidade', 'hora').eq('fornecedores.ativo', true),
    supabase.from('ref_mao_obra').select('etapa, funcao, valor_hora').eq('ativo', true).order('ordem'),
    supabase.from('ref_maquinas').select('nome, valor_hora').eq('ativo', true).eq('terceirizada', false).order('ordem'),
  ]);
  type Sv = { id: string; servico: string; valor: number; fornecedores: { nome: string } | { nome: string }[] };
  return {
    chapas: ok(ch) ?? [], precosChapa: ok(pc) ?? [], perfis: ok(pf) ?? [], itens: ok(it) ?? [],
    servicos: ((ok(sv) ?? []) as unknown as Sv[]).map((x) => ({ id: x.id, servico: x.servico, valor: Number(x.valor), fornecedor: Array.isArray(x.fornecedores) ? x.fornecedores[0]?.nome ?? '' : x.fornecedores.nome })),
    maoObra: ok(mo) ?? [], maquinas: ok(maq) ?? [],
  };
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
    supabase.from('ref_maquinas').select('nome, valor_hora').eq('ativo', true).eq('terceirizada', false).order('ordem'),
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
        imposto_modo: 'dentro', // decisão 43
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
  return ok(await supabase.from('custo_linhas').insert({ item_id: itemId, quantidade: 0, ...l }).select().single());
}

export async function atualizarLinha(id: string, dados: Partial<CustoLinha>): Promise<CustoLinha> {
  return ok(await supabase.from('custo_linhas').update(dados).eq('id', id).select().single());
}

// Grava a nova ordem das linhas depois de arrastar (só as que mudaram).
export async function reordenarLinhas(mudancas: { id: string; ordem: number }[]): Promise<void> {
  const res = await Promise.all(mudancas.map((m) => supabase.from('custo_linhas').update({ ordem: m.ordem }).eq('id', m.id)));
  res.forEach((r) => ok(r));
}

export async function removerLinha(id: string): Promise<void> {
  ok(await supabase.from('custo_linhas').delete().eq('id', id));
}

export type Combustivel = 'gasolina' | 'etanol' | 'diesel';
export interface RefVeiculo { id: string; nome: string; placa: string; consumo_km_l: number; combustivel: Combustivel | 'flex'; eixos: number; ativo: boolean }

// Veículos ativos e preço atual de cada combustível (Administração → Frota, decisão 55), para a seção Viagem.
export async function listarVeiculosECombustivel(): Promise<{ veiculos: RefVeiculo[]; precos: Partial<Record<Combustivel, number>> }> {
  const [v, c] = await Promise.all([
    supabase.from('ref_veiculos').select('id, nome, placa, consumo_km_l, combustivel, eixos, ativo').eq('ativo', true).order('ordem').order('nome'),
    supabase.from('combustivel_precos_atuais').select('combustivel, preco'),
  ]);
  const precos: Partial<Record<Combustivel, number>> = {};
  for (const x of (ok(c) ?? []) as { combustivel: Combustivel; preco: number }[]) precos[x.combustivel] = Number(x.preco);
  return { veiculos: ok(v) ?? [], precos };
}

// Preço por litro usado para o veículo: o do combustível dele; flex usa sempre gasolina (decisão 55).
export const precoDoVeiculo = (v: Pick<RefVeiculo, 'combustivel'> | undefined, precos: Partial<Record<Combustivel, number>>) =>
  precos[!v || v.combustivel === 'flex' ? 'gasolina' : v.combustivel] ?? null;
