import { AbasModulo } from '@/shared/ui/AbasModulo';
import { LayoutDashboard } from 'lucide-react';

// Módulo Compras (decisão 92): por enquanto só a página inicial. As áreas entram aqui depois do planejamento aprovado.
const abas = [{ to: '/compras', rotulo: 'Início', icone: LayoutDashboard, end: true }];

export function ComprasLayout() {
  return <AbasModulo abas={abas} />;
}
