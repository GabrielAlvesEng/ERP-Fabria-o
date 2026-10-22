import { useState, type ReactNode } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CircleCheck, CircleX, ChevronDown, ChevronUp, GripVertical, ImagePlus, Loader2, Lock, Plus, Sparkles, Trash2 } from 'lucide-react';
import { AreaTexto, Bolhas, Botao, Caixa, Campo, PrefixoCampo, CampoInteiro, CampoNumero, Entrada, Selecao } from '@/shared/ui';
import { moeda } from '@/shared/lib/formato';
import {
  INICIO_PRAZO_PADRAO, INICIOS_PRAZO, LIMITES_TEXTO, MARCOS_PAGAMENTO, MAX_IMAGENS_ITEM, SECOES_DO_MODELO, SECOES_FIXAS, SECOES_IA, escolherSecao, marcadorCartao, numerar, pendencias, sincronizarEscopo,
  type Cartao, type Documento, type Figura, type GrupoResponsabilidade, type LinhaMatriz, type Marca3, type Secao,
} from './modelo';
import { TextoFormatado } from './TextoFormatado';

// Rótulo para a caixa com barra de formatação (fora de <label>, para os botões da barra não dispararem o campo).
function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return <div><span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{texto}</span>{children}</div>;
}

export interface Imagens { enviar: (f: File) => Promise<string>; urls: Record<string, string> }

// Editor das seções do documento (decisão 61): usado na aba Documentos da proposta e em Administração → Modelos de proposta.
// Itens da aba Custos, com o valor de venda (decisão 71: o valor pode ser digitado na área Valores da comercial).
export type ItemValor = { id?: string; letra: string; descricao: string; valor: number; manual?: boolean; calculado?: number };
export type AcoesValor = { salvar: (id: string, valor: number | null) => void; criarItem: () => void; ocupado: boolean };

