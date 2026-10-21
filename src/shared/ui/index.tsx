import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { CalendarDays, Check, ChevronDown, Paperclip, X } from 'lucide-react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';
// Botão do redesign (decisão 51): primary (roxo), secondary (branco com borda), ghost e danger; tamanhos md 36px e sm 30px.
const variantes: Record<Variante, string> = {
  primario: 'bg-roxo-500 text-white shadow-sm hover:bg-roxo-600 dark:hover:bg-roxo-400',
  secundario: 'bg-superficie text-texto shadow-sm ring-1 ring-borda hover:bg-pagina dark:hover:bg-marinho-700',
  perigo: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  fantasma: 'text-suave hover:bg-pagina hover:text-texto dark:hover:bg-marinho-700',
};
const tamanhos = { md: 'h-9 px-3.5 text-sm', sm: 'h-[30px] px-2.5 text-xs' } as const;

export function Botao({ variante = 'primario', tamanho = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: keyof typeof tamanhos }) {
  return (
    <button
      {...p}
      className={cx('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roxo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-superficie disabled:cursor-not-allowed disabled:opacity-50', tamanhos[tamanho], variantes[variante], className)}
    />
  );
}

const campoBase = 'w-full rounded-lg border border-slate-300 bg-superficie px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100 dark:border-marinho-500 dark:focus:border-roxo-300 dark:focus:ring-roxo-700/40';

export function Campo({ rotulo, erro, children, className }: { rotulo: string; erro?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{rotulo}</span>
      {children}
      {erro && <span className="mt-1 block text-xs text-red-600">{erro}</span>}
    </label>
  );
}

export const Entrada = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(campoBase, p.className)} />;
export const AreaTexto = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx(campoBase, p.className)} />;
// Select com seta própria (sem a seta padrão do navegador).
export function Selecao({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx('relative', className)}>
      <select {...p} className={cx(campoBase, 'cursor-pointer appearance-none pr-9 disabled:cursor-not-allowed disabled:opacity-60')} />
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

// Data: mostra sempre DD/MM/AAAA, guarda ISO (AAAA-MM-DD). O botão abre o calendário do navegador.
function isoParaBR(iso: string) {
  const [a, m, d] = (iso || '').split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
}
function brParaISO(br: string) {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m;
  const dt = new Date(Number(a), Number(mes) - 1, Number(d));
  return dt.getFullYear() === Number(a) && dt.getMonth() === Number(mes) - 1 && dt.getDate() === Number(d) ? `${a}-${mes}-${d}` : null;
}
function mascaraData(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
}

export function CampoData({ value, onChange, disabled, required, id }: { value: string | null | undefined; onChange: (iso: string) => void; disabled?: boolean; required?: boolean; id?: string }) {
  const [texto, setTexto] = useState(isoParaBR(value ?? ''));
  const [invalida, setInvalida] = useState(false);
  const nativo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTexto(isoParaBR(value ?? ''));
    setInvalida(false);
  }, [value]);

  function digitar(v: string) {
    const t = mascaraData(v);
    setTexto(t);
    if (!t) { setInvalida(false); onChange(''); return; }
    const iso = brParaISO(t);
    setInvalida(t.length === 10 && !iso);
    if (iso) onChange(iso);
  }

  function abrirCalendario() {
    const el = nativo.current;
    if (!el || disabled) return;
    try { el.showPicker(); } catch { el.focus(); }
  }

  return (
    <div className="relative">
      <input
        id={id}
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        value={texto}
        onChange={(e) => digitar(e.target.value)}
        onBlur={() => { if (texto && !brParaISO(texto)) setInvalida(true); }}
        disabled={disabled}
        required={required}
        className={cx(campoBase, 'pr-10 tabular-nums disabled:opacity-60', invalida && 'border-red-500 focus:border-red-500 focus:ring-red-100')}
      />
      <button type="button" onClick={abrirCalendario} disabled={disabled} aria-label="Abrir calendário"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-suave hover:bg-roxo-50 hover:text-roxo-600 disabled:opacity-40 dark:hover:bg-marinho-700">
        <CalendarDays size={16} />
      </button>
      <input ref={nativo} type="date" tabIndex={-1} aria-hidden value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0" />
      {invalida && <span className="mt-1 block text-xs text-red-600">Data inválida</span>}
    </div>
  );
}

