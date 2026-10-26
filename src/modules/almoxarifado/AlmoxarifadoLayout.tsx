import { AbasModulo } from '@/shared/ui/AbasModulo';
import { ArrowRightFromLine, ClipboardList, LayoutDashboard, PackageCheck, Warehouse } from 'lucide-react';

// Abas do Almoxarifado (decisões 104, 108 e 110).
const abas = [
  { to: '/almoxarifado', rotulo: 'Painel', icone: LayoutDashboard, end: true },
  { to: '/almoxarifado/estoque', rotulo: 'Estoque', icone: Warehouse },
  { to: '/almoxarifado/retiradas', rotulo: 'Retiradas', icone: ArrowRightFromLine },
  { to: '/almoxarifado/solicitacoes', rotulo: 'Solicitações', icone: ClipboardList },
  { to: '/almoxarifado/recebimentos', rotulo: 'Recebimentos', icone: PackageCheck },
];

export function AlmoxarifadoLayout() {
  return <AbasModulo abas={abas} />;
}
