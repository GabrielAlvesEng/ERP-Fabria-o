import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { dataBR, hojeISO, mensagemErro } from '@/shared/lib/formato';
import { Aviso, Cabecalho, EsqueletoTabela, Selecao, Selo, Vazio } from '@/shared/ui';
import { listarFuncionarios, listarFuncoes, listarIntegracoesComoRequisitos, listarSetores, listarSituacoes, listarTiposDocumento } from './api';
import { diasAte, SITUACAO_REQ, type SituacaoReq } from './regras';

// RH → Vencimentos (decisão 69): o painel do RH com o que venceu, vence nos próximos dias (aviso de 30 dias)
// ou falta, por funcionário e requisito, mais as integrações nos clientes. Desligados não entram.
export function VencimentosPage() {
  const navegar = useNavigate();
  const hoje = hojeISO();
  const { data: requisitos = [], isLoading, error } = useQuery({ queryKey: ['rh', 'situacoes', 'todas'], queryFn: () => listarSituacoes() });
  const { data: integracoes = [] } = useQuery({ queryKey: ['rh', 'integracoes', 'todas'], queryFn: listarIntegracoesComoRequisitos });
  const situacoes = useMemo(() => [...requisitos, ...integracoes], [requisitos, integracoes]);
  const { data: funcionarios = [] } = useQuery({ queryKey: ['rh', 'funcionarios'], queryFn: listarFuncionarios });
  const { data: funcoes = [] } = useQuery({ queryKey: ['rh', 'funcoes'], queryFn: listarFuncoes });
  const { data: setores = [] } = useQuery({ queryKey: ['rh', 'setores'], queryFn: listarSetores });
  const { data: tipos = [] } = useQuery({ queryKey: ['rh', 'tipos_documento'], queryFn: listarTiposDocumento });
  const [filtro, setFiltro] = useState<SituacaoReq | 'pendentes' | ''>('pendentes');
  const [setor, setSetor] = useState('');
  const [tipo, setTipo] = useState('');

  const pessoa = useMemo(() => new Map(funcionarios.map((f) => [f.id, f])), [funcionarios]);
  const setorDaFuncao = useMemo(() => new Map(funcoes.map((f) => [f.id, f.setor_id])), [funcoes]);
  const nomeSetor = useMemo(() => new Map(setores.map((s) => [s.id, s.nome])), [setores]);
  const conta = (s: SituacaoReq) => situacoes.filter((x) => x.situacao === s).length;
  const lista = situacoes
    .filter((x) => (filtro === 'pendentes' ? x.situacao !== 'em_dia' : !filtro || x.situacao === filtro))
    .filter((x) => !setor || setorDaFuncao.get(pessoa.get(x.funcionario_id)?.funcao_id ?? '') === setor)
    .filter((x) => !tipo || x.tipo_documento_id === tipo || (tipo === 'integracoes' && x.tipo_documento_id.startsWith('integracao:')))
    .sort((a, b) => SITUACAO_REQ[a.situacao].ordem - SITUACAO_REQ[b.situacao].ordem || (a.validade ?? '').localeCompare(b.validade ?? '') || a.tipo_nome.localeCompare(b.tipo_nome));

  const Contador = ({ s }: { s: SituacaoReq }) => (
    <button type="button" onClick={() => setFiltro(filtro === s ? 'pendentes' : s)}
      className={`rounded-xl bg-superficie p-4 text-left shadow-sm ring-1 transition ${filtro === s ? 'ring-2 ring-roxo-400' : 'ring-borda hover:ring-roxo-200'}`}>
      <div className="text-xs text-suave">{SITUACAO_REQ[s].rotulo}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{conta(s)}</div>
    </button>
  );

  return (
    <>
      <Cabecalho titulo="Vencimentos" subtitulo="Documentos, treinamentos e integrações vencidos, vencendo nos próximos 30 dias ou faltando, de quem não está desligado." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Contador s="vencido" /><Contador s="vencendo" /><Contador s="faltando" /><Contador s="em_dia" />
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        <div className="w-48">
          <Selecao value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="pendentes">Só pendências</option>
            <option value="">Todos</option>
            {(['vencido', 'vencendo', 'faltando', 'em_dia'] as SituacaoReq[]).map((s) => <option key={s} value={s}>{SITUACAO_REQ[s].rotulo}</option>)}
          </Selecao>
        </div>
        <div className="w-48">
          <Selecao value={setor} onChange={(e) => setSetor(e.target.value)}>
            <option value="">Todos os setores</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Selecao>
        </div>
        <div className="w-64">
          <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos os documentos</option>
            <option value="integracoes">Integrações nos clientes</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Selecao>
        </div>
      </div>
      {error ? <Aviso>{mensagemErro(error)}</Aviso> : isLoading ? <EsqueletoTabela /> : lista.length === 0 ? (
        <Vazio>{situacoes.length === 0 ? 'Nenhum requisito cadastrado ainda. Escolha os requisitos de cada função em Setores e funções.' : 'Nada pendente com estes filtros.'}</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full text-sm">
            <thead className="bg-pagina text-left text-xs uppercase text-suave">
              <tr><th className="px-4 py-2">Funcionário</th><th className="px-4 py-2">Documento</th><th className="px-4 py-2">Validade</th><th className="px-4 py-2">Situação</th><th /></tr>
            </thead>
            <tbody>
              {lista.map((x) => {
                const p = pessoa.get(x.funcionario_id);
                const dias = x.validade ? diasAte(x.validade, hoje) : null;
                return (
                  <tr key={`${x.funcionario_id}-${x.tipo_documento_id}`} className="cursor-pointer border-t border-borda hover:bg-pagina" onClick={() => navegar(`/rh/funcionarios/${x.funcionario_id}`)}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{p?.nome}</div>
                      <div className="text-xs text-suave">{nomeSetor.get(setorDaFuncao.get(p?.funcao_id ?? '') ?? '') ?? 'Sem setor'}</div>
                    </td>
                    <td className="px-4 py-2">{x.tipo_nome}{!x.exigido && <span className="ml-1 text-xs text-suave">(não exigido)</span>}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {x.validade ? <>{dataBR(x.validade)} <span className="text-xs text-suave">{dias! < 0 ? `há ${-dias!} dia(s)` : `em ${dias} dia(s)`}</span></> : '—'}
                    </td>
                    <td className="px-4 py-2"><Selo cor={SITUACAO_REQ[x.situacao].cor}>{SITUACAO_REQ[x.situacao].rotulo}</Selo></td>
                    <td className="px-4 py-2 text-right text-suave"><ChevronRight size={16} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
