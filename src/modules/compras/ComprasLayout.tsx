import { AbasModulo } from '@/shared/ui/AbasModulo';
import { FileText, LayoutDashboard, Truck } from 'lucide-react';

// Abas do módulo Compras (decisão 101). A requisição abre dentro do Painel.
const abas = [
  { to: '/compras', rotulo: 'Painel', icone: LayoutDashboard, end: true },
  { to: '/compras/ordens', rotulo: 'Ordens de compra', icone: FileText },
  { to: '/compras/fornecedores', rotulo: 'Fornecedores', icone: Truck },
];

export function ComprasLayout() {
  return <AbasModulo abas={abas} />;
}
