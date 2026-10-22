import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Copy, KeyRound, Mail, RotateCcw, UserPlus } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Caixa, Campo, Entrada, Selecao, Selo } from '@/shared/ui';
import {
  definirPerfis, definirPermissao, listarPerfis, listarPermissoes, listarPermissoesDosPerfis, obterAcessoUsuario, rhAcesso,
  type Funcionario,
} from './api';

// Ficha → Acesso ao ERP (decisão 69, resposta 1): o RH cria o login, gera o link para a pessoa definir a senha,
// desativa ou reativa e escolhe perfis e ajustes. O ERP nunca vê nem guarda senhas. Quem garante as regras é o banco.
const ACOES = ['ler', 'criar', 'editar', 'aprovar', 'excluir', 'critica'] as const;
const ROTULO_MODULO: Record<string, string> = { vendas: 'Vendas', engenharia: 'Engenharia', rh: 'RH', admin: 'Administração', financeiro: 'Financeiro', compras: 'Compras' };
const ROTULO_ACAO: Record<string, string> = { ler: 'Ler', criar: 'Criar', editar: 'Editar', aprovar: 'Aprovar', excluir: 'Excluir', critica: 'Crítica' };

export function AcessoFicha({ funcionario }: { funcionario: Funcionario }) {
  const { pode, session } = useAuth();
  const qc = useQueryClient();
  const gerencia = pode('rh', 'critica');
  const usuario = funcionario.usuarios;
  const [email, setEmail] = useState(funcionario.email_corporativo || funcionario.email_pessoal || '');
  const [link, setLink] = useState<{ link: string; email: string; convite: boolean } | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const proprio = funcionario.usuario_id === session?.user.id;

  async function executar(f: () => Promise<void>) {
    setErro(''); setAviso(''); setOcupado(true);
    try { await f(); } catch (e) { setErro(mensagemErro(e)); }
    setOcupado(false);
  }

  const criar = () => executar(async () => {
    const r = await rhAcesso({ acao: 'criar_login', funcionario_id: funcionario.id, email: email.trim() });
    setLink({ link: r.link!, email: r.email!, convite: true });
    await qc.invalidateQueries({ queryKey: ['rh'] });
  });
  const gerarLink = () => executar(async () => {
    const r = await rhAcesso({ acao: 'link_senha', usuario_id: funcionario.usuario_id! });
    setLink({ link: r.link!, email: r.email!, convite: r.tipo === 'invite' });
  });
  const alternar = (ativar: boolean) => executar(async () => {
    if (!ativar && !confirm(`Desativar o login de ${funcionario.nome}? A pessoa não consegue mais entrar no ERP até ser reativada.`)) return;
    await rhAcesso({ acao: ativar ? 'reativar' : 'desativar', usuario_id: funcionario.usuario_id! });
    await qc.invalidateQueries({ queryKey: ['rh'] });
    setAviso(ativar ? 'Login reativado.' : 'Login desativado.');
  });

  if (!usuario) {
    if (!gerencia) return <span className="text-sm text-suave">Sem login no ERP.</span>;
    return (
      <div className="space-y-3">
        {erro && <Aviso>{erro}</Aviso>}
        {link ? <LinkSenha {...link} nome={funcionario.nome} /> : funcionario.situacao === 'desligado' ? (
          <p className="text-sm text-suave">Funcionário desligado não recebe login.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <Campo rotulo="E-mail de acesso" className="w-full max-w-sm">
              <Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@fabriacobrasil.com.br" />
            </Campo>
            <Botao onClick={criar} disabled={ocupado || !email.trim()}><UserPlus size={15} /> Criar login</Botao>
          </div>
        )}
        <p className="text-xs text-suave">O ERP gera um link de convite para a pessoa escolher a própria senha. Depois de criar, escolha os perfis abaixo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <KeyRound size={16} className="text-petroleo-600 dark:text-petroleo-100" />
        <span>Login: <b>{usuario.email}</b></span>
        {usuario.ativo ? <Selo cor="verde">Ativo</Selo> : <Selo cor="cinza">Desativado</Selo>}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      {aviso && <Aviso tipo="info">{aviso}</Aviso>}
      {gerencia && proprio && <p className="text-xs text-suave">Este é o seu login. Seu próprio acesso não é mudado por aqui; para trocar a senha, use "Esqueci minha senha" na tela de entrada.</p>}
      {gerencia && !proprio && (
        <>
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" tamanho="sm" onClick={gerarLink} disabled={ocupado}><KeyRound size={14} /> Gerar link de senha</Botao>
            {usuario.ativo
              ? <Botao variante="secundario" tamanho="sm" onClick={() => alternar(false)} disabled={ocupado}><Ban size={14} /> Desativar login</Botao>
              : <Botao variante="secundario" tamanho="sm" onClick={() => alternar(true)} disabled={ocupado || funcionario.situacao === 'desligado'}><RotateCcw size={14} /> Reativar login</Botao>}
          </div>
          {link && <LinkSenha {...link} nome={funcionario.nome} />}
          <PerfisEPermissoes usuarioId={funcionario.usuario_id!} />
        </>
      )}
    </div>
  );
}

function LinkSenha({ link, email, convite, nome }: { link: string; email: string; convite: boolean; nome: string }) {
  const [copiado, setCopiado] = useState(false);
  const assunto = convite ? 'Seu acesso ao ERP Fabriaço' : 'Nova senha do ERP Fabriaço';
  const corpo = `Olá, ${nome.split(' ')[0]}.\n\n${convite ? 'Seu login no ERP Fabriaço foi criado' : 'Foi gerado um link para você definir uma nova senha no ERP Fabriaço'} (${email}).\nAbra o link abaixo e escolha a sua senha:\n\n${link}\n\nO link vale por pouco tempo e só funciona uma vez.`;
  async function copiar() {
    try { await navigator.clipboard.writeText(link); setCopiado(true); } catch { setCopiado(false); }
  }
  return (
    <div className="space-y-2 rounded-lg bg-roxo-50 p-3 text-sm ring-1 ring-roxo-100 dark:bg-roxo-700/20 dark:ring-roxo-700/40">
      <div className="font-medium">{convite ? 'Link de convite' : 'Link para nova senha'} de {email}</div>
      <p className="text-xs text-suave">Mande este link só para a própria pessoa. Ele vale por pouco tempo e funciona uma vez; se expirar, gere outro.</p>
      <Entrada readOnly value={link} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
      <div className="flex flex-wrap gap-2">
        <Botao tamanho="sm" variante="secundario" onClick={copiar}><Copy size={14} /> {copiado ? 'Copiado' : 'Copiar link'}</Botao>
        <a href={`mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-roxo-700 hover:bg-roxo-100 dark:text-roxo-100 dark:hover:bg-roxo-700/30">
          <Mail size={14} /> Enviar por e-mail
        </a>
      </div>
    </div>
  );
}

function PerfisEPermissoes({ usuarioId }: { usuarioId: string }) {
  const qc = useQueryClient();
  const { data: perfis = [] } = useQuery({ queryKey: ['rh', 'perfis'], queryFn: listarPerfis });
  const { data: permissoes = [] } = useQuery({ queryKey: ['rh', 'permissoes'], queryFn: listarPermissoes });
  const { data: dosPerfis = [] } = useQuery({ queryKey: ['rh', 'perfil_permissoes'], queryFn: listarPermissoesDosPerfis });
  const { data: acesso } = useQuery({ queryKey: ['rh', 'acesso', usuarioId], queryFn: () => obterAcessoUsuario(usuarioId) });
  const [marcados, setMarcados] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState('');
  useEffect(() => { if (acesso) setMarcados(acesso.perfis); }, [acesso]);

  // O que os perfis salvos já dão, para mostrar o "padrão" de cada permissão.
  const padrao = useMemo(() => {
    const total = perfis.some((p) => p.acesso_total && acesso?.perfis.includes(p.id));
    const ids = new Set(dosPerfis.filter((x) => acesso?.perfis.includes(x.perfil_id)).map((x) => x.permissao_id));
    return (id: string) => total || ids.has(id);
  }, [perfis, dosPerfis, acesso]);
  const modulos = useMemo(() => [...new Set(permissoes.map((p) => p.modulo))], [permissoes]);
  const permissao = (modulo: string, acao: string) => permissoes.find((p) => p.modulo === modulo && p.acao === acao);
  const mudou = acesso && (marcados.length !== acesso.perfis.length || marcados.some((m) => !acesso.perfis.includes(m)));

  async function salvarPerfis() {
    setErro(''); setSalvo('');
    try {
      await definirPerfis(usuarioId, marcados);
      await qc.invalidateQueries({ queryKey: ['rh', 'acesso', usuarioId] });
      setSalvo('Perfis salvos.');
    } catch (e) { setErro(mensagemErro(e)); }
  }
  async function ajustar(modulo: string, acao: string, valor: string) {
    setErro(''); setSalvo('');
    try {
      await definirPermissao(usuarioId, modulo, acao, valor === '' ? null : valor === 'sim');
      await qc.invalidateQueries({ queryKey: ['rh', 'acesso', usuarioId] });
    } catch (e) { setErro(mensagemErro(e)); }
  }

  if (!acesso) return null;
  return (
    <div className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      {salvo && <Aviso tipo="info">{salvo}</Aviso>}
      <div>
        <div className="mb-1 text-sm font-semibold">Perfis</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {perfis.map((p) => (
            <Caixa key={p.id} marcado={marcados.includes(p.id)} onChange={(v) => setMarcados(v ? [...marcados, p.id] : marcados.filter((m) => m !== p.id))}>
              <span>{p.nome}{p.acesso_total && <span className="ml-1 text-xs text-suave">(acesso total)</span>}{p.descricao && <span className="block text-xs text-suave">{p.descricao}</span>}</span>
            </Caixa>
          ))}
        </div>
        {mudou && <Botao tamanho="sm" className="mt-2" onClick={salvarPerfis}>Salvar perfis</Botao>}
      </div>
      <div>
        <div className="mb-1 text-sm font-semibold">Ajustes individuais</div>
        <p className="mb-2 text-xs text-suave">"Padrão" segue os perfis. "Concede" ou "Nega" vale só para esta pessoa, por cima dos perfis.</p>
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full text-sm">
            <thead className="bg-pagina text-left text-xs uppercase text-suave">
              <tr><th className="px-3 py-2">Módulo</th>{ACOES.map((a) => <th key={a} className="px-2 py-2">{ROTULO_ACAO[a]}</th>)}</tr>
            </thead>
            <tbody>
              {modulos.map((m) => (
                <tr key={m} className="border-t border-borda">
                  <td className="px-3 py-1.5 font-medium capitalize">{ROTULO_MODULO[m] ?? m}</td>
                  {ACOES.map((a) => {
                    const p = permissao(m, a);
                    if (!p) return <td key={a} className="px-2 py-1.5 text-suave">—</td>;
                    const ajuste = acesso.ajustes[p.id];
                    return (
                      <td key={a} className="px-2 py-1.5">
                        <Selecao aria-label={`${m} ${a}`} value={ajuste === undefined ? '' : ajuste ? 'sim' : 'nao'} onChange={(e) => ajustar(m, a, e.target.value)}
                          compacto className="min-w-[7.5rem]">
                          <option value="">Padrão ({padrao(p.id) ? 'sim' : 'não'})</option>
                          <option value="sim">Concede</option>
                          <option value="nao">Nega</option>
                        </Selecao>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
