import { useMemo, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { NOME_STATUS, montarArvore, type Conjunto, type No, type Peca } from './regras';
import { COR_ICONE, COR_STATUS, ICONE_TIPO, codigoCurto } from './Arvore';

// Mapa da estrutura em cards (organograma), no estilo de quadro do Figma.
export function MapaView({ projetoCodigo, conjuntos, pecas, onAbrir }: { projetoCodigo: string; conjuntos: Conjunto[]; pecas: Peca[]; onAbrir: (id: string) => void }) {
  const raiz = useMemo(() => montarArvore(conjuntos), [conjuntos]);
  const [zoom, setZoom] = useState(1);
  const qtd = useMemo(() => {
    const m = new Map<string, number>();
    pecas.forEach((p) => m.set(p.conjunto_id, (m.get(p.conjunto_id) ?? 0) + 1));
    return m;
  }, [pecas]);

  const Card = ({ n }: { n: No }) => {
    const Icone = ICONE_TIPO[n.tipo];
    const cor = { geral: 'border-t-marinho-500', submontagem: 'border-t-roxo-500', conjunto: 'border-t-petroleo-500', soldado: 'border-t-amber-500' }[n.tipo];
    return (
      <button onClick={() => onAbrir(n.id)}
        className={`w-48 rounded-xl border-t-4 bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-roxo-500 dark:bg-marinho-800 dark:ring-marinho-600 ${cor}`}>
        <div className="flex items-center justify-between">
          <Icone size={15} className={COR_ICONE[n.tipo]} />
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><span className={`h-2 w-2 rounded-full ${COR_STATUS[n.status]}`} />{NOME_STATUS[n.status]}</span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-slate-500">{codigoCurto(n.codigo, projetoCodigo)}</div>
        <div className="line-clamp-2 text-sm font-semibold">{n.nome}</div>
        <div className="mt-1 flex gap-2 text-[10px] text-slate-500">
          {Number(n.quantidade) !== 1 && <span>×{Number(n.quantidade).toLocaleString('pt-BR')}</span>}
          <span>{qtd.get(n.id) ?? 0} peças</span>
          <span>{n.revisao}</span>
        </div>
      </button>
    );
  };

  const Ramo = ({ n }: { n: No }) => (
    <div className="flex flex-col items-center">
      <Card n={n} />
      {n.filhos.length > 0 && (
        <>
          <span className="h-5 border-l-2 border-slate-300 dark:border-marinho-500" />
          <div className="flex">
            {n.filhos.map((f, i) => (
              <div key={f.id} className="relative flex flex-col items-center px-3 pt-5">
                {/* linha horizontal ligando os irmãos e a descida até o card */}
                {n.filhos.length > 1 && (
                  <span className={`absolute top-0 border-t-2 border-slate-300 dark:border-marinho-500 ${i === 0 ? 'left-1/2 right-0' : i === n.filhos.length - 1 ? 'left-0 right-1/2' : 'left-0 right-0'}`} />
                )}
                <span className="absolute left-1/2 top-0 h-5 border-l-2 border-slate-300 dark:border-marinho-500" />
                <Ramo n={f} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  if (!raiz) return null;
  return (
    <div className="relative rounded-2xl bg-[radial-gradient(circle,_rgba(100,116,139,0.18)_1px,_transparent_1px)] [background-size:18px_18px] ring-1 ring-slate-200 dark:ring-marinho-700">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg bg-white p-1 text-sm shadow ring-1 ring-slate-200 dark:bg-marinho-800 dark:ring-marinho-600">
        <button onClick={() => setZoom(Math.max(0.4, zoom - 0.1))} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-marinho-700" aria-label="Diminuir zoom"><Minus size={14} /></button>
        <button onClick={() => setZoom(1)} className="w-12 text-center text-xs tabular-nums" title="Voltar a 100%">{Math.round(zoom * 100)}%</button>
        <button onClick={() => setZoom(Math.min(1.6, zoom + 0.1))} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-marinho-700" aria-label="Aumentar zoom"><Plus size={14} /></button>
        <button onClick={() => setZoom(1)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-marinho-700" aria-label="Restaurar"><RotateCcw size={13} /></button>
      </div>
      <div className="min-h-[420px] overflow-auto p-8">
        <div className="inline-block origin-top-left transition-transform" style={{ transform: `scale(${zoom})` }}>
          <Ramo n={raiz} />
        </div>
      </div>
    </div>
  );
}
