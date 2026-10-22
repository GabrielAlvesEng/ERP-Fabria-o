import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileWarning } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, hojeISO } from '@/shared/lib/formato';
import { listarFuncionarios, listarIntegracoesComoRequisitos, listarSituacoes } from './api';
import { SITUACAO_REQ } from './regras';

// Aviso de vencimentos do RH (decisão 69, resposta 5): só para quem tem rh.ler. Mostra o que venceu
// ou vence dentro do prazo de aviso de cada tipo (30 dias por padrão).
export function VencimentosSino() {
  const { pode } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const rh = pode('rh', 'ler');
  const { data: situacoes = [] } = useQuery({ queryKey: ['rh', 'situacoes', 'todas', hojeISO()], queryFn: () => listarSituacoes(), enabled: rh, refetchInterval: 30 * 60_000 });
  const { data: integracoes = [] } = useQuery({ queryKey: ['rh', 'integracoes', 'todas', hojeISO()], queryFn: listarIntegracoesComoRequisitos, enabled: rh, refetchInterval: 30 * 60_000 });
  const { data: funcionarios = [] } = useQuery({ queryKey: ['rh', 'funcionarios'], queryFn: listarFuncionarios, enabled: rh });
  if (!rh) return null;

  const nome = new Map(funcionarios.map((f) => [f.id, f.nome]));
  const avisos = [...situacoes, ...integracoes].filter((s) => s.situacao === 'vencido' || s.situacao === 'vencendo')
    .sort((a, b) => (a.validade ?? '').localeCompare(b.validade ?? ''));
  const vencidos = avisos.filter((s) => s.situacao === 'vencido').length;

  function abrir(rota: string) {
    setAberto(false);
    navigate(rota);
  }

  return (
    <div className="relative">
      <button onClick={() => setAberto(!aberto)} className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-marinho-700" aria-label={`Vencimentos do RH: ${avisos.length}`} title="Vencimentos do RH">
        <FileWarning size={18} />
        {avisos.length > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${vencidos ? 'bg-red-600' : 'bg-amber-500'}`}>{avisos.length}</span>
        )}
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onMouseDown={() => setAberto(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-superficie p-2 shadow-lg ring-1 ring-borda">
            <div className="px-2 py-1 text-sm font-semibold">Vencimentos do RH</div>
            {avisos.length === 0 ? (
              <div className="px-2 py-3 text-sm text-suave">Nada vencido nem vencendo nos próximos 30 dias.</div>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {avisos.map((s) => (
                  <li key={`${s.funcionario_id}-${s.tipo_documento_id}`}>
                    <button onClick={() => abrir(`/rh/funcionarios/${s.funcionario_id}`)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-pagina">
                      <FileWarning size={15} className={`mt-0.5 shrink-0 ${s.situacao === 'vencido' ? 'text-red-600' : 'text-amber-500'}`} />
                      <span className="min-w-0">
                        <span className="font-medium">{nome.get(s.funcionario_id)}</span> · {s.tipo_nome}
                        <span className="block text-xs text-suave">{SITUACAO_REQ[s.situacao].rotulo} · {dataBR(s.validade)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => abrir('/rh/vencimentos')} className="mt-1 w-full rounded-lg bg-roxo-50 px-2 py-1.5 text-xs font-medium text-roxo-700 hover:bg-roxo-100 dark:bg-roxo-700/30 dark:text-roxo-100">
              Abrir o painel de vencimentos
            </button>
          </div>
        </>
      )}
    </div>
  );
}
