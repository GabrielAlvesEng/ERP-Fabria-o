import { useEffect, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/shared/auth/AuthProvider';
import { supabase } from '@/shared/lib/supabase';
import { useMeuUsuario } from '@/modules/perfil/api';

// Decisão 83: Vendas ao vivo. O banco avisa (Supabase Realtime) quando uma linha muda e a tela recarrega só o que
// depende dela. O aviso respeita o RLS: cada pessoa só recebe mudanças do que já pode ler.

export const TABELAS_AO_VIVO = [
  'propostas', 'proposta_revisoes', 'proposta_documentos', 'proposta_arquivos', 'proposta_eventos', 'proposta_aprovacoes',
  'proposta_reprovacoes', 'custo_itens', 'custo_linhas', 'kickoffs', 'kickoff_itens', 'empresas', 'contatos', 'contato_anos', 'vendedores',
] as const;
export type TabelaAoVivo = (typeof TABELAS_AO_VIVO)[number];

type Linha = Record<string, unknown>;

// Consultas (React Query) que uma mudança na tabela deixa desatualizadas.
export function chavesDaMudanca(tabela: TabelaAoVivo, linha: Linha): QueryKey[] {
  const proposta = typeof linha.proposta_id === 'string' ? ['proposta', linha.proposta_id] : ['proposta'];
  switch (tabela) {
    case 'propostas':
      return [['propostas'], typeof linha.id === 'string' ? ['proposta', linha.id] : ['proposta'], ['proposta_documentos_dados'], ['retornos-vencidos']];
    case 'proposta_revisoes':
      return [proposta, ['proposta_documentos'], ['custos']];
    case 'proposta_documentos':
      return [['proposta_documentos']];
    case 'proposta_arquivos':
      return [proposta, ['proposta_documentos_dados']];
    case 'proposta_eventos':
    case 'proposta_aprovacoes':
    case 'proposta_reprovacoes':
      return [proposta];
    case 'custo_itens':
    case 'custo_linhas':
      return [['custos'], ['proposta_documentos_dados']];
    case 'kickoffs':
    case 'kickoff_itens':
      return [['kickoff']];
    case 'empresas':
      return [['empresas'], ['contatos'], ['propostas'], ['proposta']];
    case 'contatos':
    case 'contato_anos':
      return [['contatos'], ['propostas'], ['proposta']];
    case 'vendedores':
      return [['vendedores'], ['propostas'], ['proposta']];
  }
}

// Liga o "ao vivo" de Vendas enquanto a pessoa está logada. As mudanças que chegam juntas (um salvamento costuma
// mexer em várias linhas) são agrupadas e recarregadas uma vez só.
export function useVendasAoVivo() {
  const { session, pode } = useAuth();
  const qc = useQueryClient();
  const ligado = Boolean(session) && pode('vendas', 'ler');
  useEffect(() => {
    if (!ligado) return;
    const pendentes = new Map<string, QueryKey>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const recarregar = () => {
      const chaves = [...pendentes.values()];
      pendentes.clear();
      chaves.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
    };
    const anotar = (chaves: QueryKey[]) => {
      chaves.forEach((k) => pendentes.set(JSON.stringify(k), k));
      clearTimeout(timer);
      timer = setTimeout(recarregar, 300);
    };
    let caiu = false;
    let canal: RealtimeChannel = supabase.channel('vendas-ao-vivo');
    for (const tabela of TABELAS_AO_VIVO) {
      canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, (m) => {
        const linha = (m.eventType === 'DELETE' ? m.old : m.new) as Linha;
        anotar(chavesDaMudanca(tabela, linha));
      });
    }
    canal.subscribe((estado) => {
      if (estado === 'SUBSCRIBED' && caiu) anotar(TABELAS_AO_VIVO.flatMap((t) => chavesDaMudanca(t, {}))); // voltou a conexão: pode ter perdido avisos
      if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT' || estado === 'CLOSED') caiu = true;
    });
    return () => { clearTimeout(timer); supabase.removeChannel(canal); };
  }, [ligado, qc]);
}

// Quem está com a proposta aberta agora (presença), e em qual aba.
export interface Presente { id: string; nome: string; foto_caminho: string | null; foto_atualizada_em: string | null; aba: string }

export function outrasPessoas(estado: Record<string, Presente[]>, eu: string | undefined): Presente[] {
  return Object.entries(estado)
    .filter(([id]) => id !== eu)
    .map(([, lista]) => lista[lista.length - 1]) // mesma pessoa em duas janelas: vale a última
    .filter((p): p is Presente => Boolean(p))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export function usePresencaProposta(propostaId: string, aba: string): Presente[] {
  const { session } = useAuth();
  const { data: eu } = useMeuUsuario();
  const meuId = session?.user.id;
  const [canal, setCanal] = useState<RealtimeChannel | null>(null);
  const [outros, setOutros] = useState<Presente[]>([]);
  useEffect(() => {
    if (!meuId) return;
    const c = supabase.channel(`proposta:${propostaId}`, { config: { private: true, presence: { key: meuId } } });
    c.on('presence', { event: 'sync' }, () => setOutros(outrasPessoas(c.presenceState<Presente>(), meuId)));
    c.subscribe((estado) => { if (estado === 'SUBSCRIBED') setCanal(c); });
    return () => { setCanal(null); setOutros([]); supabase.removeChannel(c); };
  }, [propostaId, meuId]);
  useEffect(() => {
    if (!canal || !meuId) return;
    canal.track({ id: meuId, nome: eu?.nome || session?.user.email || 'Alguém', foto_caminho: eu?.foto_caminho ?? null, foto_atualizada_em: eu?.foto_atualizada_em ?? null, aba });
  }, [canal, meuId, eu, aba, session?.user.email]);
  return outros;
}
