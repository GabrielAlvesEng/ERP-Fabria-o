import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthProvider';
import { supabase } from '@/shared/lib/supabase';

// Comunicação (docs/PLANEJAMENTO_COMUNICACAO.md). O banco decide quem pode mandar para quem (enviar_comunicado) e quem
// lê o quê (RLS); a tela só mostra. O aviso no celular e o e-mail saem pela Edge Function comunicacao-envio.

export type Alcance = 'empresa' | 'setores' | 'pessoas';

export interface Comunicado {
  id: string; autor_id: string; alcance: Alcance; titulo: string; texto: string; urgente: boolean; exige_ciente: boolean;
  enviar_email: boolean; fixado_ate: string | null; anexo_caminho: string | null; anexo_nome: string | null;
  lembrado_em: string | null; criado_em: string; cancelado_em: string | null;
  autor: { nome: string; foto_caminho: string | null; foto_atualizada_em: string | null } | null;
  comunicado_setores: { setores: { nome: string } | null }[];
}

export interface Recebido extends Comunicado { lido_em: string | null; ciente_em: string | null }

export interface Destinatario {
  comunicado_id: string; usuario_id: string; push_enviado_em: string | null; email_enviado_em: string | null;
  lido_em: string | null; ciente_em: string | null; usuarios: { nome: string } | null;
}

export interface Pessoa {
  funcionario_id: string; usuario_id: string | null; nome: string; setor_id: string; setor: string; funcao: string;
  tem_login: boolean; aparelhos: number;
}

export interface Papel { geral: boolean; setores: string[] }

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

const CAMPOS = 'id, autor_id, alcance, titulo, texto, urgente, exige_ciente, enviar_email, fixado_ate, anexo_caminho, anexo_nome, lembrado_em, criado_em, cancelado_em, autor:usuarios!comunicados_autor_id_fkey(nome, foto_caminho, foto_atualizada_em), comunicado_setores(setores(nome))';

// Caixa de entrada: os comunicados que eu recebi (não cancelados).
export async function listarRecebidos(usuarioId: string): Promise<Recebido[]> {
  const linhas = ok(await supabase.from('comunicado_destinatarios')
    .select(`lido_em, ciente_em, comunicados!inner(${CAMPOS})`)
    .eq('usuario_id', usuarioId).is('comunicados.cancelado_em', null)) as unknown as { lido_em: string | null; ciente_em: string | null; comunicados: Comunicado }[];
  return linhas.map((l) => ({ ...l.comunicados, lido_em: l.lido_em, ciente_em: l.ciente_em }));
}

// Enviados: os meus; quem tem "Comunicado geral" vê os de todos.
export async function listarEnviados(usuarioId: string, todos: boolean): Promise<Comunicado[]> {
  let q = supabase.from('comunicados').select(CAMPOS).order('criado_em', { ascending: false }).limit(200);
  if (!todos) q = q.eq('autor_id', usuarioId);
  return ok(await q) as unknown as Comunicado[];
}

export const listarDestinatarios = async (comunicadoId: string): Promise<Destinatario[]> =>
  ok(await supabase.from('comunicado_destinatarios').select('comunicado_id, usuario_id, push_enviado_em, email_enviado_em, lido_em, ciente_em, usuarios(nome)')
    .eq('comunicado_id', comunicadoId)) as unknown as Destinatario[];

// Resumo de leitura de vários comunicados de uma vez (lista de Enviados).
export const listarLeituras = async (ids: string[]): Promise<Pick<Destinatario, 'comunicado_id' | 'lido_em' | 'ciente_em' | 'push_enviado_em'>[]> =>
  ids.length ? ok(await supabase.from('comunicado_destinatarios').select('comunicado_id, lido_em, ciente_em, push_enviado_em').in('comunicado_id', ids)) : [];

