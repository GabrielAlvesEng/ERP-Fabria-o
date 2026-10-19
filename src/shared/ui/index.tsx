import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma';
const variantes: Record<Variante, string> = {
  primario: 'bg-roxo-500 text-white hover:bg-roxo-600',
  secundario: 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-marinho-700 dark:text-slate-100 dark:ring-marinho-500',
  perigo: 'bg-red-600 text-white hover:bg-red-700',
  fantasma: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-marinho-700',
};

export function Botao({ variante = 'primario', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...p}
      className={cx('inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50', variantes[variante], className)}
    />
  );
}

const campoBase = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-roxo-500 focus:ring-2 focus:ring-roxo-100 dark:border-marinho-500 dark:bg-marinho-800 dark:focus:ring-roxo-700/40';

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
export const Selecao = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(campoBase, p.className)} />;

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-marinho-800 dark:ring-marinho-700', className)}>{children}</div>;
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
      <div className={cx('w-full rounded-2xl bg-white shadow-xl dark:bg-marinho-800', largura)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-marinho-700">
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
    <div className={cx('rounded-lg px-3 py-2 text-sm', tipo === 'erro' ? 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200' : 'bg-marinho-50 text-marinho-700 dark:bg-marinho-700 dark:text-slate-100')}>
      {children}
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-marinho-700 dark:text-white">{titulo}</h1>
        {subtitulo && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitulo}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{acoes}</div>
    </div>
  );
}
