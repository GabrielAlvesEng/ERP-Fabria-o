import { supabase } from '@/shared/lib/supabase';
import type { Situacao } from './regras';

// RH (decisão 69). Setores e funções todos leem; as fichas só o RH (rh.ler) e o próprio funcionário.

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface Setor { id: string; nome: string; ativo: boolean }
export interface Funcao { id: string; setor_id: string; nome: string; descricao: string; ativo: boolean }

export interface Funcionario {
  id: string; nome: string; cpf: string | null; rg: string; nascimento: string | null; telefone: string;
  email_pessoal: string; email_corporativo: string; cep: string; endereco: string; cidade: string; uf: string;
  emergencia_nome: string; emergencia_telefone: string; matricula: string | null; funcao_id: string | null;
  admissao: string | null; vinculo: string; situacao: Situacao; desligamento: string | null; usuario_id: string | null;
  observacoes: string; atualizado_em: string;
  usuarios?: { nome: string; email: string; ativo: boolean; foto_caminho: string | null; foto_atualizada_em: string | null } | null;
}
export type DadosFuncionario = Omit<Funcionario, 'id' | 'atualizado_em' | 'usuarios'>;

export const listarSetores = async (): Promise<Setor[]> => ok(await supabase.from('setores').select('id, nome, ativo').order('nome'));
export const listarFuncoes = async (): Promise<Funcao[]> => ok(await supabase.from('funcoes').select('id, setor_id, nome, descricao, ativo').order('nome'));

export async function salvarSetor(s: { id?: string; nome: string; ativo: boolean }): Promise<void> {
  ok(s.id ? await supabase.from('setores').update({ nome: s.nome, ativo: s.ativo }).eq('id', s.id) : await supabase.from('setores').insert({ nome: s.nome }));
}
export async function salvarFuncao(f: { id?: string; setor_id: string; nome: string; descricao: string; ativo: boolean }): Promise<void> {
  const { id, ...dados } = f;
  ok(id ? await supabase.from('funcoes').update(dados).eq('id', id) : await supabase.from('funcoes').insert(dados));
}

const COM_USUARIO = '*, usuarios!funcionarios_usuario_id_fkey(nome, email, ativo, foto_caminho, foto_atualizada_em)';

export const listarFuncionarios = async (): Promise<Funcionario[]> => ok(await supabase.from('funcionarios').select(COM_USUARIO).order('nome'));
export const obterFuncionario = async (id: string): Promise<Funcionario> => ok(await supabase.from('funcionarios').select(COM_USUARIO).eq('id', id).single());

export async function salvarFuncionario(id: string | null, f: DadosFuncionario): Promise<string> {
  if (id) {
    ok(await supabase.from('funcionarios').update(f).eq('id', id));
    return id;
  }
  return ok(await supabase.from('funcionarios').insert(f).select('id').single<{ id: string }>()).id;
}

// Usuários do ERP ainda sem ficha, para ligar a uma ficha.
export async function listarUsuariosSemFicha(atual: string | null): Promise<{ id: string; nome: string; email: string }[]> {
  const usuarios = ok(await supabase.from('usuarios').select('id, nome, email').eq('ativo', true).order('nome'));
  const ligados = ok(await supabase.from('funcionarios').select('usuario_id').not('usuario_id', 'is', null)) as { usuario_id: string }[];
  const usados = new Set(ligados.map((l) => l.usuario_id).filter((u) => u !== atual));
  return usuarios.filter((u) => !usados.has(u.id));
}
