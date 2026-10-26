import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, KeyRound, Plus, Search } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Cabecalho, Caixa, Entrada, EsqueletoTabela, Selecao, Selo, Vazio } from '@/shared/ui';
import { Avatar } from '@/modules/perfil/Avatar';
import { listarFuncionarios, listarFuncoes, listarSetores } from './api';
import { situacao } from './regras';
import { loginVisivel } from '@/shared/lib/login';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// RH → Funcionários: a lista da equipe, com busca e filtro por setor. Desligados ficam escondidos por padrão.
export function FuncionariosPage() {
  const { pode } = useAuth();
  const navegar = useNavigate();
  const { data: funcionarios = [], isLoading, error } = useQuery({ queryKey: ['rh', 'funcionarios'], queryFn: listarFuncionarios });
  const { data: funcoes = [] } = useQuery({ queryKey: ['rh', 'funcoes'], queryFn: listarFuncoes });
  const { data: setores = [] } = useQuery({ queryKey: ['rh', 'setores'], queryFn: listarSetores });
  const [busca, setBusca] = useState('');
  const [setor, setSetor] = useState('');
  const [verDesligados, setVerDesligados] = useState(false);

  const funcaoDe = useMemo(() => new Map(funcoes.map((f) => [f.id, f])), [funcoes]);
  const nomeSetor = useMemo(() => new Map(setores.map((s) => [s.id, s.nome])), [setores]);
  const t = normalizar(busca);
  const lista = funcionarios.filter((f) => {
    const fn = f.funcao_id ? funcaoDe.get(f.funcao_id) : undefined;
    if (!verDesligados && f.situacao === 'desligado') return false;
    if (setor && fn?.setor_id !== setor) return false;
    return !t || normalizar(`${f.nome} ${fn?.nome ?? ''} ${f.matricula ?? ''} ${f.usuarios?.email ?? ''}`).includes(t);
  });
  const desligados = funcionarios.filter((f) => f.situacao === 'desligado').length;

  return (
    <>
      <Cabecalho titulo="Funcionários" subtitulo="Cadastro da equipe: dados pessoais, função e acesso ao ERP."
        acoes={pode('rh', 'editar') ? <Botao onClick={() => navegar('/rh/funcionarios/novo')}><Plus size={15} /> Cadastrar funcionário</Botao> : undefined} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, função ou e-mail" className="pl-9" />
        </div>
        <div className="w-48">
          <Selecao value={setor} onChange={(e) => setSetor(e.target.value)}>
            <option value="">Todos os setores</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Selecao>
        </div>
        {desligados > 0 && <Caixa marcado={verDesligados} onChange={setVerDesligados}>Mostrar desligados ({desligados})</Caixa>}
      </div>
      {error ? <Aviso>{mensagemErro(error)}</Aviso> : isLoading ? <EsqueletoTabela /> : lista.length === 0 ? <Vazio>Nenhum funcionário encontrado.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full text-sm">
            <thead className="bg-pagina text-left text-xs uppercase text-suave">
              <tr><th className="px-4 py-2">Funcionário</th><th className="px-4 py-2">Função</th><th className="px-4 py-2">Setor</th><th className="px-4 py-2">Situação</th><th className="px-4 py-2">Acesso ao ERP</th><th /></tr>
            </thead>
            <tbody>
              {lista.map((f) => {
                const fn = f.funcao_id ? funcaoDe.get(f.funcao_id) : undefined;
                const s = situacao(f.situacao);
                return (
                  <tr key={f.id} className="cursor-pointer border-t border-borda hover:bg-pagina" onClick={() => navegar(`/rh/funcionarios/${f.id}`)}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <Avatar caminho={f.usuarios?.foto_caminho} versao={f.usuarios?.foto_atualizada_em} nome={f.nome} tamanho={32} />
                        <div className="min-w-0">
                          <Link to={`/rh/funcionarios/${f.id}`} className="font-medium hover:text-roxo-600" onClick={(e) => e.stopPropagation()}>{f.nome}</Link>
                          {f.matricula && <div className="text-xs text-suave">Matrícula {f.matricula}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">{fn?.nome ?? '—'}</td>
                    <td className="px-4 py-2">{fn ? nomeSetor.get(fn.setor_id) : '—'}</td>
                    <td className="px-4 py-2"><Selo cor={s.cor}>{s.rotulo}</Selo></td>
                    <td className="px-4 py-2">
                      {f.usuarios ? <span className="inline-flex items-center gap-1.5 text-xs"><KeyRound size={13} className="text-petroleo-600 dark:text-petroleo-100" /> {loginVisivel(f.usuarios.email)}</span> : <span className="text-xs text-suave">Sem login</span>}
                    </td>
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