export function EditorDocumento({ doc, onChange, editavel, itens = [], imagens, valores, capaDados, modelo, ia }: {
  doc: Documento; onChange: (d: Documento) => void; editavel: boolean; itens?: ItemValor[]; imagens?: Imagens; valores?: AcoesValor;
  capaDados?: { titulo: string; descricao: string }; // decisão 72: título e subtítulo da capa vêm da aba Dados
  modelo?: boolean; // Administração → Modelos de proposta: lá o Anexo é editado (decisão 75)
  ia?: { refazer: (secaoId: string, pedido: string) => void; pensando: boolean; secao?: string | null; aviso?: { secao: string; tipo: 'info' | 'erro'; texto: string } | null }; // decisão 81
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  doc = sincronizarEscopo(doc, itens); // decisão 74: Escopo com os itens (e nomes) da aba Custos
  const escopoDosCustos = doc.tipo === 'tecnica' && itens.length > 0;
  const numeros = Object.fromEntries(numerar(doc.secoes).map((n) => [n.secao.id, n.numero]));
  const setSecao = (i: number, s: Secao) => onChange({ ...doc, secoes: doc.secoes.map((x, j) => (j === i ? s : x)) });
  const mover = (i: number, d: -1 | 1) => {
    const l = [...doc.secoes]; const j = i + d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    onChange({ ...doc, secoes: l });
  };

  return (
    <PrefixoCampo valor={`${doc.tipo}: `}>
    <fieldset disabled={!editavel} className="space-y-3">
      <div className="rounded-xl bg-pagina p-3 ring-1 ring-borda">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">Capa</span>
          <div className="flex rounded-lg bg-superficie p-0.5 text-xs ring-1 ring-borda" title="Fundo claro gasta menos tinta na impressão">
            {(['escuro', 'claro'] as const).map((f) => (
              <button key={f} type="button" onClick={() => onChange({ ...doc, capa: { ...doc.capa, fundo: f } })}
                className={`rounded-md px-2.5 py-1 ${(doc.capa.fundo ?? 'escuro') === f ? 'bg-roxo-600 font-semibold text-white' : 'text-suave'}`}>
                {f === 'escuro' ? 'Fundo escuro' : 'Fundo claro (impressão)'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg bg-pagina px-3 py-2 text-sm ring-1 ring-borda sm:col-span-2">
            <div className="text-xs font-medium text-suave">Título da capa (Título do fornecimento, na aba Dados)</div>
            <div className="font-semibold">{capaDados?.titulo || '—'}</div>
            <div className="mt-1.5 text-xs font-medium text-suave">Subtítulo da capa (Descrição, na aba Dados)</div>
            <div className="whitespace-pre-line text-suave">{capaDados?.descricao || 'Sem descrição.'}</div>
          </div>
          <Campo rotulo="Complemento do título (2ª linha, opcional)" className="sm:col-span-2"><Entrada value={doc.capa.linha2} onChange={(e) => onChange({ ...doc, capa: { ...doc.capa, linha2: e.target.value } })} placeholder="Ex.: Unidade Arceburgo" /></Campo>
          {imagens && (
            <div className="sm:col-span-2">
              <div className="mb-1 text-xs font-medium text-suave">Imagem principal (capa)</div>
              <EscolherImagem imagens={imagens} caminho={doc.capa.imagem} onEscolher={(c) => onChange({ ...doc, capa: { ...doc.capa, imagem: c } })} onRemover={() => onChange({ ...doc, capa: { ...doc.capa, imagem: undefined } })} />
            </div>
          )}
          {doc.tipo === 'comercial' && (
            <p className="text-xs text-suave sm:col-span-2">A comercial tem capa, visão geral (revisões, validade, frete, garantia, prazo, impostos e pagamento), valores (itens da aba Custos, com o valor digitado na seção Valores ou o calculado) e encerramento (anexos, sigilo e o vendedor, na página dos valores quando cabe). Garantia e prazo vêm da proposta técnica; frete, da aba Dados.</p>
          )}
        </div>
      </div>
      <p className="text-xs text-suave">Use a barra de cada texto para negrito, sublinhado e listas. Linha em branco separa parágrafos. Cliente, Local, Código e Validade viram os dados da proposta.</p>
      {!modelo && (() => {
        const abertas = doc.secoes.filter((s) => (s.ativo || s.escolher) && !SECOES_DO_MODELO[doc.tipo].includes(s.id) && s.tipo !== 'sobre' && s.tipo !== 'dados_empresas' && pendencias(s, itens).length);
        return abertas.length
          ? <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"><CircleX size={14} /> Falta preencher: {abertas.map((s) => s.titulo).join(', ')}.</p>
          : <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CircleCheck size={14} /> Todas as seções estão preenchidas.</p>;
      })()}
      {doc.secoes.map((s, i) => {
        // Sobre nós e Dados da Empresa são obrigatórios na técnica (decisão 71): nem aparecem no editor.
        if (s.tipo === 'sobre' || s.tipo === 'dados_empresas') return null;
        // Decisões 75 e 76: seções do modelo não aparecem na proposta (sempre saem, com o conteúdo do modelo).
        if (!modelo && SECOES_DO_MODELO[doc.tipo].includes(s.id)) return null;
        // Seções fixas (decisão 70): Conheça a Fabriaço, Dados da Empresa, Termo de Confidencialidade e Anexos. No modelo, o Anexo é editável.
        const fixa = (SECOES_FIXAS.includes(s.id) && !(modelo && s.id === 'anexo')) || s.tipo === 'confidencialidade';
        return (
        <PrefixoCampo key={s.id} valor={`${s.id} · `}>
        <div data-campo={`${doc.tipo}: ${s.id} · `} className={`rounded-xl ring-1 ${s.escolher && !modelo ? 'bg-amber-50/60 ring-amber-300 dark:bg-amber-500/5 dark:ring-amber-500/40' : `ring-borda ${s.ativo ? 'bg-superficie' : 'bg-pagina opacity-70'}`}`}>
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <Caixa marcado={s.ativo} onChange={(ativo) => setSecao(i, escolherSecao(s, ativo))} />
            <span className="w-6 text-xs font-semibold text-roxo-600 dark:text-roxo-100">{doc.tipo === 'tecnica' ? numeros[s.id] ?? '—' : ''}</span>
            {!modelo && !fixa && (s.ativo || s.escolher) && <Situacao faltando={pendencias(s, itens)} />}
            {fixa ? (
              <span className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-0.5 text-sm font-semibold">{s.titulo} <span className="inline-flex items-center gap-0.5 text-[11px] font-normal text-suave"><Lock size={11} /> fixa</span></span>
            ) : (
              <input value={s.titulo} onChange={(e) => setSecao(i, { ...s, titulo: e.target.value })}
                className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold outline-none hover:border-borda focus:border-roxo-500" />
            )}
            {doc.tipo === 'tecnica' && !fixa && <>
              <button type="button" onClick={() => mover(i, -1)} className="rounded p-1 text-suave hover:text-texto" title="Subir"><ChevronUp size={15} /></button>
              <button type="button" onClick={() => mover(i, 1)} className="rounded p-1 text-suave hover:text-texto" title="Descer"><ChevronDown size={15} /></button>
            </>}
            {/* Decisão 98: seção ainda não escolhida — o vendedor diz se entra (marca) ou não entra. */}
            {!modelo && s.escolher && (
              <span className="flex items-center gap-1">
                <Botao type="button" tamanho="sm" variante="secundario" onClick={() => setSecao(i, escolherSecao(s, true))}>Entra</Botao>
                <Botao type="button" tamanho="sm" variante="fantasma" onClick={() => setSecao(i, escolherSecao(s, false))}>Não entra</Botao>
              </span>
            )}
            <Bolhas campo={`${doc.tipo}: ${s.id} · `} inicio />
            <button type="button" onClick={() => setAberta(aberta === s.id ? null : s.id)} className="rounded px-2 py-0.5 text-xs text-roxo-600 hover:bg-roxo-50 dark:text-roxo-100 dark:hover:bg-marinho-700">
              {aberta === s.id ? 'Fechar' : fixa ? 'Ver' : 'Editar'}
            </button>
          </div>
          {aberta === s.id && <div className="border-t border-borda p-3">{!fixa && ia && SECOES_IA.includes(s.id) && <PedirIA titulo={s.titulo} pensando={ia.pensando} estaSecao={ia.secao === s.id} aviso={ia.aviso?.secao === s.id ? ia.aviso : null} onPedir={(pedido) => ia.refazer(s.id, pedido)} />}{fixa ? <SecaoFixa s={s} /> : <CorpoSecao s={s} onChange={(n) => setSecao(i, n)} itens={itens} imagens={imagens} valores={valores} escopoDosCustos={escopoDosCustos} />}</div>}
        </div>
        </PrefixoCampo>
        );
      })}
    </fieldset>
    </PrefixoCampo>
  );
}

function SecaoFixa({ s }: { s: Secao }) {
  const textos: Record<string, string> = {
    sobre: 'Página “Conheça a Fabriaço”, com o mapa de São Paulo, junto com os Dados da Empresa. É igual em todas as propostas.',
    dados: 'Preenchido sozinho: dados da Fabriaço (Administração → Modelos de proposta) e do cliente (cadastro de Empresas e Contatos).',
    confidencialidade: 'Texto fixo, sem o nome do cliente, igual em todas as propostas.',
    anexo: 'Os arquivos anexados na aba Arquivos → Anexos aparecem aqui em cards, com o tipo e o nome. Sem anexos, sai “Não contém”.',
  };
  return <p className="text-sm text-suave">{textos[s.id] ?? textos[s.tipo === 'sobre' ? 'sobre' : s.tipo === 'dados_empresas' ? 'dados' : 'confidencialidade']}</p>;
}

function CorpoSecao({ s, onChange, itens, imagens, valores, escopoDosCustos }: { s: Secao; onChange: (s: Secao) => void; itens: ItemValor[]; imagens?: Imagens; valores?: AcoesValor; escopoDosCustos?: boolean }) {
  switch (s.tipo) {
    case 'texto':
      return <TextoFormatado rows={Math.min(18, Math.max(5, s.texto.split('\n').length + 2))} value={s.texto} placeholder={s.dica} limite={LIMITES_TEXTO[s.id]} onChange={(v) => onChange({ ...s, texto: v })} />;
    case 'cartoes': {
      // Escopo da técnica (decisão 74): os itens são os da aba Custos; o nome não muda aqui e não se adiciona nem remove item.
      const fixo = s.id === 'escopo';
      const setCartao = (i: number, c: Cartao) => onChange({ ...s, cartoes: s.cartoes.map((x, j) => (j === i ? c : x)) });
      const setFiguras = (i: number, c: Cartao, l: Figura[]) => setCartao(i, { ...c, imagens: l.length ? l : undefined });
      return (
        <div className="space-y-2">
          <Rotulo texto="Introdução"><TextoFormatado rows={3} value={s.intro} onChange={(v) => onChange({ ...s, intro: v })} /></Rotulo>
          {s.destaque !== undefined && <Rotulo texto="Destaque"><TextoFormatado rows={2} value={s.destaque} onChange={(v) => onChange({ ...s, destaque: v })} /></Rotulo>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-suave">Itens{imagens ? ' · cada item pode ter suas imagens, que saem em cards ao lado do texto' : ''}</span>
            {!fixo && <div className="flex rounded-lg bg-superficie p-0.5 text-xs ring-1 ring-borda">
              {(['letra', 'numero'] as const).map((m) => (
                <button key={m} type="button" onClick={() => onChange({ ...s, marcador: m })}
                  className={`rounded-md px-2.5 py-1 ${s.marcador === m ? 'bg-roxo-600 font-semibold text-white' : 'text-suave'}`}>{m === 'letra' ? 'A, B, C' : '01, 02, 03'}</button>
              ))}
            </div>}
          </div>
          {s.cartoes.map((c, i) => {
            const figs = c.imagens ?? [];
            return (
              <div key={i} className="space-y-1.5 rounded-lg bg-pagina p-2 ring-1 ring-borda">
                <div className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-xs font-bold text-roxo-600 dark:text-roxo-100">{marcadorCartao(s.marcador, i)}</span>
                  {fixo ? <span className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1.5 text-sm font-semibold">{c.titulo || 'Item sem nome nos Custos'} <Lock size={11} className="shrink-0 text-suave" /></span>
                    : <Entrada value={c.titulo} onChange={(e) => setCartao(i, { ...c, titulo: e.target.value })} placeholder="Título" />}
                  {!(fixo && escopoDosCustos) && <button type="button" onClick={() => onChange({ ...s, cartoes: s.cartoes.filter((_, j) => j !== i) })} className="rounded p-1 text-suave hover:text-red-600" title="Remover item"><Trash2 size={14} /></button>}
                </div>
                <TextoFormatado rows={4} value={c.texto} onChange={(v) => setCartao(i, { ...c, texto: v })} placeholder="Descrição" />
                {imagens && (
                  <div className="space-y-1.5 pl-0 sm:pl-8">
                    {figs.map((f, k) => (
                      <div key={f.caminho + k} className="flex items-center gap-2">
                        {imagens.urls[f.caminho] ? <img src={imagens.urls[f.caminho]} alt="" className="h-12 w-16 shrink-0 rounded object-cover ring-1 ring-borda" /> : <div className="h-12 w-16 shrink-0 rounded bg-superficie ring-1 ring-borda" />}
                        <Entrada value={f.legenda} placeholder="Legenda (opcional)" onChange={(e) => setFiguras(i, c, figs.map((x, j) => (j === k ? { ...x, legenda: e.target.value } : x)))} />
                        <button type="button" onClick={() => setFiguras(i, c, figs.filter((_, j) => j !== k))} className="rounded p-1 text-suave hover:text-red-600" title="Tirar a imagem do item"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    {figs.length < MAX_IMAGENS_ITEM
                      ? <EscolherImagem imagens={imagens} rotulo={figs.length ? 'Adicionar outra imagem' : 'Adicionar imagem ao item'} onEscolher={(cam) => setFiguras(i, c, [...figs, { caminho: cam, legenda: '' }])} />
                      : <p className="text-xs text-suave">Máximo de {MAX_IMAGENS_ITEM} imagens por item (para caber na página).</p>}
                  </div>
                )}
              </div>
            );
          })}
          {fixo ? <p className="text-xs text-suave">{escopoDosCustos ? 'Os itens e os nomes vêm da aba Custos. Para criar, renomear ou tirar um item, use os Custos.' : 'Nenhum item nos Custos desta revisão. Crie os itens na aba Custos para eles aparecerem aqui.'}</p>
            : <Botao type="button" variante="secundario" tamanho="sm" onClick={() => onChange({ ...s, cartoes: [...s.cartoes, { titulo: '', texto: '' }] })}><Plus size={14} /> Adicionar item</Botao>}
          {imagens && (s.figuras ?? []).length > 0 && (
            <div className="space-y-2 rounded-lg bg-pagina p-2 ring-1 ring-borda">
              <div className="text-xs font-medium text-suave">Imagens gerais da seção (modelo antigo, saem depois dos itens). Prefira colocar as imagens em cada item.</div>
              {(s.figuras ?? []).map((f, i) => (
                <div key={f.caminho} className="flex items-center gap-2">
                  {imagens.urls[f.caminho] ? <img src={imagens.urls[f.caminho]} alt="" className="h-12 w-16 shrink-0 rounded object-cover ring-1 ring-borda" /> : <div className="h-12 w-16 shrink-0 rounded bg-superficie ring-1 ring-borda" />}
                  <Entrada value={f.legenda} placeholder="Legenda" onChange={(e) => onChange({ ...s, figuras: (s.figuras ?? []).map((x, j) => (j === i ? { ...x, legenda: e.target.value } : x)) })} />
                  <button type="button" onClick={() => onChange({ ...s, figuras: (s.figuras ?? []).filter((_, j) => j !== i) })} className="rounded p-1 text-suave hover:text-red-600" title="Tirar do documento"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <Rotulo texto="Fechamento"><TextoFormatado rows={2} value={s.fecho} onChange={(v) => onChange({ ...s, fecho: v })} /></Rotulo>
          {s.dica && <p className="text-xs text-suave">{s.dica}</p>}
        </div>
      );
    }
    case 'dados_empresas':
      return <p className="text-sm text-suave">Preenchido sozinho: dados da Fabriaço (Administração → Modelos de proposta) e do cliente (cadastro de Empresas e Contatos).</p>;
    case 'competencias':
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {s.itens.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <Entrada value={it.nome} placeholder="Competência" onChange={(e) => onChange({ ...s, itens: s.itens.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })} />
                <Selecao value={it.valor} className="w-24" onChange={(e) => onChange({ ...s, itens: s.itens.map((x, j) => (j === i ? { ...x, valor: e.target.value as Marca3 } : x)) })}>
                  {!it.valor && <option value="">—</option>}
                  {['Sim', 'Não', 'N/A'].map((v) => <option key={v}>{v}</option>)}
                </Selecao>
                <button type="button" onClick={() => onChange({ ...s, itens: s.itens.filter((_, j) => j !== i) })} className="rounded p-1 text-suave hover:text-red-600" title="Remover competência"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <Botao type="button" variante="secundario" tamanho="sm" onClick={() => onChange({ ...s, itens: [...s.itens, { nome: '', valor: 'Sim' }] })}><Plus size={14} /> Adicionar competência</Botao>
        </div>
      );
    case 'sobre':
      return <p className="text-sm text-suave">Página “Conheça a Fabriaço”, com o mapa de São Paulo. Os textos ficam em Administração → Modelos de proposta → Dados da Fabriaço e valem para todas as propostas.</p>;
    case 'responsabilidades': {
      const setGrupo = (g: number, novo: GrupoResponsabilidade) => onChange({ ...s, grupos: s.grupos.map((x, j) => (j === g ? novo : x)) });
      return (
        <div className="space-y-3">
          <div className="flex gap-2 text-[11px] font-semibold uppercase text-suave"><span className="w-5" /><span className="flex-1">Item · arraste pela alça para mudar a ordem</span><span className="w-14 text-center">Cliente</span><span className="w-14 text-center">Fabriaço</span><span className="w-6" /></div>
          {s.grupos.map((g, gi) => (
            <div key={gi} className="rounded-lg bg-pagina p-2 ring-1 ring-borda">
              <div className="mb-1 flex items-center gap-2">
                <input value={g.area} onChange={(e) => setGrupo(gi, { ...g, area: e.target.value })} placeholder="Área"
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-bold uppercase tracking-wide text-roxo-600 outline-none hover:border-borda focus:border-roxo-500 dark:text-roxo-100" />
                <button type="button" onClick={() => confirm(`Tirar a área “${g.area}” e os itens dela?`) && onChange({ ...s, grupos: s.grupos.filter((_, j) => j !== gi) })} className="w-6 rounded p-1 text-suave hover:text-red-600" title="Tirar a área"><Trash2 size={13} /></button>
              </div>
              <ItensArrastaveis grupo={gi} itens={g.itens} onChange={(itens) => setGrupo(gi, { ...g, itens })} />
              <button type="button" onClick={() => setGrupo(gi, { ...g, itens: [...g.itens, { texto: '', cliente: false, fabriaco: true }] })} className="mt-1 text-xs font-medium text-roxo-600 hover:underline dark:text-roxo-100">+ Adicionar item em {g.area || 'esta área'}</button>
            </div>
          ))}
          <Botao type="button" variante="secundario" tamanho="sm" onClick={() => onChange({ ...s, grupos: [...s.grupos, { area: 'Nova área', itens: [] }] })}><Plus size={14} /> Adicionar área</Botao>
        </div>
      );
    }
    case 'garantia':
      return (
        <div className="space-y-2">
          <Campo rotulo="Tempo de garantia (meses, após a emissão da NF)" className="max-w-xs">
            <CampoInteiro min={1} max={120} sufixo="meses" valor={s.meses} onChange={(n) => onChange({ ...s, meses: n ?? 1 })} className="max-w-[11rem]" />
          </Campo>
          <p className="text-xs text-suave">O resto da garantia (o que cobre e onde não se aplica) é texto fixo, igual em todas as propostas. A proposta comercial mostra este mesmo prazo.</p>
        </div>
      );
    case 'cronograma': {
      const total = s.etapas.reduce((t, e) => t + (Number(e.dias) || 0), 0);
      return (
        <div className="space-y-2">
          <InicioPrazo valor={s.inicio?.trim() || INICIO_PRAZO_PADRAO} onChange={(inicio) => onChange({ ...s, inicio })} />
          <div className="flex gap-2 text-[11px] font-semibold uppercase text-suave"><span className="flex-1">Etapa</span><span className="w-36 text-center">Dias</span><span className="w-6" /></div>
          {s.etapas.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <Entrada value={e.nome} onChange={(ev) => onChange({ ...s, etapas: s.etapas.map((x, j) => (j === i ? { ...x, nome: ev.target.value } : x)) })} placeholder="Etapa" />
              <CampoInteiro min={0} max={999} sufixo="dias" className="w-36 shrink-0" valor={e.dias} onChange={(n) => onChange({ ...s, etapas: s.etapas.map((x, j) => (j === i ? { ...x, dias: n ?? 0 } : x)) })} />
              <button type="button" onClick={() => onChange({ ...s, etapas: s.etapas.filter((_, j) => j !== i) })} className="w-6 rounded p-1 text-suave hover:text-red-600" title="Remover"><Trash2 size={13} /></button>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2">
            <Botao type="button" variante="secundario" tamanho="sm" onClick={() => onChange({ ...s, etapas: [...s.etapas, { nome: '', dias: 5 }] })}><Plus size={14} /> Adicionar etapa</Botao>
            <span className="text-sm">Total: <b>{total} dias</b> após {s.inicio?.trim() || INICIO_PRAZO_PADRAO}</span>
          </div>
          <p className="text-xs text-suave">Cada etapa começa quando a anterior termina. A proposta comercial mostra este total.</p>
        </div>
      );
    }
    case 'validade':
      return <p className="text-sm text-suave">Cartão com a validade da proposta (campo “Validade (dias)” na aba Dados) e a data limite. As condições são texto fixo.</p>;
    case 'confidencialidade':
      return <p className="text-sm text-suave">Texto fixo, sem o nome do cliente, igual em todas as propostas.</p>;
    case 'visao_comercial':
      return (
        <p className="text-sm text-suave">Entra sozinho: revisões e validade (da proposta), frete CIF/FOB e local de entrega (aba Dados), garantia e prazo (da proposta técnica).</p>
      );
    case 'matriz':
      return (
        <div className="space-y-1">
          <div className="flex gap-2 text-[11px] font-semibold uppercase text-suave"><span className="flex-1">Item</span><span className="w-14 text-center">Cliente</span><span className="w-14 text-center">Fabriaço</span><span className="w-6" /></div>
          {s.itens.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={it.texto} onChange={(e) => onChange({ ...s, itens: s.itens.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })}
                className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none hover:border-borda focus:border-roxo-500" />
              <span className="flex w-14 justify-center"><Caixa marcado={it.cliente} onChange={(v) => onChange({ ...s, itens: s.itens.map((x, j) => (j === i ? { ...x, cliente: v } : x)) })} /></span>
              <span className="flex w-14 justify-center"><Caixa marcado={it.fabriaco} onChange={(v) => onChange({ ...s, itens: s.itens.map((x, j) => (j === i ? { ...x, fabriaco: v } : x)) })} /></span>
              <button type="button" onClick={() => onChange({ ...s, itens: s.itens.filter((_, j) => j !== i) })} className="w-6 rounded p-1 text-suave hover:text-red-600" title="Remover"><Trash2 size={13} /></button>
            </div>
          ))}
          <Botao type="button" variante="secundario" tamanho="sm" onClick={() => onChange({ ...s, itens: [...s.itens, { texto: '', cliente: false, fabriaco: true }] })}><Plus size={14} /> Adicionar linha</Botao>
        </div>
      );
    case 'impostos':
      return (
        <div className="space-y-2">
          <Rotulo texto="Introdução"><TextoFormatado rows={2} value={s.intro} onChange={(v) => onChange({ ...s, intro: v })} /></Rotulo>
          <Campo rotulo="NCM"><Entrada value={s.ncm} onChange={(e) => onChange({ ...s, ncm: e.target.value })} placeholder="Ex.: 8437.10.00" /></Campo>
          {s.linhas.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Entrada className="w-32" value={l.tributo} onChange={(e) => onChange({ ...s, linhas: s.linhas.map((x, j) => (j === i ? { ...x, tributo: e.target.value } : x)) })} />
              <Entrada value={l.valor} onChange={(e) => onChange({ ...s, linhas: s.linhas.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)) })} />
            </div>
          ))}
        </div>
      );
    case 'valores':
      return (
        <div className="space-y-2">
          <Rotulo texto="Introdução"><TextoFormatado rows={5} value={s.intro} onChange={(v) => onChange({ ...s, intro: v })} /></Rotulo>
          <p className="text-xs text-suave">Os itens são os da aba Custos. O valor de cada item já vem com a sugestão calculada pelos custos e pode ser alterado aqui. A soma é o valor total da proposta.</p>
          {itens.length === 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-pagina p-3 text-sm text-suave ring-1 ring-borda">
              Nenhum item nesta revisão.
              {valores && <Botao type="button" variante="secundario" tamanho="sm" disabled={valores.ocupado} onClick={valores.criarItem}><Plus size={14} /> Criar item A</Botao>}
            </div>
          )}
          {itens.map((it) => (
            <div key={it.letra} className="space-y-2 rounded-lg p-3 ring-1 ring-borda">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1 text-sm font-semibold">{it.letra} — {it.descricao || 'Item sem descrição'}</div>
                <div className="w-48">
                  <div className="mb-1 text-xs font-medium text-suave">Valor do item</div>
                  <CampoNumero moeda casas={2} valor={it.valor} disabled={!valores || !it.id || valores.ocupado}
                    onConfirmar={(n) => valores && it.id && n >= 0 && Math.abs(n - it.valor) > 0.005 && valores.salvar(it.id, n)} className="py-1.5" />
                </div>
              </div>
              <div className="text-xs text-suave">
                Sugestão pelos custos: <span className="font-medium tabular-nums">{moeda(it.calculado ?? it.valor)}</span>
                {it.manual ? <>{' · '}valor alterado à mão. {valores && it.id && <button type="button" className="font-medium text-roxo-600 hover:underline dark:text-roxo-100" onClick={() => valores.salvar(it.id!, null)}>Usar a sugestão</button>}</>
                  : ' · em uso. Pode alterar no campo ao lado.'}
              </div>
              <Rotulo texto="Descrição do fornecimento">
                <AreaTexto rows={2} value={s.descricoes[it.letra] ?? ''} onChange={(e) => onChange({ ...s, descricoes: { ...s.descricoes, [it.letra]: e.target.value } })} />
              </Rotulo>
            </div>
          ))}
          {itens.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-pagina px-3 py-2 ring-1 ring-borda">
              <span className="text-sm font-semibold">Valor total da proposta</span>
              <span className="text-base font-bold tabular-nums">{moeda(itens.reduce((a, i) => a + i.valor, 0))}</span>
            </div>
          )}
        </div>
      );
    case 'pagamento':
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <Campo rotulo="Condição"><Entrada value={s.condicao} onChange={(e) => onChange({ ...s, condicao: e.target.value })} /></Campo>
            <Campo rotulo="Pago no marco"><EscolhaComOutro valor={s.marco} opcoes={MARCOS_PAGAMENTO} onChange={(marco) => onChange({ ...s, marco })} /></Campo>
            <Campo rotulo="Forma"><Entrada value={s.forma} onChange={(e) => onChange({ ...s, forma: e.target.value })} /></Campo>
          </div>
          <TextoFormatado rows={4} value={s.texto} onChange={(v) => onChange({ ...s, texto: v })} />
        </div>
      );
  }
}

// Envia a imagem (reduzida) para a revisão e devolve o caminho. Tirar do documento não apaga o arquivo:
// revisões anteriores podem usar a mesma imagem; a Lixeira apaga tudo ao excluir a proposta de vez.
function EscolherImagem({ imagens, caminho, onEscolher, onRemover, rotulo }: {
  imagens: Imagens; caminho?: string; onEscolher: (c: string) => void; onRemover?: () => void; rotulo?: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  async function escolher(f: File | undefined) {
    if (!f) return;
    setErro(''); setEnviando(true);
    try { onEscolher(await imagens.enviar(f)); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    setEnviando(false);
  }
  return (
    <div>
      <div className="flex items-center gap-3">
        {caminho && (imagens.urls[caminho] ? <img src={imagens.urls[caminho]} alt="" className="h-16 w-24 rounded object-contain ring-1 ring-borda" /> : <div className="h-16 w-24 rounded bg-superficie ring-1 ring-borda" />)}
        <label className="inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-lg border border-borda bg-superficie px-2.5 text-xs font-medium hover:border-roxo-300">
          <ImagePlus size={14} /> {enviando ? 'Enviando…' : rotulo ?? (caminho ? 'Trocar imagem' : 'Escolher imagem')}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={enviando} onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {caminho && onRemover && <button type="button" onClick={onRemover} className="text-xs text-suave hover:text-red-600">Tirar da capa</button>}
      </div>
      {erro && <div className="mt-1 text-xs text-red-600">{erro}</div>}
    </div>
  );
}

// Itens de uma área das Responsabilidades, em ordem que se muda arrastando pela alça (decisão 70).
function ItensArrastaveis({ grupo, itens, onChange }: { grupo: number; itens: LinhaMatriz[]; onChange: (l: LinhaMatriz[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = itens.map((_, i) => `${grupo}-${i}`);
  const soltar = (e: DragEndEvent) => {
    const de = ids.indexOf(String(e.active.id)); const para = e.over ? ids.indexOf(String(e.over.id)) : -1;
    if (de >= 0 && para >= 0 && de !== para) onChange(arrayMove(itens, de, para));
  };
  const set = (i: number, n: Partial<LinhaMatriz>) => onChange(itens.map((x, j) => (j === i ? { ...x, ...n } : x)));
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={soltar}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {itens.map((it, i) => (
          <ItemArrastavel key={ids[i]} id={ids[i]} it={it} onChange={(n) => set(i, n)} onRemover={() => onChange(itens.filter((_, j) => j !== i))} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function ItemArrastavel({ id, it, onChange, onRemover }: { id: string; it: LinhaMatriz; onChange: (n: Partial<LinhaMatriz>) => void; onRemover: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded ${isDragging ? 'relative z-10 bg-superficie shadow-md ring-1 ring-roxo-300' : ''}`}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} className="w-5 cursor-grab touch-none rounded text-suave hover:text-texto active:cursor-grabbing" title="Arraste para mudar a ordem"><GripVertical size={14} /></button>
      <input value={it.texto} onChange={(e) => onChange({ texto: e.target.value })}
        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none hover:border-borda focus:border-roxo-500" />
      <span className="flex w-14 justify-center"><Caixa marcado={it.cliente} onChange={(v) => onChange({ cliente: v })} /></span>
      <span className="flex w-14 justify-center"><Caixa marcado={it.fabriaco} onChange={(v) => onChange({ fabriaco: v })} /></span>
      <button type="button" onClick={onRemover} className="w-6 rounded p-1 text-suave hover:text-red-600" title="Remover"><Trash2 size={13} /></button>
    </div>
  );
}

// Lista de opções com "Outro…" para digitar (marco de pagamento, início do prazo).
function EscolhaComOutro({ valor, opcoes, onChange, rotuloOpcao = (o: string) => o }: { valor: string; opcoes: string[]; onChange: (v: string) => void; rotuloOpcao?: (o: string) => string }) {
  const [outro, setOutro] = useState(() => Boolean(valor) && !opcoes.includes(valor));
  return (
    <div className="space-y-1.5">
      <Selecao value={outro ? '__outro' : valor} onChange={(e) => { if (e.target.value === '__outro') { setOutro(true); } else { setOutro(false); onChange(e.target.value); } }}>
        {opcoes.map((o) => <option key={o} value={o}>{rotuloOpcao(o)}</option>)}
        <option value="__outro">Outro…</option>
      </Selecao>
      {outro && <Entrada value={valor} placeholder="Escreva" onChange={(e) => onChange(e.target.value)} autoFocus />}
    </div>
  );
}

// De quando o prazo de entrega começa a contar (decisão 70).
function InicioPrazo({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const primeira = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  return (
    <Campo rotulo="Prazo contado a partir de" className="max-w-md">
      <EscolhaComOutro valor={valor} opcoes={INICIOS_PRAZO} onChange={onChange} rotuloOpcao={(o) => primeira(o.replace(/^(o|a) /, ''))} />
    </Campo>
  );
}

// Decisão 77: X amarelo quando falta algo obrigatório na seção (a lista aparece ao passar o mouse); certinho verde quando está completa.
function Situacao({ faltando }: { faltando: string[] }) {
  return faltando.length
    ? <span title={`Falta preencher: ${faltando.join(', ')}`} aria-label="Falta preencher" className="shrink-0 text-amber-500"><CircleX size={16} /></span>
    : <span title="Preenchido" aria-label="Preenchido" className="shrink-0 text-emerald-600 dark:text-emerald-400"><CircleCheck size={16} /></span>;
}

// Decisão 81: pedir à IA só esta seção, com um ajuste opcional ("deixe mais curto", "cite a NR-12"...).
function PedirIA({ titulo, pensando, estaSecao, aviso, onPedir }: { titulo: string; pensando: boolean; estaSecao: boolean; aviso: { tipo: 'info' | 'erro'; texto: string } | null; onPedir: (pedido: string) => void }) {
  const [pedido, setPedido] = useState('');
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-roxo-50 p-2 ring-1 ring-roxo-100 dark:bg-roxo-500/10 dark:ring-roxo-700/40">
      <Sparkles size={15} className="shrink-0 text-roxo-600 dark:text-roxo-100" />
      <input value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder={`O que mudar em "${titulo}"? (opcional)`}
        onKeyDown={(e) => { if (e.key === 'Enter' && !pensando) { e.preventDefault(); onPedir(pedido); } }}
        className="min-w-[12rem] flex-1 rounded-md border border-transparent bg-superficie px-2 py-1 text-sm outline-none focus:border-roxo-500" />
      <Botao type="button" variante={estaSecao ? 'primario' : 'secundario'} tamanho="sm" disabled={pensando} aria-busy={estaSecao} onClick={() => onPedir(pedido)}>
        {estaSecao ? <><Loader2 size={14} className="animate-spin" /> Carregando… (até 1 min)</> : pensando ? 'Aguarde a IA…' : 'Refazer só esta seção com IA'}
      </Botao>
      {aviso && <p className={`w-full text-xs ${aviso.tipo === 'erro' ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{aviso.texto}</p>}
    </div>
  );
}

