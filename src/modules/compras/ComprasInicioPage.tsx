import { ShoppingCart } from 'lucide-react';
import { Cabecalho } from '@/shared/ui';

// Página provisória: o módulo existe no menu, mas as funcionalidades só vêm com o planejamento aprovado (CLAUDE.md).
export function ComprasInicioPage() {
  return (
    <>
      <Cabecalho titulo="Compras" subtitulo="Cotações, pedidos de compra e fornecedores." />
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="rounded-full bg-roxo-50 p-4 text-roxo-600 dark:bg-roxo-500/20 dark:text-roxo-100"><ShoppingCart size={28} /></span>
        <div className="text-base font-semibold text-texto">Módulo em construção</div>
        <p className="max-w-md text-sm text-suave">As telas de Compras serão liberadas aqui assim que o planejamento do módulo for aprovado.</p>
      </div>
    </>
  );
}
