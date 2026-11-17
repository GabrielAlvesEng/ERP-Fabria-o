import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

// Botão pequeno de copiar (decisão 138): copia o texto e mostra um "copiado" por 1,5 s.
export function BotaoCopiar({ texto, rotulo = 'Copiar' }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch { /* navegador sem permissão: o texto continua na tela para copiar à mão */ }
  }
  return (
    <button type="button" onClick={copiar} title={ok ? 'Copiado' : rotulo} aria-label={ok ? 'Copiado' : rotulo}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 align-middle text-xs transition ${ok ? 'text-emerald-600' : 'text-suave hover:bg-pagina hover:text-roxo-600'}`}>
      {ok ? <Check size={13} /> : <Copy size={13} />}{ok && 'copiado'}
    </button>
  );
}

// Valor para colar no app do banco: sem "R$" e sem ponto de milhar, com vírgula (ex.: 1234,56).
export const valorParaCopiar = (n: number) => (Math.round(Number(n) * 100) / 100).toFixed(2).replace('.', ',');