export const lerPapel = async (): Promise<Papel> => ok(await supabase.rpc('comunicacao_meu_papel')) as Papel;
export const listarPessoas = async (): Promise<Pessoa[]> => ok(await supabase.rpc('comunicacao_pessoas'));
export const listarSetoresAtivos = async (): Promise<{ id: string; nome: string }[]> =>
  ok(await supabase.from('setores').select('id, nome').eq('ativo', true).order('nome'));

export function usePapel() {
  const { session } = useAuth();
  return useQuery({ queryKey: ['comunicacao', 'papel', session?.user.id], queryFn: lerPapel, enabled: Boolean(session) });
}

export function useRecebidos() {
  const { session } = useAuth();
  const id = session?.user.id;
  return useQuery({ queryKey: ['comunicacao', 'recebidos', id], queryFn: () => listarRecebidos(id!), enabled: Boolean(id), refetchInterval: 5 * 60_000 });
}

export interface NovoComunicado {
  alcance: Alcance; setores: string[]; pessoas: string[]; titulo: string; texto: string;
  urgente: boolean; exige_ciente: boolean; enviar_email: boolean; fixado_ate: string | null;
}

export async function enviarComunicado(n: NovoComunicado): Promise<string> {
  return ok(await supabase.rpc('enviar_comunicado', {
    p_alcance: n.alcance, p_setores: n.alcance === 'setores' ? n.setores : null, p_pessoas: n.alcance === 'pessoas' ? n.pessoas : null,
    p_titulo: n.titulo, p_texto: n.texto, p_urgente: n.urgente, p_exige_ciente: n.exige_ciente, p_enviar_email: n.enviar_email,
    p_fixado_ate: n.fixado_ate || null,
  })) as string;
}

const LIMPO = (nome: string) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);

export async function anexar(comunicadoId: string, arquivo: File): Promise<void> {
  const caminho = `${comunicadoId}/${Date.now()}-${LIMPO(arquivo.name)}`;
  ok(await supabase.storage.from('comunicacao').upload(caminho, arquivo, { contentType: arquivo.type }));
  ok(await supabase.rpc('anexar_comunicado', { p_comunicado: comunicadoId, p_caminho: caminho, p_nome: arquivo.name }));
}

export async function linkAnexo(caminho: string): Promise<string> {
  return ok(await supabase.storage.from('comunicacao').createSignedUrl(caminho, 3600)).signedUrl;
}

export const marcarLido = async (id: string) => { ok(await supabase.rpc('marcar_comunicado_lido', { p_comunicado: id })); };
export const darCiente = async (id: string) => { ok(await supabase.rpc('dar_ciente_comunicado', { p_comunicado: id })); };
export const cancelarComunicado = async (id: string) => { ok(await supabase.rpc('cancelar_comunicado', { p_comunicado: id })); };

export const salvarLideres = async (setorId: string, funcionarios: string[]) => {
  ok(await supabase.rpc('definir_lideres', { p_setor: setorId, p_funcionarios: funcionarios }));
};
export const listarLideres = async (): Promise<{ setor_id: string; funcionario_id: string }[]> =>
  ok(await supabase.from('setor_lideres').select('setor_id, funcionario_id').is('removido_em', null));

// Edge Function comunicacao-envio.
export interface ResultadoEnvio { pessoas: number; celular: number; sem_celular: string[]; email: number; aviso_email: string }

export async function chamarEnvio<T>(pedido: Record<string, unknown>): Promise<T> {
  const voltar = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const { data, error } = await supabase.functions.invoke('comunicacao-envio', { body: { ...pedido, voltar } });
  if (error) {
    const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(corpo?.erro ?? error.message);
  }
  if (data?.erro) throw new Error(data.erro);
  return data as T;
}

export const avisarCelulares = (comunicadoId: string, acao: 'enviar' | 'lembrete' = 'enviar') =>
  chamarEnvio<ResultadoEnvio>({ acao, comunicado_id: comunicadoId });
