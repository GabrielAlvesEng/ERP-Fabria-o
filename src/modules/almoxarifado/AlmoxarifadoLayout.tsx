import { AbasModulo } from '@/shared/ui/AbasModulo';
import { Warehouse } from 'lucide-react';

// Módulo Almoxarifado (decisão 94): por enquanto só a entrada no ERP. As áreas (materiais, estoque,
// reservas por projeto, entradas e saídas, separação) entram aqui como abas depois do planejamento aprovado.
const abas = [{ to: '/almoxarifado', rotulo: 'Início', icone: Warehouse, end: true }];

export function AlmoxarifadoLayout() {
  return <AbasModulo abas={abas} />;
}
