import { AbasModulo } from '@/shared/ui/AbasModulo';
import { ArrowRightFromLine, LayoutDashboard, Warehouse } from 'lucide-react';

// Abas do Almoxarifado (decisão 104). Recebimentos entra com o Compras v2 (ordens de compra por item).
const abas = [
  { to: '/almoxarifado', rotulo: 'Painel', icone: LayoutDashboard, end: true },
  { to: '/almoxarifado/estoque', rotulo: 'Estoque', icone: Warehouse },
  { to: '/almoxarifado/retiradas', rotulo: 'Retiradas', icone: ArrowRightFromLine },
];

export function AlmoxarifadoLayout() {
  return <AbasModulo abas={abas} />;
}
