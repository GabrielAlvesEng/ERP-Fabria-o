import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthProvider';
import { supabase } from '@/shared/lib/supabase';
import type { TarefaBase, Urgencia } from './regras';

// Tarefas por pessoa (decisão 116). Todos os logados leem todas; criar, editar, marcar, ordenar e apagar passam pelas
// funções do banco (tarefa_*), que conferem quem pode.

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface Tarefa extends TarefaBase {
  texto: string;
  criador: { nome: string } | null;
}
export interface PessoaTarefas { id: string; nome: string; foto_caminho: string | null; foto_atualizada_em: string | null }

// As feitas só dos últimos 60 dias, para a lista não crescer para sempre.
export async function listarTarefas(): Promise<Tarefa[]> {
  const desde = new Date(Date.now() - 60 * 86_400_000).toISOString();
  return ok(await supabase.from('tarefas')
    .select('id, dono_id, criado_por, texto, urgencia, prazo, ordem, criado_em, feita_em, vista_em, criador:usuarios!tarefas_criado_por_fkey(nome)')
    .is('excluido_em', null).or(`feita_em.is.null,feita_em.gte.${desde}`)
    .returns<Tarefa[]>());
}
export const useTarefas = () => {
  const { session } = useAuth();
  return useQuery({ queryKey: ['tarefas', 'lista'], queryFn: listarTarefas, enabled: Boolean(session) });
};

// Quem tem login ativo no ERP (resposta 1 do Gabriel).
export const listarPessoas = async (): Promise<PessoaTarefas[]> =>
  ok(await supabase.from('usuarios').select('id, nome, foto_caminho, foto_atualizada_em').eq('ativo', true).order('nome'));
export const usePessoasTarefas = () => useQuery({ queryKey: ['tarefas', 'pessoas'], queryFn: listarPessoas, staleTime: 5 * 60_000 });

export const criarTarefa = async (dono: string, texto: string, urgencia: Urgencia, prazo: string | null) =>
  ok(await supabase.rpc('tarefa_criar', { p_dono: dono, p_texto: texto, p_urgencia: urgencia, p_prazo: prazo }));
export const editarTarefa = async (id: string, texto: string, urgencia: Urgencia, prazo: string | null) => {
  ok(await supabase.rpc('tarefa_editar', { p_id: id, p_texto: texto, p_urgencia: urgencia, p_prazo: prazo }));
};
export const marcarTarefa = async (id: string, feita: boolean) => { ok(await supabase.rpc('tarefa_marcar', { p_id: id, p_feita: feita })); };
export const ordenarTarefas = async (ids: string[]) => { ok(await supabase.rpc('tarefa_ordenar', { p_ids: ids })); };
export const apagarTarefa = async (id: string) => { ok(await supabase.rpc('tarefa_apagar', { p_id: id })); };
export const marcarVistas = async () => { ok(await supabase.rpc('tarefas_marcar_vistas')); };

// Ao vivo: quando alguém cria, marca, reordena ou apaga, as listas (e o número do menu) atualizam sozinhas.
export function useTarefasAoVivo() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const id = session?.user.id;
  useEffect(() => {
    if (!id) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const recarregar = () => { clearTimeout(timer); timer = setTimeout(() => qc.invalidateQueries({ queryKey: ['tarefas', 'lista'] }), 150); };
    const canal = supabase.channel('tarefas-ao-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas' }, recarregar)
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(canal); };
  }, [id, qc]);
}
