import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { moeda } from '@/shared/lib/formato';
import { Botao, Cabecalho, Cartao, EsqueletoDashboard, Selo, Vazio } from '@/shared/ui';
import { listarEstoque, listarMovimentosRetiradas } from './api';
import { destinoRetirada } from './ItemModal';
import { NovaRetiradaModal } from './NovaRetiradaModal';
import { ROTULO_SITUACAO, qtd, situacaoEstoque } from './regras';
import { SolicitarCompraBotao } from './SolicitarCompra';

// Almoxarifado → Painel (decisão 104): o que está acabando e o consumo do mês.
export function PainelPage() {
  const { pode } = useAuth();
  const inicioMes = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); }, []);
  const { data: itens = [], isLoading } = useQuery({ queryKey: ['almoxarifado', 'estoque'], queryFn: listarEstoque });
  const { data: movs = [] } = useQuery({ queryKey: ['almoxarifado', 'retiradas', 'mes'], queryFn: () => listarMovimentosRetiradas(inicioMes) });
  const [nova, setNova] = useState(false);
  if (isLoading) return <EsqueletoDashboard />;

  const ativos = itens.filter((i) => i.ativo);
  const faltando = ativos.filter((i) => situacaoEstoque(i.saldo, i.minimo) !== 'ok').sort((a, b) => a.saldo - b.saldo);
  const zerados = faltando.filter((i) => i.saldo <= 0).length;
  const produto = new Map(itens.map((i) => [i.id, i]));
  // Consumo do mês = retiradas − devoluções, sem o que foi estornado (o estorno anula o original).
  const estornados = new Set(movs.filter((m) => m.tipo === 'estorno').map((m) => m.origem_id));
  const validos = movs.filter((m) => (m.tipo === 'retirada' || m.tipo === 'devolucao') && !estornados.has(m.id));
  const retiradasMes = new Set(validos.filter((m) => m.tipo === 'retirada').map((m) => m.retirada_id)).size;
  const valorMes = validos.reduce((s, m) => s - Number(m.quantidade) * Number(m.custo_unit), 0);
  const somar = (chave: (m: (typeof validos)[number]) => string) => {
    const t = new Map<string, number>();
    for (const m of validos) { const k = chave(m); t.set(k, (t.get(k) ?? 0) - Number(m.quantidade) * Number(m.custo_unit)); }
    return [...t.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  };
  const qtdPorItem = new Map<string, number>();
  for (const m of validos) qtdPorItem.set(m.item_id, (qtdPorItem.get(m.item_id) ?? 0) - Number(m.quantidade));
  const maisRetirados = [...qtdPorItem.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const porDestino = somar((m) => destinoRetirada(m.alm_retiradas!));
  const porFuncionario = somar((m) => m.alm_retiradas!.funcionario_nome);

  const indicadores: [string, string | number, string?][] = [
    ['Produtos no estoque', ativos.length],
    ['Abaixo do mínimo', faltando.length - zerados, faltando.length - zerados ? 'text-amber-600 dark:text-amber-300' : ''],
    ['Zerados', zerados, zerados ? 'text-red-600 dark:text-red-300' : ''],
    ['Retiradas no mês', retiradasMes],
    ['Consumo no mês', moeda(valorMes)],
    ['Valor em estoque', moeda(ativos.reduce((s, i) => s + i.saldo * i.custo_medio, 0))],
  ];

  return (
    <>
      <Cabecalho titulo="Almoxarifado" subtitulo="Estoque, retiradas para os funcionários e pedidos de compra do que está acabando."
        acoes={pode('almoxarifado', 'criar') ? <Botao onClick={() => setNova(true)}><Plus size={15} /> Nova retirada</Botao> : undefined} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {indicadores.map(([rot, val, cor]) => (
          <div key={rot} className="rounded-xl bg-superficie p-4 shadow-sm ring-1 ring-borda">
            <div className="text-xs text-suave">{rot}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${cor || 'text-texto'}`}>{val}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Acabando</h2>
            {faltando.length > 1 && <SolicitarCompraBotao itens={faltando} />}
          </div>
          {faltando.length === 0 ? <Vazio>Nenhum produto abaixo do mínimo.</Vazio> : (
            <ul className="divide-y divide-borda text-sm">
              {faltando.slice(0, 12).map((i) => {
                const s = situacaoEstoque(i.saldo, i.minimo);
                return (
                  <li key={i.id} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1"><span className="font-medium">{i.descricao}</span>
                      <span className="block text-xs text-suave">tem {qtd(i.saldo)} {i.unidade} · mínimo {qtd(i.minimo)}{i.local && ` · ${i.local}`}</span></span>
                    <Selo cor={ROTULO_SITUACAO[s].cor}>{ROTULO_SITUACAO[s].rotulo}</Selo>
                    <SolicitarCompraBotao itens={[i]} />
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
        <Cartao>
          <h2 className="mb-3 font-semibold">Mais retirados no mês</h2>
          {maisRetirados.length === 0 ? <Vazio>Nenhuma retirada neste mês.</Vazio> : (
            <ul className="divide-y divide-borda text-sm">
              {maisRetirados.map(([id, q]) => <li key={id} className="flex justify-between gap-2 py-2"><span className="truncate">{produto.get(id)?.descricao}</span><span className="whitespace-nowrap tabular-nums">{qtd(q)} {produto.get(id)?.unidade}</span></li>)}
            </ul>
          )}
        </Cartao>
        <Ranking titulo="Consumo do mês por destino" linhas={porDestino} />
        <Ranking titulo="Consumo do mês por funcionário" linhas={porFuncionario} />
      </div>
      {nova && <NovaRetiradaModal onFechar={() => setNova(false)} />}
    </>
  );
}

function Ranking({ titulo, linhas }: { titulo: string; linhas: [string, number][] }) {
  const max = Math.max(...linhas.map(([, v]) => v), 1);
  return (
    <Cartao>
      <h2 className="mb-3 font-semibold">{titulo}</h2>
      {linhas.length === 0 ? <Vazio>Sem consumo com custo neste mês.</Vazio> : (
        <ul className="space-y-2 text-sm">
          {linhas.map(([nome, v]) => (
            <li key={nome}>
              <div className="flex justify-between gap-2"><span className="truncate">{nome}</span><span className="tabular-nums">{moeda(v)}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-pagina"><div className="h-1.5 rounded-full bg-petroleo-500" style={{ width: `${(v / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}
