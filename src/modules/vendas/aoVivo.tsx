import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/shared/auth/AuthProvider';
import { supabase } from '@/shared/lib/supabase';
import { useMeuUsuario } from '@/modules/perfil/api';
import { Avatar } from '@/modules/perfil/Avatar';
import type { Bolha } from '@/shared/ui';

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
      timer = setTimeout(recarregar, 100);
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

// Presença (decisões 83 e 84): um canal privado para Vendas inteira. Cada pessoa conta qual proposta está aberta,
// em qual aba e em qual campo está o cursor. O Kanban mostra a foto no card; a proposta, no campo.
export interface Presente {
  id: string; nome: string; foto_caminho: string | null; foto_atualizada_em: string | null;
  proposta_id: string | null; aba: string | null; campo: string | null;
}
type Onde = Pick<Presente, 'proposta_id' | 'aba' | 'campo'>;

export function outrasPessoas(estado: Record<string, Presente[]>, eu: string | undefined): Presente[] {
  return Object.entries(estado)
    .filter(([id]) => id !== eu)
    .map(([, lista]) => [...lista].reverse().find((x) => x.proposta_id) ?? lista[lista.length - 1]) // duas janelas: a que tem proposta aberta
    .filter((p): p is Presente => Boolean(p))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

// Decisão 85: o que está sendo digitado vai direto para as outras telas (Broadcast, ~0,1 s), sem esperar o banco.
export interface Digitando { proposta_id: string; alvo: string; dados: unknown }
type Ouvinte = (d: Digitando) => void;

const Ctx = createContext<{ outros: Presente[]; definir: (o: Onde) => void; enviar: (d: Digitando) => void; ouvintes: Set<Ouvinte> }>({
  outros: [], definir: () => {}, enviar: () => {}, ouvintes: new Set(),
});
const NENHUM: Onde = { proposta_id: null, aba: null, campo: null };

export function PresencaVendas({ children }: { children: ReactNode }) {
  const { session, pode } = useAuth();
  const { data: eu } = useMeuUsuario();
  const meuId = session?.user.id;
  const ligado = Boolean(meuId) && pode('vendas', 'ler');
  const [canal, setCanal] = useState<RealtimeChannel | null>(null);
  const [outros, setOutros] = useState<Presente[]>([]);
  const [onde, setOnde] = useState<Onde>(NENHUM);
  const [ouvintes] = useState(() => new Set<Ouvinte>());
  useEffect(() => {
    if (!ligado || !meuId) return;
    const c = supabase.channel('proposta:vendas', { config: { private: true, presence: { key: meuId }, broadcast: { self: false } } });
    c.on('presence', { event: 'sync' }, () => setOutros(outrasPessoas(c.presenceState<Presente>(), meuId)));
    c.on('broadcast', { event: 'digitando' }, ({ payload }) => ouvintes.forEach((f) => f(payload as Digitando)));
    c.subscribe((estado) => { if (estado === 'SUBSCRIBED') setCanal(c); });
    return () => { setCanal(null); setOutros([]); supabase.removeChannel(c); };
  }, [ligado, meuId]);
  useEffect(() => {
    if (!canal || !meuId) return;
    canal.track({ id: meuId, nome: eu?.nome || session?.user.email || 'Alguém', foto_caminho: eu?.foto_caminho ?? null, foto_atualizada_em: eu?.foto_atualizada_em ?? null, ...onde });
  }, [canal, meuId, eu, onde, session?.user.email]);
  const definir = useCallback((o: Onde) => setOnde((a) => (a.proposta_id === o.proposta_id && a.aba === o.aba && a.campo === o.campo ? a : o)), []);
  const enviar = useCallback((d: Digitando) => { canal?.send({ type: 'broadcast', event: 'digitando', payload: d }); }, [canal]);
  const valor = useMemo(() => ({ outros, definir, enviar, ouvintes }), [outros, definir, enviar, ouvintes]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const usePresentes = () => useContext(Ctx).outros;

// Usado pela proposta aberta: conta onde estou e devolve quem mais está nela.
export function usePresencaProposta(propostaId: string, aba: string, campo: string | null): Presente[] {
  const { outros, definir } = useContext(Ctx);
  useEffect(() => { definir({ proposta_id: propostaId, aba, campo }); }, [definir, propostaId, aba, campo]);
  useEffect(() => () => definir(NENHUM), [definir]);
  return useMemo(() => outros.filter((x) => x.proposta_id === propostaId), [outros, propostaId]);
}

export function paraBolhas(lista: Presente[], tamanho = 22): Bolha[] {
  return lista.map((x) => ({ id: x.id, nome: x.nome, campo: x.campo, avatar: <Avatar caminho={x.foto_caminho} versao={x.foto_atualizada_em} nome={x.nome} tamanho={tamanho} /> }));
}

// Envia o que mudou enquanto a pessoa digita (agrupado a cada 80 ms) e recebe o que as outras pessoas digitam
// na mesma proposta e no mesmo alvo (ex.: "dados", "documento:<revisão>").
export function useDigitandoAoVivo<T>(propostaId: string, alvo: string, juntar: (a: T | null, b: T) => T, aoReceber: (dados: T) => void) {
  const { enviar, ouvintes } = useContext(Ctx);
  const receber = useRef(aoReceber);
  receber.current = aoReceber;
  useEffect(() => {
    const f: Ouvinte = (d) => { if (d.proposta_id === propostaId && d.alvo === alvo) receber.current(d.dados as T); };
    ouvintes.add(f);
    return () => { ouvintes.delete(f); };
  }, [ouvintes, propostaId, alvo]);
  const fila = useRef<{ dados: T | null; timer?: ReturnType<typeof setTimeout> }>({ dados: null });
  useEffect(() => () => clearTimeout(fila.current.timer), []);
  return useCallback((dados: T) => {
    const q = fila.current;
    q.dados = juntar(q.dados, dados);
    if (q.timer) return;
    q.timer = setTimeout(() => { q.timer = undefined; const d = q.dados; q.dados = null; if (d) enviar({ proposta_id: propostaId, alvo, dados: d }); }, 80);
  }, [enviar, propostaId, alvo, juntar]);
}
