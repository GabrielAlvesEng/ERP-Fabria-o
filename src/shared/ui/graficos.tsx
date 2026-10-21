import { useEffect, useRef, useState } from 'react';

// Contagem animada dos cartões (redesign, decisão 51): sobe até o valor em ~600 ms; com
// "reduzir movimento" ligado no sistema, mostra o valor direto.
export function useContagem(alvo: number, duracao = 600): number {
  const [v, setV] = useState(alvo);
  const anterior = useRef(0);
  useEffect(() => {
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const de = anterior.current;
    anterior.current = alvo;
    if (reduzir || de === alvo) { setV(alvo); return; }
    let quadro = 0;
    const inicio = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracao);
      const suave = 1 - (1 - p) ** 3;
      setV(de + (alvo - de) * suave);
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, duracao]);
  return v;
}

export interface FatiaRosca { id: string; rotulo: string; valor: number; cor: string; detalhe?: string }

// Rosca de parte do todo (≤ 6 fatias), com 2 px de espaço entre as fatias, número total no centro e dica ao passar o mouse.
// As cores vêm de variáveis CSS (claro/escuro) passadas em `cor`; a legenda com números fica fora, ao lado (o texto nunca usa a cor da série).
export function Rosca({ fatias, total, rotuloTotal, tamanho = 200 }: { fatias: FatiaRosca[]; total: number; rotuloTotal: string; tamanho?: number }) {
  const [ativa, setAtiva] = useState<string | null>(null);
  const [dica, setDica] = useState<{ x: number; y: number; f: FatiaRosca } | null>(null);
  const r = 80, espessura = 22, c = 2 * Math.PI * r;
  const soma = fatias.reduce((s, f) => s + f.valor, 0);
  const visiveis = fatias.filter((f) => f.valor > 0);
  const vao = visiveis.length > 1 ? 2 : 0; // px de superfície entre fatias
  let acumulado = 0;
  return (
    <div className="relative" style={{ width: tamanho, height: tamanho }} onMouseLeave={() => { setAtiva(null); setDica(null); }}>
      <svg viewBox="0 0 200 200" width={tamanho} height={tamanho} role="img" aria-label={`${rotuloTotal}: ${total}. ${fatias.map((f) => `${f.rotulo} ${f.valor}`).join(', ')}`}>
        <circle cx="100" cy="100" r={r} fill="none" strokeWidth={espessura} className="stroke-slate-100 dark:stroke-marinho-700" />
        {soma > 0 && visiveis.map((f) => {
          const comp = (f.valor / soma) * c;
          const ini = acumulado;
          acumulado += comp;
          return (
            <circle key={f.id} cx="100" cy="100" r={r} fill="none" stroke={f.cor} strokeWidth={ativa === f.id ? espessura + 4 : espessura}
              strokeDasharray={`${Math.max(comp - vao, 0.001)} ${c}`} strokeDashoffset={-ini} transform="rotate(-90 100 100)"
              className="cursor-default transition-[stroke-width] duration-150"
              onMouseMove={(e) => { const b = e.currentTarget.ownerSVGElement!.getBoundingClientRect(); setAtiva(f.id); setDica({ x: e.clientX - b.left, y: e.clientY - b.top, f }); }} />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums text-texto">{total}</span>
        <span className="text-xs text-suave">{rotuloTotal}</span>
      </div>
      {dica && (
        <div className="pointer-events-none absolute z-10 min-w-[150px] -translate-x-1/2 -translate-y-full rounded-lg bg-superficie px-3 py-2 text-xs shadow-lg ring-1 ring-borda"
          style={{ left: dica.x, top: dica.y - 10 }}>
          <div className="flex items-center gap-1.5 font-semibold text-texto"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: dica.f.cor }} />{dica.f.rotulo}</div>
          <div className="mt-0.5 tabular-nums text-suave">{dica.f.valor} · {soma ? Math.round((dica.f.valor / soma) * 100) : 0}%</div>
          {dica.f.detalhe && <div className="tabular-nums text-suave">{dica.f.detalhe}</div>}
        </div>
      )}
    </div>
  );
}
