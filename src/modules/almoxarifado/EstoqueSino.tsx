import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PackageX } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { listarEstoque } from './api';
import { qtd, situacaoEstoque } from './regras';

// Aviso de estoque baixo ou zerado (decisão 104), no mesmo padrão dos vencimentos do RH: só para quem tem almoxarifado.ler.
export function EstoqueSino({ bloqueado = false }: { bloqueado?: boolean }) {
  const { pode } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const ver = pode('almoxarifado', 'ler') && !bloqueado;
  const { data: itens = [] } = useQuery({ queryKey: ['almoxarifado', 'estoque'], queryFn: listarEstoque, enabled: ver, refetchInterval: 30 * 60_000 });
  if (!ver) return null;
  const avisos = itens.filter((i) => i.ativo && situacaoEstoque(i.saldo, i.minimo) !== 'ok').sort((a, b) => a.saldo - b.saldo);
  if (!avisos.length) return null;
  const zerados = avisos.filter((i) => i.saldo <= 0).length;
  const abrir = (rota: string) => { setAberto(false); navigate(rota); };

  return (
    <div className="relative">
      <button onClick={() => setAberto(!aberto)} className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-marinho-700" aria-label={`Estoque baixo: ${avisos.length}`} title="Estoque baixo">
        <PackageX size={18} />
        <span className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${zerados ? 'bg-red-600' : 'bg-amber-500'}`}>{avisos.length}</span>
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onMouseDown={() => setAberto(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-superficie p-2 shadow-lg ring-1 ring-borda">
            <div className="px-2 py-1 text-sm font-semibold">Estoque baixo</div>
            <ul className="max-h-80 overflow-y-auto">
              {avisos.map((i) => (
                <li key={i.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm">
                  <PackageX size={15} className={`mt-0.5 shrink-0 ${i.saldo <= 0 ? 'text-red-600' : 'text-amber-500'}`} />
                  <span className="min-w-0"><span className="font-medium">{i.descricao}</span>
                    <span className="block text-xs text-suave">{i.saldo <= 0 ? 'Zerado' : `Tem ${qtd(i.saldo)} ${i.unidade}`} · mínimo {qtd(i.minimo)}</span></span>
                </li>
              ))}
            </ul>
            <button onClick={() => abrir('/almoxarifado')} className="mt-1 w-full rounded-lg bg-roxo-50 px-2 py-1.5 text-xs font-medium text-roxo-700 hover:bg-roxo-100 dark:bg-roxo-700/30 dark:text-roxo-100">
              Abrir o Almoxarifado
            </button>
          </div>
        </>
      )}
    </div>
  );
}
