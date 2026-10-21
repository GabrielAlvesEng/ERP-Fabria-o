import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { AreaTexto, Botao, Caixa, Campo, Entrada, Selecao } from '@/shared/ui';
import { numerar, type Cartao, type Documento, type Marca3, type Secao } from './modelo';

// Editor das seções do documento (decisão 61): usado na aba Documentos da proposta e em Administração → Modelos de proposta.
export function EditorDocumento({ doc, onChange, editavel, itens = [] }: {
  doc: Documento; onChange: (d: Documento) => void; editavel: boolean; itens?: { letra: string; descricao: string }[];
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
        <div className="mb-2 text-sm font-semibold">Capa</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo rotulo="Título · 1ª linha (assunto)"><Entrada value={doc.capa.linha1} onChange={(e) => onChange({ ...doc, capa: { ...doc.capa, linha1: e.target.value } })} placeholder="Ex.: Vedação Pneumática" /></Campo>
          <Campo rotulo="Título · 2ª linha (equipamento)"><Entrada value={doc.capa.linha2} onChange={(e) => onChange({ ...doc, capa: { ...doc.capa, linha2: e.target.value } })} placeholder="Ex.: Rosca MP" /></Campo>
          <Campo rotulo="Subtítulo" className="sm:col-span-2"><AreaTexto rows={2} value={doc.capa.subtitulo} onChange={(e) => onChange({ ...doc, capa: { ...doc.capa, subtitulo: e.target.value } })} placeholder="Ex.: Fornecimento, fabricação e instalação de novo cabeçote removível…" /></Campo>
          {doc.tipo === 'tecnica' ? (
            <>
              <Campo rotulo="Objeto"><Entrada value={doc.visao.objeto} onChange={(e) => onChange({ ...doc, visao: { ...doc.visao, objeto: e.target.value } })} placeholder="Ex.: Cabeçote removível" /></Campo>
              <Campo rotulo="Solução"><Entrada value={doc.visao.solucao} onChange={(e) => onChange({ ...doc, visao: { ...doc.visao, solucao: e.target.value } })} placeholder="Ex.: Vedação pneumática" /></Campo>
              <Campo rotulo="Unidade (vazio = cliente · cidade)" className="sm:col-span-2"><Entrada value={doc.visao.unidade} onChange={(e) => onChange({ ...doc, visao: { ...doc.visao, unidade: e.target.value } })} /></Campo>
            </>
          ) : (
            <Campo rotulo="Abertura (abaixo de “Olá, contato”)" className="sm:col-span-2"><AreaTexto rows={3} value={doc.abertura} onChange={(e) => onChange({ ...doc, abertura: e.target.value })} /></Campo>
          )}
        </div>
      </div>
      <p className="text-xs text-suave">Nos textos: linha em branco separa parágrafos, “- ” no começo da linha faz lista, **texto** fica em negrito. {'{cliente}'}, {'{local}'} e {'{validade_dias}'} viram os dados da proposta.</p>
      {doc.secoes.map((s, i) => (
        <div key={s.id} className={`rounded-xl ring-1 ring-borda ${s.ativo ? 'bg-superficie' : 'bg-pagina opacity-70'}`}>
          <div className="flex items-center gap-2 px-3 py-2">
            <Caixa marcado={s.ativo} onChange={(ativo) => setSecao(i, { ...s, ativo })} />
            <span className="w-6 text-xs font-semibold text-roxo-600 dark:text-roxo-100">{numeros[s.id] ?? '—'}</span>
            <input value={s.titulo} onChange={(e) => setSecao(i, { ...s, titulo: e.target.value })}
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold outline-none hover:border-borda focus:border-roxo-500" />
            <button type="button" onClick={() => mover(i, -1)} className="rounded p-1 text-suave hover:text-texto" title="Subir"><ChevronUp size={15} /></button>
            <button type="button" onClick={() => mover(i, 1)} className="rounded p-1 text-suave hover:text-texto" title="Descer"><ChevronDown size={15} /></button>
            <button type="button" onClick={() => setAberta(aberta === s.id ? null : s.id)} className="rounded px-2 py-0.5 text-xs text-roxo-600 hover:bg-roxo-50 dark:text-roxo-100 dark:hover:bg-marinho-700">
              {aberta === s.id ? 'Fechar' : 'Editar'}
            </button>
          </div>
          {aberta === s.id && <div className="border-t border-borda p-3"><CorpoSecao s={s} onChange={(n) => setSecao(i, n)} itens={itens} /></div>}
        </div>
      ))}
    </fieldset>
  );
}

function CorpoSecao({ s, onChange, itens }: { s: Secao; onChange: (s: Secao) => void; itens: { letra: string; descricao: string }[] }) {
  switch (s.tipo) {
    case 'texto':
      return <AreaTexto rows={Math.min(18, Math.max(5, s.texto.split('\n').length + 2))} value={s.texto} placeholder={s.dica} onChange={(e) => onChange({ ...s, texto: e.target.value })} />;
    case 'cartoes': {
      const setCartao = (i: number, c: Cartao) => onChange({ ...s, cartoes: s.cartoes.map((x, j) => (j === i ? c : x)) });
      return (
        <div className="space-y-2">
          <Campo rotulo="Introdução"><AreaTexto rows={3} value={s.intro} onChange={(e) => onChange({ ...s, intro: e.target.value })} /></Campo>
          {s.destaque !== undefined && <Campo rotulo="Destaque"><AreaTexto rows={2} value={s.destaque} onChange={(e) => onChange({ ...s, destaque: e.target.value })} /></Campo>}
          {s.cartoes.map((c, i) => (
            <div key={i} className="space-y-1 rounded-lg bg-pagina p-2 ring-1 ring-borda">
              <div className="flex items-center gap-2">
                <span className="w-6 text-center text-xs font-bold text-roxo-600">{s.marcador === 'letra' ? String.fromCharCode(65 + i) : i + 1}</span>
                <Entrada value={c.titulo} onChange={(e) => setCartao(i, { ...c, titulo: e.target.value })} placeholder="Título" />
                <button type="button" onClick={() => onChange({ ...s, cartoes: s.cartoes.filter((_, j) => j !== i) })} className="rounded p-1 text-suave hover:text-red-600" title="Remover"><Trash2 size={14} /></button>
              </div>
              <AreaTexto rows={3} value={c.texto} onChange={(e) => setCartao(i, { ...c, texto: e.target.value })} placeholder="Descrição" />
            </div>
          ))}
          <Botao type="button" variante="secundario" tamanho="sm" onClick={() => onChange({ ...s, cartoes: [...s.cartoes, { titulo: '', texto: '' }] })}><Plus size={14} /> Adicionar cartão</Botao>
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
