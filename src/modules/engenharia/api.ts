import { supabase } from '@/shared/lib/supabase';
import type { Conjunto, MaterialCatalogo, Peca, Projeto } from './regras';

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export async function listarProjetos(): Promise<Projeto[]> {
  return ok(await supabase.from('projetos').select('*, empresas(nome_fantasia)').order('codigo', { ascending: false }));
}

export async function obterProjeto(id: string): Promise<Projeto> {
  return ok(await supabase.from('projetos').select('*, empresas(nome_fantasia)').eq('id', id).single());
}

export async function atualizarProjeto(id: string, dados: Partial<Projeto>): Promise<void> {
  const { empresas: _e, ...resto } = dados;
  ok(await supabase.from('projetos').update(resto).eq('id', id));
}

export interface PropostaAprovada { id: string; codigo: string; titulo: string; status: string; empresas: { nome_fantasia: string } | null }

export async function propostasSemProjeto(): Promise<PropostaAprovada[]> {
  const [props, projs] = await Promise.all([
    supabase.from('propostas').select('id, codigo, titulo, status, empresas(nome_fantasia)').in('status', ['Aprovado', 'Finalizado', 'Emitido NF', 'Pago']).order('codigo', { ascending: false }),
    supabase.from('projetos').select('proposta_id'),
  ]);
  const comProjeto = new Set((ok(projs) as { proposta_id: string }[]).map((p) => p.proposta_id));
  return (ok(props) as unknown as PropostaAprovada[]).filter((p) => !comProjeto.has(p.id));
}

export async function criarProjeto(propostaId: string): Promise<Projeto> {
  return ok(await supabase.rpc('criar_projeto', { p_proposta: propostaId })) as Projeto;
}

export async function listarConjuntos(projetoId: string): Promise<Conjunto[]> {
  return ok(await supabase.from('projeto_conjuntos').select('*').eq('projeto_id', projetoId).order('codigo'));
}

export async function listarPecas(projetoId: string): Promise<Peca[]> {
  return ok(await supabase.from('projeto_pecas').select('*').eq('projeto_id', projetoId).order('codigo'));
}

export async function adicionarConjunto(paiId: string, nome: string, quantidade = 1): Promise<Conjunto> {
  return ok(await supabase.rpc('adicionar_conjunto', { p_pai: paiId, p_nome: nome, p_quantidade: quantidade })) as Conjunto;
}

export async function atualizarConjunto(id: string, dados: Partial<Conjunto>): Promise<void> {
  ok(await supabase.from('projeto_conjuntos').update(dados).eq('id', id));
}

export async function adicionarPeca(conjuntoId: string, dados: Partial<Peca>): Promise<Peca> {
  return ok(await supabase.rpc('adicionar_peca', { p_conjunto: conjuntoId, p_dados: dados })) as Peca;
}

export async function atualizarPeca(id: string, dados: Partial<Peca>): Promise<void> {
  ok(await supabase.from('projeto_pecas').update(dados).eq('id', id));
}

export async function listarCatalogo(): Promise<MaterialCatalogo[]> {
  return ok(await supabase.from('catalogo_materiais').select('cod_mat, nome, categoria').eq('ativo', true).order('cod_mat'));
}

export async function excluirItem(tabela: 'conjunto' | 'peca', id: string): Promise<void> {
  ok(await supabase.rpc('excluir_item_eng', { p_tabela: tabela, p_id: id }));
}
