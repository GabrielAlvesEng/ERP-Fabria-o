import { AbasModulo } from '@/shared/ui/AbasModulo';
import { BadgeDollarSign, Building2, KanbanSquare, LayoutDashboard, Users } from 'lucide-react';

// Abas superiores do módulo Vendas (decisão 24; visual do redesign, decisão 51).
const abas = [
  { to: '/vendas', rotulo: 'Dashboard', icone: LayoutDashboard, end: true },
  { to: '/vendas/empresas', rotulo: 'Empresas', icone: Building2 },
  { to: '/vendas/contatos', rotulo: 'Contatos', icone: Users },
  { to: '/vendas/propostas', rotulo: 'Propostas', icone: KanbanSquare },
  { to: '/vendas/vendedores', rotulo: 'Vendedores', icone: BadgeDollarSign },
];

export function VendasLayout() {
  return <AbasModulo abas={abas} />;
}
