import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, ImagePlus, Link2, Plus, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Caixa, Campo, CampoData, Cartao, Entrada, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { GRUPOS, type GrupoItem } from '@/modules/compras/regras';
import { BuscaItem } from '@/modules/almoxarifado/BuscaItem';
import { lerQuantidade, unidadePadrao } from '@/modules/almoxarifado/regras';
import {
  atualizarItemLista, descartarRascunho, enviarImagemRef, enviarLista, excluirItemLista, incluirItemLista, listarItensLista, listarListas,
  listarRefsEng, listarSolicitacoes, novaRevisao, urlImagemRef, type ItemLista, type ListaRevisao,
} from './api';
import { ROTULO_SOLICITACAO, linhasDaRevisao, planoEnvio, type LinhaRevisao, type PlanoEnvio, type Solicitacao } from './compra';
import type { RefsEng } from './biblioteca';
import type { Projeto } from './regras';

// Lista de materiais por revisão (decisão 113, pedido do Gabriel de 26/10/2026): o engenheiro abre uma revisão em
// rascunho, lança os materiais (do cadastro de Compras ou digitados, com link ou imagem de referência para o comprador)
// e envia a lista inteira para Compras. Enviada, a revisão trava; mudança vai por nova revisão.

const COR_REQ: Record<Solicitacao['status'], 'cinza' | 'roxo' | 'verde' | 'vermelho' | 'amarelo' | 'azul'> = {
  aberta: 'azul', em_compra: 'roxo', concluida: 'verde', cancelada: 'cinza',
};
const REFS_VAZIAS: RefsEng = { chapas: [], perfis: [], itens: [], tipos: [], precosChapa: [] };
const qtdBR = (n: number) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const textoQtd = (n: number) => String(n).replace('.', ',');
const ordemGrupo = (g: string) => GRUPOS.indexOf(g as GrupoItem);

interface Produto { id: string; bib_tipo: 'chapa' | 'perfil' | 'item'; bib_id: string; grupo: GrupoItem; descricao: string; unidade: string }
function produtosDoCadastro(refs: RefsEng): Produto[] {
  return [
    ...refs.chapas.map((c) => ({ id: `chapa:${c.id}`, bib_tipo: 'chapa' as const, bib_id: c.id, grupo: 'Chapas' as GrupoItem, descricao: c.descricao, unidade: unidadePadrao('chapa', '') })),
    ...refs.perfis.map((p) => ({ id: `perfil:${p.id}`, bib_tipo: 'perfil' as const, bib_id: p.id, grupo: 'Perfis' as GrupoItem, descricao: p.descricao, unidade: unidadePadrao('perfil', '') })),
    ...refs.itens.map((i) => ({ id: `item:${i.id}`, bib_tipo: 'item' as const, bib_id: i.id, grupo: i.grupo as GrupoItem, descricao: i.descricao, unidade: unidadePadrao('item', i.unidade) })),
  ];
}

