import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, FileDown, Paperclip, Truck } from 'lucide-react';
import { dataBR, dataHoraBR, hojeISO, moeda } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, CampoArquivo, CampoData, CampoNumero, Cartao, Entrada, Modal, Selecao, Selo } from '@/shared/ui';
import { abrirArquivo, atualizarPedido, itensPorIds, situacaoPagamento, type Cotacao, type DadosCotacao, type Evento, type Fornecedor, type Pedido } from './api';
import { ROTULO_CONDICAO, ROTULO_ORIGEM, ROTULO_PEDIDO, ROTULO_STATUS, descreverCondicao, lerDias, pedidoAtrasado, rotuloDestino, type CondicaoTipo, type Origem, type StatusItem, type StatusRequisicao } from './regras';
import { imprimirOrdem } from './ordemPdf';

// Peças comuns das telas de Compras (solicitação, pacote de cotação e ordens).
export type Cor = 'cinza' | 'roxo' | 'verde' | 'vermelho' | 'amarelo' | 'azul';
export const COR_ITEM: Record<StatusItem, Cor> = { a_comprar: 'cinza', comprado: 'roxo', recebido: 'verde', cancelado: 'vermelho' };
const PAGAMENTO: Record<string, [string, Cor]> = { a_pagar: ['A pagar', 'amarelo'], paga_parcial: ['Paga em parte', 'azul'], paga: ['Paga', 'verde'], cancelada: ['Conta cancelada', 'cinza'] };

export function descreverEvento(e: { tipo: string; de: string | null; para: string | null; dados: Record<string, unknown> }) {
  if (e.tipo === 'criada') return 'criou a requisição';
  if (e.tipo === 'pacote') return e.dados.acao === 'criado' ? `criou o pacote com ${e.dados.itens} item(ns)` : e.dados.acao === 'adicionados' ? `adicionou ${e.dados.itens} item(ns)` : `tirou ${e.dados.itens} item(ns), que voltaram para à comprar`;
  if (e.tipo === 'cotacao') return `lançou o orçamento de ${e.dados.fornecedor ?? 'um fornecedor'}`;
  if (e.tipo === 'pedido') return `gerou a ordem de compra ${e.dados.codigo} para ${e.dados.fornecedor ?? 'o fornecedor'} (${moeda(Number(e.dados.total))})`;
  if (e.tipo === 'entrega') return `recebeu ${e.para === 'entregue' ? 'tudo' : 'parte'} da ${e.dados.codigo ?? 'ordem'} em ${dataBR(String(e.dados.data))}`;
  if (e.tipo === 'cancelamento') return e.dados.codigo ? `cancelou a ordem de compra ${e.dados.codigo}` : 'cancelou o pacote (os itens voltaram para à comprar)';
  if (e.dados?.origem) return `enviou a solicitação pela ${ROTULO_ORIGEM[e.dados.origem as keyof typeof ROTULO_ORIGEM] ?? e.dados.origem} (${e.dados.itens} item(ns))`;
  if (e.para === 'cancelada') return 'cancelou a requisição';
  const st = (s: string | null) => (s ? ROTULO_STATUS[s as StatusRequisicao] ?? s : '');
  return `mudou de ${st(e.de)} para ${st(e.para)}`;
}

export function Historico({ eventos }: { eventos: Evento[] }) {
  if (!eventos.length) return <p className="py-4 text-center text-sm text-suave">Sem registros.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {eventos.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span className="w-32 shrink-0 text-xs text-suave">{dataHoraBR(e.criado_em)}</span>
          <span><b className="font-medium">{e.usuarios?.nome ?? 'Sistema'}</b> {descreverEvento(e)}{e.justificativa && <span className="text-suave"> · {e.justificativa}</span>}</span>
        </li>
      ))}
    </ul>
  );
}

export function Secao({ titulo, acoes, children }: { titulo: string; acoes?: ReactNode; children: ReactNode }) {
  return (
    <Cartao>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{titulo}</h2><div className="flex flex-wrap gap-2">{acoes}</div></div>
      {children}
    </Cartao>
  );
}

