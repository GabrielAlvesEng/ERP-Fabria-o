import { lerTudo } from '@/shared/lib/consulta';
import { supabase } from '@/shared/lib/supabase';
import type { ColunaProjeto, Conjunto, MaterialCatalogo, PainelProjeto, Peca, Projeto } from './regras';
import type { RefsEng } from './biblioteca';

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

// O cliente vem pelo campo calculado cliente_nome: a Engenharia não lê o cadastro de Vendas (decisão 96).
export async function listarProjetos(): Promise<Projeto[]> {
  return ok(await supabase.from('projetos').select('*, cliente_nome').order('codigo', { ascending: false }));
}

export async function obterProjeto(id: string): Promise<Projeto> {
  return ok(await supabase.from('projetos').select('*, cliente_nome').eq('id', id).single());
}

export async function atualizarProjeto(id: string, dados: Partial<Pick<Projeto, 'responsavel_id' | 'prazo' | 'observacoes' | 'titulo'>>): Promise<void> {
  ok(await supabase.from('projetos').update(dados).eq('id', id));
}

export interface PropostaAprovada { id: string; codigo: string; titulo: string; cliente: string | null }

export async function propostasSemProjeto(): Promise<PropostaAprovada[]> {
  return ok(await supabase.rpc('propostas_aguardando_projeto')) ?? [];
}

export async function moverProjeto(id: string, status: ColunaProjeto, justificativa = '', data: string | null = null): Promise<void> {
  ok(await supabase.rpc('mover_projeto', { p_projeto: id, p_status: status, p_justificativa: justificativa, p_data: data }));
}

export async function pausarProjeto(id: string, pausado: boolean, justificativa = ''): Promise<void> {
  ok(await supabase.rpc('pausar_projeto', { p_projeto: id, p_pausado: pausado, p_justificativa: justificativa }));
}

export async function criarProjetoExemplo(titulo: string): Promise<Projeto> {
  return ok(await supabase.rpc('criar_projeto_exemplo', { p_titulo: titulo })) as Projeto;
}

export async function listarPainel(): Promise<PainelProjeto[]> {
  return ok(await supabase.from('painel_engenharia').select('*'));
}

export interface EventoProjeto { id: string; tipo: 'criado' | 'status' | 'pausa'; de: string | null; para: string | null; justificativa: string; criado_em: string; usuarios: { nome: string } | null }

export async function listarEventos(projetoId: string): Promise<EventoProjeto[]> {
  return ok(await supabase.from('projeto_eventos').select('id, tipo, de, para, justificativa, criado_em, usuarios(nome)').eq('projeto_id', projetoId).order('criado_em', { ascending: false })) as unknown as EventoProjeto[];
}

export interface UsuarioAtivo { id: string; nome: string }

export async function listarUsuariosAtivos(): Promise<UsuarioAtivo[]> {
  return ok(await supabase.from('usuarios').select('id, nome').eq('ativo', true).order('nome'));
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
    lerTudo((de, ate) => supabase.from('bib_itens').select('id, grupo, descricao, unidade, valor').eq('ativo', true).order('descricao').order('id').range(de, ate)),
    supabase.from('bib_tipos').select('id, grupo, nome, formato'),
    supabase.from('bib_chapa_precos').select('cod_mat, tipo_id, valor_kg'),
  ]);
  return { chapas: ok(ch) ?? [], perfis: ok(pf) ?? [], itens: ok(it) ?? [], tipos: ok(tp) ?? [], precosChapa: ok(pc) ?? [] };
}
