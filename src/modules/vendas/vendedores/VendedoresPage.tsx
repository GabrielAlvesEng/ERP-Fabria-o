import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, PenLine, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { Avatar } from '@/modules/perfil/Avatar';
import { useAno } from '@/app/AnoContext';
import { useAuth } from '@/shared/auth/AuthProvider';
import { hojeISO, mensagemErro, moeda } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Caixa, Campo, Entrada, EsqueletoCartoes, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { listarPropostas } from '../api';
import { listarCandidatosVendedor, listarVendedores, removerVendedor, salvarVendedor, type Vendedor } from './api';
import { resumoVendedor } from './regras';
import { AssinaturaModal, useMinhaAssinatura } from './AssinaturaModal';
import { loginVisivel } from '@/shared/lib/login';

// Vendas → Vendedores (decisão 62): a equipe com os números do ano. Cadastro e edição só para o RH (permissão rh.editar).
// Quem não é do RH (o vendedor comum) vê só o próprio cartão (decisão 68).
export function VendedoresPage() {
  const { ano } = useAno();
  const { pode, session } = useAuth();
  const [assinando, setAssinando] = useState(false);
  const { data: minha } = useMinhaAssinatura();
  const { data: vendedores = [], isLoading } = useQuery({ queryKey: ['vendedores'], queryFn: listarVendedores });
  const { data: propostas = [] } = useQuery({ queryKey: ['propostas', ano], queryFn: () => listarPropostas(ano) });
  const [editando, setEditando] = useState<Vendedor | 'novo' | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const hoje = hojeISO();
  const rh = pode('rh', 'editar');
  const veTodos = pode('rh', 'ler');
  const ordenados = useMemo(() => vendedores.filter((v) => !v.removido_em).filter((v) => veTodos || v.usuario_id === session?.user.id).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome)), [vendedores, veTodos, session?.user.id]);
  const semVendedor = propostas.filter((p) => !p.responsavel_id).length;

  return (
    <>
      <Cabecalho titulo={veTodos ? 'Vendedores' : 'Meus números'} subtitulo={veTodos ? `Equipe comercial e os números de ${ano}. O cadastro de vendedores é feito pelo RH.` : `Seus números de ${ano} e a sua assinatura de e-mail.`}
        acoes={rh ? <Botao onClick={() => setEditando('novo')}><Plus size={15} /> Cadastrar vendedor</Botao> : undefined} />
      {veTodos && semVendedor > 0 && <div className="mb-3"><Aviso tipo="info">{semVendedor} proposta(s) de {ano} sem vendedor. Escolha o vendedor na aba Dados da proposta.</Aviso></div>}
      {isLoading ? <EsqueletoCartoes /> : ordenados.length === 0 ? <Vazio>{veTodos ? 'Nenhum vendedor cadastrado.' : 'Você ainda não está cadastrado como vendedor. Peça ao RH.'}</Vazio> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ordenados.map((v) => {
            const dele = propostas.filter((p) => p.responsavel_id === v.usuario_id);
            const r = resumoVendedor(dele, hoje);
            return (
              <div key={v.usuario_id} className={`rounded-xl bg-superficie p-4 shadow-sm ring-1 ring-borda ${v.ativo ? '' : 'opacity-70'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar caminho={v.usuarios?.foto_caminho} versao={v.usuarios?.foto_atualizada_em} nome={v.nome} tamanho={40} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{v.nome || v.usuarios?.nome}</div>
                      <div className="text-xs text-suave">{v.cargo}{v.ativo ? '' : ' · inativo'}</div>
                    </div>
                  </div>
                  {rh && <button type="button" onClick={() => setEditando(v)} className="rounded p-1.5 text-suave hover:bg-pagina hover:text-texto" title="Editar"><Pencil size={15} /></button>}
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-suave">
                  {v.usuarios?.email && <div className="flex items-center gap-1.5"><Mail size={12} /> {loginVisivel(v.usuarios.email)}</div>}
                  {v.telefone && <div className="flex items-center gap-1.5"><Phone size={12} /> {v.telefone}</div>}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Numero rotulo="Propostas" valor={String(r.propostas)} />
                  <Numero rotulo="Aprovadas" valor={String(r.aprovadas)} />
                  <Numero rotulo="Conversão" valor={r.conversao === null ? '—' : `${r.conversao}%`} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                  <Numero rotulo="Em negociação" valor={moeda(r.negociacao)} />
                  <Numero rotulo="Valor aprovado" valor={moeda(r.valorAprovado)} destaque />
                </div>
                {r.vencidos > 0 && <div className="mt-2"><Selo cor="amarelo">{r.vencidos} follow-up(s) vencido(s)</Selo></div>}
                {v.usuario_id === session?.user.id && (
                  <button type="button" onClick={() => setAssinando(true)} className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg bg-pagina px-3 py-2 text-left text-xs ring-1 ring-borda hover:ring-roxo-300">
                    <span className="flex items-center gap-1.5 font-medium"><PenLine size={14} className="text-roxo-500 dark:text-roxo-300" /> Minha assinatura de e-mail</span>
                    <span className={minha?.html ? 'text-petroleo-600 dark:text-petroleo-100' : 'text-suave'}>{minha?.html ? 'Importada do Outlook' : 'Importar do Outlook'}</span>
                  </button>
                )}
                {dele.length > 0 && (
                  <button type="button" onClick={() => setAberto(aberto === v.usuario_id ? null : v.usuario_id)} className="mt-3 text-xs font-medium text-roxo-600 hover:underline dark:text-roxo-100">
                    {aberto === v.usuario_id ? 'Esconder propostas' : `Ver as ${dele.length} proposta(s)`}
                  </button>
                )}
                {aberto === v.usuario_id && (
                  <ul className="mt-2 divide-y divide-borda text-xs">
                    {dele.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="min-w-0 truncate"><span className="font-mono font-semibold text-roxo-600 dark:text-roxo-100">{p.codigo}</span> · {p.titulo}</span>
                        <span className="shrink-0 text-suave">{p.status} · {moeda(p.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
      {assinando && <AssinaturaModal onFechar={() => setAssinando(false)} />}
      {editando && <FichaVendedor vendedor={editando === 'novo' ? null : editando} jaVendedores={vendedores.filter((v) => !v.removido_em).map((v) => v.usuario_id)} onFechar={() => setEditando(null)} />}
    </>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-lg bg-pagina px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-suave">{rotulo}</div>
      <div className={`truncate text-sm font-semibold tabular-nums ${destaque ? 'text-petroleo-600 dark:text-petroleo-100' : ''}`}>{valor}</div>
    </div>
  );
}

// Cadastro do vendedor: escolhe um funcionário do RH com login (decisão 91) e completa cargo e telefone.
function FichaVendedor({ vendedor, jaVendedores, onFechar }: { vendedor: Vendedor | null; jaVendedores: string[]; onFechar: () => void }) {
  const qc = useQueryClient();
  const { data: candidatos = [] } = useQuery({ queryKey: ['vendedores', 'candidatos'], queryFn: listarCandidatosVendedor, enabled: !vendedor });
  const livres = candidatos.filter((c) => !jaVendedores.includes(c.usuario_id));
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [f, setF] = useState({
    usuario_id: vendedor?.usuario_id ?? '', nome: vendedor?.nome ?? '', cargo: vendedor?.cargo ?? 'Vendedor',
    telefone: vendedor?.telefone ?? '', observacoes: vendedor?.observacoes ?? '', ativo: vendedor?.ativo ?? true,
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro('');
    if (!f.usuario_id) return setErro('Escolha o usuário do vendedor. Ele precisa ter login no ERP.');
    if (f.nome.trim().length < 3) return setErro('Informe o nome do vendedor.');
    setSalvando(true);
    try {
      await salvarVendedor({ ...f, nome: f.nome.trim(), cargo: f.cargo.trim() || 'Vendedor', telefone: f.telefone.trim() }, !vendedor);
      await qc.invalidateQueries({ queryKey: ['vendedores'] });
      await qc.invalidateQueries({ queryKey: ['propostas'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); }
    setSalvando(false);
  }

  async function remover() {
    if (!vendedor) return;
    setErro(''); setSalvando(true);
    try {
      await removerVendedor(vendedor.usuario_id);
      await qc.invalidateQueries({ queryKey: ['vendedores'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); }
    setSalvando(false);
  }

  return (
    <Modal aberto titulo={vendedor ? `Vendedor · ${vendedor.nome}` : 'Cadastrar vendedor'} onFechar={onFechar}>
      <div className="space-y-3">
        {erro && <Aviso>{erro}</Aviso>}
        {vendedor ? (
          <div className="text-sm text-suave">Usuário: <b className="text-texto">{vendedor.usuarios?.email ? loginVisivel(vendedor.usuarios.email) : vendedor.usuarios?.nome}</b></div>
        ) : (
          <Campo rotulo="Funcionário (RH) *">
            <Selecao value={f.usuario_id} onChange={(e) => {
              const c = candidatos.find((x) => x.usuario_id === e.target.value);
              setF({ ...f, usuario_id: e.target.value, nome: f.nome || c?.nome || '', telefone: f.telefone || c?.telefone || '' });
            }}>
              <option value="">Escolha…</option>
              {livres.map((c) => <option key={c.usuario_id} value={c.usuario_id}>{c.nome} · {c.email}</option>)}
            </Selecao>
            <p className="mt-1 text-xs text-suave">{livres.length === 0
              ? 'Ninguém disponível. Só aparecem funcionários cadastrados no RH, com login no ERP e que ainda não são vendedores.'
              : 'Só aparecem funcionários cadastrados no RH, com login no ERP.'}</p>
          </Campo>
        )}
        <Campo rotulo="Nome do vendedor *"><Entrada value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Gabriel Alves" /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Cargo"><Entrada value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} placeholder="Vendedor, Gerente comercial…" /></Campo>
          <Campo rotulo="Telefone / WhatsApp"><Entrada value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Observações"><AreaTexto rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Campo>
        {vendedor && <Caixa marcado={f.ativo} onChange={(ativo) => setF({ ...f, ativo })}>Vendedor ativo (inativo não aparece para novas propostas)</Caixa>}
        {confirmarRemocao && (
          <Aviso>Remover {vendedor?.nome}? Ele sai da lista de vendedores e não pode ser escolhido em novas propostas. As propostas dele continuam com o nome dele. Dá para cadastrar de novo depois.</Aviso>
        )}
        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <div>
            {vendedor && (confirmarRemocao
              ? <div className="flex gap-2"><Botao variante="perigo" onClick={remover} disabled={salvando}>Sim, remover</Botao><Botao variante="fantasma" onClick={() => setConfirmarRemocao(false)}>Não</Botao></div>
              : <Botao variante="fantasma" className="text-red-600" onClick={() => setConfirmarRemocao(true)}><Trash2 size={15} /> Remover vendedor</Botao>)}
          </div>
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
            <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
          </div>
        </div>
      </div>
    </Modal>
  );
}
