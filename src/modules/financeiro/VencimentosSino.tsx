import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { hojeISO, moeda } from '@/shared/lib/formato';
import { listarContas } from './api';
import { emAberto, prazoParcela, saldo } from './regras';
import { SeloPrazo, useDiasAviso } from './componentes';

// Sino do Financeiro (decisão 105): contas vencidas, que vencem hoje e nos próximos dias do aviso (decisão 109), para quem tem financeiro.ler.
// Uma vez por dia, se a pessoa permitir, também sai um aviso do Windows com o resumo.
export function VencimentosFinanceiroSino({ bloqueado = false }: { bloqueado?: boolean }) {
  const { pode } = useAuth();
  const navigate = useNavigate();
  const local = useLocation();
  const [aberto, setAberto] = useState(false);
  const [permissao, setPermissao] = useState<NotificationPermission | 'indisponivel'>(() => ('Notification' in window ? Notification.permission : 'indisponivel'));
  const ativo = pode('financeiro', 'ler') && !bloqueado;
  const hoje = hojeISO();
  const dias = useDiasAviso(ativo);
  const { data: contas = [] } = useQuery({ queryKey: ['financeiro', 'contas'], queryFn: listarContas, enabled: ativo, refetchInterval: 30 * 60_000 });
  useEffect(() => setAberto(false), [local.pathname]);

  const avisos = contas.filter((c) => c.status === 'aberta')
    .flatMap((c) => emAberto(c.fin_parcelas).map((p) => ({ p, c, prazo: prazoParcela(p, hoje, dias) })))
    .filter((x) => x.prazo === 'vencida' || x.prazo === 'hoje' || x.prazo === 'em_breve')
    .sort((a, b) => (a.p.vencimento ?? '').localeCompare(b.p.vencimento ?? ''));
  const vencidas = avisos.filter((x) => x.prazo === 'vencida').length;
  const deHoje = avisos.filter((x) => x.prazo === 'hoje').length;

  useEffect(() => {
    if (permissao !== 'granted' || !(vencidas || deHoje)) return;
    const chave = `erp-financeiro-${hoje}`;
    try {
      if (localStorage.getItem(chave)) return;
      localStorage.setItem(chave, '1');
    } catch {
      return;
    }
    const n = new Notification('Financeiro: contas a pagar', { body: [vencidas && `${vencidas} vencida(s)`, deHoje && `${deHoje} vence(m) hoje`].filter(Boolean).join(' · '), tag: chave });
    n.onclick = () => { window.focus(); navigate('/financeiro/contas'); n.close(); };
  }, [permissao, vencidas, deHoje, hoje, navigate]);

  if (!ativo) return null;

  return (
    <div className="relative">
      <button onClick={() => setAberto(!aberto)} className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-marinho-700" aria-label={`Contas a pagar com aviso: ${avisos.length}`} title="Contas a pagar">
        <Wallet size={18} />
        {avisos.length > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${vencidas ? 'bg-red-600' : deHoje ? 'bg-orange-500' : 'bg-amber-500'}`}>{avisos.length}</span>
        )}
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onMouseDown={() => setAberto(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-superficie p-2 shadow-lg ring-1 ring-borda">
            <div className="px-2 py-1 text-sm font-semibold">Contas a pagar</div>
            {avisos.length === 0 ? (
              <div className="px-2 py-3 text-sm text-suave">Nada vencido nem vencendo nos próximos {dias} dias.</div>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {avisos.map(({ p, c, prazo }) => (
                  <li key={p.id}>
                    <button onClick={() => navigate(`/financeiro/contas/${c.id}`)} className="flex w-full items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-pagina">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.fornecedor_nome}</span>
                        <span className="block text-xs text-suave">{c.pedido_codigo} · {moeda(saldo(p))}</span>
                      </span>
                      <SeloPrazo prazo={prazo} data={p.vencimento} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {permissao === 'default' && (
              <button onClick={() => Notification.requestPermission().then(setPermissao)} className="mt-1 w-full rounded-lg bg-roxo-50 px-2 py-1.5 text-xs font-medium text-roxo-700 hover:bg-roxo-100 dark:bg-roxo-700/30 dark:text-roxo-100">
                Ativar aviso do Windows de contas vencidas
              </button>
            )}
            <button onClick={() => navigate('/financeiro/contas')} className="mt-1 w-full rounded-lg bg-roxo-50 px-2 py-1.5 text-xs font-medium text-roxo-700 hover:bg-roxo-100 dark:bg-roxo-700/30 dark:text-roxo-100">
              Abrir as contas a pagar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
