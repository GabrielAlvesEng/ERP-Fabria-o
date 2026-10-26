import { AbasModulo } from '@/shared/ui/AbasModulo';
import { FileText, LayoutDashboard, Package, Truck } from 'lucide-react';

// Abas do módulo Compras (decisões 101 e 103). A requisição abre dentro do Painel.
const abas = [
  { to: '/compras', rotulo: 'Painel', icone: LayoutDashboard, end: true },
  { to: '/compras/ordens', rotulo: 'Ordens de compra', icone: FileText },
  { to: '/compras/produtos', rotulo: 'Produtos', icone: Package },
  { to: '/compras/fornecedores', rotulo: 'Fornecedores', icone: Truck },
];

export function ComprasLayout() {
  return <AbasModulo abas={abas} />;
}
