import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataHoraBR } from '@/shared/lib/formato';
import { supabase } from '@/shared/lib/supabase';
import { useRecebidos } from './api';
import { pendente } from './regras';

// Comunicados para ler, na barra superior (todos os logados).
export function ComunicadosSino() {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const { data = [] } = useRecebidos();
  const avisos = data.filter(pendente).sort((a, b) => Number(b.urgente) - Number(a.urgente) || b.criado_em.localeCompare(a.criado_em));
  const urgentes = avisos.some((c) => c.urgente);

  function abrir(id?: string) {
    setAberto(false);
    navigate(id ? `/comunicacao?c=${id}` : '/comunicacao');
  }

  return (
    <div className="relative">
      <button onClick={() => setAberto(!aberto)} className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-marinho-700" aria-label={`Comunicados para ler: ${avisos.length}`} title="Comunicados">
        <Megaphone size={18} />
        {avisos.length > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${urgentes ? 'bg-red-600' : 'bg-roxo-500'}`}>{avisos.length}</span>
        )}
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onMouseDown={() => setAberto(false)} />
          <div className="fixed inset-x-2 top-14 z-40 rounded-xl bg-superficie p-2 shadow-lg ring-1 ring-borda sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
            <div className="px-2 py-1 text-sm font-semibold">Comunicados</div>
            {avisos.length === 0 ? (
              <div className="px-2 py-3 text-sm text-suave">Nada para ler.</div>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {avisos.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => abrir(c.id)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-pagina">
                      <Megaphone size={15} className={`mt-0.5 shrink-0 ${c.urgente ? 'text-red-600' : 'text-roxo-500'}`} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.titulo}</span>
                        <span className="block text-xs text-suave">{c.autor?.nome} · {dataHoraBR(c.criado_em)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => abrir()} className="mt-1 w-full rounded-lg bg-roxo-50 px-2 py-1.5 text-xs font-medium text-roxo-700 hover:bg-roxo-100 dark:bg-roxo-700/30 dark:text-roxo-100">
              Abrir a caixa de entrada
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Ao vivo: comunicado novo, leitura e cancelamento atualizam a caixa, o contador e Enviados sem recarregar.
// E o toque no aviso do celular com o ERP já aberto leva até o comunicado (mensagem do public/sw.js).
export function useComunicacaoAoVivo() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const id = session?.user.id;
  useEffect(() => {
    if (!id) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const recarregar = () => { clearTimeout(timer); timer = setTimeout(() => qc.invalidateQueries({ queryKey: ['comunicacao'] }), 150); };
    const canal = supabase.channel('comunicacao-ao-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicado_destinatarios' }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicados' }, recarregar)
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(canal); };
  }, [id, qc]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const ouvir = (e: MessageEvent) => {
      if (e.data?.tipo !== 'abrir' || typeof e.data.url !== 'string' || !e.data.url.startsWith(base)) return;
      navigate(`/${e.data.url.slice(base.length)}`);
    };
    navigator.serviceWorker.addEventListener('message', ouvir);
    return () => navigator.serviceWorker.removeEventListener('message', ouvir);
  }, [navigate]);
}
