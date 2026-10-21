// Acesso a dados de Vendas. Regras sensíveis ficam nas RPCs do banco.
import { supabase } from '@/shared/lib/supabase';
import type { Arquivo, Contato, Empresa, Evento, Proposta, Revisao, StatusProposta } from './types';

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

// Empresas -------------------------------------------------------------------
export async function listarEmpresas(): Promise<Empresa[]> {
  return ok(await supabase.from('empresas').select('*').order('nome_fantasia'));
}

export async function salvarEmpresa(e: Partial<Empresa>): Promise<void> {
  const { id, criado_em: _c, ativo: _a, ...dados } = e;
  if (id) ok(await supabase.from('empresas').update(dados).eq('id', id));
  else ok(await supabase.from('empresas').insert(dados));
}

export async function definirAtivoEmpresa(id: string, ativo: boolean): Promise<void> {
  ok(await supabase.from('empresas').update({ ativo }).eq('id', id));
}

// Contatos -------------------------------------------------------------------
export async function listarContatos(): Promise<Contato[]> {
  return ok(await supabase.from('contatos').select('*, empresas(nome_fantasia), contato_anos(ano, codigo_comercial)').order('nome'));
}

export async function salvarContato(c: Partial<Contato>): Promise<string> {
  const { id, empresas: _e, contato_anos: _a, ...dados } = c;
  if (id) {
    ok(await supabase.from('contatos').update(dados).eq('id', id));
    return id;
  }
  const r = ok<{ id: string }>(await supabase.from('contatos').insert(dados).select('id').single());
  return r.id;
}

export async function incluirContatoNoAno(contatoId: string, ano: number): Promise<number> {
  return ok(await supabase.rpc('incluir_contato_no_ano', { p_contato: contatoId, p_ano: ano })) as number;
}

// Propostas ------------------------------------------------------------------
const camposProposta = '*, empresas(nome_fantasia), contatos!propostas_contato_id_fkey(nome), usuarios!propostas_responsavel_id_fkey(nome, vendedores!vendedores_usuario_id_fkey(nome))';

export async function listarPropostas(ano: number): Promise<Proposta[]> {
  return ok(await supabase.from('propostas').select(camposProposta).eq('ano', ano).order('ordem_kanban'));
}

export async function obterProposta(id: string): Promise<Proposta> {
  return ok(await supabase.from('propostas').select(camposProposta).eq('id', id).single());
}

export async function criarProposta(dados: Record<string, unknown>): Promise<Proposta> {
  return ok(await supabase.rpc('criar_proposta', { p_dados: dados })) as Proposta;
}

export async function atualizarRascunho(id: string, dados: Partial<Proposta>): Promise<void> {
  ok(await supabase.from('propostas').update(dados).eq('id', id));
}

export async function moverProposta(id: string, para: StatusProposta, dados: Record<string, unknown> = {}): Promise<void> {
  ok(await supabase.rpc('mover_proposta', { p_id: id, p_para: para, p_dados: dados }));
}

export async function reordenarProposta(id: string, ordem: number): Promise<void> {
  ok(await supabase.rpc('reordenar_proposta', { p_id: id, p_ordem: ordem }));
}

export async function aprovarProposta(id: string, dados: Record<string, unknown>): Promise<void> {
  ok(await supabase.rpc('aprovar_proposta', { p_id: id, p_dados: dados }));
}

export async function reprovarProposta(id: string, dados: Record<string, unknown>): Promise<void> {
  ok(await supabase.rpc('reprovar_proposta', { p_id: id, p_dados: dados }));
}

export async function registrarFollowup(id: string, dados: Record<string, unknown>): Promise<void> {
  ok(await supabase.rpc('registrar_followup', { p_id: id, p_dados: dados }));
}

export async function listarRevisoes(propostaId: string): Promise<Revisao[]> {
  return ok(await supabase.from('proposta_revisoes').select('*').eq('proposta_id', propostaId).order('numero', { ascending: false }));
}

export async function listarArquivos(revisaoIds: string[]): Promise<Arquivo[]> {
  if (!revisaoIds.length) return [];
  return ok(await supabase.from('proposta_arquivos').select('*').in('revisao_id', revisaoIds).order('criado_em'));
}

export async function listarEventos(propostaId: string): Promise<Evento[]> {
  return ok(await supabase.from('proposta_eventos').select('*, usuarios(nome)').eq('proposta_id', propostaId).order('criado_em', { ascending: false }));
}

export async function obterAprovacao(propostaId: string) {
  return ok(await supabase.from('proposta_aprovacoes').select('*').eq('proposta_id', propostaId).order('criado_em', { ascending: false }).limit(1).maybeSingle()) as
    | { forma: string; numero_documento: string; data_aprovacao: string; valor_aprovado: number; comprovante_caminho: string; comprovante_nome: string; observacoes: string }
    | null;
}

export async function listarReprovacoes(propostaId: string) {
  return ok(await supabase.from('proposta_reprovacoes').select('*').eq('proposta_id', propostaId).order('criado_em', { ascending: false })) as {
    id: string;
    motivo: string;
    concorrente: string;
    observacoes: string;
    criado_em: string;
  }[];
}

// Arquivos (Storage privado "vendas") ------------------------------------------
function nomeSeguro(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
}

export async function enviarArquivoRevisao(propostaId: string, revisaoId: string, tipo: Arquivo['tipo'], arquivo: File): Promise<void> {
  const caminho = `propostas/${propostaId}/${revisaoId}/${Date.now()}_${nomeSeguro(arquivo.name)}`;
  ok(await supabase.storage.from('vendas').upload(caminho, arquivo));
  ok(await supabase.from('proposta_arquivos').insert({ revisao_id: revisaoId, tipo, caminho, nome: arquivo.name, tamanho: arquivo.size }));
}

export async function removerArquivo(a: Arquivo): Promise<void> {
  ok(await supabase.from('proposta_arquivos').delete().eq('id', a.id));
  await supabase.storage.from('vendas').remove([a.caminho]);
}

export async function enviarComprovante(propostaId: string, arquivo: File): Promise<string> {
  const caminho = `aprovacoes/${propostaId}/${Date.now()}_${nomeSeguro(arquivo.name)}`;
  ok(await supabase.storage.from('vendas').upload(caminho, arquivo));
  return caminho;
}

export async function abrirArquivo(caminho: string): Promise<void> {
  const r = ok(await supabase.storage.from('vendas').createSignedUrl(caminho, 120));
  window.open((r as { signedUrl: string }).signedUrl, '_blank', 'noopener');
}

// Código sugerido para a nova proposta (decisão 44): não consome número; o banco confirma ao criar.
export async function sugerirCodigoProposta(contatoId: string, ano: number): Promise<string> {
  return ok(await supabase.rpc('sugerir_codigo_proposta', { p_contato: contatoId, p_ano: ano })) as string;
}

// Retornos de follow-up vencidos (qualquer ano), para o sino de Vendas (decisão 40).
export type RetornoVencido = Pick<Proposta, 'id' | 'codigo' | 'titulo' | 'proximo_followup' | 'responsavel_id' | 'empresas' | 'contatos'>;

export async function listarRetornosVencidos(hoje: string): Promise<RetornoVencido[]> {
  return ok<unknown>(await supabase.from('propostas').select('id, codigo, titulo, proximo_followup, responsavel_id, empresas(nome_fantasia), contatos!propostas_contato_id_fkey(nome)')
    .in('status', ['Enviados', 'Follow-up']).lte('proximo_followup', hoje).order('proximo_followup')) as RetornoVencido[];
}
