import { Children, Fragment, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

// Select do ERP com lista própria (cores, bordas e cantos do site, nos temas claro e escuro).
// Mesmo jeito de usar de um <select>: value, onChange(e => e.target.value) e <option>/<optgroup> como filhos.
interface Opcao { valor: string; rotulo: string; desabilitada: boolean; grupo?: string }

const texto = (n: ReactNode): string => {
  if (n === null || n === undefined || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(texto).join('');
  if (isValidElement<{ children?: ReactNode }>(n)) return texto(n.props.children);
  return '';
};

function lerOpcoes(filhos: ReactNode, grupo?: string, saida: Opcao[] = []): Opcao[] {
  Children.forEach(filhos, (f) => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean; label?: string }>(f)) return;
    if (f.type === Fragment) lerOpcoes(f.props.children, grupo, saida);
    else if (f.type === 'optgroup') lerOpcoes(f.props.children, f.props.label, saida);
    else if (f.type === 'option') {
      const rotulo = texto(f.props.children);
      saida.push({ valor: f.props.value !== undefined ? String(f.props.value) : rotulo, rotulo, desabilitada: Boolean(f.props.disabled), grupo });
    }
  });
  return saida;
}

const base = 'w-full rounded-lg border border-slate-300 bg-superficie px-3 py-2 text-sm outline-none transition-colors duration-150 hover:border-roxo-300 focus-visible:border-roxo-500 focus-visible:ring-2 focus-visible:ring-roxo-100 dark:border-marinho-500 dark:hover:border-roxo-300/70 dark:focus-visible:border-roxo-300 dark:focus-visible:ring-roxo-700/40';
const compactoBase = 'w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-sm outline-none hover:border-slate-300 focus-visible:border-roxo-500 dark:hover:border-marinho-500';

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  compacto?: boolean; // dentro de tabelas: sem borda até passar o mouse
};

