import { supabase } from '@/shared/lib/supabase';
import type { Situacao, SituacaoReq } from './regras';

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

// Entrega 2: tipos de documento, requisitos e documentos do funcionário (arquivos no espaço privado "rh").

export const CATEGORIAS = ['Saúde (ASO)', 'Treinamento NR', 'CNH', 'Certificação', 'Registro profissional', 'Documento pessoal', 'Outro'] as const;

export interface TipoDocumento {
  id: string; nome: string; categoria: string; tem_validade: boolean; validade_meses: number | null; aviso_dias: number; descricao: string; ativo: boolean;
}
export interface DocumentoFuncionario {
  id: string; funcionario_id: string; tipo_documento_id: string; numero: string; emissao: string | null; validade: string | null;
  arquivo_caminho: string | null; arquivo_nome: string; observacoes: string; substituido_em: string | null; excluido_em: string | null; criado_em: string;
}
export interface SituacaoRequisito {
  funcionario_id: string; tipo_documento_id: string; exigido: boolean; tipo_nome: string; categoria: string; aviso_dias: number;
  documento_id: string | null; numero: string | null; emissao: string | null; validade: string | null; situacao: SituacaoReq;
}

export const listarTiposDocumento = async (): Promise<TipoDocumento[]> => ok(await supabase.from('tipos_documento').select('*').order('nome'));

export async function salvarTipoDocumento(t: Omit<TipoDocumento, 'id'> & { id?: string }): Promise<void> {
  const { id, ...dados } = t;
  ok(id ? await supabase.from('tipos_documento').update(dados).eq('id', id) : await supabase.from('tipos_documento').insert(dados));
}

export const listarRequisitosFuncoes = async (): Promise<{ funcao_id: string; tipo_documento_id: string }[]> =>
  ok(await supabase.from('funcao_requisitos').select('funcao_id, tipo_documento_id'));

// Troca a lista de requisitos de uma tabela de requisitos (por função ou individual): inclui os novos e tira os que saíram.
async function trocarRequisitos(tabela: 'funcao_requisitos' | 'funcionario_requisitos', coluna: 'funcao_id' | 'funcionario_id', id: string, antes: string[], depois: string[]) {
  const novos = depois.filter((t) => !antes.includes(t));
  const saem = antes.filter((t) => !depois.includes(t));
  if (novos.length) ok(await supabase.from(tabela).insert(novos.map((t) => ({ [coluna]: id, tipo_documento_id: t }))));
  if (saem.length) ok(await supabase.from(tabela).delete().eq(coluna, id).in('tipo_documento_id', saem));
}
export const salvarRequisitosFuncao = (funcaoId: string, antes: string[], depois: string[]) => trocarRequisitos('funcao_requisitos', 'funcao_id', funcaoId, antes, depois);
export const salvarRequisitosExtras = (funcionarioId: string, antes: string[], depois: string[]) => trocarRequisitos('funcionario_requisitos', 'funcionario_id', funcionarioId, antes, depois);

export const listarRequisitosExtras = async (funcionarioId: string): Promise<string[]> =>
  (ok(await supabase.from('funcionario_requisitos').select('tipo_documento_id').eq('funcionario_id', funcionarioId)) as { tipo_documento_id: string }[]).map((r) => r.tipo_documento_id);

export const listarDocumentos = async (funcionarioId: string): Promise<DocumentoFuncionario[]> =>
  ok(await supabase.from('funcionario_documentos').select('*').eq('funcionario_id', funcionarioId).is('excluido_em', null).order('criado_em', { ascending: false }));

export async function listarSituacoes(funcionarioId?: string): Promise<SituacaoRequisito[]> {
  let q = supabase.from('situacao_requisitos').select('*');
  if (funcionarioId) q = q.eq('funcionario_id', funcionarioId);
  return ok(await q);
}

export async function lancarDocumento(d: { funcionario_id: string; tipo_documento_id: string; numero: string; emissao: string | null; validade: string | null; observacoes: string }, arquivo: File | null): Promise<void> {
  let arquivo_caminho: string | null = null;
  if (arquivo) {
    const ext = (arquivo.name.split('.').pop() ?? 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
    arquivo_caminho = `${d.funcionario_id}/${crypto.randomUUID()}.${ext}`;
    ok(await supabase.storage.from('rh').upload(arquivo_caminho, arquivo, { contentType: arquivo.type }));
  }
  ok(await supabase.from('funcionario_documentos').insert({ ...d, arquivo_caminho, arquivo_nome: arquivo?.name ?? '' }));
}

export async function excluirDocumento(id: string): Promise<void> {
  ok(await supabase.from('funcionario_documentos').update({ excluido_em: new Date().toISOString() }).eq('id', id));
}

export async function abrirArquivoRh(caminho: string): Promise<void> {
  const janela = window.open('', '_blank');
  const { signedUrl } = ok(await supabase.storage.from('rh').createSignedUrl(caminho, 300));
  if (janela) janela.location.href = signedUrl;
  else window.location.href = signedUrl;
}
