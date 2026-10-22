import { Warehouse } from 'lucide-react';
import { Cabecalho, Cartao } from '@/shared/ui';

// Página inicial provisória (decisão 94): o módulo ainda não tem funcionalidades.
export function AlmoxarifadoInicioPage() {
  return (
    <>
      <Cabecalho titulo="Almoxarifado" subtitulo="Materiais, estoque, reservas por projeto e separação para a fabricação." />
      <Cartao className="flex flex-col items-center gap-3 py-12 text-center">
        <Warehouse size={36} className="text-roxo-500" />
        <div className="text-base font-medium text-texto">Módulo em construção</div>
        <p className="max-w-md text-sm text-suave">
          As telas do Almoxarifado serão feitas depois que o planejamento do módulo for aprovado.
        </p>
      </Cartao>
    </>
  );
}
