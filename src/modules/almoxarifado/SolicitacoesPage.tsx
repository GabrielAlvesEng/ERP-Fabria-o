import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, CampoData, Cartao, Entrada, EsqueletoTabela, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { listarProdutos, listarSolicitacoes, solicitarItens, type SituacaoItemCompra } from './api';
import { BuscaItem } from './BuscaItem';
import { lerQuantidade, qtd, unidadePadrao } from './regras';

const SITUACAO: Record<SituacaoItemCompra, { rotulo: string; cor: 'cinza' | 'amarelo' | 'azul' | 'verde' | 'vermelho' }> = {
  a_comprar: { rotulo: 'À comprar', cor: 'cinza' }, em_cotacao: { rotulo: 'Em cotação', cor: 'amarelo' }, comprado: { rotulo: 'Comprado', cor: 'azul' },
  recebido: { rotulo: 'Recebido', cor: 'verde' }, cancelado: { rotulo: 'Cancelado', cor: 'vermelho' },
};
const GRUPOS = ['Consumíveis', 'Fixadores', 'Comerciais', 'Chapas', 'Perfis', 'Serviços', 'Outros'];

// Almoxarifado → Solicitações (decisão 110): pedir qualquer item, do cadastro ou digitado; Compras organiza.
export function SolicitacoesPage() {
  const { pode } = useAuth();
  const { data: lista = [], isLoading } = useQuery({ queryKey: ['almoxarifado', 'solicitacoes'], queryFn: listarSolicitacoes });
  const [nova, setNova] = useState(false);
  const [filtro, setFiltro] = useState<'abertas' | 'todas'>('abertas');
  const visiveis = lista.filter((s) => filtro === 'todas' || s.status === 'aberta');
  return (
    <>
      <Cabecalho titulo="Solicitações" subtitulo="Pedidos de compra do Almoxarifado. O item pode ser do cadastro ou digitado; Compras organiza a compra."
        acoes={<>
          <Selecao value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="w-44"><option value="abertas">Em andamento</option><option value="todas">Todas</option></Selecao>
          {(pode('almoxarifado', 'criar') || pode('almoxarifado', 'editar')) && <Botao onClick={() => setNova(true)}><Plus size={15} /> Nova solicitação</Botao>}
        </>} />
      {isLoading ? <EsqueletoTabela /> : visiveis.length === 0 ? <Vazio>Nenhuma solicitação {filtro === 'abertas' ? 'em andamento' : 'ainda'}.</Vazio> : (
        <div className="space-y-3">
          {visiveis.map((s) => (
            <Cartao key={s.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm"><span className="font-mono font-semibold">{s.codigo}</span> · {dataBR(s.criado_em)}{s.solicitante && ` · ${s.solicitante}`}</div>
                  {s.observacoes && <div className="text-xs text-suave">{s.observacoes}</div>}
                </div>
                <div className="flex items-center gap-2 text-xs text-suave">
                  {s.prioridade === 'urgente' && <Selo cor="vermelho">Urgente</Selo>}
                  {s.necessario_em && <span>precisa em {dataBR(s.necessario_em)}</span>}
                  {s.status !== 'aberta' && <Selo cor={s.status === 'concluida' ? 'verde' : 'vermelho'}>{s.status === 'concluida' ? 'Concluída' : 'Cancelada'}</Selo>}
                </div>
              </div>
              <ul className="mt-2 divide-y divide-borda text-sm">
                {s.itens.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 py-1.5">
                    <span className="min-w-0 flex-1">{i.descricao}{!i.cadastrado && <span className="ml-2 text-xs text-amber-600 dark:text-amber-300">sem cadastro</span>}</span>
                    <span className="whitespace-nowrap tabular-nums text-suave">{qtd(i.quantidade)} {i.unidade}</span>
                    {i.pedido && <span className="font-mono text-xs text-suave">{i.pedido}{Number(i.recebida) > 0 && i.situacao !== 'recebido' && ` · chegou ${qtd(i.recebida)}`}</span>}
                    <Selo cor={SITUACAO[i.situacao].cor}>{SITUACAO[i.situacao].rotulo}</Selo>
                  </li>
                ))}
              </ul>
            </Cartao>
          ))}
        </div>
      )}
      {nova && <NovaSolicitacaoModal onFechar={() => setNova(false)} />}
    </>
  );
}

interface Linha { chave: string; bib_tipo?: string; bib_id?: string; descricao: string; grupo: string; unidade: string; quantidade: string; observacoes: string }