// Preço unitário em reais; vazio tira o preço (fornecedor não cotou o item).
export function PrecoCelula({ valor, onConfirmar, placeholder = 'R$ —', rotulo, className = '' }: { valor: number | undefined; onConfirmar: (v: number | null) => void; placeholder?: string; rotulo?: string; className?: string }) {
  const mostrar = (v: number | undefined) => (v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }));
  const [texto, setTexto] = useState(mostrar(valor));
  const [focado, setFocado] = useState(false);
  const atual = focado ? texto : mostrar(valor);
  function confirmar() {
    setFocado(false);
    const t = texto.replace(/R\$|%/gi, '').trim();
    if (!t) { if (valor != null) onConfirmar(null); return; }
    const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
    if (Number.isNaN(n) || n < 0) return;
    if (n !== valor) onConfirmar(n);
  }
  return (
    <input inputMode="decimal" value={atual} placeholder={placeholder} aria-label={rotulo} title={rotulo} onFocus={(e) => { setFocado(true); setTexto(mostrar(valor)); const el = e.target; requestAnimationFrame(() => el.select()); }}
      onChange={(e) => setTexto(e.target.value)} onBlur={confirmar} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className={`w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-roxo-500 focus:bg-superficie dark:hover:border-marinho-500 ${className}`} />
  );
}

// Pagamento padrão (Gabriel, 26/10/2026): a Fabriaço costuma pagar adiantado, exceto os consumíveis que o Almoxarifado
// pede; a condição cadastrada no fornecedor, quando há, vale mais.
export function CotacaoModal({ cotacao, origem, fornecedores, onFechar, onSalvar }: {
  cotacao: Cotacao | null; origem: Origem; fornecedores: Fornecedor[]; onFechar: () => void; onSalvar: (d: DadosCotacao, arquivo: File | null) => Promise<boolean>;
}) {
  const padrao: CondicaoTipo = origem === 'almoxarifado' ? 'a_combinar' : 'antecipado';
  const [d, setD] = useState<DadosCotacao>({
    fornecedor_id: cotacao?.fornecedor_id ?? '', frete: Number(cotacao?.frete ?? 0), prazo_dias: cotacao?.prazo_dias ?? null,
    condicao_pagamento: cotacao?.condicao_pagamento ?? '', condicao_tipo: cotacao?.condicao_tipo ?? padrao, condicao_dias: cotacao?.condicao_dias ?? [],
    validade: cotacao?.validade ?? null, observacoes: cotacao?.observacoes ?? '',
  });
  const [dias, setDias] = useState((cotacao?.condicao_dias ?? []).join('/'));
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof DadosCotacao>(k: K, v: DadosCotacao[K]) => setD((x) => ({ ...x, [k]: v }));
  const comDias = d.condicao_tipo === 'apos_recebimento' || d.condicao_tipo === 'parcelado';

  async function salvar() {
    if (!d.fornecedor_id) return setErro('Escolha o fornecedor.');
    const ds = comDias ? lerDias(dias) : [];
    if (comDias && !ds.length) return setErro('Informe os dias do pagamento (ex.: 28 ou 30/60/90).');
    if (arquivo && arquivo.size > 15 * 1024 * 1024) return setErro('O arquivo do orçamento passa de 15 MB.');
    setSalvando(true); setErro('');
    if (await onSalvar({ ...d, condicao_dias: ds }, arquivo)) onFechar();
    setSalvando(false);
  }

  return (
    <Modal aberto titulo={cotacao ? 'Editar orçamento' : 'Orçamento de fornecedor'} onFechar={onFechar}>
      <div className="space-y-3">
        <Campo rotulo="Fornecedor">
          <Selecao value={d.fornecedor_id} onChange={(e) => {
            const f = fornecedores.find((x) => x.id === e.target.value);
            setD((x) => ({ ...x, fornecedor_id: e.target.value, condicao_tipo: cotacao ? x.condicao_tipo : f && f.condicao_pagamento !== 'a_combinar' ? f.condicao_pagamento : padrao }));
          }}>
            <option value="">Escolha…</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Selecao>
        </Campo>
        {!fornecedores.length && <p className="text-xs text-suave">Cadastre o fornecedor na aba Fornecedores.</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Frete (R$)"><div className="rounded-lg border border-slate-300 dark:border-marinho-500"><CampoNumero valor={d.frete} moeda onConfirmar={(n) => set('frete', n)} /></div></Campo>
          <Campo rotulo="Prazo de entrega (dias)"><Entrada type="number" min={0} value={d.prazo_dias ?? ''} onChange={(e) => set('prazo_dias', e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))} /></Campo>
          <Campo rotulo="Validade"><CampoData value={d.validade} onChange={(v) => set('validade', v || null)} /></Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Campo rotulo="Pagamento">
            <Selecao value={d.condicao_tipo} onChange={(e) => set('condicao_tipo', e.target.value as CondicaoTipo)}>
              {(Object.keys(ROTULO_CONDICAO) as CondicaoTipo[]).map((k) => <option key={k} value={k}>{ROTULO_CONDICAO[k]}</option>)}
            </Selecao>
          </Campo>
          {comDias && <Campo rotulo={d.condicao_tipo === 'parcelado' ? 'Dias da emissão' : 'Dias após receber'}><Entrada value={dias} onChange={(e) => setDias(e.target.value)} placeholder={d.condicao_tipo === 'parcelado' ? '30/60/90' : '28'} /></Campo>}
        </div>
        <Campo rotulo="Forma de pagamento e detalhes"><Entrada value={d.condicao_pagamento} onChange={(e) => set('condicao_pagamento', e.target.value)} placeholder="Ex.: boleto, PIX, 5% de desconto à vista" /></Campo>
        <Campo rotulo={cotacao?.orcamento_caminho ? 'Trocar o orçamento anexado (PDF ou imagem)' : 'Orçamento do fornecedor (PDF ou imagem)'}>
          <CampoArquivo arquivo={arquivo} onChange={setArquivo} accept="application/pdf,image/jpeg,image/png,image/webp" />
        </Campo>
        <Campo rotulo="Observações"><AreaTexto rows={2} value={d.observacoes} onChange={(e) => set('observacoes', e.target.value)} /></Campo>
        <p className="text-xs text-suave">Os preços de cada item são lançados na comparação do pacote. O orçamento anexado vai junto com a ordem de compra para o Financeiro.</p>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </div>
    </Modal>
  );
}

