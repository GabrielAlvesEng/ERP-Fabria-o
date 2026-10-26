import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { dataBR, hojeISO, moeda } from '@/shared/lib/formato';
import { Botao, Cabecalho, Cartao, EsqueletoDashboard, Selo, Vazio } from '@/shared/ui';
import { Linhas } from '@/shared/ui/graficos';
import { listarContas } from './api';
import { DiasAvisoModal, useDiasAviso } from './componentes';
import { COR_PRAZO, ROTULO_PRAZO, aVencerPorSemana, diasEntre, emAberto, prazoParcela, saldo, somarDias } from './regras';

const moedaCurta = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : moeda(v);

// Financeiro → Painel (decisão 105): o que venceu, o que vence hoje e nos próximos dias, e o que foi pago no mês.
export function PainelFinanceiro() {
  const { data: contas = [], isLoading } = useQuery({ queryKey: ['financeiro', 'contas'], queryFn: listarContas });
  const hoje = hojeISO();
  const dias = useDiasAviso();
  const { pode } = useAuth();
  const [editarAviso, setEditarAviso] = useState(false);
  if (isLoading) return <EsqueletoDashboard />;

  const abertas = contas.filter((c) => c.status === 'aberta');
  const parcelas = abertas.flatMap((c) => emAberto(c.fin_parcelas).map((p) => ({ ...p, conta: c })));
  const soma = (l: typeof parcelas) => l.reduce((s, p) => s + saldo(p), 0);
  const vencidas = parcelas.filter((p) => prazoParcela(p, hoje, dias) === 'vencida');
  const deHoje = parcelas.filter((p) => p.vencimento === hoje);
  const sete = parcelas.filter((p) => p.vencimento && p.vencimento > hoje && diasEntre(hoje, p.vencimento) <= dias);
  const trinta = parcelas.filter((p) => p.vencimento && p.vencimento <= somarDias(hoje, 30));
  const semData = parcelas.filter((p) => !p.vencimento);
  const mes = hoje.slice(0, 7);
  const pagoMes = contas.flatMap((c) => c.fin_parcelas).filter((p) => p.ativa && p.pago_em?.startsWith(mes)).reduce((s, p) => s + Number(p.pago), 0);

  const cartoes: [string, string, number, string][] = [
    ['Vencidas', moeda(soma(vencidas)), vencidas.length, vencidas.length ? 'text-red-600 dark:text-red-300' : ''],
    ['Vencem hoje', moeda(soma(deHoje)), deHoje.length, deHoje.length ? 'text-orange-600 dark:text-orange-300' : ''],
    [`Próximos ${dias} dias`, moeda(soma(sete)), sete.length, sete.length ? 'text-amber-600 dark:text-amber-300' : ''],
    ['A pagar em 30 dias', moeda(soma(trinta)), trinta.length, ''],
    ['Pago no mês', moeda(pagoMes), -1, 'text-petroleo-600 dark:text-teal-200'],
  ];
  const semanas = aVencerPorSemana(parcelas, hoje);
  const proximas = [...parcelas].sort((a, b) => (a.vencimento ?? '9999').localeCompare(b.vencimento ?? '9999')).slice(0, 10);

  return (
    <>
      <Cabecalho titulo="Financeiro" subtitulo="Contas a pagar das ordens de compra, com os vencimentos e os avisos."
        acoes={pode('financeiro', 'editar') && <Botao variante="secundario" onClick={() => setEditarAviso(true)}><Settings2 size={16} /> Aviso: {dias} dias antes</Botao>} />
      {editarAviso && <DiasAvisoModal atual={dias} onFechar={() => setEditarAviso(false)} />}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cartoes.map(([rot, val, n, cor]) => (
          <div key={rot} className="rounded-xl bg-superficie p-4 shadow-sm ring-1 ring-borda">
            <div className="text-xs text-suave">{rot}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${cor || 'text-texto'}`}>{val}</div>
            {n >= 0 && <div className="mt-0.5 text-xs text-suave">{n} parcela(s)</div>}
          </div>
        ))}
      </div>
      {semData.length > 0 && (
        <Link to="/financeiro/contas" className="mb-5 block rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
          {semData.length} parcela(s) sem data de pagamento ({moeda(soma(semData))}): aguardando a entrega ou com vencimento a definir.
        </Link>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <Cartao>
          <h2 className="mb-3 font-semibold">A pagar por semana</h2>
          <Linhas rotulosX={semanas.map((_, i) => i === 0 ? 'Hoje' : dataBR(somarDias(hoje, i * 7)).slice(0, 5))} formatar={moeda} formatarEixo={moedaCurta}
            series={[{ id: 'apagar', rotulo: 'A pagar (inclui vencidas na primeira semana)', cor: 'var(--serie-1)', valores: semanas }]} />
        </Cartao>
        <Cartao className="p-0">
          <h2 className="px-5 pb-2 pt-5 font-semibold">Próximos pagamentos</h2>
          {proximas.length === 0 ? <div className="px-5 pb-5"><Vazio>Nenhuma conta em aberto.</Vazio></div> : (
            <ul className="divide-y divide-borda">
              {proximas.map((p) => {
                const prazo = prazoParcela(p, hoje, dias);
                return (
                  <li key={p.id}>
                    <Link to={`/financeiro/contas/${p.conta.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-pagina">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.conta.fornecedor_nome}</span>
                        <span className="block truncate text-xs text-suave">{p.conta.pedido_codigo} · parcela {p.numero}{p.conta.projeto_codigo && ` · ${p.conta.projeto_codigo}`}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold tabular-nums">{moeda(saldo(p))}</span>
                        <Selo cor={COR_PRAZO[prazo]}>{p.vencimento ? `${ROTULO_PRAZO[prazo]} · ${dataBR(p.vencimento)}` : 'Sem data'}</Selo>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