export function ListaRevisoes({ projeto }: { projeto: Projeto }) {
  const { pode } = useAuth();
  const editavel = pode('engenharia', 'editar') && projeto.status !== 'cancelado';
  const { data: listas = [], isLoading, error } = useQuery({ queryKey: ['eng', projeto.id, 'listas'], queryFn: () => listarListas(projeto.id) });
  const { data: solicitacoes = [] } = useQuery({ queryKey: ['eng', projeto.id, 'solicitacoes'], queryFn: () => listarSolicitacoes(projeto.id) });
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const rascunho = listas.find((l) => l.status === 'rascunho');
  const atual = listas.find((l) => l.id === escolhida) ?? rascunho ?? listas[0];
  const solicitacaoDe = (l: ListaRevisao) => solicitacoes.find((s) => s.revisao === l.revisao);

  if (error) return <Aviso>{mensagemErro(error)}</Aviso>;
  if (isLoading) return <div className="text-sm text-suave">Carregando…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-suave">Revisões:</span>
        {listas.map((l) => {
          const s = solicitacaoDe(l);
          return (
            <button key={l.id} onClick={() => setEscolhida(l.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm ring-1 transition-colors duration-150 ${atual?.id === l.id ? 'bg-roxo-50 font-semibold text-roxo-700 ring-roxo-300 dark:bg-roxo-700/30 dark:text-roxo-100' : 'ring-borda hover:bg-pagina'}`}>
              R{l.revisao}
              {l.status === 'rascunho' ? <Selo cor="amarelo">Rascunho</Selo> : s ? <Selo cor={COR_REQ[s.status]}>{ROTULO_SOLICITACAO[s.status]}</Selo> : <Selo>Enviada</Selo>}
            </button>
          );
        })}
        {editavel && !rascunho && <Botao tamanho="sm" variante={listas.length ? 'secundario' : 'primario'} onClick={() => setCriando(true)}><Plus size={14} /> {listas.length ? 'Nova revisão' : 'Criar a lista (R0)'}</Botao>}
      </div>

      {!atual ? (
        <Vazio>Nenhuma lista de materiais ainda. {editavel ? 'Crie a R0, lance os materiais e envie para Compras.' : ''}</Vazio>
      ) : (
        <Revisao key={atual.id} projeto={projeto} lista={atual} solicitacao={solicitacaoDe(atual)} solicitacoes={solicitacoes} editavel={editavel && atual.status === 'rascunho'} />
      )}
      {criando && <NovaRevisaoModal projeto={projeto} temEnviada={listas.some((l) => l.status === 'enviada')} onFechar={() => setCriando(false)} onCriada={setEscolhida} />}
    </div>
  );
}

function NovaRevisaoModal({ projeto, temEnviada, onFechar, onCriada }: { projeto: Projeto; temEnviada: boolean; onFechar: () => void; onCriada: (id: string) => void }) {
  const qc = useQueryClient();
  const [copiar, setCopiar] = useState(temEnviada);
  const [erro, setErro] = useState('');
  const criar = useMutation({
    mutationFn: () => novaRevisao(projeto.id, copiar),
    onSuccess: async (id) => { await qc.invalidateQueries({ queryKey: ['eng', projeto.id, 'listas'] }); onCriada(id); onFechar(); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  return (
    <Modal aberto titulo={temEnviada ? 'Nova revisão da lista' : 'Criar a lista de materiais'} onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p>A revisão começa como <b>rascunho</b>: você lança e corrige os materiais à vontade e só depois envia a lista inteira para Compras. Enviada, ela trava.</p>
        {temEnviada && <Caixa marcado={copiar} onChange={setCopiar}>Começar com os itens da última revisão enviada</Caixa>}
        {temEnviada && <p className="text-suave">Ao enviar, cada item que mudou mostra para Compras quanto era e quanto é agora.</p>}
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={criar.isPending} onClick={() => { setErro(''); criar.mutate(); }}>Criar rascunho</Botao>
        </div>
      </div>
    </Modal>
  );
}

function Revisao({ projeto, lista, solicitacao, solicitacoes, editavel }: { projeto: Projeto; lista: ListaRevisao; solicitacao?: Solicitacao; solicitacoes: Solicitacao[]; editavel: boolean }) {
  const qc = useQueryClient();
  const { data: itens = [], isLoading } = useQuery({ queryKey: ['eng', lista.id, 'itens'], queryFn: () => listarItensLista(lista.id) });
  const { data: refs = REFS_VAZIAS } = useQuery({ queryKey: ['bib', 'eng_refs'], queryFn: listarRefsEng, staleTime: 5 * 60_000, enabled: editavel });
  const produtos = useMemo(() => produtosDoCadastro(refs), [refs]);
  const [digitando, setDigitando] = useState(false);
  const [referencia, setReferencia] = useState<ItemLista | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const [erro, setErro] = useState('');
  const ordenados = [...itens].sort((a, b) => ordemGrupo(a.grupo) - ordemGrupo(b.grupo) || a.ordem - b.ordem);
  const atualizar = () => qc.invalidateQueries({ queryKey: ['eng', lista.id, 'itens'] });
  const tentar = async (f: () => Promise<unknown>) => { setErro(''); try { await f(); await atualizar(); } catch (e) { setErro(mensagemErro(e)); } };
  const proximaOrdem = () => itens.reduce((m, i) => Math.max(m, i.ordem), 0) + 1;

  function adicionarProduto(id: string) {
    const p = produtos.find((x) => x.id === id);
    if (!p) return;
    tentar(() => incluirItemLista({ lista_id: lista.id, ordem: proximaOrdem(), grupo: p.grupo, descricao: p.descricao, quantidade: 1, unidade: p.unidade, bib_tipo: p.bib_tipo, bib_id: p.bib_id, observacoes: '', link: '' }));
  }

  const descartarM = useMutation({
    mutationFn: () => descartarRascunho(lista.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eng', projeto.id, 'listas'] }),
    onError: (e) => setErro(mensagemErro(e)),
  });

  return (
    <Cartao className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-borda px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Lista de materiais · R{lista.revisao}</div>
          <div className="text-sm text-suave">
            {lista.status === 'rascunho' ? 'Rascunho: ainda não foi para Compras.' : (
              <>Enviada {lista.enviada_em ? `em ${dataHoraBR(lista.enviada_em)}` : ''}{lista.enviada ? ` por ${lista.enviada.nome}` : ''}
                {solicitacao && <> · <span className="font-mono text-texto">{solicitacao.codigo}</span>{solicitacao.necessario_em && ` · precisa em ${dataBR(solicitacao.necessario_em)}`}</>}
                . Travada: para mudar, abra uma nova revisão.</>
            )}
          </div>
        </div>
        {editavel && (
          <>
            <Botao tamanho="sm" variante="secundario" onClick={() => setDescartar(true)}><Trash2 size={14} /> Descartar rascunho</Botao>
            <Botao tamanho="sm" disabled={!itens.length} onClick={() => setEnviando(true)}><Send size={14} /> Enviar para Compras</Botao>
          </>
        )}
      </div>

      {editavel && (
        <div className="flex flex-wrap items-end gap-2 border-b border-borda px-4 py-3">
          <div className="min-w-[240px] flex-1">
            <BuscaItem placeholder="Buscar no cadastro de Compras (ex.: chapa 6,35, parafuso M12)" opcoes={produtos.map((p) => ({ id: p.id, titulo: p.descricao, detalhe: p.grupo }))} onEscolher={adicionarProduto} />
          </div>
          <Botao variante="secundario" onClick={() => setDigitando(true)}><Plus size={14} /> Item sem cadastro</Botao>
        </div>
      )}
      {erro && <div className="px-4 pt-3"><Aviso>{erro}</Aviso></div>}

      {isLoading ? <div className="px-4 py-6 text-sm text-suave">Carregando…</div> : ordenados.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-suave">{editavel ? 'Busque um material no cadastro de Compras ou use "Item sem cadastro".' : 'Nenhum item nesta revisão.'}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-pagina text-left text-xs uppercase text-suave">
              <tr>
                <th className="px-3 py-2">Grupo</th><th className="px-3 py-2">Material / item</th>
                <th className="px-3 py-2 text-right">Qtd</th><th className="px-3 py-2">Un.</th>
                <th className="px-3 py-2">Observação</th><th className="px-3 py-2">Referência</th>
                {editavel && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((i) => (
                <tr key={i.id} className="border-t border-borda align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-suave">{i.grupo}</td>
                  <td className="min-w-[12rem] px-3 py-2">{i.descricao}{!i.bib_id && <div className="text-[11px] text-amber-600 dark:text-amber-400">sem cadastro</div>}</td>
                  {editavel ? (
                    <>
                      <td className="min-w-[6rem] px-2 py-1.5"><CampoTexto valor={textoQtd(i.quantidade)} className="text-right" rotulo="Quantidade"
                        onSalvar={(v) => { const q = lerQuantidade(v); if (q == null || q <= 0) { setErro('A quantidade precisa ser maior que zero.'); return; } tentar(() => atualizarItemLista(i.id, { quantidade: q })); }} /></td>
                      <td className="min-w-[5rem] px-2 py-1.5"><CampoTexto valor={i.unidade} rotulo="Unidade" onSalvar={(v) => v.trim() && tentar(() => atualizarItemLista(i.id, { unidade: v.trim() }))} /></td>
                      <td className="min-w-[11rem] px-2 py-1.5"><CampoTexto valor={i.observacoes} rotulo="Observação" placeholder="marca, medida…" onSalvar={(v) => tentar(() => atualizarItemLista(i.id, { observacoes: v.trim() }))} /></td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{qtdBR(i.quantidade)}</td>
                      <td className="px-3 py-2">{i.unidade}</td>
                      <td className="px-3 py-2 text-suave">{i.observacoes || '—'}</td>
                    </>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {i.link && <a href={i.link} target="_blank" rel="noreferrer" title={i.link} className="inline-flex items-center gap-1 text-roxo-600 hover:underline dark:text-roxo-100"><ExternalLink size={14} /> link</a>}
                      {i.imagem && <MiniaturaRef caminho={i.imagem} />}
                      {editavel && <button onClick={() => setReferencia(i)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-suave ring-1 ring-borda hover:text-roxo-600"><Link2 size={12} /> {i.link || i.imagem ? 'Trocar' : 'Adicionar'}</button>}
                      {!editavel && !i.link && !i.imagem && <span className="text-suave">—</span>}
                    </div>
                  </td>
                  {editavel && (
                    <td className="px-2 py-2 text-right">
                      <button title="Tirar da lista" onClick={() => tentar(() => excluirItemLista(i.id))} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-marinho-700"><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {digitando && <ItemDigitadoModal lista={lista} ordem={proximaOrdem()} onFechar={() => setDigitando(false)} onSalvo={atualizar} />}
      {referencia && <ReferenciaModal item={referencia} onFechar={() => setReferencia(null)} onSalvo={atualizar} />}
      {enviando && <EnviarModal projeto={projeto} lista={lista} itens={itens} solicitacoes={solicitacoes} onFechar={() => setEnviando(false)} />}
      {descartar && (
        <Modal aberto titulo={`Descartar o rascunho R${lista.revisao}?`} onFechar={() => setDescartar(false)}>
          <div className="space-y-3 text-sm">
            <p>Os itens deste rascunho não vão para Compras. As revisões já enviadas continuam como estão.</p>
            <div className="flex justify-end gap-2">
              <Botao variante="secundario" onClick={() => setDescartar(false)}>Voltar</Botao>
              <Botao variante="perigo" disabled={descartarM.isPending} onClick={() => descartarM.mutate()}>Descartar</Botao>
            </div>
          </div>
        </Modal>
      )}
    </Cartao>
  );
}

// Campo que salva ao sair (ou Enter), sem gravar a cada tecla.
function CampoTexto({ valor, onSalvar, className, rotulo, placeholder }: { valor: string; onSalvar: (v: string) => void; className?: string; rotulo: string; placeholder?: string }) {
  const [texto, setTexto] = useState(valor);
  return (
    <Entrada value={texto} aria-label={rotulo} placeholder={placeholder} className={`h-8 py-1 text-sm ${className ?? ''}`}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => texto !== valor && onSalvar(texto)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
  );
}

function MiniaturaRef({ caminho }: { caminho: string }) {
  const { data: url } = useQuery({ queryKey: ['eng', 'imagem', caminho], queryFn: () => urlImagemRef(caminho), staleTime: 50 * 60_000 });
  if (!url) return <span className="inline-block h-8 w-8 animate-pulse rounded bg-pagina" />;
  return <a href={url} target="_blank" rel="noreferrer" title="Abrir imagem"><img src={url} alt="Referência" className="h-8 w-8 rounded object-cover ring-1 ring-borda" /></a>;
}

function ItemDigitadoModal({ lista, ordem, onFechar, onSalvo }: { lista: ListaRevisao; ordem: number; onFechar: () => void; onSalvo: () => void }) {
  const [descricao, setDescricao] = useState('');
  const [grupo, setGrupo] = useState<GrupoItem>('Comerciais');
  const [quantidade, setQuantidade] = useState('1');
  const [unidade, setUnidade] = useState('un');
  const [obs, setObs] = useState('');
  const [link, setLink] = useState('');
  const [erro, setErro] = useState('');
  const salvar = useMutation({
    mutationFn: async () => {
      const q = lerQuantidade(quantidade);
      if (descricao.trim().length < 2) throw new Error('Descreva o item.');
      if (q == null || q <= 0) throw new Error('A quantidade precisa ser maior que zero.');
      if (link.trim() && !/^https?:\/\//i.test(link.trim())) throw new Error('O link precisa começar com http:// ou https://.');
      await incluirItemLista({ lista_id: lista.id, ordem, grupo, descricao: descricao.trim(), quantidade: q, unidade: unidade.trim() || 'un', bib_tipo: null, bib_id: null, observacoes: obs.trim(), link: link.trim() });
    },
    onSuccess: () => { onSalvo(); onFechar(); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  return (
    <Modal aberto titulo="Item sem cadastro" onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <Campo rotulo="Descrição"><Entrada value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Motorredutor 0,5 cv 1:30 eixo 25 mm" autoFocus /></Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Grupo"><Selecao value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoItem)}>{GRUPOS.map((g) => <option key={g}>{g}</option>)}</Selecao></Campo>
          <Campo rotulo="Quantidade"><Entrada value={quantidade} onChange={(e) => setQuantidade(e.target.value)} inputMode="decimal" className="text-right" /></Campo>
          <Campo rotulo="Unidade"><Entrada value={unidade} onChange={(e) => setUnidade(e.target.value)} /></Campo>
        </div>
        <Campo rotulo="Observação"><Entrada value={obs} onChange={(e) => setObs(e.target.value)} placeholder="marca, modelo, medida…" /></Campo>
        <Campo rotulo="Link de referência (opcional)"><Entrada value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" /></Campo>
        <p className="text-xs text-suave">A imagem de referência você adiciona depois, na coluna Referência.</p>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={salvar.isPending} onClick={() => { setErro(''); salvar.mutate(); }}>Adicionar</Botao>
        </div>
      </div>
    </Modal>
  );
}

function ReferenciaModal({ item, onFechar, onSalvo }: { item: ItemLista; onFechar: () => void; onSalvo: () => void }) {
  const [link, setLink] = useState(item.link);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tirarImagem, setTirarImagem] = useState(false);
  const [erro, setErro] = useState('');
  const entrada = useRef<HTMLInputElement>(null);
  const salvar = useMutation({
    mutationFn: async () => {
      const l = link.trim();
      if (l && !/^https?:\/\//i.test(l)) throw new Error('O link precisa começar com http:// ou https://.');
      if (arquivo && arquivo.size > 10 * 1024 * 1024) throw new Error('A imagem pode ter até 10 MB.');
      await atualizarItemLista(item.id, { link: l, ...(tirarImagem ? { imagem: null } : {}) });
      if (arquivo) await enviarImagemRef(item.lista_id, item.id, arquivo);
    },
    onSuccess: () => { onSalvo(); onFechar(); },
    onError: (e) => setErro(mensagemErro(e)),
  });
  return (
    <Modal aberto titulo="Referência para o comprador" onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <div className="font-medium">{item.descricao}</div>
        <Campo rotulo="Link de compra ou do fabricante"><Entrada value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" autoFocus /></Campo>
        <div>
          <div className="mb-1 text-xs text-suave">Imagem (foto, print do catálogo)</div>
          <div className="flex flex-wrap items-center gap-2">
            {item.imagem && !tirarImagem && !arquivo && <MiniaturaRef caminho={item.imagem} />}
            {arquivo && <span className="text-xs">{arquivo.name}</span>}
            <Botao tamanho="sm" variante="secundario" onClick={() => entrada.current?.click()}><ImagePlus size={14} /> {item.imagem || arquivo ? 'Trocar imagem' : 'Escolher imagem'}</Botao>
            {item.imagem && !arquivo && <Caixa marcado={tirarImagem} onChange={setTirarImagem}>Tirar a imagem</Caixa>}
            <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setTirarImagem(false); }} />
          </div>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={salvar.isPending} onClick={() => { setErro(''); salvar.mutate(); }}>{salvar.isPending ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </div>
    </Modal>
  );
}

// Envio da revisão: a lista inteira vai para Compras; com algo já comprado, só o que falta (decisão 107), e cada item
// que mudou leva "era × agora".
function EnviarModal({ projeto, lista, itens, solicitacoes, onFechar }: { projeto: Projeto; lista: ListaRevisao; itens: ItemLista[]; solicitacoes: Solicitacao[]; onFechar: () => void }) {
  const qc = useQueryClient();
  const plano: PlanoEnvio<LinhaRevisao> = useMemo(() => planoEnvio(linhasDaRevisao(itens), solicitacoes), [itens, solicitacoes]);
  const [necessario, setNecessario] = useState(projeto.prazo ?? '');
  const [prioridade, setPrioridade] = useState<'normal' | 'urgente'>('normal');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState<{ codigo: string; revisao: number } | null>(null);
  const complemento = plano.itens.some((i) => i.observacoes.includes('complemento'));
  const revisando = plano.comparacao.length > 0;
  const porChave = new Map(plano.comparacao.map((c) => [c.chave, c]));
  const enviar = useMutation({
    mutationFn: () => {
      const notas = [obs.trim(), complemento ? 'Complemento: parte da lista já foi comprada em outra requisição.' : '',
        plano.saidas.length ? `Saíram da lista na R${lista.revisao}: ${plano.saidas.join('; ')}.` : '',
        plano.reducoes.length ? `Itens que diminuíram ou saíram da lista depois de comprados: ${plano.reducoes.join('; ')}.` : ''].filter(Boolean).join('\n');
      return enviarLista(lista.id, plano.itens, necessario || null, prioridade, notas);
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['eng', projeto.id] });
      qc.invalidateQueries({ queryKey: ['eng', lista.id] });
      qc.invalidateQueries({ queryKey: ['compras'] });
      setFeito({ codigo: r.codigo, revisao: r.revisao });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  if (feito) return (
    <Modal aberto titulo="Lista enviada" onFechar={onFechar}>
      <div className="space-y-3 text-sm">
        <p>A R{feito.revisao} foi para Compras como <span className="font-mono font-semibold">{feito.codigo}</span> e aparece na aba À comprar. A revisão agora está travada.</p>
        <div className="flex justify-end"><Botao onClick={onFechar}>Fechar</Botao></div>
      </div>
    </Modal>
  );

  return (
    <Modal aberto titulo={`Enviar para Compras · ${projeto.codigo} · R${lista.revisao}`} onFechar={onFechar} largura="max-w-3xl">
      <div className="space-y-3 text-sm">
        <p className="text-suave">Vai para Compras a lista inteira desta revisão, com os links e imagens de referência. Depois de enviada, ela trava.{revisando && ' Cada item que mudou leva para Compras quanto era e quanto é agora.'}</p>
        {plano.substitui.length > 0 && <Aviso tipo="info">A solicitação {plano.substitui.map((s) => `${s.codigo} (R${s.revisao})`).join(', ')} ainda não teve nada comprado e será cancelada e substituída por esta revisão.</Aviso>}
        {complemento && <Aviso tipo="info">Parte da lista já foi comprada. Vai só o que falta, marcado como complemento.</Aviso>}
        {plano.reducoes.length > 0 && (
          <Aviso>Itens que já foram comprados e diminuíram ou saíram da lista (avise Compras se for preciso cancelar ou devolver):
            <ul className="mt-1 list-disc pl-5">{plano.reducoes.map((r) => <li key={r}>{r}</li>)}</ul>
          </Aviso>
        )}
        {plano.itens.length === 0 ? <Aviso>Nada a enviar: tudo o que está nesta revisão já foi comprado.</Aviso> : (
          <div className="max-h-72 overflow-auto rounded-lg ring-1 ring-borda">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-pagina text-left text-xs uppercase text-suave">
                <tr>
                  <th className="px-3 py-2">Grupo</th><th className="px-3 py-2">Material / item</th>
                  {revisando && <><th className="px-3 py-2 text-right">Era</th><th className="px-3 py-2 text-right">Agora</th></>}
                  <th className="px-3 py-2 text-right">{revisando ? 'Vai na RC' : 'Quantidade'}</th><th className="px-3 py-2">Un.</th>
                </tr>
              </thead>
              <tbody>
                {plano.itens.map((i) => {
                  const c = porChave.get(i.chave);
                  const mudou = c && (c.era == null || Math.abs(c.era - c.agora) > 0.0005);
                  return (
                    <tr key={i.chave} className={`border-t border-borda ${mudou ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}`}>
                      <td className="px-3 py-1.5 text-suave">{i.grupo}</td>
                      <td className="px-3 py-1.5">{i.descricao}{(i.link || i.imagem) && <span className="ml-1 text-[11px] text-roxo-600 dark:text-roxo-100">· com referência</span>}{i.observacoes && <div className="text-[11px] text-amber-600 dark:text-amber-400">{i.observacoes}</div>}</td>
                      {revisando && <><td className="px-3 py-1.5 text-right tabular-nums text-suave">{c?.era == null ? '—' : qtdBR(c.era)}</td><td className="px-3 py-1.5 text-right tabular-nums">{c ? qtdBR(c.agora) : '—'}</td></>}
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{qtdBR(i.quantidade)}</td>
                      <td className="px-3 py-1.5">{i.unidade}</td>
                    </tr>
                  );
                })}
                {plano.saidas.map((t) => (
                  <tr key={t} className="border-t border-borda text-suave">
                    <td className="px-3 py-1.5" /><td className="px-3 py-1.5 line-through">{t}</td>
                    <td className="px-3 py-1.5 text-right text-[11px]" colSpan={4}>saiu da lista</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Precisa em"><CampoData value={necessario} onChange={setNecessario} /></Campo>
          <Campo rotulo="Prioridade">
            <Selecao value={prioridade} onChange={(e) => setPrioridade(e.target.value as 'normal' | 'urgente')}>
              <option value="normal">Normal</option><option value="urgente">Urgente</option>
            </Selecao>
          </Campo>
        </div>
        <Campo rotulo="Observações para Compras"><AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: entregar na fábrica, preferir chapa de 3000 × 1200" /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={enviar.isPending || plano.itens.length === 0} onClick={() => { setErro(''); enviar.mutate(); }}><Send size={14} /> {enviar.isPending ? 'Enviando…' : `Enviar ${plano.itens.length} ${plano.itens.length === 1 ? 'item' : 'itens'}`}</Botao>
        </div>
      </div>
    </Modal>
  );
}