// Cartão da OC (solicitação e pacote). Os itens vêm pela própria OC, que pode juntar várias solicitações.
export function OrdemCartao({ p, fornecedor, podeEditar, agir, cancelar: cancelarOc, mostrarOrigem }: {
  p: Pedido; fornecedor: Fornecedor | undefined; podeEditar: boolean;
  agir: (f: () => Promise<unknown>) => Promise<boolean>; cancelar: () => void; mostrarOrigem?: boolean;
}) {
  const ids = (p.compras_pedido_itens ?? []).map((x) => x.item_id);
  const { data: itens = [] } = useQuery({ queryKey: ['compras', 'itens-ids', ...ids], queryFn: () => itensPorIds(ids), enabled: ids.length > 0 });
  const { data: pagamento } = useQuery({ queryKey: ['compras', 'pagamento', p.id], queryFn: () => situacaoPagamento(p.id), enabled: p.status !== 'cancelada' });
  const atrasado = pedidoAtrasado(p, hojeISO());
  const pi = p.compras_pedido_itens ?? [];
  const nome = (id: string) => itens.find((i) => i.id === id);
  const aberta = p.status === 'aguardando_entrega' || p.status === 'entregue_parcial';
  return (
    <div className={`rounded-lg bg-pagina p-3 ring-1 ring-borda ${p.status === 'cancelada' ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold">{p.codigo}</span><b>{p.fornecedores?.nome}</b>
            <Selo cor={p.status === 'entregue' ? 'verde' : p.status === 'cancelada' ? 'vermelho' : atrasado ? 'vermelho' : 'azul'}>{atrasado ? 'Atrasada' : ROTULO_PEDIDO[p.status]}</Selo>
            {pagamento && PAGAMENTO[pagamento] && <Selo cor={PAGAMENTO[pagamento][1]}>{PAGAMENTO[pagamento][0]}</Selo>}
          </div>
          <div className="mt-1 text-suave">
            Emitida em {dataBR(p.emitido_em)} · {moeda(p.valor_total)} · {descreverCondicao(p.condicao_tipo, p.condicao_dias ?? [])} · previsão {dataBR(p.previsao_entrega)}{p.entregue_em && ` · entregue em ${dataBR(p.entregue_em)}`}
          </div>
          {mostrarOrigem && p.compras_pacotes && <div className="mt-1 text-xs">Cotação <Link to={`/compras/cotacoes/${p.pacote_id}`} className="font-mono text-roxo-600 hover:underline dark:text-roxo-100">{p.compras_pacotes.codigo}</Link> · {p.compras_pacotes.titulo}</div>}
          {p.status === 'cancelada' && p.cancelado_motivo && <div className="mt-1 text-xs text-red-600">Cancelada: {p.cancelado_motivo}</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          {p.orcamento_caminho && <Botao tamanho="sm" variante="secundario" onClick={() => agir(() => abrirArquivo(p.orcamento_caminho!))}><Paperclip size={14} /> Orçamento</Botao>}
          <Botao tamanho="sm" variante="secundario" onClick={() => imprimirOrdem(p, itens, fornecedor)}><FileDown size={14} /> PDF</Botao>
          {aberta && <span className="inline-flex items-center gap-1 self-center text-xs text-suave"><Truck size={14} /> Recebimento pelo Almoxarifado</span>}
          {p.status === 'aguardando_entrega' && podeEditar && <Botao tamanho="sm" variante="secundario" onClick={cancelarOc}><Ban size={14} /> Cancelar</Botao>}
        </div>
      </div>
      <ul className="mt-2 text-xs text-suave">
        {pi.map((x) => (
          <li key={x.item_id}>{nome(x.item_id)?.descricao ?? 'Item'}{nome(x.item_id) && <span className="text-[11px]"> ({rotuloDestino(nome(x.item_id)!.compras_requisicoes)})</span>}: {Number(x.quantidade).toLocaleString('pt-BR')} {nome(x.item_id)?.unidade} × {moeda(x.valor_unit)}{Number(x.ipi) > 0 && ` + IPI ${Number(x.ipi).toLocaleString('pt-BR')}%`}
            {Number(x.quantidade_recebida) > 0 && <span className={Number(x.quantidade_recebida) >= Number(x.quantidade) ? 'text-petroleo-600' : 'text-amber-600'}> · recebido {Number(x.quantidade_recebida).toLocaleString('pt-BR')}</span>}
          </li>
        ))}
      </ul>
      {aberta && podeEditar && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
          <Campo rotulo="Previsão de entrega"><CampoData value={p.previsao_entrega} onChange={(v) => agir(() => atualizarPedido(p.id, { previsao_entrega: v || null }))} /></Campo>
          <Campo rotulo="Observações da ordem"><Entrada defaultValue={p.observacoes} onBlur={(e) => e.target.value !== p.observacoes && agir(() => atualizarPedido(p.id, { observacoes: e.target.value }))} /></Campo>
        </div>
      )}
    </div>
  );
}

export function Justificar({ titulo, rotulo, botao, onFechar, onConfirmar }: { titulo: string; rotulo: string; botao: string; onFechar: () => void; onConfirmar: (t: string) => Promise<boolean> }) {
  const [t, setT] = useState('');
  return (
    <Modal aberto titulo={titulo} onFechar={onFechar}>
      <Campo rotulo={rotulo}><AreaTexto value={t} onChange={(e) => setT(e.target.value)} autoFocus /></Campo>
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="secundario" onClick={onFechar}>Voltar</Botao>
        <Botao variante="perigo" disabled={t.trim().length < 3} onClick={async () => { if (await onConfirmar(t.trim())) onFechar(); }}>{botao}</Botao>
      </div>
    </Modal>
  );
}
