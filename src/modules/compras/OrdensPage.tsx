import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dataBR, hojeISO, moeda } from '@/shared/lib/formato';
import { Cabecalho, EsqueletoTabela, Selecao, Selo, Vazio } from '@/shared/ui';
import { listarPedidos } from './api';
import { ROTULO_PEDIDO, pedidoAtrasado } from './regras';

// Compras → Ordens de compra (decisão 101).
export function OrdensPage() {
  const { data: pedidos = [], isLoading } = useQuery({ queryKey: ['compras', 'pedidos'], queryFn: listarPedidos });
  const [filtro, setFiltro] = useState<'abertas' | 'atrasadas' | 'entregues' | 'todas'>('abertas');
  const hoje = hojeISO();
  const lista = pedidos.filter((p) => filtro === 'todas' || (filtro === 'entregues' ? p.status === 'entregue' : filtro === 'atrasadas' ? pedidoAtrasado(p, hoje) : p.status !== 'entregue'));
  return (
    <>
      <Cabecalho titulo="Ordens de compra" subtitulo="Pedidos emitidos aos fornecedores e o acompanhamento das entregas."
        acoes={<Selecao value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="w-48">
          <option value="abertas">Em aberto</option><option value="atrasadas">Atrasadas</option><option value="entregues">Entregues</option><option value="todas">Todas</option>
        </Selecao>} />
      {isLoading ? <EsqueletoTabela /> : lista.length === 0 ? <Vazio>Nenhuma ordem de compra aqui.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Ordem</th><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Requisição / projeto</th>
              <th className="px-3 py-2">Emitida</th><th className="px-3 py-2">Previsão</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Situação</th>
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {lista.map((p) => {
                const atrasado = pedidoAtrasado(p, hoje);
                return (
                  <tr key={p.id} className="hover:bg-pagina">
                    <td className="px-3 py-2"><Link to={`/compras/requisicoes/${p.requisicao_id}`} className="font-mono font-medium text-roxo-600 hover:underline dark:text-roxo-100">{p.codigo}</Link></td>
                    <td className="px-3 py-2">{p.fornecedores?.nome}</td>
                    <td className="px-3 py-2">{p.compras_requisicoes?.titulo}<span className="block text-xs text-suave">{p.compras_requisicoes?.codigo}{p.compras_requisicoes?.projeto_codigo && ` · ${p.compras_requisicoes.projeto_codigo}`}</span></td>
                    <td className="px-3 py-2">{dataBR(p.emitido_em)}</td>
                    <td className={`px-3 py-2 ${atrasado ? 'font-medium text-red-600' : ''}`}>{dataBR(p.previsao_entrega)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moeda(p.valor_total)}</td>
                    <td className="px-3 py-2"><Selo cor={p.status === 'entregue' ? 'verde' : atrasado ? 'vermelho' : 'azul'}>{atrasado ? 'Atrasada' : ROTULO_PEDIDO[p.status]}</Selo></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
