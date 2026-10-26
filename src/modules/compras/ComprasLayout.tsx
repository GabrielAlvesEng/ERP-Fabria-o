import { AbasModulo } from '@/shared/ui/AbasModulo';
import { FileText, Layers, Package, ShoppingCart, Truck } from 'lucide-react';

// Abas do módulo Compras (decisões 107 e 111). A requisição abre a partir do À comprar; o pacote, das Cotações.
const abas = [
  { to: '/compras', rotulo: 'À comprar', icone: ShoppingCart, end: true },
  { to: '/compras/cotacoes', rotulo: 'Cotações', icone: Layers },
  { to: '/compras/ordens', rotulo: 'Ordens de compra', icone: FileText },
  { to: '/compras/produtos', rotulo: 'Produtos', icone: Package },
  { to: '/compras/fornecedores', rotulo: 'Fornecedores', icone: Truck },
];

export function ComprasLayout() {
  return <AbasModulo abas={abas} />;
}
