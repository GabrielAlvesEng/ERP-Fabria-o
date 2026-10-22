import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

type Acao = 'ler' | 'criar' | 'editar' | 'aprovar' | 'excluir' | 'critica';

interface AuthCtx {
  session: Session | null;
  carregando: boolean;
  pode: (modulo: string, acao: Acao) => boolean;
  permissoesProntas: boolean;
  sair: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // A interface só esconde/desabilita; quem garante é o RLS e as RPCs no banco.
  const { data: permissoes = [], isSuccess: permissoesProntas } = useQuery({
    queryKey: ['minhas_permissoes', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_permissoes');
      if (error) throw error;
      return (data ?? []) as { modulo: string; acao: string }[];
    },
  });

  const pode = (modulo: string, acao: Acao) => permissoes.some((p) => p.modulo === modulo && p.acao === acao);
  const sair = async () => {
    await supabase.auth.signOut();
  };

  return <Ctx.Provider value={{ session, carregando, pode, permissoesProntas, sair }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
