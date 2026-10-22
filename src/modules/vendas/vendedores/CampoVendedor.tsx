import { useQuery } from '@tanstack/react-query';
import { Selecao } from '@/shared/ui';
import { listarVendedores } from './api';

// Escolha do vendedor da proposta: só vendedores ativos (o atual aparece mesmo se ficou inativo ou foi removido).
export function CampoVendedor({ valor, onChange, disabled }: { valor: string | null; onChange: (id: string | null) => void; disabled?: boolean }) {
  const { data: vendedores = [] } = useQuery({ queryKey: ['vendedores'], queryFn: listarVendedores });
  const lista = vendedores.filter((v) => v.ativo || v.usuario_id === valor);
  return (
    <Selecao value={valor ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Sem vendedor</option>
      {lista.map((v) => <option key={v.usuario_id} value={v.usuario_id}>{v.nome || v.usuarios?.nome}{v.removido_em ? ' (removido)' : v.ativo ? '' : ' (inativo)'}</option>)}
    </Selecao>
  );
}
