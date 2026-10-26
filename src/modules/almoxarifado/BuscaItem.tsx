import { useState } from 'react';
import { Search } from 'lucide-react';
import { Entrada } from '@/shared/ui';
import { combina } from './regras';

export interface OpcaoBusca { id: string; titulo: string; detalhe?: string; desativada?: boolean }

// Busca com lista logo abaixo (produtos do cadastro ou itens do estoque). Escolher chama onEscolher e limpa o campo.
export function BuscaItem({ opcoes, onEscolher, placeholder, autoFocus }: {
  opcoes: OpcaoBusca[]; onEscolher: (id: string) => void; placeholder: string; autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState('');
  const [aberta, setAberta] = useState(false);
  const lista = texto.trim() ? opcoes.filter((o) => combina(`${o.titulo} ${o.detalhe ?? ''}`, texto)).slice(0, 40) : [];
  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-[11px] text-suave" />
      <Entrada value={texto} autoFocus={autoFocus} placeholder={placeholder} className="pl-9"
        onChange={(e) => { setTexto(e.target.value); setAberta(true); }} onFocus={() => setAberta(true)} onBlur={() => setTimeout(() => setAberta(false), 150)} />
      {aberta && texto.trim() && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg bg-superficie p-1 shadow-lg ring-1 ring-borda">
          {lista.length === 0 ? <div className="px-2 py-2 text-sm text-suave">Nada encontrado.</div> : lista.map((o) => (
            <button key={o.id} type="button" disabled={o.desativada} onMouseDown={(e) => { e.preventDefault(); onEscolher(o.id); setTexto(''); setAberta(false); }}
              className="flex w-full items-baseline justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-pagina disabled:cursor-not-allowed disabled:opacity-50">
              <span className="min-w-0 truncate">{o.titulo}</span>
              {o.detalhe && <span className="shrink-0 text-[11px] text-suave">{o.detalhe}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
