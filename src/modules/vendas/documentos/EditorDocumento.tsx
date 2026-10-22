import { useState } from 'react';
import { ChevronDown, ChevronUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { AreaTexto, Botao, Caixa, Campo, Entrada, Selecao } from '@/shared/ui';
import { MAX_IMAGENS_ITEM, marcadorCartao, numerar, type Cartao, type Documento, type Figura, type GrupoResponsabilidade, type Marca3, type Secao } from './modelo';

export interface Imagens { enviar: (f: File) => Promise<string>; urls: Record<string, string> }

// Editor das seções do documento (decisão 61): usado na aba Documentos da proposta e em Administração → Modelos de proposta.
export function EditorDocumento({ doc, onChange, editavel, itens = [], imagens }: {
  doc: Documento; onChange: (d: Documento) => void; editavel: boolean; itens?: { letra: string; descricao: string }[]; imagens?: Imagens;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  const numeros = Object.fromEntries(numerar(doc.secoes).map((n) => [n.secao.id, n.numero]));
  const setSecao = (i: number, s: Secao) => onChange({ ...doc, secoes: doc.secoes.map((x, j) => (j === i ? s : x)) });
  const mover = (i: number, d: -1 | 1) => {
    const l = [...doc.secoes]; const j = i + d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    onChange({ ...doc, secoes: l });
  };

  return (
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
          <Campo rotulo="Título · 1ª linha (assunto)"><Entrada value={doc.capa.linha1} onChange={(e) => onChange({ ...doc, capa: { ...doc.capa, linha1: e.target.value } })} placeholder="Ex.: Vedação Pneumática" /></Campo>
          <Campo rotulo="Título · 2ª linha (equipamento)"><Entrada value={doc.capa.linha2} onChange={(e) => onChange({ ...doc, capa: { ...doc.capa, linha2: e.target.value } })} placeholder="Ex.: Rosca MP" /></Campo>
          {imagens && (
            <div className="sm:col-span-2">
              <div className="mb-1 text-xs font-medium text-suave">Imagem principal (capa)</div>
              <EscolherImagem imagens={imagens} caminho={doc.capa.imagem} onEscolher={(c) => onChange({ ...doc, capa: { ...doc.capa, imagem: c } })} onRemover={() => onChange({ ...doc, capa: { ...doc.capa, imagem: undefined } })} />
            </div>
          )}
          <Campo rotulo="Subtítulo" className="sm:col-span-2"><AreaTexto rows={2} value={doc.capa.subtitulo} onChange={(e) => onChange({ ...doc, capa: { ...doc.capa, subtitulo: e.target.value } })} placeholder="Ex.: Fornecimento, fabricação e instalação de novo cabeçote removível…" /></Campo>
          {doc.tipo === 'tecnica' ? (
            <>
              <Campo rotulo="Objeto"><Entrada value={doc.visao.objeto} onChange={(e) => onChange({ ...doc, visao: { ...doc.visao, objeto: e.target.value } })} placeholder="Ex.: Cabeçote removível" /></Campo>
              <Campo rotulo="Solução"><Entrada value={doc.visao.solucao} onChange={(e) => onChange({ ...doc, visao: { ...doc.visao, solucao: e.target.value } })} placeholder="Ex.: Vedação pneumática" /></Campo>
              <Campo rotulo="Unidade (vazio = cliente · cidade)" className="sm:col-span-2"><Entrada value={doc.visao.unidade} onChange={(e) => onChange({ ...doc, visao: { ...doc.visao, unidade: e.target.value } })} /></Campo>
            </>
          ) : (
            <p className="text-xs text-suave sm:col-span-2">A comercial tem 4 páginas fixas: capa, visão geral (revisões, validade, frete, garantia, prazo, impostos e pagamento), valores (da aba Custos) e encerramento (anexos, sigilo e o vendedor). Garantia e prazo vêm da proposta técnica.</p>
          )}
        </div>
      </div>
      <p className="text-xs text-suave">Nos textos: linha em branco separa parágrafos, “- ” no começo da linha faz lista, **texto** fica em negrito. {'{cliente}'}, {'{local}'}, {'{validade_dias}'} e {'{codigo}'} viram os dados da proposta.</p>
      {doc.secoes.map((s, i) => (
        <div key={s.id} className={`rounded-xl ring-1 ring-borda ${s.ativo ? 'bg-superficie' : 'bg-pagina opacity-70'}`}>
          <div className="flex items-center gap-2 px-3 py-2">
            <Caixa marcado={s.ativo} onChange={(ativo) => setSecao(i, { ...s, ativo })} />
            <span className="w-6 text-xs font-semibold text-roxo-600 dark:text-roxo-100">{doc.tipo === 'tecnica' ? numeros[s.id] ?? '—' : ''}</span>
            <input value={s.titulo} onChange={(e) => setSecao(i, { ...s, titulo: e.target.value })}
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold outline-none hover:border-borda focus:border-roxo-500" />
            {doc.tipo === 'tecnica' && <>
              <button type="button" onClick={() => mover(i, -1)} className="rounded p-1 text-suave hover:text-texto" title="Subir"><ChevronUp size={15} /></button>
              <button type="button" onClick={() => mover(i, 1)} className="rounded p-1 text-suave hover:text-texto" title="Descer"><ChevronDown size={15} /></button>
            </>}
            <button type="button" onClick={() => setAberta(aberta === s.id ? null : s.id)} className="rounded px-2 py-0.5 text-xs text-roxo-600 hover:bg-roxo-50 dark:text-roxo-100 dark:hover:bg-marinho-700">
              {aberta === s.id ? 'Fechar' : 'Editar'}
            </button>
          </div>
          {aberta === s.id && <div className="border-t border-borda p-3"><CorpoSecao s={s} onChange={(n) => setSecao(i, n)} itens={itens} imagens={imagens} /></div>}
        </div>
      ))}
    </fieldset>
  );
}

function CorpoSecao({ s, onChange, itens, imagens }: { s: Secao; onChange: (s: Secao) => void; itens: { letra: string; descricao: string }[]; imagens?: Imagens }) {
  switch (s.tipo) {
    case 'texto':
      return <AreaTexto rows={Math.min(18, Math.max(5, s.texto.split('\n').length + 2))} value={s.texto} placeholder={s.dica} onChange={(e) => onChange({ ...s, texto: e.target.value })} />;
    case 'cartoes': {
      const setCartao = (i: number, c: Cartao) => onChange({ ...s, cartoes: s.cartoes.map((x, j) => (j === i ? c : x)) });
      const setFiguras = (i: number, c: Cartao, l: Figura[]) => setCartao(i, { ...c, imagens: l.length ? l : undefined });
      return (
        <div className="space-y-2">
          <Campo rotulo="Introdução"><AreaTexto rows={3} value={s.intro} onChange={(e) => onChange({ ...s, intro: e.target.value })} /></Campo>
          {s.destaque !== undefined && <Campo rotulo="Destaque"><AreaTexto rows={2} value={s.destaque} onChange={(e) => onChange({ ...s, destaque: e.target.value })} /></Campo>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-suave">Itens{imagens ? ' · cada item pode ter suas imagens, que saem em cards ao lado do texto' : ''}</span>
            <div className="flex rounded-lg bg-superficie p-0.5 text-xs ring-1 ring-borda">
              {(['letra', 'numero'] as const).map((m) => (
                <button key={m} type="button" onClick={() => onChange({ ...s, marcador: m })}
                  className={`rounded-md px-2.5 py-1 ${s.marcador === m ? 'bg-roxo-600 font-semibold text-white' : 'text-suave'}`}>{m === 'letra' ? 'A, B, C' : '01, 02, 03'}</button>
              ))}
            </div>
          </div>
          {s.cartoes.map((c, i) => {
            const figs = c.imagens ?? [];
            return (
              <div key={i} className="space-y-1.5 rounded-lg bg-pagina p-2 ring-1 ring-borda">
                <div className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-xs font-bold text-roxo-600 dark:text-roxo-100">{marcadorCartao(s.marcador, i)}</span>
                  <Entrada value={c.titulo} onChange={(e) => setCartao(i, { ...c, titulo: e.target.value })} placeholder="Título" />
                  <button type="button" onClick={() => onChange({ ...s, cartoes: s.cartoes.filter((_, j) => j !== i) })} className="rounded p-1 text-suave hover:text-red-600" title="Remover item"><Trash2 size={14} /></button>
                </div>
                <AreaTexto rows={3} value={c.texto} onChange={(e) => setCartao(i, { ...c, texto: e.target.value })} placeholder="Descrição" />
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
          <Botao type="button" variante="secundario" tamanho="sm" onClick={() => onChange({ ...s, cartoes: [...s.cartoes, { titulo: '', texto: '' }] })}><Plus size={14} /> Adicionar item</Botao>
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
          <Campo rotulo="Fechamento"><AreaTexto rows={2} value={s.fecho} onChange={(e) => onChange({ ...s, fecho: e.target.value })} /></Campo>
          {s.dica && <p className="text-xs text-suave">{s.dica}</p>}
        </div>
      );
    }
    case 'dados_empresas':
      return <p className="text-sm text-suave">Preenchido sozinho: dados da Fabriaço (Administração → Modelos de proposta) e do cliente (cadastro de Empresas e Contatos).</p>;
    case 'competencias':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {s.itens.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <Entrada value={it.nome} onChange={(e) => onChange({ ...s, itens: s.itens.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })} />
              <Selecao value={it.valor} className="w-24" onChange={(e) => onChange({ ...s, itens: s.itens.map((x, j) => (j === i ? { ...x, valor: e.target.value as Marca3 } : x)) })}>
                {['Sim', 'Não', 'N/A'].map((v) => <option key={v}>{v}</option>)}
              </Selecao>
            </div>
          ))}
        </div>
      );
    case 'sobre':
      return <p className="text-sm text-suave">Página “Conheça a Fabriaço”, com o mapa de São Paulo. Os textos ficam em Administração → Modelos de proposta → Dados da Fabriaço e valem para todas as propostas.</p>;
    case 'responsabilidades': {
      const setGrupo = (g: number, novo: GrupoResponsabilidade) => onChange({ ...s, grupos: s.grupos.map((x, j) => (j === g ? novo : x)) });
      return (
        <div className="space-y-3">
          <div className="flex gap-2 text-[11px] font-semibold uppercase text-suave"><span className="flex-1">Item</span><span className="w-14 text-center">Cliente</span><span className="w-14 text-center">Fabriaço</span><span className="w-6" /></div>
          {s.grupos.map((g, gi) => (
            <div key={gi} className="rounded-lg bg-pagina p-2 ring-1 ring-borda">
              <div className="mb-1 flex items-center gap-2">
                <input value={g.area} onChange={(e) => setGrupo(gi, { ...g, area: e.target.value })} placeholder="Área"
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-bold uppercase tracking-wide text-roxo-600 outline-none hover:border-borda focus:border-roxo-500 dark:text-roxo-100" />
                <button type="button" onClick={() => confirm(`Tirar a área “${g.area}” e os itens dela?`) && onChange({ ...s, grupos: s.grupos.filter((_, j) => j !== gi) })} className="w-6 rounded p-1 text-suave hover:text-red-600" title="Tirar a área"><Trash2 size={13} /></button>
              </div>
              {g.itens.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={it.texto} onChange={(e) => setGrupo(gi, { ...g, itens: g.itens.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })}
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none hover:border-borda focus:border-roxo-500" />
                  <span className="flex w-14 justify-center"><Caixa marcado={it.cliente} onChange={(v) => setGrupo(gi, { ...g, itens: g.itens.map((x, j) => (j === i ? { ...x, cliente: v } : x)) })} /></span>
                  <span className="flex w-14 justify-center"><Caixa marcado={it.fabriaco} onChange={(v) => setGrupo(gi, { ...g, itens: g.itens.map((x, j) => (j === i ? { ...x, fabriaco: v } : x)) })} /></span>
                  <button type="button" onClick={() => setGrupo(gi, { ...g, itens: g.itens.filter((_, j) => j !== i) })} className="w-6 rounded p-1 text-suave hover:text-red-600" title="Remover"><Trash2 size={13} /></button>
                </div>
              ))}
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
            <Entrada type="number" min={1} max={120} value={s.meses} onChange={(e) => onChange({ ...s, meses: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
          </Campo>
          <p className="text-xs text-suave">O resto da garantia (o que cobre e onde não se aplica) é texto fixo, igual em todas as propostas. A proposta comercial mostra este mesmo prazo.</p>
        </div>
      );
    case 'cronograma': {
      const total = s.etapas.reduce((t, e) => t + (Number(e.dias) || 0), 0);
      return (
        <div className="space-y-2">
          <div className="flex gap-2 text-[11px] font-semibold uppercase text-suave"><span className="flex-1">Etapa</span><span className="w-20 text-right">Dias</span><span className="w-6" /></div>
          {s.etapas.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <Entrada value={e.nome} onChange={(ev) => onChange({ ...s, etapas: s.etapas.map((x, j) => (j === i ? { ...x, nome: ev.target.value } : x)) })} placeholder="Etapa" />
              <Entrada type="number" min={0} className="w-20 text-right" value={e.dias} onChange={(ev) => onChange({ ...s, etapas: s.etapas.map((x, j) => (j === i ? { ...x, dias: Math.max(0, Math.round(Number(ev.target.value) || 0)) } : x)) })} />
              <button type="button" onClick={() => onChange({ ...s, etapas: s.etapas.filter((_, j) => j !== i) })} className="w-6 rounded p-1 text-suave hover:text-red-600" title="Remover"><Trash2 size={13} /></button>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2">
            <Botao type="button" variante="secundario" tamanho="sm" onClick={() => onChange({ ...s, etapas: [...s.etapas, { nome: '', dias: 5 }] })}><Plus size={14} /> Adicionar etapa</Botao>
            <span className="text-sm">Total: <b>{total} dias</b> após a aprovação</span>
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
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo rotulo="Frete"><Entrada value={s.frete} onChange={(e) => onChange({ ...s, frete: e.target.value })} placeholder="Ex.: CIF — incluso" /></Campo>
          <Campo rotulo="Detalhe do frete"><Entrada value={s.frete_detalhe} onChange={(e) => onChange({ ...s, frete_detalhe: e.target.value })} /></Campo>
          <p className="text-xs text-suave sm:col-span-2">Revisões, validade, garantia e prazo entram sozinhos (da proposta e da proposta técnica).</p>
        </div>
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
          <Campo rotulo="Introdução"><AreaTexto rows={2} value={s.intro} onChange={(e) => onChange({ ...s, intro: e.target.value })} /></Campo>
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
          <Campo rotulo="Introdução"><AreaTexto rows={5} value={s.intro} onChange={(e) => onChange({ ...s, intro: e.target.value })} /></Campo>
          <p className="text-xs text-suave">Itens e valores vêm da aba Custos (preço de venda de cada item). Aqui só a descrição do fornecimento de cada um.</p>
          {itens.length === 0 && <p className="text-sm text-suave">Nenhum item nos Custos desta revisão.</p>}
          {itens.map((it) => (
            <Campo key={it.letra} rotulo={`${it.letra} — ${it.descricao}`}>
              <AreaTexto rows={2} value={s.descricoes[it.letra] ?? ''} onChange={(e) => onChange({ ...s, descricoes: { ...s.descricoes, [it.letra]: e.target.value } })} />
            </Campo>
          ))}
        </div>
      );
    case 'pagamento':
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <Campo rotulo="Condição"><Entrada value={s.condicao} onChange={(e) => onChange({ ...s, condicao: e.target.value })} /></Campo>
            <Campo rotulo="Marco"><Entrada value={s.marco} onChange={(e) => onChange({ ...s, marco: e.target.value })} /></Campo>
            <Campo rotulo="Forma"><Entrada value={s.forma} onChange={(e) => onChange({ ...s, forma: e.target.value })} /></Campo>
          </div>
          <AreaTexto rows={4} value={s.texto} onChange={(e) => onChange({ ...s, texto: e.target.value })} />
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
