import { supabase } from '@/shared/lib/supabase';

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface Marco { descricao: string; percentual: number; evento: string }

export interface Kickoff {
  id: string;
  proposta_id: string;
  versao: number;
  data_reuniao: string | null;
  participantes: string;
  observacoes: string;
  marcos: Marco[];
  status: 'rascunho' | 'finalizado';
  finalizado_em: string | null;
  usuarios?: { nome: string } | null;
}

export interface KickoffItem {
  id: string;
  kickoff_id: string;
  setor: string;
  descricao: string;
  necessario: 'sim' | 'nao' | 'a_definir';
  responsavel: string;
  prazo: string | null;
  observacao: string;
  ordem: number;
}

export async function listarKickoffs(propostaId: string): Promise<Kickoff[]> {
  return ok(await supabase.from('kickoffs').select('*, usuarios!kickoffs_finalizado_por_fkey(nome)').eq('proposta_id', propostaId).order('versao', { ascending: false }));
}

export async function listarItens(kickoffId: string): Promise<KickoffItem[]> {
  return ok(await supabase.from('kickoff_itens').select('*').eq('kickoff_id', kickoffId).order('ordem'));
}

export async function iniciarKickoff(propostaId: string): Promise<Kickoff> {
  return ok(await supabase.rpc('iniciar_kickoff', { p_proposta: propostaId })) as Kickoff;
}

export async function finalizarKickoff(id: string): Promise<void> {
  ok(await supabase.rpc('finalizar_kickoff', { p_kickoff: id }));
}

export async function atualizarKickoff(id: string, dados: Partial<Kickoff>): Promise<void> {
  const { usuarios: _u, ...resto } = dados;
  ok(await supabase.from('kickoffs').update(resto).eq('id', id));
}

export async function atualizarItem(id: string, dados: Partial<KickoffItem>): Promise<void> {
  ok(await supabase.from('kickoff_itens').update(dados).eq('id', id));
}

export async function adicionarItem(kickoffId: string, setor: string, descricao: string, ordem: number): Promise<void> {
  ok(await supabase.from('kickoff_itens').insert({ kickoff_id: kickoffId, setor, descricao, ordem }));
}

export async function removerItem(id: string): Promise<void> {
  ok(await supabase.from('kickoff_itens').delete().eq('id', id));
}
