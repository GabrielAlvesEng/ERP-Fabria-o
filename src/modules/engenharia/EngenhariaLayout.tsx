import { AbasModulo } from '@/shared/ui/AbasModulo';
import { FolderKanban, LayoutDashboard } from 'lucide-react';

// Mesmo padrão de abas superiores de Vendas (decisão 24). Dashboard e Kanban de projetos (decisão 96).
const abas = [
  { to: '/engenharia', rotulo: 'Dashboard', icone: LayoutDashboard, end: true },
  { to: '/engenharia/projetos', rotulo: 'Projetos', icone: FolderKanban },
];

export function EngenhariaLayout() {
  return <AbasModulo abas={abas} />;
}
