import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, FileText, Paperclip, Trash2, Undo2, Wallet } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, hojeISO, mensagemErro, moeda } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, CampoArquivo, CampoData, Cartao, Entrada, EntradaMoeda, EsqueletoDetalhe, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import {
  abrirArquivo, alterarVencimento, anexar, definirParcelas, estornarPagamento, listarAnexos, listarDadosPagamento, listarEventos, listarPagamentos,
  obterConta, removerAnexo, type Conta, type Pagamento, type Parcela,
} from './api';
import { ROTULO_ANEXO, ROTULO_FORMA, dividir, lerValor, parcelasAtivas, prazoConta, prazoParcela, saldo, textoCondicao, type TipoAnexo } from './regras';
import { PagamentoModal, SeloPrazo, useDiasAviso } from './componentes';

type ModalConta = null | 'pagar' | 'parcelas' | 'anexo' | { vencimento: Parcela } | { estorno: Pagamento };

// Financeiro → conta a pagar (decisão 105): dados da OC e do fornecedor, orçamento e anexos, parcelas, pagamentos e histórico.
export function ContaPage() {
  const { id = '' } = useParams();
  const { pode } = useAuth();
  const qc = useQueryClient();
  const { data: c, isLoading, error } = useQuery({ queryKey: ['financeiro', 'conta', id], queryFn: () => obterConta(id) });
  const { data: pagamentos = [] } = useQuery({ queryKey: ['financeiro', 'pagamentos', id], queryFn: () => listarPagamentos(id) });
  const { data: anexos = [] } = useQuery({ queryKey: ['financeiro', 'anexos', id], queryFn: () => listarAnexos(id) });
  const { data: eventos = [] } = useQuery({ queryKey: ['financeiro', 'eventos', id], queryFn: () => listarEventos(id) });
  const { data: bancarios = [] } = useQuery({ queryKey: ['financeiro', 'fornecedores_pagamento'], queryFn: listarDadosPagamento });
  const [modal, setModal] = useState<ModalConta>(null);
  const [erro, setErro] = useState('');
  const hoje = hojeISO();
  const dias = useDiasAviso();

  if (isLoading) return <EsqueletoDetalhe />;
  if (error || !c) return <Aviso>{error ? mensagemErro(error) : 'Conta não encontrada.'}</Aviso>;

  const editar = pode('financeiro', 'editar') && c.status === 'aberta';
  const parcelas = parcelasAtivas(c.fin_parcelas);
  const banco = bancarios.find((b) => b.fornecedor_id === c.fornecedor_id);
  const emAbertoTotal = parcelas.reduce((s, p) => s + saldo(p), 0);
  const prazo = prazoConta(c, c.fin_parcelas, hoje, dias);
  const teveP = pagamentos.length > 0;
  const fechar = () => setModal(null);

  async function abrir(bucket: 'financeiro' | 'compras', caminho: string) {
    setErro('');
    try { await abrirArquivo(bucket, caminho); } catch (e) { setErro(mensagemErro(e)); }
  }
  async function tirarAnexo(id: string) {
    if (!confirm('Remover este anexo da conta? Ele continua no histórico.')) return;
    setErro('');
    try { await removerAnexo(id); await qc.invalidateQueries({ queryKey: ['financeiro'] }); } catch (e) { setErro(mensagemErro(e)); }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/financeiro/contas" className="mb-2 inline-flex items-center gap-1 text-sm text-suave hover:text-texto"><ArrowLeft size={15} /> Contas a pagar</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-suave">
              <span className="font-mono">{c.pedido_codigo}</span>
              {c.status === 'cancelada' ? <Selo cor="vermelho">Cancelada</Selo> : <SeloPrazo prazo={prazo} />}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{c.fornecedor_nome}</h1>
            <p className="mt-0.5 text-sm text-suave">
              {c.descricao}{c.projeto_codigo && ` · Projeto ${c.projeto_codigo} · ${c.projeto_titulo}`} · OC emitida em {dataBR(c.emitida_em)}
              {c.entregue_em ? ` · entregue em ${dataBR(c.entregue_em)}` : ' · ainda não entregue'}
            </p>
          </div>
          {editar && parcelas.some((p) => !p.pago_em) && <Botao onClick={() => setModal('pagar')}><Wallet size={15} /> Registrar pagamento</Botao>}
        </div>
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      {c.status === 'cancelada' && <Aviso>Conta cancelada{c.cancelado_motivo && `: ${c.cancelado_motivo}`}</Aviso>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao>
          <div className="text-xs text-suave">Valor da ordem de compra</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{moeda(c.valor_total)}</div>
          <div className="mt-2 text-sm">Em aberto: <b className="tabular-nums">{moeda(c.status === 'aberta' ? emAbertoTotal : 0)}</b></div>
          <div className="mt-1 text-sm text-suave">{textoCondicao(c.condicao_tipo, c.condicao_dias)}</div>
        </Cartao>
        <Cartao className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Dados para pagamento</h2>
            <Link to="/financeiro/fornecedores" className="text-xs text-roxo-600 hover:underline dark:text-roxo-100">Editar</Link></div>
          {!banco || !(banco.chave_pix || banco.banco || banco.conta) ? <p className="text-sm text-suave">Sem dados bancários cadastrados para este fornecedor.</p> : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              {banco.chave_pix && <><dt className="text-suave">Chave PIX</dt><dd className="font-mono">{banco.chave_pix}</dd></>}
              {banco.banco && <><dt className="text-suave">Banco</dt><dd>{banco.banco}</dd></>}
              {(banco.agencia || banco.conta) && <><dt className="text-suave">Agência / conta</dt><dd className="font-mono">{banco.agencia} / {banco.conta}</dd></>}
              {banco.titular && <><dt className="text-suave">Titular</dt><dd>{banco.titular}{banco.documento_titular && ` · ${banco.documento_titular}`}</dd></>}
              {banco.observacoes && <><dt className="text-suave">Observações</dt><dd>{banco.observacoes}</dd></>}
            </dl>
          )}
        </Cartao>
      </div>

      <Cartao className="p-0">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="font-semibold">Orçamento e anexos</h2>
          {pode('financeiro', 'editar') && <Botao variante="secundario" tamanho="sm" onClick={() => setModal('anexo')}><Paperclip size={14} /> Anexar boleto, NF…</Botao>}
        </div>
        {anexos.length === 0 ? <p className="px-5 pb-5 text-sm text-suave">Nenhum anexo. O orçamento do fornecedor vem de Compras quando a ordem de compra tem o arquivo.</p> : (
          <ul className="divide-y divide-borda">
            {anexos.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <button onClick={() => abrir(a.bucket, a.caminho)} className="flex min-w-0 items-center gap-2 text-left hover:text-roxo-600">
                  <FileText size={16} className="shrink-0 text-suave" />
                  <span className="min-w-0"><span className="block truncate font-medium">{a.nome}</span><span className="text-xs text-suave">{ROTULO_ANEXO[a.tipo]} · {dataBR(a.enviado_em)}</span></span>
                </button>
                {pode('financeiro', 'editar') && a.bucket === 'financeiro' && <button onClick={() => tirarAnexo(a.id)} className="rounded p-1.5 text-suave hover:bg-pagina hover:text-red-600" aria-label="Remover anexo"><Trash2 size={15} /></button>}
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao className="p-0">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="font-semibold">Parcelas</h2>
          {editar && !teveP && <Botao variante="secundario" tamanho="sm" onClick={() => setModal('parcelas')}><CalendarDays size={14} /> Refazer parcelas</Botao>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-5 py-2">Parcela</th><th className="px-3 py-2">Vencimento</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2 text-right">Pago</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {parcelas.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2">{p.numero}/{parcelas.length}</td>
                  <td className="px-3 py-2">{p.vencimento ? dataBR(p.vencimento) : <span className="text-suave">{c.condicao_tipo === 'apos_recebimento' && !c.entregue_em ? 'Depois da entrega' : 'A definir'}</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{moeda(p.valor)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(p.pago) > 0 ? moeda(p.pago) : '—'}</td>
                  <td className="px-3 py-2">{c.status === 'cancelada' ? <span className="text-xs text-suave">—</span> : <SeloPrazo prazo={prazoParcela(p, hoje, dias)} />}</td>
                  <td className="px-3 py-2 text-right">
                    {editar && !p.pago_em && <button onClick={() => setModal({ vencimento: p })} className="text-xs text-roxo-600 hover:underline dark:text-roxo-100">Mudar data</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao className="p-0">
        <h2 className="px-5 pb-2 pt-5 font-semibold">Pagamentos</h2>
        {pagamentos.length === 0 ? <div className="px-5 pb-5"><Vazio>Nenhum pagamento registrado.</Vazio></div> : (
          <ul className="divide-y divide-borda">
            {pagamentos.map((g) => {
              const p = c.fin_parcelas.find((x) => x.id === g.parcela_id);
              return (
                <li key={g.id} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm ${g.estornado_em ? 'opacity-60' : ''}`}>
                  <span className="min-w-0">
                    <span className={`font-medium tabular-nums ${g.estornado_em ? 'line-through' : ''}`}>{moeda(g.valor)}</span> · {ROTULO_FORMA[g.forma]} · {dataBR(g.data)} · parcela {p?.numero}
                    <span className="block text-xs text-suave">Lançado por {g.lancador?.nome ?? '—'} em {dataHoraBR(g.lancado_em)}{g.observacao && ` · ${g.observacao}`}</span>
                    {g.estornado_em && <span className="block text-xs text-red-600">Estornado em {dataHoraBR(g.estornado_em)}: {g.estorno_motivo}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    {g.comprovante_caminho && <Botao variante="secundario" tamanho="sm" onClick={() => abrir('financeiro', g.comprovante_caminho!)}><FileText size={14} /> Comprovante</Botao>}
                    {!g.estornado_em && pode('financeiro', 'critica') && c.status !== 'cancelada' &&
                      <Botao variante="secundario" tamanho="sm" onClick={() => setModal({ estorno: g })}><Undo2 size={14} /> Estornar</Botao>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>

      <Cartao>
        <h2 className="mb-2 font-semibold">Histórico</h2>
        <ul className="space-y-1.5 text-sm">
          {eventos.map((e) => (
            <li key={e.id}><span className="text-suave">{dataHoraBR(e.criado_em)}{e.usuarios?.nome && ` · ${e.usuarios.nome}`}</span> — {e.descricao}</li>
          ))}
        </ul>
      </Cartao>

      {modal === 'pagar' && <PagamentoModal conta={c} onFechar={fechar} />}
      {modal === 'parcelas' && <ParcelasModal conta={c} onFechar={fechar} />}
      {modal === 'anexo' && <AnexoModal conta={c} onFechar={fechar} />}
      {modal && typeof modal === 'object' && 'vencimento' in modal && <VencimentoModal parcela={modal.vencimento} onFechar={fechar} />}
      {modal && typeof modal === 'object' && 'estorno' in modal && <EstornoModal pagamento={modal.estorno} onFechar={fechar} />}
    </div>
  );
}

function useAcao(onFechar: () => void) {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function rodar(f: () => Promise<unknown>) {
    setSalvando(true);
    setErro('');
    try { await f(); await qc.invalidateQueries({ queryKey: ['financeiro'] }); onFechar(); } catch (e) { setErro(mensagemErro(e)); } finally { setSalvando(false); }
  }
  return { erro, setErro, salvando, rodar };
}

function Rodape({ onFechar, onSalvar, salvando, rotulo }: { onFechar: () => void; onSalvar: () => void; salvando: boolean; rotulo: string }) {
  return (
    <div className="flex justify-end gap-2">
      <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
      <Botao onClick={onSalvar} disabled={salvando}>{salvando ? 'Salvando…' : rotulo}</Botao>
    </div>
  );
}

function VencimentoModal({ parcela, onFechar }: { parcela: Parcela; onFechar: () => void }) {
  const [data, setData] = useState(parcela.vencimento ?? '');
  const { erro, salvando, rodar } = useAcao(onFechar);
  return (
    <Modal aberto titulo={`Vencimento da parcela ${parcela.numero}`} onFechar={onFechar}>
      <div className="space-y-3">
        <Campo rotulo="Data de pagamento"><CampoData value={data} onChange={setData} /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <Rodape onFechar={onFechar} salvando={salvando} rotulo="Salvar" onSalvar={() => rodar(() => alterarVencimento(parcela.id, data || null))} />
      </div>
    </Modal>
  );
}

// Refaz as parcelas (só antes de qualquer pagamento): quantidade, datas e valores, com a soma igual ao valor da conta.
function ParcelasModal({ conta, onFechar }: { conta: Conta; onFechar: () => void }) {
  const atuais = parcelasAtivas(conta.fin_parcelas);
  const [linhas, setLinhas] = useState(atuais.map((p) => ({ vencimento: p.vencimento ?? '', valor: Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) })));
  const { erro, setErro, salvando, rodar } = useAcao(onFechar);
  const soma = Math.round(linhas.reduce((s, l) => s + (lerValor(l.valor) || 0), 0) * 100) / 100;
  const total = Number(conta.valor_total);

  function quantidade(n: number) {
    const valores = dividir(total, n);
    const base = linhas[0]?.vencimento || conta.emitida_em;
    setLinhas(valores.map((v, i) => ({
      vencimento: linhas[i]?.vencimento || (base ? new Date(Date.parse(`${base}T12:00:00Z`) + i * 30 * 86_400_000).toISOString().slice(0, 10) : ''),
      valor: v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    })));
  }
  function salvar() {
    if (Math.abs(soma - total) > 0.001) return setErro(`A soma das parcelas (${moeda(soma)}) precisa ser ${moeda(total)}.`);
    rodar(() => definirParcelas(conta.id, linhas.map((l) => ({ vencimento: l.vencimento || null, valor: lerValor(l.valor) }))));
  }

  return (
    <Modal aberto titulo="Refazer parcelas" onFechar={onFechar} largura="max-w-xl">
      <div className="space-y-3">
        <Campo rotulo="Quantidade de parcelas">
          <Selecao value={String(linhas.length)} onChange={(e) => quantidade(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? 'À vista (1)' : `${n} parcelas`}</option>)}
          </Selecao>
        </Campo>
        {linhas.map((l, i) => (
          <div key={i} className="grid grid-cols-[3rem_1fr_1fr] items-end gap-2">
            <span className="pb-2 text-sm text-suave">{i + 1}ª</span>
            <Campo rotulo="Vencimento"><CampoData value={l.vencimento} onChange={(v) => setLinhas(linhas.map((x, j) => j === i ? { ...x, vencimento: v } : x))} /></Campo>
            <Campo rotulo="Valor"><EntradaMoeda value={l.valor} onChange={(v) => setLinhas(linhas.map((x, j) => j === i ? { ...x, valor: v } : x))} /></Campo>
          </div>
        ))}
        <p className={`text-sm ${Math.abs(soma - total) > 0.001 ? 'text-red-600' : 'text-suave'}`}>Soma {moeda(soma)} de {moeda(total)}</p>
        {erro && <Aviso>{erro}</Aviso>}
        <Rodape onFechar={onFechar} salvando={salvando} rotulo="Salvar parcelas" onSalvar={salvar} />
      </div>
    </Modal>
  );
}

function AnexoModal({ conta, onFechar }: { conta: Conta; onFechar: () => void }) {
  const [tipo, setTipo] = useState<TipoAnexo>('boleto');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nome, setNome] = useState('');
  const { erro, setErro, salvando, rodar } = useAcao(onFechar);
  return (
    <Modal aberto titulo="Anexar à conta" onFechar={onFechar}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Tipo">
            <Selecao value={tipo} onChange={(e) => setTipo(e.target.value as TipoAnexo)}>
              {(['boleto', 'nf', 'orcamento', 'outro'] as TipoAnexo[]).map((t) => <option key={t} value={t}>{ROTULO_ANEXO[t]}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Nome (opcional)"><Entrada value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Boleto parcela 1" /></Campo>
        </div>
        <Campo rotulo="Arquivo (PDF ou imagem, até 20 MB)"><CampoArquivo arquivo={arquivo} onChange={setArquivo} accept="application/pdf,image/png,image/jpeg,image/webp" /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <Rodape onFechar={onFechar} salvando={salvando} rotulo="Anexar"
          onSalvar={() => arquivo ? rodar(() => anexar(conta.id, tipo, arquivo, nome.trim() || `${ROTULO_ANEXO[tipo]} · ${arquivo.name}`)) : setErro('Escolha o arquivo.')} />
      </div>
    </Modal>
  );
}

function EstornoModal({ pagamento, onFechar }: { pagamento: Pagamento; onFechar: () => void }) {
  const [motivo, setMotivo] = useState('');
  const { erro, setErro, salvando, rodar } = useAcao(onFechar);
  return (
    <Modal aberto titulo="Estornar pagamento" onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-sm">Estornar o pagamento de <b>{moeda(pagamento.valor)}</b> de {dataBR(pagamento.data)}. A parcela volta a ficar em aberto; o lançamento continua no histórico, riscado.</p>
        <Campo rotulo="Motivo do estorno"><AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Ex.: valor lançado errado" /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <Rodape onFechar={onFechar} salvando={salvando} rotulo="Estornar"
          onSalvar={() => motivo.trim().length < 5 ? setErro('Escreva o motivo (pelo menos 5 letras).') : rodar(() => estornarPagamento(pagamento.id, motivo.trim()))} />
      </div>
    </Modal>
  );
}

