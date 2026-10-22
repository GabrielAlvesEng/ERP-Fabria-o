import { CalendarClock, FileBadge, Network, UsersRound } from 'lucide-react';
import { AbasModulo } from '@/shared/ui/AbasModulo';

// Abas do módulo RH (decisão 69).
const abas = [
  { to: '/rh', rotulo: 'Funcionários', icone: UsersRound, end: true },
  { to: '/rh/vencimentos', rotulo: 'Vencimentos', icone: CalendarClock },
  { to: '/rh/setores', rotulo: 'Setores e funções', icone: Network },
  { to: '/rh/documentos', rotulo: 'Tipos de documento', icone: FileBadge },
];

export function RhLayout() {
  return <AbasModulo abas={abas} />;
}
