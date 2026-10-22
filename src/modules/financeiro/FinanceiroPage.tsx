import { Wallet } from 'lucide-react';
import { Cabecalho, Cartao } from '@/shared/ui';

// Módulo Financeiro (decisão 93): por enquanto só a entrada no menu e esta página.
// As funcionalidades entram depois do planejamento aprovado pelo Gabriel (CLAUDE.md).
export function FinanceiroPage() {
  return (
    <>
      <Cabecalho titulo="Financeiro" subtitulo="Contas a pagar e a receber, faturamento e fluxo de caixa." />
      <Cartao className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="rounded-full bg-roxo-50 p-3 text-roxo-600 dark:bg-roxo-500/20 dark:text-roxo-100"><Wallet size={28} /></span>
        <h2 className="text-lg font-semibold text-texto">Módulo em construção</h2>
        <p className="max-w-md text-sm text-suave">As telas do Financeiro serão adicionadas depois que o planejamento do módulo for aprovado.</p>
      </Cartao>
    </>
  );
}
