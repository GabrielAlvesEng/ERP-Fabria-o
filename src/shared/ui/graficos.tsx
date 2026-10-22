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

export interface SerieLinha { id: string; rotulo: string; cor: string; valores: number[] }

// Gráfico de linhas (decisão 90): um eixo só, linhas de 2 px, marcadores de 8 px com anel da superfície,
// grade discreta, legenda acima e, ao passar o mouse, linha-guia com a dica de todos os valores daquele ponto.
// O texto usa as cores de texto; a cor da série fica só na linha e no quadradinho da legenda.
export function Linhas({ series, rotulosX, formatar, formatarEixo = formatar, altura = 220, inteiro = false }: {
  series: SerieLinha[]; rotulosX: string[]; formatar: (v: number) => string; formatarEixo?: (v: number) => string; altura?: number;
  inteiro?: boolean; // contagens: o topo vira múltiplo de 4, para as 4 faixas da grade caírem em números inteiros
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(560);
  const [ativo, setAtivo] = useState<number | null>(null);
  useEffect(() => {
    if (!caixa.current) return;
    const o = new ResizeObserver(([e]) => setLargura(Math.max(260, e.contentRect.width)));
    o.observe(caixa.current);
    return () => o.disconnect();
  }, []);
  const max = Math.max(0, ...series.flatMap((s) => s.valores));
  const topo = inteiro ? Math.ceil(topoRedondo(max) / 4) * 4 : topoRedondo(max);
  // Margem esquerda do tamanho do maior rótulo do eixo (~6 px por caractere a 10 px).
  const maiorRotulo = Math.max(...[0, 0.25, 0.5, 0.75, 1].map((k) => formatarEixo(k * topo).length));
  const m = { esq: maiorRotulo * 6 + 14, dir: 12, topo: 10, base: 26 };
  const w = largura - m.esq - m.dir;
  const h = altura - m.topo - m.base;
  const n = rotulosX.length;
  const x = (i: number) => m.esq + (n > 1 ? (i / (n - 1)) * w : w / 2);
  const y = (v: number) => m.topo + h - (v / topo) * h;
  const passos = [0, 0.25, 0.5, 0.75, 1].map((k) => k * topo);
  // Com muitos meses na tela estreita, mostra um rótulo sim, outro não.
  const pulo = w / n < 30 ? 2 : 1;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
        {series.map((s) => <span key={s.id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} />{s.rotulo}</span>)}
      </div>
      <div ref={caixa} className="relative w-full" onMouseLeave={() => setAtivo(null)}>
        <svg width={largura} height={altura} role="img" className="block max-w-full"
          aria-label={series.map((s) => `${s.rotulo}: ${s.valores.map((v, i) => `${rotulosX[i]} ${formatar(v)}`).join(', ')}`).join('. ')}
          onMouseMove={(e) => {
            const b = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - b.left - m.esq) / w) * (n - 1));
            setAtivo(Math.min(n - 1, Math.max(0, i)));
          }}>
          {passos.map((v) => (
            <g key={v}>
              <line x1={m.esq} x2={m.esq + w} y1={y(v)} y2={y(v)} className="stroke-slate-200 dark:stroke-marinho-600" strokeWidth={1} strokeDasharray={v ? '3 4' : undefined} />
              <text x={m.esq - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" className="fill-slate-500 text-[10px] dark:fill-slate-400">{formatarEixo(v)}</text>
            </g>
          ))}
          {rotulosX.map((r, i) => i % pulo === 0 && (
            <text key={r} x={x(i)} y={altura - 8} textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-400">{r}</text>
          ))}
          {ativo !== null && <line x1={x(ativo)} x2={x(ativo)} y1={m.topo} y2={m.topo + h} className="stroke-slate-300 dark:stroke-marinho-500" strokeWidth={1} />}
          {series.map((s) => (
            <g key={s.id}>
              <polyline fill="none" stroke={s.cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.valores.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
              {s.valores.map((v, i) => (v > 0 || ativo === i) && (
                <circle key={i} cx={x(i)} cy={y(v)} r={ativo === i ? 5 : 4} fill={s.cor} strokeWidth={2} className="stroke-superficie" />
              ))}
            </g>
          ))}
        </svg>
        {ativo !== null && (
          <div className="pointer-events-none absolute z-10 min-w-[160px] rounded-lg bg-superficie px-3 py-2 text-xs shadow-lg ring-1 ring-borda"
            style={{ left: Math.min(x(ativo) + 12, largura - 175), top: 4 }}>
            <div className="mb-1 font-semibold text-texto">{rotulosX[ativo]}</div>
            {series.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-suave"><span className="h-2 w-2 rounded-sm" style={{ background: s.cor }} />{s.rotulo}</span>
                <span className="font-medium tabular-nums text-texto">{formatar(s.valores[ativo])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function topoRedondo(max: number): number {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= max) return k * p;
  return 10 * p;
}
