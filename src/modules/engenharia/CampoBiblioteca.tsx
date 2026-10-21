import { Check, Sparkles, X } from 'lucide-react';
import { CampoEscolha, type OpcaoEscolha } from '@/shared/ui';
import { sugerirItem, tipoDaPeca, type RefsEng, type TipoBib } from './biblioteca';
import type { Peca } from './regras';

// Item da Biblioteca de Materiais da peça (decisão 53): mostra o item confirmado, ou a sugestão do ERP para aceitar,
// ou a lista para escolher. Escolher ou aceitar grava bib_tipo, bib_id e bib_confirmado.
export function CampoBiblioteca({ peca: p, refs, editavel, onSalvar }: {
  peca: Peca; refs: RefsEng; editavel: boolean; onSalvar: (d: Partial<Peca>) => void;
}) {
  // Tipo da lista: o do item ligado, o da peça, ou todos (peça sem pista de tipo).
  const tipo: TipoBib | null = (p.bib_tipo as TipoBib | null) ?? tipoDaPeca(p);
  const atual = p.bib_id ? descricaoDoItem(refs, p.bib_tipo as TipoBib, p.bib_id) : null;
  const sugestao = !p.bib_id ? sugerirItem(p, refs) : null;
  const lista = opcoes(refs, tipo, p.cod_mat);

  function escolher(v: string) {
    if (!v.trim()) return onSalvar({ bib_tipo: null, bib_id: null, bib_confirmado: false });
    const achado = lista.find((o) => o.valor === v);
    if (achado) onSalvar({ bib_tipo: achado.tipo, bib_id: achado.id, bib_confirmado: true });
  }

  return (
    <div className="min-w-[220px]">
      <div className="flex items-center gap-1">
        {atual && <Check size={13} className="shrink-0 text-petroleo-500" aria-label="Item confirmado" />}
        <div className="min-w-0 flex-1">
          <CampoEscolha valor={atual ?? ''} opcoes={lista} disabled={!editavel} placeholder={editavel ? 'Escolher na biblioteca' : '—'} onConfirmar={escolher} />
        </div>
        {editavel && atual && (
          <button type="button" title="Tirar o item da biblioteca" onClick={() => onSalvar({ bib_tipo: null, bib_id: null, bib_confirmado: false })}
            className="shrink-0 rounded p-0.5 text-slate-300 hover:text-red-600"><X size={13} /></button>
        )}
      </div>
      {sugestao && (
        <button type="button" disabled={!editavel} onClick={() => onSalvar({ bib_tipo: sugestao.tipo, bib_id: sugestao.id, bib_confirmado: true })}
          title="Sugestão do ERP pelo material, espessura ou descrição. Clique para confirmar."
          className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-md bg-roxo-50 px-1.5 py-0.5 text-left text-[11px] text-roxo-700 hover:bg-roxo-100 disabled:cursor-default dark:bg-roxo-500/15 dark:text-roxo-100">
          <Sparkles size={11} className="shrink-0" /><span className="truncate">{sugestao.descricao}</span>{editavel && <span className="shrink-0 font-semibold">· aceitar</span>}
        </button>
      )}
    </div>
  );
}

type Opcao = OpcaoEscolha & { id: string; tipo: TipoBib };

function opcoes(refs: RefsEng, tipo: TipoBib | null, codMat: string | null): Opcao[] {
  if (tipo === null) return [...opcoes(refs, 'item', codMat), ...opcoes(refs, 'perfil', codMat), ...opcoes(refs, 'chapa', codMat)];
  const primeiro = <T extends { cod_mat: string | null }>(l: T[]) => (codMat ? [...l.filter((x) => x.cod_mat === codMat), ...l.filter((x) => x.cod_mat !== codMat)] : l);
  if (tipo === 'chapa') return primeiro(refs.chapas).map((c) => ({ id: c.id, tipo: 'chapa' as const, valor: c.descricao, detalhe: `${Number(c.peso_kg).toLocaleString('pt-BR')} kg` }));
  if (tipo === 'perfil') return primeiro(refs.perfis).map((x) => ({ id: x.id, tipo: 'perfil' as const, valor: x.descricao, detalhe: x.kg_m ? `${Number(x.kg_m).toLocaleString('pt-BR')} kg/m` : undefined }));
  return refs.itens.map((x) => ({ id: x.id, tipo: 'item' as const, valor: x.descricao, detalhe: x.grupo }));
}

export function descricaoDoItem(refs: RefsEng, tipo: TipoBib | null | undefined, id: string): string | null {
  const lista: { id: string; descricao: string }[] = tipo === 'chapa' ? refs.chapas : tipo === 'perfil' ? refs.perfis : refs.itens;
  return lista.find((x) => x.id === id)?.descricao ?? null;
}
