import { supabase } from '@/shared/lib/supabase';
import type { Formato, GrupoItem, ModoPreco, TipoBiblioteca } from './regras';

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface MaterialBase { cod_mat: string; nome: string; categoria: string; densidade: number | null; ativo: boolean }
export interface PrecoChapa { id: string; cod_mat: string; tipo_id: string; valor_kg: number }
export interface Chapa {
  id: string; cod_mat: string; tipo_id: string; espessura_txt: string; espessura_mm: number; largura_mm: number; comprimento_mm: number;
  peso_kg: number; peso_manual: boolean; valor_kg: number | null; descricao: string; ativo: boolean;
}
export interface Perfil {
  id: string; cod_mat: string | null; tipo_id: string; a_txt: string; b_txt: string; c_txt: string; parede_txt: string;
  a_mm: number | null; b_mm: number | null; c_mm: number | null; parede_mm: number | null;
  kg_m: number | null; kg_m_manual: boolean; preco_modo: ModoPreco; valor: number; descricao: string; ativo: boolean;
}
export interface PesoPerfil { id: string; tipo_id: string; bitola: string; kg_m: number; fonte: string; ativo: boolean }
export interface ItemBiblioteca { id: string; grupo: GrupoItem; descricao: string; material: string; unidade: string; valor: number; ativo: boolean }
export interface Fornecedor { id: string; nome: string; cidade: string; contato: string; telefone: string; email: string; observacoes: string; ativo: boolean }
export interface ServicoFornecedor { id: string; fornecedor_id: string; servico: string; unidade: 'hora' | 'kg' | 'm²' | 'metro' | 'peça'; valor: number; ativo: boolean }
export const UNIDADES_SERVICO: ServicoFornecedor['unidade'][] = ['hora', 'kg', 'm²', 'metro', 'peça'];

export const listarMateriaisBase = async (): Promise<MaterialBase[]> =>
  ok(await supabase.from('catalogo_materiais').select('cod_mat, nome, categoria, densidade, ativo').order('categoria').order('cod_mat'));
export const listarTipos = async (): Promise<(TipoBiblioteca & { formato: Formato })[]> =>
  ok(await supabase.from('bib_tipos').select('*').order('grupo').order('ordem'));
export const listarPrecosChapa = async (): Promise<PrecoChapa[]> => ok(await supabase.from('bib_chapa_precos').select('id, cod_mat, tipo_id, valor_kg'));
export const listarChapas = async (): Promise<Chapa[]> => ok(await supabase.from('bib_chapas').select('*').order('descricao').limit(5000));
export const listarPerfis = async (): Promise<Perfil[]> => ok(await supabase.from('bib_perfis').select('*').order('descricao').limit(5000));
export const listarPesosPerfil = async (): Promise<PesoPerfil[]> => ok(await supabase.from('bib_pesos_perfil').select('*').order('kg_m'));
export const listarItens = async (): Promise<ItemBiblioteca[]> =>
  ok(await supabase.from('bib_itens').select('id, grupo, descricao, material, unidade, valor, ativo').order('descricao').limit(5000));
export const listarFornecedores = async (): Promise<Fornecedor[]> => ok(await supabase.from('fornecedores').select('*').order('nome'));
export const listarServicos = async (): Promise<ServicoFornecedor[]> => ok(await supabase.from('fornecedor_servicos').select('*').order('servico'));
export const listarARevisar = async (): Promise<{ id: string; tipo: string; descricao: string; preco: number }[]> =>
  ok(await supabase.from('ref_materiais').select('id, tipo, descricao, preco').eq('ativo', true).eq('migrado', false).order('descricao'));

type Tabela = 'bib_chapa_precos' | 'bib_chapas' | 'bib_perfis' | 'bib_pesos_perfil' | 'bib_itens' | 'bib_tipos' | 'fornecedores' | 'fornecedor_servicos'
  | 'catalogo_materiais' | 'ref_mao_obra' | 'ref_maquinas';

// Gravação genérica: sem exclusão física (desativar = ativo false), auditoria no banco.
export async function inserir(tabela: Tabela, dados: Record<string, unknown>): Promise<void> {
  ok(await supabase.from(tabela).insert(dados));
}
export async function atualizar(tabela: Tabela, chave: Record<string, string>, dados: Record<string, unknown>): Promise<void> {
  let q = supabase.from(tabela).update(dados);
  for (const [k, v] of Object.entries(chave)) q = q.eq(k, v);
  ok(await q);
}