// Checkbox personalizada.
export function Caixa({ marcado, onChange, children, disabled }: { marcado: boolean; onChange: (v: boolean) => void; children?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex cursor-pointer select-none items-center gap-2 text-sm', disabled && 'cursor-not-allowed opacity-60')}>
      <span className="relative inline-flex">
        <input type="checkbox" className="peer sr-only" checked={marcado} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-slate-300 bg-superficie transition peer-checked:border-roxo-500 peer-checked:bg-roxo-500 peer-focus-visible:ring-2 peer-focus-visible:ring-roxo-200 dark:border-marinho-500">
          <Check size={13} strokeWidth={3} className={cx('text-white transition', marcado ? 'scale-100 opacity-100' : 'scale-50 opacity-0')} />
        </span>
      </span>
      {children}
    </label>
  );
}

// Escolha de arquivo com botão no padrão do sistema.
export function CampoArquivo({ arquivo, onChange, accept }: { arquivo: File | null; onChange: (f: File | null) => void; accept?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm hover:border-roxo-500 dark:border-marinho-500">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-roxo-50 px-2.5 py-1 font-medium text-roxo-700 dark:bg-roxo-700/30 dark:text-roxo-100"><Paperclip size={14} /> Escolher arquivo</span>
      <span className="truncate text-suave">{arquivo ? arquivo.name : 'Nenhum arquivo selecionado'}</span>
      <input type="file" accept={accept} className="sr-only" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
  );
}

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  // Espaçamento padrão p-5, a não ser que a tela passe o próprio (p-0, p-4…).
  const temPadding = /(^|\s)p-\d/.test(className ?? '');
  return <div className={cx('rounded-xl bg-superficie shadow-sm ring-1 ring-borda', !temPadding && 'p-5', className)}>{children}</div>;
}

export function Selo({ children, cor = 'cinza' }: { children: ReactNode; cor?: 'cinza' | 'roxo' | 'verde' | 'vermelho' | 'amarelo' | 'azul' }) {
  const cores = {
    cinza: 'bg-slate-100 text-slate-700 dark:bg-marinho-700 dark:text-slate-200',
    roxo: 'bg-roxo-50 text-roxo-700 dark:bg-roxo-700/30 dark:text-roxo-100',
    verde: 'bg-petroleo-50 text-petroleo-600 dark:bg-petroleo-600/30 dark:text-teal-100',
    vermelho: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200',
    amarelo: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
    azul: 'bg-marinho-50 text-marinho-500 dark:bg-marinho-500/40 dark:text-slate-100',
  };
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', cores[cor])}>{children}</span>;
}