export function Selecao({ className, value, onChange, disabled, children, compacto, id, title, 'aria-label': ariaLabel }: Props) {
  const opcoes = useMemo(() => lerOpcoes(children), [children]);
  const atual = String(value ?? '');
  const escolhida = opcoes.find((o) => o.valor === atual);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [busca, setBusca] = useState('');
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; max: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const digitado = useRef({ texto: '', ate: 0 });
  const listaId = useId();
  const comBusca = opcoes.length > 10;
  const visiveis = useMemo(() => {
    const termos = busca.toLowerCase().split(/\s+/).filter(Boolean);
    return termos.length ? opcoes.filter((o) => termos.every((t) => o.rotulo.toLowerCase().includes(t))) : opcoes;
  }, [opcoes, busca]);

  const posicionar = () => {
    const r = botao.current?.getBoundingClientRect();
    if (!r) return;
    const baixo = window.innerHeight - r.bottom - 8;
    const cima = r.top - 8;
    const largura = Math.max(r.width, 180);
    const left = Math.min(r.left, window.innerWidth - largura - 8);
    if (baixo < 220 && cima > baixo) setPos({ left, width: largura, bottom: window.innerHeight - r.top + 4, max: Math.min(320, cima) });
    else setPos({ left, width: largura, top: r.bottom + 4, max: Math.min(320, baixo) });
  };

  const abrir = () => {
    if (disabled) return;
    setBusca('');
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.valor === atual)));
    posicionar();
    setAberto(true);
  };
  const fechar = (focar = true) => { setAberto(false); if (focar) botao.current?.focus(); };
  const escolher = (o: Opcao | undefined) => {
    if (!o || o.desabilitada) return;
    if (o.valor !== atual) onChange?.({ target: { value: o.valor }, currentTarget: { value: o.valor } } as unknown as ChangeEvent<HTMLSelectElement>);
    fechar();
  };

  useLayoutEffect(() => {
    if (!aberto) return;
    lista.current?.querySelector<HTMLElement>(`[data-i="${ativo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [aberto, ativo]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!botao.current?.contains(alvo) && !lista.current?.contains(alvo)) fechar(false);
    };
    const rolou = (e: Event) => { if (!lista.current?.contains(e.target as Node)) posicionar(); };
    document.addEventListener('mousedown', fora);
    window.addEventListener('scroll', rolou, true);
    window.addEventListener('resize', posicionar);
    return () => { document.removeEventListener('mousedown', fora); window.removeEventListener('scroll', rolou, true); window.removeEventListener('resize', posicionar); };
  }, [aberto]);

  const mover = (d: number) => {
    if (!visiveis.length) return;
    let i = ativo;
    for (let k = 0; k < visiveis.length; k++) {
      i = (i + d + visiveis.length) % visiveis.length;
      if (!visiveis[i].desabilitada) break;
    }
    setAtivo(i);
  };
  const tecla = (e: KeyboardEvent) => {
    if (!aberto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir(); return; }
      // Digitar com a lista fechada escolhe pela letra inicial, como no select comum.
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        const agora = Date.now();
        digitado.current = { texto: (agora < digitado.current.ate ? digitado.current.texto : '') + e.key.toLowerCase(), ate: agora + 700 };
        const o = opcoes.find((x) => !x.desabilitada && x.rotulo.toLowerCase().startsWith(digitado.current.texto));
        if (o && o.valor !== atual) onChange?.({ target: { value: o.valor }, currentTarget: { value: o.valor } } as unknown as ChangeEvent<HTMLSelectElement>);
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); mover(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
    else if (e.key === 'Home') { e.preventDefault(); setAtivo(0); }
    else if (e.key === 'End') { e.preventDefault(); setAtivo(visiveis.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(visiveis[ativo]); }
    else if (e.key === 'Tab') fechar(false);
  };

  const vazio = !escolhida || escolhida.valor === '';
  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      <button
        ref={botao} id={id} type="button" title={title} aria-label={ariaLabel} disabled={disabled}
        role="combobox" aria-haspopup="listbox" aria-expanded={aberto} aria-controls={listaId}
        onClick={() => (aberto ? fechar() : abrir())} onKeyDown={tecla}
        className={[compacto ? compactoBase : base, 'flex cursor-pointer items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60', aberto && !compacto ? 'border-roxo-500 ring-2 ring-roxo-100 dark:border-roxo-300 dark:ring-roxo-700/40' : ''].join(' ')}
      >
        <span className={`min-w-0 flex-1 truncate ${vazio ? 'text-suave' : ''}`}>{escolhida?.rotulo ?? atual}</span>
        <ChevronDown size={compacto ? 14 : 16} className={`shrink-0 text-slate-400 transition-transform duration-150 ${aberto ? 'rotate-180 text-roxo-500 dark:text-roxo-300' : ''}`} />
      </button>
      {aberto && pos && createPortal(
        <div
          ref={lista} onKeyDown={tecla}
          style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.max }}
          className="z-[80] flex flex-col overflow-hidden rounded-xl bg-superficie p-1 text-sm shadow-lg ring-1 ring-borda animate-[aparecer_120ms_ease-out] dark:shadow-black/50"
        >
          {comBusca && (
            <div className="relative mb-1 shrink-0">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-suave" />
              <input autoFocus value={busca} onChange={(e) => { setBusca(e.target.value); setAtivo(0); }} placeholder="Buscar…"
                className="w-full rounded-lg border border-borda bg-pagina py-1.5 pl-8 pr-2 text-sm outline-none focus:border-roxo-500 dark:focus:border-roxo-300" />
            </div>
          )}
          <div id={listaId} role="listbox" className="min-h-0 overflow-y-auto overscroll-contain">
            {visiveis.length === 0 && <div className="px-3 py-2 text-suave">Nada encontrado.</div>}
            {visiveis.map((o, i) => {
              const sel = o.valor === atual;
              const grupoNovo = o.grupo && o.grupo !== visiveis[i - 1]?.grupo;
              return (
                <div key={`${o.grupo ?? ''}|${o.valor}|${i}`}>
                  {grupoNovo && <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-suave">{o.grupo}</div>}
                  <div
                    data-i={i} role="option" aria-selected={sel} aria-disabled={o.desabilitada}
                    onMouseEnter={() => setAtivo(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(o)}
                    className={[
                      'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5',
                      o.desabilitada ? 'cursor-not-allowed opacity-40' : i === ativo ? 'bg-roxo-50 dark:bg-marinho-700' : '',
                      sel ? 'font-semibold text-roxo-600 dark:text-roxo-200' : '',
                    ].join(' ')}
                  >
                    <span className={`min-w-0 flex-1 truncate ${o.valor === '' && !sel ? 'text-suave' : ''}`}>{o.rotulo || ' '}</span>
                    {sel && <Check size={14} className="shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
