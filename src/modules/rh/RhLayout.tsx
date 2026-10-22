import { Network, UsersRound } from 'lucide-react';
import { AbasModulo } from '@/shared/ui/AbasModulo';

// Abas do módulo RH (decisão 69). Documentos, vencimentos e integrações entram nas próximas entregas.
const abas = [
  { to: '/rh', rotulo: 'Funcionários', icone: UsersRound, end: true },
  { to: '/rh/setores', rotulo: 'Setores e funções', icone: Network },
];

export function RhLayout() {
  return <AbasModulo abas={abas} />;
}