export function Modal({ aberto, titulo, onFechar, children, largura = 'max-w-lg' }: { aberto: boolean; titulo: string; onFechar: () => void; children: ReactNode; largura?: string }) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberto, onFechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-marinho-900/60 p-4 sm:p-10" onMouseDown={onFechar}>
      <div className={cx('w-full rounded-2xl bg-superficie shadow-xl', largura)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-borda px-5 py-3">
          <h2 className="font-semibold">{titulo}</h2>
          <button onClick={onFechar} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-marinho-700" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Aviso({ children, tipo = 'erro' }: { children: ReactNode; tipo?: 'erro' | 'info' }) {
  return (
    <div className={cx('rounded-lg px-3 py-2 text-sm', tipo === 'erro' ? 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200' : 'bg-marinho-50 text-texto dark:bg-marinho-700 dark:text-slate-100')}>
      {children}
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-suave">{children}</div>;
}

export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-texto">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 text-sm text-suave">{subtitulo}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{acoes}</div>
    </div>
  );
}

// Número no formato brasileiro (1.234,56). Mostra formatado; ao sair do campo, devolve o número.
// Número editável (célula ou formulário). Com `moeda`, mostra "R$ 1.234,56" fora da edição; ao editar, só o número.
export function CampoNumero({ valor, onConfirmar, casas = 2, disabled, className, alinhar = 'direita', moeda = false }: {
  valor: number; onConfirmar: (n: number) => void; casas?: number; disabled?: boolean; className?: string; alinhar?: 'direita' | 'esquerda'; moeda?: boolean;
}) {
  const fmt = (n: number) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: moeda ? 2 : 0, maximumFractionDigits: Math.max(casas, moeda ? 2 : 0) });
  const exibir = (n: number) => (moeda ? `R$ ${fmt(n)}` : fmt(n));
  const [texto, setTexto] = useState(exibir(valor));
  const [focado, setFocado] = useState(false);
  useEffect(() => { if (!focado) setTexto(exibir(valor)); }, [valor, focado, moeda]); // eslint-disable-line react-hooks/exhaustive-deps
  function confirmar() {
    setFocado(false);
    const t = texto.replace(/R\$/i, '').trim();
    const n = t === '' ? 0 : Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
    if (Number.isNaN(n)) { setTexto(exibir(valor)); return; }
    if (n !== Number(valor)) onConfirmar(n);
    setTexto(exibir(n));
  }
  return (
    <input
      inputMode="decimal"
      value={texto}
      disabled={disabled}
      onFocus={(e) => { setFocado(true); setTexto(fmt(valor)); const el = e.target; requestAnimationFrame(() => el.select()); }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className={cx('w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm tabular-nums outline-none hover:border-slate-300 focus:border-roxo-500 focus:bg-superficie disabled:hover:border-transparent dark:hover:border-marinho-500', alinhar === 'direita' && 'text-right', className)}
    />
  );
}

// Valor em reais nos formulários (texto livre, convertido depois com numeroBR): "R$ 1.234,56" fora da edição.
export function EntradaMoeda({ value, onChange, disabled, placeholder = 'R$ 0,00', className }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; className?: string;
}) {
  const [focado, setFocado] = useState(false);
  const formatar = (v: string) => {
    const t = v.replace(/R\$/i, '').trim();
    if (!t) return '';
    const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
    return Number.isNaN(n) ? v : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const mostrado = focado ? value.replace(/R\$/i, '').trim() : value.trim() ? `R$ ${formatar(value)}` : '';
  return (
    <input
      inputMode="decimal"
      value={mostrado}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={() => { setFocado(true); if (value.trim()) onChange(formatar(value)); }}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => { setFocado(false); onChange(formatar(value)); }}
      className={cx(campoBase, 'tabular-nums', className)}
    />
  );
}

