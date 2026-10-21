import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { mensagemErro } from '@/shared/lib/formato';

// Chaves de cache da biblioteca e das predefinições (a aba Custos lê as mesmas).
export const CHAVES = {
  materiais: ['bib', 'materiais'], tipos: ['bib', 'tipos'], precosChapa: ['bib', 'precos_chapa'], chapas: ['bib', 'chapas'],
  perfis: ['bib', 'perfis'], pesos: ['bib', 'pesos'], itens: ['bib', 'itens'], fornecedores: ['bib', 'fornecedores'],
  servicos: ['bib', 'servicos'], fixadores: ['bib', 'fixadores'], revisar: ['bib', 'revisar'], maoObra: ['admin_mao_obra'], maquinas: ['admin_maquinas'],
} as const;

// Executa uma gravação, mostra o erro do banco (RLS, repetido, validação) e recarrega a biblioteca.
export function useGravar() {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  async function gravar(fn: () => Promise<void>): Promise<boolean> {
    setErro('');
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['bib'] });
      await qc.invalidateQueries({ queryKey: ['catalogo_materiais'] });
      await qc.invalidateQueries({ queryKey: ['ref_custos'] });
      await qc.invalidateQueries({ queryKey: ['admin_mao_obra'] });
      await qc.invalidateQueries({ queryKey: ['admin_maquinas'] });
      return true;
    } catch (e) {
      setErro(mensagemErro(e));
      return false;
    }
  }
  return { erro, setErro, gravar };
}

export function SubAbas<T extends string>({ abas, ativa, onTrocar }: { abas: readonly T[]; ativa: T; onTrocar: (a: T) => void }) {
  return (
    <div className="abas mb-4 gap-1 border-b border-borda">
      {abas.map((a) => (
        <button key={a} type="button" onClick={() => onTrocar(a)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${a === ativa ? 'border-roxo-500 font-semibold text-roxo-600 dark:text-roxo-100' : 'border-transparent text-suave hover:text-slate-800 dark:hover:text-slate-200'}`}>
          {a}
        </button>
      ))}
    </div>
  );
}

export const th = 'px-2 py-2 text-left text-xs font-semibold uppercase text-suave';
export const td = 'px-1 py-1 align-middle';
export const linha = (ativo = true) => `border-t border-borda ${ativo ? '' : 'text-slate-400'}`;

export function Tabela({ cabecalho, children }: { cabecalho: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
      <table className="w-full text-sm">
        <thead className="bg-pagina"><tr>{cabecalho}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// Caixa de número com borda para formulários (CampoNumero é de célula).
export const molduraNumero = 'rounded-lg border border-slate-300 bg-superficie dark:border-marinho-500';
