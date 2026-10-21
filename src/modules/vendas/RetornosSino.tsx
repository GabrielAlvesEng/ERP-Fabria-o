import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, hojeISO } from '@/shared/lib/formato';
import { listarRetornosVencidos, type RetornoVencido } from './api';

// Sino de retornos de follow-up vencidos (decisão 40): a lista aparece para todo o setor de Vendas;
// o aviso do Windows (notificação do navegador) vai só para o responsável, uma vez por dia por proposta.
export function RetornosSino() {
  const { session, pode } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [permissao, setPermissao] = useState<NotificationPermission | 'indisponivel'>(() => ('Notification' in window ? Notification.permission : 'indisponivel'));
  const hoje = hojeISO();
  const { data: vencidos = [] } = useQuery({
    queryKey: ['retornos-vencidos', hoje],
    queryFn: () => listarRetornosVencidos(hoje),
    enabled: pode('vendas', 'ler'),
    refetchInterval: 30 * 60_000,
  });
  const meus = useMemo(() => vencidos.filter((p) => p.responsavel_id === session?.user.id), [vencidos, session?.user.id]);

  useEffect(() => {
    if (permissao !== 'granted') return;
    for (const p of meus) avisarUmaVezPorDia(p, hoje, () => navigate(`/vendas/propostas?abrir=${p.id}`));
  }, [meus, permissao, hoje, navigate]);

  if (!pode('vendas', 'ler')) return null;

  function abrir(id: string) {
    setAberto(false);
    navigate(`/vendas/propostas?abrir=${id}`);
  }

  return (
    <div className="relative">
      <button onClick={() => setAberto(!aberto)} className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-marinho-700" aria-label={`Retornos vencidos: ${vencidos.length}`} title="Retornos de follow-up">
        <Bell size={18} />
        {vencidos.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">{vencidos.length}</span>
        )}
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onMouseDown={() => setAberto(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-superficie p-2 shadow-lg ring-1 ring-borda">
            <div className="px-2 py-1 text-sm font-semibold">Retornos vencidos</div>
            {vencidos.length === 0 ? (
              <div className="px-2 py-3 text-sm text-suave">Nenhum retorno vencido.</div>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {vencidos.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => abrir(p.id)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-pagina">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                      <span className="min-w-0">
                        <span className="font-mono text-xs font-semibold text-roxo-600 dark:text-roxo-100">{p.codigo}</span> {p.titulo}
                        <span className="block text-xs text-suave">{p.empresas?.nome_fantasia} · {p.contatos?.nome} · desde {dataBR(p.proximo_followup)}{p.responsavel_id === session?.user.id ? ' · sua' : ''}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {permissao === 'default' && (
              <button onClick={() => Notification.requestPermission().then(setPermissao)} className="mt-1 w-full rounded-lg bg-roxo-50 px-2 py-1.5 text-xs font-medium text-roxo-700 hover:bg-roxo-100 dark:bg-roxo-700/30 dark:text-roxo-100">
                Ativar avisos do Windows para os meus retornos
              </button>
            )}
            {permissao === 'denied' && <div className="mt-1 px-2 text-[11px] text-suave">Avisos do Windows bloqueados no navegador.</div>}
          </div>
        </>
      )}
    </div>
  );
}

function avisarUmaVezPorDia(p: RetornoVencido, hoje: string, aoClicar: () => void) {
  const chave = `erp-retorno-${p.id}-${hoje}`;
  try {
    if (localStorage.getItem(chave)) return;
    localStorage.setItem(chave, '1');
  } catch {
    return; // sem armazenamento local, não repete avisos a cada recarga
  }
  const n = new Notification(`Retorno vencido: ${p.codigo}`, { body: `${p.titulo} · ${p.empresas?.nome_fantasia ?? ''} · cobrar ${p.contatos?.nome ?? 'o contato'}`, tag: chave });
  n.onclick = () => { window.focus(); aoClicar(); n.close(); };
}
