import { useEffect, useId, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

// Preloader do ERP: o símbolo da Fabriaço "enche" de baixo para cima com as próprias cores (roxo e grafite; no
// tema escuro, lilás e branco). O mesmo desenho está no index.html, para aparecer antes do JavaScript carregar.
const BARRA = 'M4.8 233.5L3.8 233.7L2.8 233.0L2.5 230.4L2.5 143.9L3.1 136.4L5.3 129.9L7.9 124.9L10.2 121.4L13.4 117.4L16.3 114.7L20.3 111.4L23.5 109.4L30.3 106.3L55.8 98.2L143.9 71.9L155.3 68.2L314.8 21.2L377.8 3.2L382.8 2.1L385.3 2.0L388.8 2.2L392.3 3.1L397.3 5.9L399.4 7.9L400.9 9.9L402.0 12.4L403.1 17.4L403.0 105.4L401.9 110.9L400.1 114.4L396.9 117.9L393.3 120.5L389.3 121.9L386.8 122.3L363.8 128.8L328.3 138.2L316.3 141.9L285.3 150.3L223.5 167.9L214.3 170.2L111.8 199.3L63.3 214.3L4.8 233.5ZM134.8 442.0L133.3 442.2L132.3 441.9L131.8 440.9L131.7 437.4L131.8 297.4L132.2 291.9L134.3 285.4L138.4 278.4L141.8 274.5L145.4 271.4L148.3 269.5L156.3 266.4L158.8 265.9L182.3 258.3L234.3 242.3L363.3 203.3L368.8 202.5L373.8 203.2L377.3 204.7L380.8 207.4L382.4 209.4L383.9 211.9L384.9 214.9L385.1 216.4L385.1 303.9L384.9 305.9L383.7 309.4L382.0 312.4L380.3 314.4L377.3 316.6L374.8 317.9L275.9 346.4L203.3 368.5L202.3 369.4L202.1 370.9L202.0 411.4L200.5 415.4L198.4 418.4L195.8 420.8L193.8 421.9L134.8 442.0Z';
const PONTA = 'M109.8 340.0L107.8 340.1L105.8 339.2L22.8 289.2L9.7 280.9L7.2 278.4L4.5 274.9L3.3 272.4L2.2 268.4L2.0 264.9L2.3 262.4L3.4 258.9L5.8 254.9L8.3 252.5L10.8 250.8L16.8 248.3L106.8 221.2L109.8 220.9L112.2 221.9L113.4 223.9L113.8 226.9L113.8 332.9L113.6 335.4L113.0 337.4L111.8 338.9L109.8 340.0Z';
const ALTURA = 444.2;

export function SimboloCarregando({ tamanho = 56 }: { tamanho?: number }) {
  const id = `enche-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox={`0 0 405.1 ${ALTURA}`} width={tamanho} height={tamanho * (ALTURA / 405.1)} role="img" aria-label="Carregando" className="carregando-simbolo">
      <defs>
        <clipPath id={id}>
          <rect x="0" width="405.1" y={ALTURA} height="0">
            <animate attributeName="y" values={`${ALTURA};0;0;${ALTURA}`} keyTimes="0;0.7;0.9;1" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="height" values={`0;${ALTURA};${ALTURA};0`} keyTimes="0;0.7;0.9;1" dur="1.8s" repeatCount="indefinite" />
          </rect>
        </clipPath>
      </defs>
      <path d={BARRA} className="fill-roxo-500 opacity-[0.14] dark:fill-[#8B63E7]" />
      <path d={PONTA} className="fill-marinho-900 opacity-[0.14] dark:fill-white" />
      <g clipPath={`url(#${id})`}>
        <path d={BARRA} className="fill-roxo-500 dark:fill-[#8B63E7]" />
        <path d={PONTA} className="fill-marinho-900 dark:fill-white" />
      </g>
    </svg>
  );
}

// Carregamento dentro de uma tela ou componente.
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-suave" role="status">
      <SimboloCarregando tamanho={34} />
      <span>{texto}</span>
    </div>
  );
}

// Barra fina no topo enquanto o ERP busca ou grava dados (aparece só se demorar mais que 250 ms).
export function BarraCarregamento() {
  const ocupado = useIsFetching() + useIsMutating() > 0;
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    if (!ocupado) { setVisivel(false); return; }
    const t = setTimeout(() => setVisivel(true), 250);
    return () => clearTimeout(t);
  }, [ocupado]);
  return (
    <div aria-hidden className={`pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden transition-opacity duration-300 ${visivel ? 'opacity-100' : 'opacity-0'}`}>
      <div className="barra-carregando h-full w-1/3 rounded-full bg-gradient-to-r from-roxo-300 via-roxo-500 to-petroleo-500" />
    </div>
  );
}

// Tira o preloader da primeira carga (index.html) com um esmaecer, depois de no mínimo 2 s na tela.
const MINIMO_PRELOADER = 2000;
export function esconderPreloader() {
  const el = document.getElementById('preloader');
  if (!el || el.dataset.saindo) return;
  el.dataset.saindo = '1';
  const inicio = (window as { __inicioPreloader?: number }).__inicioPreloader ?? Date.now();
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 350);
  }, Math.max(0, MINIMO_PRELOADER - (Date.now() - inicio)));
}