// Texto editável em célula de tabela: salva ao sair do campo.
export function CampoCelula({ valor, onConfirmar, disabled, lista, placeholder }: { valor: string; onConfirmar: (v: string) => void; disabled?: boolean; lista?: string; placeholder?: string }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  return (
    <input
      value={texto}
      list={lista}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => { if (texto !== valor) onConfirmar(texto); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-roxo-500 focus:bg-superficie disabled:hover:border-transparent dark:hover:border-marinho-500"
    />
  );
}

export interface OpcaoEscolha { valor: string; detalhe?: string }

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Campo de escolha (decisão 41): a lista aparece logo abaixo da caixa, filtrando enquanto digita,
// e aceita texto livre que não está na lista. Salva ao escolher, ao apertar Enter ou ao sair do campo.
export function CampoEscolha({ valor, opcoes, onConfirmar, disabled, placeholder, celula = true }: {
  valor: string; opcoes: OpcaoEscolha[]; onConfirmar: (v: string) => void; disabled?: boolean; placeholder?: string; celula?: boolean;
}) {
  const [texto, setTexto] = useState(valor);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [ativo, setAtivo] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  // Último valor já gravado: ao clicar num item, o blur que vem logo depois não pode gravar o texto digitado por cima.
  const gravado = useRef(valor);
  const escolhido = useRef(false);
  useEffect(() => { setTexto(valor); gravado.current = valor; }, [valor]);
  // A lista é fixa na tela: ao rolar a página, acompanha o campo; fecha só se o campo sair da tela.
  const aberta = pos != null;
  useEffect(() => {
    if (!aberta) return;
    const seguir = (e: Event) => {
      if (listaRef.current?.contains(e.target as Node)) return;
      const r = ref.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return setPos(null);
      setPos(posicao(r));
    };
    window.addEventListener('scroll', seguir, true);
    return () => window.removeEventListener('scroll', seguir, true);
  }, [aberta]);

  const termo = semAcento(texto.trim());
  // Todas as palavras digitadas, em qualquer ordem ("allen m8 inox" acha "Parafuso Allen Cab. Cilíndrica M8 x 20 Inox 304").
  const palavras = termo.split(/\s+/).filter(Boolean);
  const filtradas = (termo && texto !== valor ? opcoes.filter((o) => { const t = semAcento(`${o.valor} ${o.detalhe ?? ''}`); return palavras.every((p) => t.includes(p)); }) : opcoes).slice(0, 60);

  const posicao = (r: DOMRect) => ({ top: Math.min(r.bottom + 2, window.innerHeight - 260), left: Math.min(r.left, window.innerWidth - Math.max(r.width, 280) - 8), width: Math.max(r.width, 280) });
  function abrir() {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos(posicao(r));
    setAtivo(0);
  }
  function confirmar(v: string) {
    setTexto(v);
    setPos(null);
    if (v !== gravado.current) { gravado.current = v; onConfirmar(v); }
    escolhido.current = true;
  }

  return (
    <>
      <input
        ref={ref}
        value={texto}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={abrir}
        onChange={(e) => { setTexto(e.target.value); if (!pos) abrir(); setAtivo(0); }}
        onBlur={(e) => {
          const t = e.currentTarget.value;
          if (escolhido.current) { escolhido.current = false; setPos(null); return; }
          setTimeout(() => { if (document.activeElement !== ref.current) { confirmar(t); escolhido.current = false; } }, 150);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(a + 1, filtradas.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); confirmar(pos && filtradas[ativo] && termo ? filtradas[ativo].valor : texto); ref.current?.blur(); }
          else if (e.key === 'Escape') { setTexto(valor); setPos(null); }
        }}
        className={celula
          ? 'w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-roxo-500 focus:bg-superficie disabled:hover:border-transparent dark:hover:border-marinho-500'
          : campoBase}
      />
      {pos && !disabled && filtradas.length > 0 && (
        <div ref={listaRef} style={{ top: pos.top, left: pos.left, width: pos.width }} className="fixed z-50 max-h-60 overflow-y-auto rounded-lg bg-superficie p-1 shadow-lg ring-1 ring-borda">
          {filtradas.map((o, i) => (
            <button key={o.valor} type="button" onMouseDown={(e) => { e.preventDefault(); confirmar(o.valor); ref.current?.blur(); }} onMouseEnter={() => setAtivo(i)}
              className={cx('flex w-full items-baseline justify-between gap-2 rounded px-2 py-1 text-left text-sm', i === ativo ? 'bg-roxo-50 text-roxo-700 dark:bg-roxo-700/30 dark:text-roxo-100' : 'hover:bg-pagina')}>
              <span className="truncate">{o.valor}</span>
              {o.detalhe && <span className="shrink-0 text-[11px] text-suave">{o.detalhe}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
