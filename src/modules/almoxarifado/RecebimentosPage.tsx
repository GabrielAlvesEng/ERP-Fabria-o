import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageCheck } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, hojeISO, mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Campo, CampoData, Cartao, Entrada, EsqueletoTabela, Modal, Selo, Vazio } from '@/shared/ui';
import { entregarReserva, listarOCsReceber, listarRecebimentos, listarReservas, receberOC, recebimentoDisponivel, type OCReceber, type Reserva } from './api';
import { lerQuantidade, qtd } from './regras';

const DESTINO = { estoque: 'Estoque', projeto: 'Reserva do projeto', setor: 'Direto ao setor' } as const;

// Almoxarifado → Recebimentos (decisão 108): o Almoxarifado confere o que chega das ordens de compra e marca o recebido.
export function RecebimentosPage() {
  const { pode } = useAuth();
  const editar = pode('almoxarifado', 'editar');
  const { data: disponivel } = useQuery({ queryKey: ['almoxarifado', 'recebimento_disponivel'], queryFn: recebimentoDisponivel });
  const { data: ocs = [], isLoading } = useQuery({ queryKey: ['almoxarifado', 'ocs'], queryFn: listarOCsReceber });
  const { data: reservas = [] } = useQuery({ queryKey: ['almoxarifado', 'reservas'], queryFn: listarReservas });
  const { data: recebimentos = [] } = useQuery({ queryKey: ['almoxarifado', 'recebimentos'], queryFn: listarRecebimentos });
  const [conferir, setConferir] = useState<OCReceber | null>(null);
  const [entregar, setEntregar] = useState<Reserva | null>(null);
  const hoje = hojeISO();
  const abertas = reservas.filter((r) => r.status === 'reservado');

  return (
    <>
      <Cabecalho titulo="Recebimentos" subtitulo="Conferência do que chega das ordens de compra: o aceito entra no estoque ou fica reservado para o projeto." />
      {disponivel === false && <div className="mb-4"><Aviso tipo="info">O recebimento começa a funcionar quando a nova versão de Compras (ordens de compra por item) estiver no banco.</Aviso></div>}
      <h2 className="mb-2 font-semibold">Ordens de compra a receber</h2>
      {isLoading ? <EsqueletoTabela linhas={3} /> : ocs.length === 0 ? <Vazio>Nenhuma ordem de compra aguardando entrega.</Vazio> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {ocs.map((o) => {
            const atrasada = o.previsao != null && o.previsao < hoje;
            return (
              <Cartao key={o.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-sm font-semibold">{o.codigo} <span className="font-sans font-normal text-suave">· {o.fornecedor}</span></div>
                    <div className="text-sm">{o.requisicao_titulo}</div>
                    <div className="text-xs text-suave">{o.requisicao_codigo}{o.projeto_codigo ? ` · ${o.projeto_codigo} ${o.projeto_titulo}` : ` · ${o.setor}`}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Selo cor={atrasada ? 'vermelho' : o.status === 'entregue_parcial' ? 'amarelo' : 'azul'}>{atrasada ? 'Atrasada' : o.status === 'entregue_parcial' ? 'Entrega parcial' : 'Aguardando'}</Selo>
                    <span className="text-xs text-suave">previsão {dataBR(o.previsao)}</span>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {(o.itens ?? []).map((i) => (
                    <li key={i.item_id} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{i.descricao}</span>
                      <span className="whitespace-nowrap tabular-nums text-suave">{qtd(i.recebida)} / {qtd(i.quantidade)} {i.unidade}</span>
                    </li>
                  ))}
                </ul>
                {editar && <div className="mt-3 flex justify-end"><Botao tamanho="sm" onClick={() => setConferir(o)}><PackageCheck size={14} /> Conferir entrega</Botao></div>}
              </Cartao>
            );
          })}
        </div>
      )}

      <h2 className="mb-2 mt-6 font-semibold">Reservado para projetos</h2>
      {abertas.length === 0 ? <Vazio>Nenhum material reservado.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Projeto</th><th className="px-3 py-2">Material</th><th className="px-3 py-2 text-right">Qtd.</th><th className="px-3 py-2">OC</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {abertas.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{r.projeto_codigo} <span className="text-suave">{r.projeto_titulo}</span></td>
                  <td className="px-3 py-2">{r.descricao}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{qtd(r.quantidade)} <span className="text-xs text-suave">{r.unidade}</span></td>
                  <td className="px-3 py-2 font-mono text-xs">{r.pedido_codigo}</td>
                  <td className="px-3 py-2 text-right">{editar && <Botao tamanho="sm" variante="secundario" onClick={() => setEntregar(r)}>Entregar</Botao>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-2 mt-6 font-semibold">Últimos recebimentos</h2>
      {recebimentos.length === 0 ? <Vazio>Nenhum recebimento registrado.</Vazio> : (
        <ul className="divide-y divide-borda rounded-xl text-sm ring-1 ring-borda">
          {recebimentos.map((r) => (
            <li key={r.id} className="px-3 py-2">
              <div className="flex flex-wrap justify-between gap-2"><span><span className="font-mono font-medium">{r.pedido_codigo}</span> · {r.fornecedor_nome}</span><span className="text-xs text-suave">{dataBR(r.data)} · {r.usuarios?.nome}</span></div>
              <ul className="mt-1 text-xs text-suave">
                {r.alm_recebimento_itens.map((i) => (
                  <li key={i.id}>{i.descricao}: {Number(i.aceita) > 0 && `${qtd(i.aceita)} ${i.unidade} aceito (${DESTINO[i.destino]})`}{Number(i.rejeitada) > 0 && <span className="text-red-600 dark:text-red-300">{Number(i.aceita) > 0 ? ' · ' : ''}{qtd(i.rejeitada)} rejeitado: {i.motivo}</span>}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {conferir && <ConferirModal oc={conferir} onFechar={() => setConferir(null)} />}
      {entregar && <EntregarReservaModal reserva={entregar} onFechar={() => setEntregar(null)} />}
    </>
  );
}

function ConferirModal({ oc, onFechar }: { oc: OCReceber; onFechar: () => void }) {
  const qc = useQueryClient();
  const itens = (oc.itens ?? []).filter((i) => i.quantidade > i.recebida);
  const [data, setData] = useState(hojeISO());
  const [linhas, setLinhas] = useState(() => Object.fromEntries(itens.map((i) => [i.item_id, { aceita: qtd(i.quantidade - i.recebida), rejeitada: '', motivo: '' }])));
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (id: string, k: 'aceita' | 'rejeitada' | 'motivo', v: string) => setLinhas((l) => ({ ...l, [id]: { ...l[id], [k]: v } }));

  async function salvar() {
    const lista = [];
    for (const i of itens) {
      const l = linhas[i.item_id];
      const a = lerQuantidade(l.aceita || '0'); const r = lerQuantidade(l.rejeitada || '0');
      if (a == null || r == null || a < 0 || r < 0) return setErro(`Quantidade inválida em "${i.descricao}".`);
      if (a + r > i.quantidade - i.recebida) return setErro(`Em "${i.descricao}" faltam só ${qtd(i.quantidade - i.recebida)} ${i.unidade}.`);
      if (r > 0 && l.motivo.trim().length < 3) return setErro(`Informe o motivo da rejeição em "${i.descricao}".`);
      if (a + r > 0) lista.push({ item_id: i.item_id, aceita: a, rejeitada: r, motivo: l.motivo.trim() });
    }
    if (!lista.length) return setErro('Informe o que chegou em pelo menos um item.');
    setSalvando(true); setErro('');
    try {
      await receberOC(oc.id, data, lista, obs.trim());
      await qc.invalidateQueries({ queryKey: ['almoxarifado'] });
      await qc.invalidateQueries({ queryKey: ['compras'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); setSalvando(false); }
  }

  return (
    <Modal aberto titulo={`Conferir entrega · ${oc.codigo}`} onFechar={onFechar} largura="max-w-3xl">
      <div className="space-y-3">
        <p className="text-sm text-suave">{oc.fornecedor} · aceito vai para o destino indicado; rejeitado continua faltando na OC, com o motivo.</p>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {itens.map((i) => {
            const l = linhas[i.item_id];
            return (
              <div key={i.item_id} className="rounded-xl p-3 ring-1 ring-borda">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium">{i.descricao}</span>
                  <span className="text-xs text-suave">falta {qtd(i.quantidade - i.recebida)} {i.unidade} · {DESTINO[i.destino]}</span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[8rem_8rem_1fr]">
                  <Campo rotulo="Aceito"><Entrada value={l.aceita} onChange={(e) => set(i.item_id, 'aceita', e.target.value)} inputMode="decimal" className="text-right" /></Campo>
                  <Campo rotulo="Rejeitado"><Entrada value={l.rejeitada} onChange={(e) => set(i.item_id, 'rejeitada', e.target.value)} inputMode="decimal" className="text-right" placeholder="0" /></Campo>
                  {lerQuantidade(l.rejeitada || '0') ? <Campo rotulo="Motivo da rejeição"><Entrada value={l.motivo} onChange={(e) => set(i.item_id, 'motivo', e.target.value)} placeholder="Ex.: medida errada, avariado" /></Campo> : <span />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <Campo rotulo="Data da entrega"><CampoData value={data} onChange={(v) => setData(v)} /></Campo>
          <Campo rotulo="Observação"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: nota fiscal 1234" /></Campo>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Registrando…' : 'Registrar recebimento'}</Botao>
        </div>
      </div>
    </Modal>
  );
}

function EntregarReservaModal({ reserva, onFechar }: { reserva: Reserva; onFechar: () => void }) {
  const qc = useQueryClient();
  const [para, setPara] = useState('');
  const [erro, setErro] = useState('');
  async function salvar() {
    try { await entregarReserva(reserva.id, para.trim()); await qc.invalidateQueries({ queryKey: ['almoxarifado'] }); onFechar(); } catch (e) { setErro(mensagemErro(e)); }
  }
  return (
    <Modal aberto titulo="Entregar material do projeto" onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-sm">{qtd(reserva.quantidade)} {reserva.unidade} de {reserva.descricao} · {reserva.projeto_codigo}</p>
        <Campo rotulo="Entregue para"><Entrada value={para} onChange={(e) => setPara(e.target.value)} placeholder="Ex.: Preparação (corte a laser), Kleber" autoFocus /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2"><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao onClick={salvar} disabled={para.trim().length < 2}>Entregar</Botao></div>
      </div>
    </Modal>
  );
}
