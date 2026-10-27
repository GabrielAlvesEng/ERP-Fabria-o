import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthProvider';
import { supabase } from '@/shared/lib/supabase';
import { somarDias, inicioDoDia, type CompromissoBase, type Cor, type Repeticao } from './regras';

// Agenda (decisão 118). Ler passa por agenda_listar (na agenda de outra pessoa vem só "Ocupado"); criar, mudar,
// cancelar e sair passam pelas funções compromisso_*, que conferem quem pode.

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export interface Compromisso extends CompromissoBase {
  local: string | null; descricao: string | null; cor: Cor;
  criado_por: string | null; criador_nome: string | null;
  participantes: { id: string; nome: string }[];
  // false: compromisso de outra pessoa em que eu não estou (só o horário).
  detalhes: boolean;
  // Alguém me chamou e eu ainda não abri a Agenda.
  novo: boolean;
}

export const listarAgenda = async (usuario: string, de: Date, ate: Date): Promise<Compromisso[]> =>
  ok(await supabase.rpc('agenda_listar', { p_usuario: usuario, p_de: de.toISOString(), p_ate: ate.toISOString() }));

export const useAgenda = (usuario: string | undefined, de: Date, ate: Date) => useQuery({
  queryKey: ['agenda', 'lista', usuario, de.toISOString(), ate.toISOString()],
  queryFn: () => listarAgenda(usuario!, de, ate),
  enabled: Boolean(usuario),
  placeholderData: (anterior) => anterior,
});

// Ontem até depois de amanhã: o que os lembretes e o sino precisam. Recarrega a cada 10 minutos (e quando muda algo).
export function useMinhaAgendaProxima() {
  const { session } = useAuth();
  const usuario = session?.user.id;
  const hoje = inicioDoDia(new Date());
  const [de, ate] = [somarDias(hoje, -1), somarDias(hoje, 3)];
  return useQuery({
    queryKey: ['agenda', 'lista', usuario, de.toISOString(), ate.toISOString()],
    queryFn: () => listarAgenda(usuario!, de, ate),
    enabled: Boolean(usuario),
    refetchInterval: 10 * 60_000,
  });
}

export interface DadosCompromisso {
  titulo: string; inicio: Date; fim: Date; dia_inteiro: boolean; local: string; descricao: string; cor: Cor;
  repeticao: Repeticao | null; repetir_intervalo: number; repetir_dias: number[]; repetir_ate: string | null; participantes: string[];
}
export type Modo = 'todos' | 'este' | 'seguintes';

export const salvarCompromisso = async (id: string | null, d: DadosCompromisso, modo: Modo = 'todos', dia: string | null = null) =>
  ok(await supabase.rpc('compromisso_salvar', {
    p_id: id, p_titulo: d.titulo, p_inicio: d.inicio.toISOString(), p_fim: d.fim.toISOString(), p_dia_inteiro: d.dia_inteiro,
    p_local: d.local, p_descricao: d.descricao, p_cor: d.cor, p_repeticao: d.repeticao, p_intervalo: d.repetir_intervalo,
    p_dias: d.repeticao === 'semanal' ? d.repetir_dias : null, p_ate: d.repetir_ate, p_participantes: d.participantes,
    p_modo: modo, p_data: dia,
  })) as string;
export const cancelarCompromisso = async (id: string, modo: Modo = 'todos', dia: string | null = null) => {
  ok(await supabase.rpc('compromisso_cancelar', { p_id: id, p_modo: modo, p_data: dia }));
};
export const sairDoCompromisso = async (id: string) => { ok(await supabase.rpc('compromisso_sair', { p_id: id })); };
// Compromissos (de qualquer data) em que me chamaram e eu ainda não abri a Agenda: número no item do menu.
export function useNovosAgenda() {
  const { session } = useAuth();
  const eu = session?.user.id;
  const { data = 0 } = useQuery({
    queryKey: ['agenda', 'lista', 'novos', eu],
    enabled: Boolean(eu),
    queryFn: async () => {
      const r = await supabase.from('compromisso_participantes').select('compromisso_id, compromissos!inner(excluido_em)', { count: 'exact', head: true })
        .eq('usuario_id', eu!).is('visto_em', null).is('removido_em', null).is('compromissos.excluido_em', null);
      if (r.error) throw r.error;
      return r.count ?? 0;
    },
  });
  return data;
}
export const marcarVistos = async () => { ok(await supabase.rpc('agenda_marcar_vistos')); };

// Ao vivo: quando alguém marca, muda ou cancela um compromisso comigo, a agenda, o sino e os lembretes atualizam.
export function useAgendaAoVivo() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const id = session?.user.id;
  useEffect(() => {
    if (!id) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const recarregar = () => { clearTimeout(timer); timer = setTimeout(() => qc.invalidateQueries({ queryKey: ['agenda', 'lista'] }), 150); };
    const canal = supabase.channel('agenda-ao-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compromissos' }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compromisso_participantes' }, recarregar)
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(canal); };
  }, [id, qc]);
}
