import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ListChecks, XCircle } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { hojeISO, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, CampoData, Entrada, EsqueletoTabela, Selecao, Selo, Vazio } from '@/shared/ui';
import {
  liberacaoNoCliente, listarDocumentosExigidos, listarEmpresasClientes, listarExigencias, listarFuncionarios, listarFuncoes, listarTiposDocumento,
  salvarDocumentosExigidos, salvarExigencia,
} from './api';
import { EscolherRequisitos } from './EscolherRequisitos';

// RH → Integrações (decisão 69): o que cada cliente exige (validade da integração, definida por ele, e documentos)
// e quem está liberado para ir lá numa data. A mesma conta (liberacao_no_cliente) vai bloquear a Agenda.
export function IntegracoesPage() {
  const { pode } = useAuth();
  const editavel = pode('rh', 'editar');
  const qc = useQueryClient();
  const navegar = useNavigate();
  const { data: empresas = [] } = useQuery({ queryKey: ['rh', 'empresas'], queryFn: listarEmpresasClientes });
  const { data: exigencias = [] } = useQuery({ queryKey: ['rh', 'exigencias'], queryFn: listarExigencias });
  const { data: tipos = [] } = useQuery({ queryKey: ['rh', 'tipos_documento'], queryFn: listarTiposDocumento });
  const { data: funcionarios = [] } = useQuery({ queryKey: ['rh', 'funcionarios'], queryFn: listarFuncionarios });
  const { data: funcoes = [] } = useQuery({ queryKey: ['rh', 'funcoes'], queryFn: listarFuncoes });
  const [empresa, setEmpresa] = useState('');
  const [data, setData] = useState(hojeISO());
  const { data: exigidos = [] } = useQuery({ queryKey: ['rh', 'exigidos', empresa], queryFn: () => listarDocumentosExigidos(empresa), enabled: Boolean(empresa) });
  const { data: liberacao = [], isLoading, error } = useQuery({ queryKey: ['rh', 'liberacao', empresa, data], queryFn: () => liberacaoNoCliente(empresa, data), enabled: Boolean(empresa && data) });
  const exigencia = exigencias.find((e) => e.empresa_id === empresa);
  const [escolhendo, setEscolhendo] = useState(false);
  const comExigencia = new Set(exigencias.map((e) => e.empresa_id));
  const pessoa = useMemo(() => new Map(funcionarios.map((f) => [f.id, f])), [funcionarios]);
  const nomeFuncao = useMemo(() => new Map(funcoes.map((f) => [f.id, f.nome])), [funcoes]);
  const nomeTipo = new Map(tipos.map((t) => [t.id, t.nome]));
  const linhas = [...liberacao].sort((a, b) => Number(b.liberado) - Number(a.liberado) || (pessoa.get(a.funcionario_id)?.nome ?? '').localeCompare(pessoa.get(b.funcionario_id)?.nome ?? ''));

  return (
    <>
      <Cabecalho titulo="Integrações nos clientes" subtitulo="O que cada cliente exige e quem pode ir lá numa data. Integração ou documento vencido na data impede a ida." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Campo rotulo="Cliente" className="w-full max-w-sm">
          <Selecao value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
            <option value="">Escolha o cliente…</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome_fantasia}{comExigencia.has(e.id) ? ' · exige integração' : ''}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Data do serviço" className="w-44"><CampoData value={data} onChange={setData} /></Campo>
      </div>
      {!empresa ? <Vazio>Escolha um cliente para ver as exigências e quem está liberado.</Vazio> : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Exigencias key={empresa} empresaId={empresa} validadeMeses={exigencia?.validade_meses ?? null} observacoes={exigencia?.observacoes ?? ''} editavel={editavel}
            documentos={exigidos.map((t) => nomeTipo.get(t) ?? '')} onEscolher={() => setEscolhendo(true)} />
          <div>
            {error ? <Aviso>{mensagemErro(error)}</Aviso> : isLoading ? <EsqueletoTabela linhas={4} colunas={3} /> : linhas.length === 0 ? <Vazio>Nenhum funcionário ativo.</Vazio> : (
              <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
                <table className="w-full text-sm">
                  <thead className="bg-pagina text-left text-xs uppercase text-suave">
                    <tr><th className="px-4 py-2">Funcionário</th><th className="px-4 py-2">Na data</th><th className="px-4 py-2">Motivo</th></tr>
                  </thead>
                  <tbody>
                    {linhas.map((l) => {
                      const p = pessoa.get(l.funcionario_id);
                      return (
                        <tr key={l.funcionario_id} className="cursor-pointer border-t border-borda align-top hover:bg-pagina" onClick={() => navegar(`/rh/funcionarios/${l.funcionario_id}`)}>
                          <td className="px-4 py-2"><div className="font-medium">{p?.nome}</div><div className="text-xs text-suave">{nomeFuncao.get(p?.funcao_id ?? '') ?? ''}</div></td>
                          <td className="px-4 py-2">{l.liberado
                            ? <span className="inline-flex items-center gap-1 text-petroleo-600 dark:text-petroleo-100"><CheckCircle2 size={15} /> Liberado</span>
                            : <span className="inline-flex items-center gap-1 text-red-600"><XCircle size={15} /> Bloqueado</span>}</td>
                          <td className="px-4 py-2 text-xs text-suave">{l.motivos.join(' ') || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {escolhendo && (
        <EscolherRequisitos titulo="Documentos exigidos pelo cliente" tipos={tipos} marcados={exigidos} onFechar={() => setEscolhendo(false)}
          explicacao="Além dos requisitos da função de cada pessoa, os documentos que este cliente exige para entrar."
          onSalvar={async (ids) => { await salvarDocumentosExigidos(empresa, exigidos, ids); await qc.invalidateQueries({ queryKey: ['rh'] }); }} />
      )}
    </>
  );
}

function Exigencias({ empresaId, validadeMeses, observacoes, documentos, editavel, onEscolher }: {
  empresaId: string; validadeMeses: number | null; observacoes: string; documentos: string[]; editavel: boolean; onEscolher: () => void;
}) {
  const qc = useQueryClient();
  const [meses, setMeses] = useState(validadeMeses ? String(validadeMeses) : '');
  const [obs, setObs] = useState(observacoes);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);

  async function salvar() {
    setErro(''); setSalvo(false);
    const n = Number(meses);
    if (!(Number.isInteger(n) && n >= 1 && n <= 60)) return setErro('Validade da integração: de 1 a 60 meses.');
    try {
      await salvarExigencia({ empresa_id: empresaId, validade_meses: n, observacoes: obs.trim() }, validadeMeses === null);
      await qc.invalidateQueries({ queryKey: ['rh'] });
      setSalvo(true);
    } catch (e) { setErro(mensagemErro(e)); }
  }

  return (
    <div className="space-y-3 rounded-xl bg-superficie p-4 ring-1 ring-borda">
      <div className="font-semibold">Exigências do cliente</div>
      {erro && <Aviso>{erro}</Aviso>}
      {salvo && <Aviso tipo="info">Salvo.</Aviso>}
      {validadeMeses === null && <p className="text-xs text-suave">Sem integração exigida. Defina a validade para passar a exigir.</p>}
      <Campo rotulo="Validade da integração (meses)"><Entrada inputMode="numeric" value={meses} disabled={!editavel} onChange={(e) => setMeses(e.target.value)} placeholder="Ex.: 12" /></Campo>
      <Campo rotulo="Observações"><AreaTexto rows={2} value={obs} disabled={!editavel} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: agendar com a segurança do trabalho do cliente" /></Campo>
      {editavel && <Botao tamanho="sm" onClick={salvar}>Salvar exigências</Botao>}
      <div>
        <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Documentos exigidos para entrar</div>
        <div className="flex flex-wrap gap-1">{documentos.length ? documentos.map((d) => <Selo key={d} cor="roxo">{d}</Selo>) : <span className="text-xs text-suave">Nenhum além dos da função.</span>}</div>
        {editavel && <Botao variante="secundario" tamanho="sm" className="mt-2" onClick={onEscolher}><ListChecks size={14} /> Escolher documentos</Botao>}
      </div>
    </div>
  );
}
