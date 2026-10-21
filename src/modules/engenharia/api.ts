import { supabase } from '@/shared/lib/supabase';
import type { Conjunto, MaterialCatalogo, Peca, Projeto } from './regras';
import type { RefsEng } from './biblioteca';

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

// Importação do SolidWorks: o plano vem do leitor do JSON (solidworks.ts); o banco gera os códigos e valida.
export async function importarSolidworks(projetoId: string, plano: unknown): Promise<{ nos: number; pecas: number }> {
  return ok(await supabase.rpc('importar_solidworks', { p_projeto: projetoId, p_plano: plano })) as { nos: number; pecas: number };
}

// Nova revisão do CAD: o plano vem do comparador (revisaoCad.ts).
export async function atualizarSolidworks(projetoId: string, plano: unknown): Promise<Record<string, number>> {
  return ok(await supabase.rpc('atualizar_solidworks', { p_projeto: projetoId, p_plano: plano })) as Record<string, number>;
}

export interface ImportacaoCad { id: string; tipo: 'inicial' | 'revisao'; arquivo: string; codigo_cad: string; macro: string; resumo: Record<string, number>; criado_em: string; usuarios: { nome: string } | null }

export async function listarImportacoesCad(projetoId: string): Promise<ImportacaoCad[]> {
  return ok(await supabase.from('projeto_importacoes_cad').select('*, usuarios(nome)').eq('projeto_id', projetoId).order('criado_em', { ascending: false }));
}

// Biblioteca de Materiais para as peças (decisão 53): itens ativos, tipos e preços de chapa por material + tipo.
export async function listarRefsEng(): Promise<RefsEng> {
  const [ch, pf, it, tp, pc] = await Promise.all([
    supabase.from('bib_chapas').select('id, cod_mat, tipo_id, descricao, espessura_mm, largura_mm, comprimento_mm, peso_kg, valor_kg').eq('ativo', true).limit(5000),
    supabase.from('bib_perfis').select('id, cod_mat, tipo_id, descricao, a_mm, b_mm, c_mm, parede_mm, kg_m, preco_modo, valor').eq('ativo', true).order('descricao').limit(5000),
    supabase.from('bib_itens').select('id, grupo, descricao, unidade, valor').eq('ativo', true).order('descricao').limit(5000),
    supabase.from('bib_tipos').select('id, grupo, nome, formato'),
    supabase.from('bib_chapa_precos').select('cod_mat, tipo_id, valor_kg'),
  ]);
  return { chapas: ok(ch) ?? [], perfis: ok(pf) ?? [], itens: ok(it) ?? [], tipos: ok(tp) ?? [], precosChapa: ok(pc) ?? [] };
}

// Custo de materiais (seção A) da revisão atual da proposta do projeto, por item × quantidade. Vazio sem permissão de custos.
export async function custoMateriaisProposta(propostaId: string): Promise<{ total: number; revisao: number } | null> {
  const { data: prop } = await supabase.from('propostas').select('revisao_atual').eq('id', propostaId).maybeSingle();
  if (!prop) return null;
  const { data: rev } = await supabase.from('proposta_revisoes').select('id, numero').eq('proposta_id', propostaId).eq('numero', prop.revisao_atual).maybeSingle();
  if (!rev) return null;
  const { data: itens } = await supabase.from('custo_itens').select('id, quantidade').eq('revisao_id', rev.id);
  if (!itens?.length) return null;
  const { data: linhas } = await supabase.from('custo_linhas').select('item_id, total').eq('secao', 'materiais').in('item_id', itens.map((i) => i.id));
  const qtd = new Map(itens.map((i) => [i.id, Number(i.quantidade)]));
  const total = (linhas ?? []).reduce((s, l) => s + Number(l.total) * (qtd.get(l.item_id) ?? 1), 0);
  return { total: Math.round(total * 100) / 100, revisao: rev.numero };
}