function NovaSolicitacaoModal({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const { data: produtos = [] } = useQuery({ queryKey: ['almoxarifado', 'produtos'], queryFn: listarProdutos });
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [necessario, setNecessario] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<'normal' | 'urgente'>('normal');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const chave = (p: { bib_tipo: string; bib_id: string }) => `${p.bib_tipo}:${p.bib_id}`;
  const mudar = (n: number, d: Partial<Linha>) => setLinhas((ls) => ls.map((l, k) => (k === n ? { ...l, ...d } : l)));

  function adicionarProduto(id: string) {
    const p = produtos.find((x) => chave(x) === id);
    if (p) setLinhas((ls) => [...ls, { chave: id, bib_tipo: p.bib_tipo, bib_id: p.bib_id, descricao: p.descricao, grupo: p.grupo, unidade: unidadePadrao(p.bib_tipo, p.unidade), quantidade: '1', observacoes: '' }]);
  }
  const adicionarDigitado = () => setLinhas((ls) => [...ls, { chave: crypto.randomUUID(), descricao: '', grupo: 'Consumíveis', unidade: 'un', quantidade: '1', observacoes: '' }]);

  async function enviar() {
    if (!linhas.length) return setErro('Inclua pelo menos um item.');
    const itens = [];
    for (const l of linhas) {
      const q = lerQuantidade(l.quantidade);
      if (!l.bib_id && l.descricao.trim().length < 2) return setErro('Descreva todos os itens digitados.');
      if (q == null || q <= 0) return setErro(`Informe a quantidade de "${l.descricao || 'item'}".`);
      itens.push(l.bib_id
        ? { bib_tipo: l.bib_tipo, bib_id: l.bib_id, unidade: l.unidade.trim() || 'un', quantidade: q, observacoes: l.observacoes.trim() }
        : { descricao: l.descricao.trim(), grupo: l.grupo, unidade: l.unidade.trim() || 'un', quantidade: q, observacoes: l.observacoes.trim() });
    }
    setSalvando(true); setErro('');
    try {
      await solicitarItens(itens, necessario, prioridade, obs.trim());
      await qc.invalidateQueries({ queryKey: ['almoxarifado'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); setSalvando(false); }
  }

  return (
    <Modal aberto titulo="Nova solicitação de compra" onFechar={onFechar} largura="max-w-3xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <Campo rotulo="Produto do cadastro">
              <BuscaItem placeholder="Buscar no cadastro (ex.: disco corte)" opcoes={produtos.map((p) => ({ id: chave(p), titulo: p.descricao, detalhe: p.grupo }))} onEscolher={adicionarProduto} />
            </Campo>
          </div>
          <Botao variante="secundario" onClick={adicionarDigitado}><Plus size={14} /> Item sem cadastro</Botao>
        </div>
        {linhas.length === 0 ? <p className="text-sm text-suave">Busque um produto do cadastro ou use "Item sem cadastro" para digitar.</p> : (
          <ul className="max-h-[45vh] space-y-2 overflow-y-auto">
            {linhas.map((l, n) => (
              <li key={l.chave} className="rounded-xl p-3 ring-1 ring-borda">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {l.bib_id ? <div className="text-sm font-medium">{l.descricao}<span className="ml-2 text-xs font-normal text-suave">{l.grupo}</span></div>
                      : <Entrada value={l.descricao} onChange={(e) => mudar(n, { descricao: e.target.value })} placeholder="Descrição do item (ex.: Rebolo de esmeril 6 pol.)" autoFocus />}
                  </div>
                  <button onClick={() => setLinhas((ls) => ls.filter((_, k) => k !== n))} className="rounded p-1.5 text-suave hover:text-red-600" aria-label="Tirar item"><Trash2 size={15} /></button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[7rem_6rem_10rem_1fr]">
                  <Entrada value={l.quantidade} onChange={(e) => mudar(n, { quantidade: e.target.value })} inputMode="decimal" className="text-right" aria-label="Quantidade" />
                  <Entrada value={l.unidade} onChange={(e) => mudar(n, { unidade: e.target.value })} aria-label="Unidade" placeholder="un" />
                  {l.bib_id ? <span className="hidden sm:block" /> : <Selecao className="col-span-2 sm:col-span-1" value={l.grupo} onChange={(e) => mudar(n, { grupo: e.target.value })} aria-label="Grupo">{GRUPOS.map((g) => <option key={g}>{g}</option>)}</Selecao>}
                  <Entrada value={l.observacoes} onChange={(e) => mudar(n, { observacoes: e.target.value })} placeholder="Observação (marca, medida…)" aria-label="Observação" className="col-span-2 sm:col-span-1" />
                </div>
              </li>
            ))}
          </ul>
        )}
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
