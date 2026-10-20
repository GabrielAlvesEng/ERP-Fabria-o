import { AbasModulo } from '@/shared/ui/AbasModulo';
import { FolderKanban } from 'lucide-react';

// Mesmo padrão de abas superiores de Vendas (decisão 24). Novas áreas da Engenharia entram aqui.
const abas = [{ to: '/engenharia', rotulo: 'Projetos', icone: FolderKanban }];

export function EngenhariaLayout() {
  return <AbasModulo abas={abas} />;
}
