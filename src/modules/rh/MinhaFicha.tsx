import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR } from '@/shared/lib/formato';
import { Selo } from '@/shared/ui';
import { listarFuncoes, listarSetores, obterMinhaFicha } from './api';
import { DocumentosFicha } from './DocumentosFicha';
import { IntegracoesFicha } from './IntegracoesFicha';
import { situacao } from './regras';

// Meu perfil → Minha ficha (decisão 69, resposta 6): o funcionário vê, só para leitura, a própria ficha do RH,
// os documentos com a situação de cada um e as integrações. Quem muda é o RH.
export function MinhaFicha() {
  const { session } = useAuth();
  const { data: ficha } = useQuery({ queryKey: ['rh', 'minha_ficha', session?.user.id], queryFn: () => obterMinhaFicha(session!.user.id), enabled: Boolean(session) });
  const { data: funcoes = [] } = useQuery({ queryKey: ['rh', 'funcoes'], queryFn: listarFuncoes, enabled: Boolean(ficha) });
  const { data: setores = [] } = useQuery({ queryKey: ['rh', 'setores'], queryFn: listarSetores, enabled: Boolean(ficha) });
  if (!ficha) return null;
  const fn = funcoes.find((f) => f.id === ficha.funcao_id);
  const s = situacao(ficha.situacao);

  return (
    <div className="rounded-xl bg-superficie p-5 shadow-sm ring-1 ring-borda">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Minha ficha no RH</h2>
        <Selo cor={s.cor}>{s.rotulo}</Selo>
      </div>
      <p className="mb-3 text-xs text-suave">Só para consulta. Se algo estiver errado, fale com o RH.</p>
      <dl className="mb-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Dado rotulo="Função" valor={fn?.nome ?? '—'} />
        <Dado rotulo="Setor" valor={setores.find((x) => x.id === fn?.setor_id)?.nome ?? '—'} />
        <Dado rotulo="Admissão" valor={dataBR(ficha.admissao)} />
        <Dado rotulo="Matrícula" valor={ficha.matricula ?? '—'} />
      </dl>
      <h3 className="mb-2 text-sm font-semibold">Documentos e treinamentos</h3>
      <DocumentosFicha funcionarioId={ficha.id} editavel={false} />
      <h3 className="mb-2 mt-4 text-sm font-semibold">Integrações nos clientes</h3>
      <IntegracoesFicha funcionarioId={ficha.id} editavel={false} />
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-suave">{rotulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
