import { Landmark, LayoutDashboard, ReceiptText } from 'lucide-react';
import { AbasModulo } from '@/shared/ui/AbasModulo';

// Abas do Financeiro (decisão 105). A conta abre dentro de Contas a pagar.
const abas = [
  { to: '/financeiro', rotulo: 'Painel', icone: LayoutDashboard, end: true },
  { to: '/financeiro/contas', rotulo: 'Contas a pagar', icone: ReceiptText },
  { to: '/financeiro/fornecedores', rotulo: 'Dados de pagamento', icone: Landmark },
];

export function FinanceiroLayout() {
  return <AbasModulo abas={abas} />;
}
