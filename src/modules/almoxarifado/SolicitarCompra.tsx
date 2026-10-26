import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, CampoData, Entrada, Modal, Selecao } from '@/shared/ui';
import { listarComprasAbertas, solicitarCompra, type ItemEstoque } from './api';
import { lerQuantidade, qtd, sugestaoCompra } from './regras';

// "Solicitar compra" (decisão 104): vira uma solicitação em Compras com origem Almoxarifado, sem projeto.
// Item com solicitação em aberto mostra o código e a data, para não pedir duas vezes.
export function SolicitarCompraBotao({ itens }: { itens: ItemEstoque[] }) {
  const { pode } = useAuth();
  const permitido = pode('almoxarifado', 'criar');
  const { data: abertas = [] } = useQuery({ queryKey: ['almoxarifado', 'compras_abertas'], queryFn: listarComprasAbertas, enabled: permitido });
  const [aberto, setAberto] = useState(false);
  if (!permitido) return null;
  const pedido = new Map(abertas.map((a) => [a.item_id, a]));
  const pendentes = itens.filter((i) => !pedido.has(i.id));
  if (itens.length === 1 && pedido.has(itens[0].id)) {
    const a = pedido.get(itens[0].id)!;
    return <span className="whitespace-nowrap text-xs text-suave" title="Compra já solicitada">Pedido {a.requisicao_codigo} · {dataBR(a.criado_em)}</span>;
  }
  if (!pendentes.length) return null;
  return (
    <>
      <Botao tamanho="sm" variante="secundario" onClick={() => setAberto(true)}><ShoppingCart size={13} /> {pendentes.length > 1 ? `Solicitar compra dos ${pendentes.length}` : 'Solicitar compra'}</Botao>
      {aberto && <SolicitarCompraModal itens={pendentes} onFechar={() => setAberto(false)} />}
    </>
  );
}

function SolicitarCompraModal({ itens, onFechar }: { itens: ItemEstoque[]; onFechar: () => void }) {
  const qc = useQueryClient();
  const [qtds, setQtds] = useState(() => Object.fromEntries(itens.map((i) => [i.id, qtd(sugestaoCompra(i.saldo, i.minimo))])));
  const [necessario, setNecessario] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<'normal' | 'urgente'>('normal');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function enviar() {
    const lista = [];
    for (const i of itens) {
      const q = lerQuantidade(qtds[i.id] ?? '');
      if (q == null || q < 0) return setErro(`Quantidade inválida em "${i.descricao}".`);
      if (q > 0) lista.push({ item_id: i.id, quantidade: q });
    }
    if (!lista.length) return setErro('Informe a quantidade de pelo menos um item.');
    setSalvando(true); setErro('');
    try {
      await solicitarCompra({ itens: lista, necessario_em: necessario, prioridade, observacoes: obs.trim() });
      await qc.invalidateQueries({ queryKey: ['almoxarifado'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); setSalvando(false); }
  }

  return (
    <Modal aberto titulo="Solicitar compra para o estoque" onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-3">
        <p className="text-sm text-suave">Vai para Compras como pedido do Almoxarifado. A quantidade sugerida completa duas vezes o mínimo; use 0 para não pedir um item.</p>
        <ul className="max-h-72 divide-y divide-borda overflow-y-auto rounded-xl ring-1 ring-borda">
          {itens.map((i) => (
            <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1"><span className="font-medium">{i.descricao}</span><span className="block text-xs text-suave">tem {qtd(i.saldo)} · mínimo {qtd(i.minimo)}</span></span>
              <div className="w-24 shrink-0"><Entrada value={qtds[i.id]} onChange={(e) => setQtds((x) => ({ ...x, [i.id]: e.target.value }))} inputMode="decimal" className="text-right" aria-label="Quantidade" /></div>
              <span className="w-8 text-xs text-suave">{i.unidade}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Precisa em"><CampoData value={necessario} onChange={(v) => setNecessario(v || null)} /></Campo>
          <Campo rotulo="Prioridade"><Selecao value={prioridade} onChange={(e) => setPrioridade(e.target.value as 'normal' | 'urgente')}><option value="normal">Normal</option><option value="urgente">Urgente</option></Selecao></Campo>
        </div>
        <Campo rotulo="Observações"><AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} rows={2} /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={enviar} disabled={salvando}>{salvando ? 'Enviando…' : 'Enviar para Compras'}</Botao>
        </div>
      </div>
    </Modal>
  );
}
