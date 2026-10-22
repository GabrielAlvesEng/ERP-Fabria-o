import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { apenasDigitos, hojeISO, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, CampoData, Entrada, EsqueletoDetalhe, Selecao, Selo } from '@/shared/ui';
import { Avatar } from '@/modules/perfil/Avatar';
import { listarFuncoes, listarSetores, listarUsuariosSemFicha, obterFuncionario, salvarFuncionario, type DadosFuncionario, type Funcionario } from './api';
import { DocumentosFicha } from './DocumentosFicha';
import { formatarCPF, situacao, SITUACOES, UFS, validarFicha, VINCULOS, type Situacao } from './regras';

type Form = Omit<DadosFuncionario, 'cpf' | 'nascimento' | 'admissao' | 'desligamento' | 'matricula' | 'funcao_id' | 'usuario_id'> & {
  cpf: string; nascimento: string; admissao: string; desligamento: string; matricula: string; funcao_id: string; usuario_id: string;
};

const vazio: Form = {
  nome: '', cpf: '', rg: '', nascimento: '', telefone: '', email_pessoal: '', email_corporativo: '', cep: '', endereco: '', cidade: '', uf: '',
  emergencia_nome: '', emergencia_telefone: '', matricula: '', funcao_id: '', admissao: '', vinculo: '', situacao: 'ativo', desligamento: '',
  usuario_id: '', observacoes: '',
};

function paraForm(f: Funcionario): Form {
  return {
    nome: f.nome, cpf: formatarCPF(f.cpf), rg: f.rg, nascimento: f.nascimento ?? '', telefone: f.telefone, email_pessoal: f.email_pessoal,
    email_corporativo: f.email_corporativo, cep: f.cep, endereco: f.endereco, cidade: f.cidade, uf: f.uf, emergencia_nome: f.emergencia_nome,
    emergencia_telefone: f.emergencia_telefone, matricula: f.matricula ?? '', funcao_id: f.funcao_id ?? '', admissao: f.admissao ?? '',
    vinculo: f.vinculo, situacao: f.situacao, desligamento: f.desligamento ?? '', usuario_id: f.usuario_id ?? '', observacoes: f.observacoes,
  };
}

function paraBanco(f: Form): DadosFuncionario {
  const t = (s: string) => s.trim();
  return {
    nome: t(f.nome), cpf: apenasDigitos(f.cpf) || null, rg: t(f.rg), nascimento: f.nascimento || null, telefone: t(f.telefone),
    email_pessoal: t(f.email_pessoal).toLowerCase(), email_corporativo: t(f.email_corporativo).toLowerCase(), cep: t(f.cep), endereco: t(f.endereco),
    cidade: t(f.cidade), uf: f.uf, emergencia_nome: t(f.emergencia_nome), emergencia_telefone: t(f.emergencia_telefone),
    matricula: t(f.matricula) || null, funcao_id: f.funcao_id || null, admissao: f.admissao || null, vinculo: f.vinculo,
    situacao: f.situacao, desligamento: f.situacao === 'desligado' ? f.desligamento || null : null, usuario_id: f.usuario_id || null,
    observacoes: t(f.observacoes),
  };
}

function erroBanco(e: unknown): string {
  const m = mensagemErro(e);
  if (m.includes('funcionarios_cpf_unico')) return 'Já existe um funcionário com este CPF.';
  if (m.includes('funcionarios_matricula_unica')) return 'Já existe um funcionário com esta matrícula.';
  if (m.includes('funcionarios_usuario_id_key')) return 'Este usuário já está ligado a outra ficha.';
  return m;
}

