import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Undo2 } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataHoraBR, mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Campo, Entrada, EsqueletoTabela, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { devolver, estornar, listarEstoque, listarMovimentosRetiradas, type Movimento } from './api';
import { destinoRetirada } from './ItemModal';
import { NovaRetiradaModal } from './NovaRetiradaModal';
import { combina, lerQuantidade, qtd } from './regras';

const PERIODOS = { 30: 'Últimos 30 dias', 90: 'Últimos 90 dias', 365: 'Últimos 12 meses' } as const;

// Almoxarifado → Retiradas (decisão 104): o que saiu, para quem e onde foi usado, com devolução e estorno.
export function RetiradasPage() {
  const { pode } = useAuth();
  const [dias, setDias] = useState<keyof typeof PERIODOS>(30);
  const desde = useMemo(() => new Date(Date.now() - dias * 86_400_000).toISOString(), [dias]);
  const { data: movs = [], isLoading } = useQuery({ queryKey: ['almoxarifado', 'retiradas', dias], queryFn: () => listarMovimentosRetiradas(desde) });
  const { data: estoque = [] } = useQuery({ queryKey: ['almoxarifado', 'estoque'], queryFn: listarEstoque });
  const [busca, setBusca] = useState('');
  const [funcionario, setFuncionario] = useState('');
  const [nova, setNova] = useState(false);
  const [acao, setAcao] = useState<{ tipo: 'devolver' | 'estornar'; mov: Movimento } | null>(null);

  const produto = new Map(estoque.map((i) => [i.id, i]));
  // Devolvido (válido) e estornado por movimento original.
  const estornados = new Set(movs.filter((m) => m.tipo === 'estorno').map((m) => m.origem_id));
  const devolvido = new Map<string, number>();
  for (const m of movs) if (m.tipo === 'devolucao' && !estornados.has(m.id) && m.origem_id) devolvido.set(m.origem_id, (devolvido.get(m.origem_id) ?? 0) + Number(m.quantidade));
  const funcionarios = [...new Map(movs.filter((m) => m.alm_retiradas).map((m) => [m.alm_retiradas!.funcionario_id, m.alm_retiradas!.funcionario_nome])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const lista = movs.filter((m) => m.tipo !== 'estorno' && m.alm_retiradas
    && (!funcionario || m.alm_retiradas.funcionario_id === funcionario)
    && (!busca || combina(`${m.alm_retiradas.codigo} ${produto.get(m.item_id)?.descricao ?? ''} ${destinoRetirada(m.alm_retiradas)} ${m.alm_retiradas.funcionario_nome}`, busca)));

  return (
    <>
      <Cabecalho titulo="Retiradas" subtitulo="Itens entregues aos funcionários, com a baixa no estoque e onde foram usados."
        acoes={pode('almoxarifado', 'criar') ? <Botao onClick={() => setNova(true)}><Plus size={15} /> Nova retirada</Botao> : undefined} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto, projeto, setor, RT…" className="pl-9" />
        </div>
        <Selecao value={funcionario} onChange={(e) => setFuncionario(e.target.value)} className="w-56">
          <option value="">Todos os funcionários</option>{funcionarios.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </Selecao>
        <Selecao value={String(dias)} onChange={(e) => setDias(Number(e.target.value) as keyof typeof PERIODOS)} className="w-48">
          {Object.entries(PERIODOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </Selecao>
      </div>
      {isLoading ? <EsqueletoTabela /> : lista.length === 0 ? <Vazio>Nenhuma retirada neste período.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Quando</th><th className="px-3 py-2">Produto</th><th className="px-3 py-2 text-right">Qtd.</th>
              <th className="px-3 py-2">Funcionário</th><th className="px-3 py-2">Onde foi usado</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {lista.map((m) => {
                const r = m.alm_retiradas!;
                const i = produto.get(m.item_id);
                const estornado = estornados.has(m.id);
                const dev = devolvido.get(m.id) ?? 0;
                const retirado = m.tipo === 'retirada' ? -Number(m.quantidade) : Number(m.quantidade);
                return (
                  <tr key={m.id} className={estornado ? 'opacity-50' : ''}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{dataHoraBR(m.criado_em)}<span className="block font-mono text-suave">{r.codigo}</span></td>
                    <td className="px-3 py-2">{i?.descricao ?? '—'}{m.justificativa && <span className="block text-xs text-suave">{m.justificativa}</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.tipo === 'devolucao' ? '+' : ''}{qtd(retirado)} <span className="text-xs text-suave">{i?.unidade}</span></td>
                    <td className="px-3 py-2">{r.funcionario_nome}</td>
                    <td className="px-3 py-2">{destinoRetirada(r)}{r.observacao && <span className="block text-xs text-suave">{r.observacao}</span>}</td>
                    <td className="px-3 py-2">
                      {estornado ? <Selo>Estornado</Selo> : m.tipo === 'devolucao' ? <Selo cor="azul">Devolução</Selo>
                        : dev > 0 ? <Selo cor="amarelo">Devolveu {qtd(dev)}</Selo> : <Selo cor="verde">Entregue</Selo>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {!estornado && m.tipo === 'retirada' && dev < retirado && pode('almoxarifado', 'criar') && (
                        <Botao tamanho="sm" variante="fantasma" onClick={() => setAcao({ tipo: 'devolver', mov: m })}><Undo2 size={13} /> Devolver</Botao>
                      )}
                      {!estornado && !(m.tipo === 'retirada' && dev > 0) && pode('almoxarifado', 'editar') && (
                        <Botao tamanho="sm" variante="fantasma" onClick={() => setAcao({ tipo: 'estornar', mov: m })}>Estornar</Botao>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {nova && <NovaRetiradaModal onFechar={() => setNova(false)} />}
      {acao && <AcaoModal {...acao} restante={-Number(acao.mov.quantidade) - (devolvido.get(acao.mov.id) ?? 0)} unidade={produto.get(acao.mov.item_id)?.unidade ?? ''} onFechar={() => setAcao(null)} />}
    </>
  );
}

function AcaoModal({ tipo, mov, restante, unidade, onFechar }: { tipo: 'devolver' | 'estornar'; mov: Movimento; restante: number; unidade: string; onFechar: () => void }) {
  const qc = useQueryClient();
  const [quantidade, setQuantidade] = useState(qtd(restante));
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function confirmar() {
    setSalvando(true); setErro('');
    try {
      if (tipo === 'devolver') {
        const q = lerQuantidade(quantidade);
        if (q == null || q <= 0) throw new Error('Informe a quantidade devolvida.');
        await devolver(mov.id, q, texto.trim());
      } else await estornar(mov.id, texto.trim());
      await qc.invalidateQueries({ queryKey: ['almoxarifado'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); setSalvando(false); }
  }
  return (
    <Modal aberto titulo={tipo === 'devolver' ? 'Registrar devolução' : 'Estornar lançamento'} onFechar={onFechar}>
      <div className="space-y-3">
        {tipo === 'devolver' ? (
          <Campo rotulo={`Quantidade que voltou (até ${qtd(restante)} ${unidade})`}><Entrada value={quantidade} onChange={(e) => setQuantidade(e.target.value)} inputMode="decimal" autoFocus /></Campo>
        ) : (
          <p className="text-sm text-suave">O estorno desfaz este lançamento no saldo e fica registrado no histórico. Nada é apagado.</p>
        )}
        <Campo rotulo={tipo === 'devolver' ? 'Observação' : 'Motivo do estorno'}><Entrada value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={tipo === 'devolver' ? 'Ex.: sobrou sem uso' : 'Ex.: lançado para a pessoa errada'} /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao variante={tipo === 'estornar' ? 'perigo' : 'primario'} onClick={confirmar} disabled={salvando || (tipo === 'estornar' && texto.trim().length < 3)}>
            {tipo === 'devolver' ? 'Registrar devolução' : 'Estornar'}
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
