import { useRef, type ReactNode } from 'react';
import { Bold, List, ListOrdered, Underline } from 'lucide-react';

// Caixa de texto das propostas com barra de formatação (decisão 70). A formatação é a mesma marcação que o PDF lê:
// **negrito**, __sublinhado__, "- " lista e "1. " lista numerada. O limite (se houver) aparece como contador.
const VARIAVEIS = [['{cliente}', 'Cliente'], ['{local}', 'Local'], ['{codigo}', 'Código'], ['{validade_dias}', 'Validade']] as const;

export function TextoFormatado({ value, onChange, rows = 4, placeholder, limite, disabled }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; limite?: number; disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Aplica a mudança e devolve a seleção para o texto marcado.
  function trocar(novo: string, ini: number, fim: number) {
    onChange(limite ? novo.slice(0, limite) : novo);
    requestAnimationFrame(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange(ini, fim); } });
  }
  function envolver(marca: string) {
    const el = ref.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = value.slice(a, b) || 'texto';
    // Já marcado: tira a marca.
    if (value.slice(a - marca.length, a) === marca && value.slice(b, b + marca.length) === marca) {
      return trocar(value.slice(0, a - marca.length) + value.slice(a, b) + value.slice(b + marca.length), a - marca.length, b - marca.length);
    }
    trocar(value.slice(0, a) + marca + sel + marca + value.slice(b), a + marca.length, a + marca.length + sel.length);
  }
  function lista(numerada: boolean) {
    const el = ref.current; if (!el) return;
    const ini = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    const fimLinha = value.indexOf('\n', el.selectionEnd);
    const fim = fimLinha === -1 ? value.length : fimLinha;
    const linhas = value.slice(ini, fim).split('\n');
    const marcada = (l: string) => (numerada ? /^\d{1,2}[.)]\s+/ : /^[-•]\s+/).test(l);
    const tirar = linhas.every((l) => !l.trim() || marcada(l));
    let n = 0;
    const novas = linhas.map((l) => {
      const limpa = l.replace(/^([-•]|\d{1,2}[.)])\s+/, '');
      if (!l.trim()) return l;
      return tirar ? limpa : numerada ? `${++n}. ${limpa}` : `- ${limpa}`;
    }).join('\n');
    trocar(value.slice(0, ini) + novas + value.slice(fim), ini, ini + novas.length);
  }
  function inserir(t: string) {
    const el = ref.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    trocar(value.slice(0, a) + t + value.slice(b), a + t.length, a + t.length);
  }

  const passou = limite ? value.length > limite : false;
  return (
    <div className={`overflow-hidden rounded-lg border ${passou ? 'border-red-400' : 'border-slate-300 dark:border-marinho-500'} focus-within:border-roxo-500`}>
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-borda bg-pagina px-1.5 py-1">
          <Botao titulo="Negrito (Ctrl+B)" onClick={() => envolver('**')}><Bold size={14} /></Botao>
          <Botao titulo="Sublinhado (Ctrl+U)" onClick={() => envolver('__')}><Underline size={14} /></Botao>
          <span className="mx-1 h-4 w-px bg-borda" />
          <Botao titulo="Lista com marcadores" onClick={() => lista(false)}><List size={14} /></Botao>
          <Botao titulo="Lista numerada" onClick={() => lista(true)}><ListOrdered size={14} /></Botao>
          <span className="mx-1 h-4 w-px bg-borda" />
          {VARIAVEIS.map(([v, r]) => (
            <button key={v} type="button" onClick={() => inserir(v)} title={`Inserir ${v}`}
              className="rounded px-1.5 py-0.5 text-[11px] text-suave hover:bg-superficie hover:text-texto">{r}</button>
          ))}
          {limite && <span className={`ml-auto pr-1 text-[11px] tabular-nums ${passou ? 'font-semibold text-red-600' : 'text-suave'}`}>{value.length}/{limite}</span>}
        </div>
      )}
      <textarea ref={ref} rows={rows} value={value} placeholder={placeholder} disabled={disabled}
        className="block w-full resize-y bg-superficie px-3 py-2 text-sm text-texto outline-none placeholder:text-slate-400 disabled:opacity-60"
        onChange={(e) => onChange(limite && e.target.value.length > value.length ? e.target.value.slice(0, Math.max(limite, value.length)) : e.target.value)}
        onKeyDown={(e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          if (e.key.toLowerCase() === 'b') { e.preventDefault(); envolver('**'); }
          if (e.key.toLowerCase() === 'u') { e.preventDefault(); envolver('__'); }
        }} />
      {passou && <div className="bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:bg-red-900/30 dark:text-red-200">Passou do limite: o texto pode não caber na página. Reduza para {limite} caracteres.</div>}
    </div>
  );
}

function Botao({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" title={titulo} aria-label={titulo} onClick={onClick} className="rounded p-1 text-suave hover:bg-superficie hover:text-texto">{children}</button>;
}