// RH → ficha do funcionário (decisão 69). Quem não tem rh.editar vê só para leitura.
export function FuncionarioPage() {
  const { id = 'novo' } = useParams();
  const novo = id === 'novo';
  const navegar = useNavigate();
  const qc = useQueryClient();
  const { pode } = useAuth();
  const editavel = pode('rh', 'editar');
  const { data: funcionario, error } = useQuery({ queryKey: ['rh', 'funcionario', id], queryFn: () => obterFuncionario(id), enabled: !novo });
  const { data: setores = [] } = useQuery({ queryKey: ['rh', 'setores'], queryFn: listarSetores });
  const { data: funcoes = [] } = useQuery({ queryKey: ['rh', 'funcoes'], queryFn: listarFuncoes });
  const { data: usuarios = [] } = useQuery({ queryKey: ['rh', 'usuarios_sem_ficha', id], queryFn: () => listarUsuariosSemFicha(funcionario?.usuario_id ?? null), enabled: editavel && (novo || Boolean(funcionario)) });
  const [f, setF] = useState<Form>(vazio);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (funcionario) setF(paraForm(funcionario)); }, [funcionario]);

  const nomeSetor = useMemo(() => new Map(setores.map((s) => [s.id, s.nome])), [setores]);
  const funcoesPorSetor = useMemo(() => setores.map((s) => ({
    setor: s, funcoes: funcoes.filter((fn) => fn.setor_id === s.id && ((fn.ativo && s.ativo) || fn.id === f.funcao_id)),
  })).filter((g) => g.funcoes.length), [setores, funcoes, f.funcao_id]);

  const campo = <K extends keyof Form>(k: K) => ({ value: f[k] as string, disabled: !editavel, onChange: (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setSalvo(false); } });

  async function salvar() {
    setErro(''); setSalvo(false);
    const msg = validarFicha(f, hojeISO());
    if (msg) return setErro(msg);
    setSalvando(true);
    try {
      const novoId = await salvarFuncionario(novo ? null : id, paraBanco(f));
      await qc.invalidateQueries({ queryKey: ['rh'] });
      await qc.invalidateQueries({ queryKey: ['meu_usuario'] });
      if (novo) navegar(`/rh/funcionarios/${novoId}`, { replace: true });
      else setSalvo(true);
    } catch (e) { setErro(erroBanco(e)); }
    setSalvando(false);
  }

  if (error) return <Aviso>{mensagemErro(error)}</Aviso>;
  if (!novo && !funcionario) return <EsqueletoDetalhe />;
  const fn = funcoes.find((x) => x.id === f.funcao_id);
  const s = situacao(f.situacao);

  return (
    <div className="space-y-4">
      <Link to="/rh" className="inline-flex items-center gap-1 text-sm text-suave hover:text-roxo-600"><ArrowLeft size={15} /> Funcionários</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar caminho={funcionario?.usuarios?.foto_caminho} versao={funcionario?.usuarios?.foto_atualizada_em} nome={f.nome} tamanho={56} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{novo ? 'Novo funcionário' : funcionario!.nome}</h1>
              {!novo && <Selo cor={s.cor}>{s.rotulo}</Selo>}
            </div>
            {fn && <div className="text-sm text-suave">{fn.nome} · {nomeSetor.get(fn.setor_id)}</div>}
          </div>
        </div>
        {editavel && <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : novo ? 'Cadastrar' : 'Salvar alterações'}</Botao>}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      {salvo && <Aviso tipo="info">Alterações salvas.</Aviso>}

      <Secao titulo="Dados funcionais">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Função" className="sm:col-span-2">
            <Selecao {...campo('funcao_id')}>
              <option value="">Sem função</option>
              {funcoesPorSetor.map((g) => (
                <optgroup key={g.setor.id} label={g.setor.nome}>
                  {g.funcoes.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.ativo ? '' : ' (inativa)'}</option>)}
                </optgroup>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Matrícula"><Entrada {...campo('matricula')} /></Campo>
          <Campo rotulo="Vínculo">
            <Selecao {...campo('vinculo')}>
              <option value="">Não informado</option>
              {VINCULOS.map((v) => <option key={v} value={v}>{v}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Admissão"><CampoData value={f.admissao} disabled={!editavel} onChange={(admissao) => setF({ ...f, admissao })} /></Campo>
          <Campo rotulo="Situação">
            <Selecao value={f.situacao} disabled={!editavel} onChange={(e) => setF({ ...f, situacao: e.target.value as Situacao, desligamento: e.target.value === 'desligado' ? f.desligamento || hojeISO() : '' })}>
              {SITUACOES.map((x) => <option key={x.valor} value={x.valor}>{x.rotulo}</option>)}
            </Selecao>
          </Campo>
          {f.situacao === 'desligado' && <Campo rotulo="Desligamento *"><CampoData value={f.desligamento} disabled={!editavel} onChange={(desligamento) => setF({ ...f, desligamento })} /></Campo>}
          <Campo rotulo="E-mail corporativo (Outlook)" className="sm:col-span-2"><Entrada type="email" {...campo('email_corporativo')} /></Campo>
        </div>
      </Secao>

      <Secao titulo="Dados pessoais" detalhe="Visíveis só para o RH e para o próprio funcionário.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Nome completo *" className="sm:col-span-2"><Entrada {...campo('nome')} /></Campo>
          <Campo rotulo="CPF"><Entrada inputMode="numeric" placeholder="000.000.000-00" {...campo('cpf')} onBlur={() => setF({ ...f, cpf: formatarCPF(f.cpf) })} /></Campo>
          <Campo rotulo="RG"><Entrada {...campo('rg')} /></Campo>
          <Campo rotulo="Nascimento"><CampoData value={f.nascimento} disabled={!editavel} onChange={(nascimento) => setF({ ...f, nascimento })} /></Campo>
          <Campo rotulo="Telefone / WhatsApp"><Entrada {...campo('telefone')} /></Campo>
          <Campo rotulo="E-mail pessoal" className="sm:col-span-2"><Entrada type="email" {...campo('email_pessoal')} /></Campo>
          <Campo rotulo="Endereço" className="sm:col-span-2"><Entrada placeholder="Rua, número, bairro" {...campo('endereco')} /></Campo>
          <Campo rotulo="Cidade"><Entrada {...campo('cidade')} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="UF">
              <Selecao {...campo('uf')}>
                <option value="">—</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Selecao>
            </Campo>
            <Campo rotulo="CEP"><Entrada inputMode="numeric" {...campo('cep')} /></Campo>
          </div>
          <Campo rotulo="Contato de emergência (nome)" className="sm:col-span-2"><Entrada {...campo('emergencia_nome')} /></Campo>
          <Campo rotulo="Telefone de emergência" className="sm:col-span-2"><Entrada {...campo('emergencia_telefone')} /></Campo>
        </div>
        {f.usuario_id && <p className="mt-2 text-xs text-suave">Telefone e nascimento ficam iguais aos de Meu perfil do funcionário: quem mudar por último vale para os dois.</p>}
      </Secao>

      {!novo && (
        <Secao titulo="Documentos e treinamentos" detalhe="Requisitos da função e individuais, com aviso 30 dias antes de vencer.">
          <DocumentosFicha funcionarioId={id} editavel={editavel} />
        </Secao>
      )}

      <Secao titulo="Acesso ao ERP" detalhe="Criar login, mandar link de senha e escolher perfis entram na próxima etapa do RH. O ERP nunca guarda nem mostra senhas.">
        {funcionario?.usuarios && f.usuario_id === funcionario.usuario_id ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <KeyRound size={16} className="text-petroleo-600 dark:text-petroleo-100" />
            <span>Login: <b>{funcionario.usuarios.email}</b></span>
            {!funcionario.usuarios.ativo && <Selo cor="cinza">Login desativado</Selo>}
            {editavel && <Botao variante="fantasma" tamanho="sm" onClick={() => setF({ ...f, usuario_id: '' })}>Desligar desta ficha</Botao>}
          </div>
        ) : editavel ? (
          <Campo rotulo="Ligar a um login que já existe" className="max-w-md">
            <Selecao value={f.usuario_id} onChange={(e) => setF({ ...f, usuario_id: e.target.value })}>
              <option value="">Sem login</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </Selecao>
          </Campo>
        ) : <span className="text-sm text-suave">Sem login no ERP.</span>}
      </Secao>

      <Secao titulo="Observações">
        <AreaTexto rows={3} {...campo('observacoes')} />
      </Secao>
    </div>
  );
}

function Secao({ titulo, detalhe, children }: { titulo: string; detalhe?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-superficie p-4 ring-1 ring-borda sm:p-5">
      <h2 className="font-semibold">{titulo}</h2>
      {detalhe && <p className="mb-3 text-xs text-suave">{detalhe}</p>}
      <div className={detalhe ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}
