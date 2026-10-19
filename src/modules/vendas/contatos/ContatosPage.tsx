import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Pencil, Plus, Search } from 'lucide-react';
import { useAno } from '@/app/AnoContext';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, Cartao, Entrada, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { incluirContatoNoAno, listarContatos, listarEmpresas, salvarContato } from '../api';
import type { Contato } from '../types';

const vazio: Partial<Contato> = { nome: '', empresa_id: '', cargo: '', departamento: '', email: '', telefone: '', whatsapp: '', unidade: '', observacoes: '' };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function ContatosPage() {
  const { ano } = useAno();
  const { pode } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [todos, setTodos] = useState(false);
  const [editando, setEditando] = useState<Partial<Contato> | null>(null);
  const [incluindo, setIncluindo] = useState(false);
  const [erro, setErro] = useState('');
  const { data: contatos = [], isLoading } = useQuery({ queryKey: ['contatos'], queryFn: listarContatos });

  const ccDoAno = (c: Contato) => c.contato_anos?.find((a) => a.ano === ano)?.codigo_comercial;

  const lista = useMemo(() => {
    const t = norm(busca);
    return contatos
      .filter((c) => todos || ccDoAno(c) !== undefined)
      .filter((c) => !t || norm(`${c.nome} ${c.empresas?.nome_fantasia ?? ''} ${c.email}`).includes(t))
      .sort((a, b) => (ccDoAno(a) ?? 9999) - (ccDoAno(b) ?? 9999) || a.nome.localeCompare(b.nome));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contatos, busca, todos, ano]);

  const incluir = useMutation({
    mutationFn: (id: string) => incluirContatoNoAno(id, ano),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contatos'] }),
    onError: (e) => setErro(mensagemErro(e)),
  });

  const doAno = contatos.filter((c) => ccDoAno(c) !== undefined).length;

  return (
    <>
      <Cabecalho
        titulo="Contatos"
        subtitulo={`${doAno} contatos ativos em ${ano} · ${contatos.length} no total`}
        acoes={
          <>
            {pode('vendas', 'editar') && <Botao variante="secundario" onClick={() => setIncluindo(true)}><CalendarPlus size={16} /> Incluir contato existente em {ano}</Botao>}
            {pode('vendas', 'criar') && <Botao onClick={() => setEditando({ ...vazio })}><Plus size={16} /> Novo contato</Botao>}
          </>
        }
      />
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      <Cartao className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-3 dark:border-marinho-700">
          <div className="relative w-full max-w-sm">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <Entrada placeholder="Buscar por nome, empresa ou e-mail" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> Mostrar contatos de todos os anos</label>
        </div>
        {isLoading ? <Vazio>Carregando…</Vazio> : lista.length === 0 ? <Vazio>Nenhum contato em {ano}. Use “Incluir contato existente” ou crie uma proposta.</Vazio> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-marinho-700/50">
                <tr><th className="px-4 py-2">CC {ano}</th><th className="px-4 py-2">Nome</th><th className="px-4 py-2">Empresa</th><th className="px-4 py-2">Telefone</th><th className="px-4 py-2">E-mail</th><th className="px-4 py-2">Situação</th><th /></tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const cc = ccDoAno(c);
                  return (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-marinho-700 dark:hover:bg-marinho-700/40">
                      <td className="px-4 py-2 font-mono font-semibold">{cc !== undefined ? String(cc).padStart(2, '0') : '—'}</td>
                      <td className="px-4 py-2"><div className="font-medium">{c.nome}</div>{c.cargo && <div className="text-xs text-slate-500">{c.cargo}</div>}</td>
                      <td className="px-4 py-2">{c.empresas?.nome_fantasia}{c.unidade && <div className="text-xs text-slate-500">{c.unidade}</div>}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{c.telefone || '—'}</td>
                      <td className="px-4 py-2">{c.email || '—'}</td>
                      <td className="px-4 py-2">{c.classificacao === 'cliente' ? <Selo cor="verde">Cliente</Selo> : <Selo>Lead</Selo>}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {cc === undefined && pode('vendas', 'editar') && (
                          <Botao variante="fantasma" onClick={() => incluir.mutate(c.id)} title={`Incluir em ${ano}`}><CalendarPlus size={15} /></Botao>
                        )}
                        {pode('vendas', 'editar') && <Botao variante="fantasma" onClick={() => setEditando(c)} aria-label="Editar"><Pencil size={15} /></Botao>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
      {editando && <ContatoForm inicial={editando} ano={ano} onFechar={() => setEditando(null)} />}
      {incluindo && (
        <IncluirNoAno
          ano={ano}
          contatos={contatos.filter((c) => ccDoAno(c) === undefined)}
          onIncluir={(id) => incluir.mutate(id)}
          onFechar={() => setIncluindo(false)}
        />
      )}
    </>
  );
}

function ContatoForm({ inicial, ano, onFechar }: { inicial: Partial<Contato>; ano: number; onFechar: () => void }) {
  const qc = useQueryClient();
  const { data: empresas = [] } = useQuery({ queryKey: ['empresas'], queryFn: listarEmpresas });
  const [f, setF] = useState<Partial<Contato>>(inicial);
  const [noAno, setNoAno] = useState(!inicial.id);
  const [erro, setErro] = useState('');
  const set = (k: keyof Contato) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const m = useMutation({
    mutationFn: async () => {
      const id = await salvarContato(f);
      if (noAno) await incluirContatoNoAno(id, ano);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contatos'] });
      onFechar();
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!f.empresa_id) return setErro('Escolha a empresa.');
    if ((f.nome ?? '').trim().length < 2) return setErro('Informe o nome.');
    m.mutate();
  }

  return (
    <Modal aberto titulo={f.id ? 'Editar contato' : 'Novo contato'} onFechar={onFechar} largura="max-w-2xl">
      <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
        {erro && <div className="sm:col-span-2"><Aviso>{erro}</Aviso></div>}
        <Campo rotulo="Nome *"><Entrada value={f.nome} onChange={set('nome')} autoFocus /></Campo>
        <Campo rotulo="Empresa *">
          <Selecao value={f.empresa_id} onChange={set('empresa_id')}>
            <option value="">Selecione…</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome_fantasia}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Cargo"><Entrada value={f.cargo} onChange={set('cargo')} /></Campo>
        <Campo rotulo="Departamento"><Entrada value={f.departamento} onChange={set('departamento')} /></Campo>
        <Campo rotulo="E-mail"><Entrada type="email" value={f.email} onChange={set('email')} /></Campo>
        <Campo rotulo="Telefone"><Entrada value={f.telefone} onChange={set('telefone')} /></Campo>
        <Campo rotulo="WhatsApp"><Entrada value={f.whatsapp} onChange={set('whatsapp')} /></Campo>
        <Campo rotulo="Unidade / cidade"><Entrada value={f.unidade} onChange={set('unidade')} /></Campo>
        <Campo rotulo="Observações" className="sm:col-span-2"><AreaTexto value={f.observacoes} onChange={set('observacoes')} /></Campo>
        {!f.id && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={noAno} onChange={(e) => setNoAno(e.target.checked)} /> Incluir já em {ano} (recebe o próximo código do cliente)
          </label>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={m.isPending}>{m.isPending ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </form>
    </Modal>
  );
}

function IncluirNoAno({ ano, contatos, onIncluir, onFechar }: { ano: number; contatos: Contato[]; onIncluir: (id: string) => void; onFechar: () => void }) {
  const [busca, setBusca] = useState('');
  const t = norm(busca);
  const lista = contatos.filter((c) => !t || norm(`${c.nome} ${c.empresas?.nome_fantasia ?? ''}`).includes(t)).slice(0, 50);
  return (
    <Modal aberto titulo={`Incluir contato existente em ${ano}`} onFechar={onFechar}>
      <p className="mb-3 text-sm text-slate-500">O contato não é duplicado. Ele só passa a fazer parte de {ano} e recebe o próximo código do cliente do ano.</p>
      <Entrada placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
      <div className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-marinho-700">
        {lista.length === 0 && <Vazio>Nenhum contato fora de {ano}.</Vazio>}
        {lista.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-2 text-sm">
            <div><div className="font-medium">{c.nome}</div><div className="text-xs text-slate-500">{c.empresas?.nome_fantasia}</div></div>
            <Botao variante="secundario" onClick={() => onIncluir(c.id)}>Incluir</Botao>
          </div>
        ))}
      </div>
    </Modal>
  );
}
