import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Loader2, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { consultarCNPJ } from '@/shared/lib/cnpj';
import { apenasDigitos, cnpjValido, formatarCNPJ, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, Cartao, Entrada, Modal, Selo, Vazio } from '@/shared/ui';
import { definirAtivoEmpresa, listarContatos, listarEmpresas, salvarEmpresa } from '../api';
import type { Empresa } from '../types';

const vazia: Partial<Empresa> = {
  nome_fantasia: '', razao_social: '', cnpj: '', inscricao_estadual: '', cep: '', logradouro: '', numero: '',
  complemento: '', bairro: '', cidade: '', uf: '', telefones: '', emails: '', site: '', observacoes: '',
};

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function EmpresasPage() {
  const { pode } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Partial<Empresa> | null>(null);
  const [erro, setErro] = useState('');
  const { data: empresas = [], isLoading, error } = useQuery({ queryKey: ['empresas'], queryFn: listarEmpresas });
  const { data: contatos = [] } = useQuery({ queryKey: ['contatos'], queryFn: listarContatos });

  const qtdContatos = useMemo(() => {
    const m = new Map<string, number>();
    contatos.forEach((c) => m.set(c.empresa_id, (m.get(c.empresa_id) ?? 0) + 1));
    return m;
  }, [contatos]);

  const t = normalizar(busca);
  const filtradas = empresas.filter((e) => !t || normalizar(`${e.nome_fantasia} ${e.razao_social} ${e.cidade} ${e.cnpj ?? ''}`).includes(t));
  const ativas = filtradas.filter((e) => e.ativo);
  const desativadas = filtradas.filter((e) => !e.ativo);

  const reativar = useMutation({
    mutationFn: (id: string) => definirAtivoEmpresa(id, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['empresas'] }),
    onError: (e) => setErro(mensagemErro(e)),
  });

  const tabela = (lista: Empresa[], inativas: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-marinho-700/50">
          <tr><th className="px-4 py-2">Empresa</th><th className="px-4 py-2">CNPJ</th><th className="px-4 py-2">Cidade</th><th className="px-4 py-2">Contatos</th><th /></tr>
        </thead>
        <tbody>
          {lista.map((e) => (
            <tr key={e.id} className={`border-t border-slate-100 hover:bg-slate-50 dark:border-marinho-700 dark:hover:bg-marinho-700/40 ${inativas ? 'text-slate-500' : ''}`}>
              <td className="px-4 py-2"><div className="font-medium">{e.nome_fantasia}</div>{e.razao_social && <div className="text-xs text-slate-500">{e.razao_social}</div>}</td>
              <td className="px-4 py-2 whitespace-nowrap">{formatarCNPJ(e.cnpj) || '—'}</td>
              <td className="px-4 py-2">{[e.cidade, e.uf].filter(Boolean).join('-') || '—'}</td>
              <td className="px-4 py-2">{qtdContatos.get(e.id) ?? 0}</td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                {pode('vendas', 'editar') && (inativas ? (
                  <Botao variante="secundario" onClick={() => reativar.mutate(e.id)} disabled={reativar.isPending}><RotateCcw size={14} /> Reativar</Botao>
                ) : (
                  <Botao variante="fantasma" onClick={() => setEditando(e)} aria-label="Editar"><Pencil size={15} /></Botao>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <Cabecalho
        titulo="Empresas"
        subtitulo={`${empresas.filter((e) => e.ativo).length} empresas ativas · ${empresas.filter((e) => !e.ativo).length} desativadas`}
        acoes={pode('vendas', 'criar') && <Botao onClick={() => setEditando({ ...vazia })}><Plus size={16} /> Nova empresa</Botao>}
      />
      {erro && <div className="mb-3"><Aviso>{erro}</Aviso></div>}
      <Cartao className="p-0">
        <div className="border-b border-slate-200 p-3 dark:border-marinho-700">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <Entrada placeholder="Buscar por nome, cidade ou CNPJ" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        {error && <div className="p-3"><Aviso>{mensagemErro(error)}</Aviso></div>}
        {isLoading ? <Vazio>Carregando…</Vazio> : ativas.length === 0 ? <Vazio>Nenhuma empresa ativa encontrada.</Vazio> : tabela(ativas, false)}
      </Cartao>

      {desativadas.length > 0 && (
        <Cartao className="mt-5 p-0">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-marinho-700">
            <Ban size={16} className="text-slate-400" />
            <span className="font-semibold">Empresas desativadas</span>
            <Selo>{desativadas.length}</Selo>
            <span className="text-xs text-slate-500">Não aparecem para novos contatos e propostas. O histórico continua preservado.</span>
          </div>
          {tabela(desativadas, true)}
        </Cartao>
      )}

      {editando && <EmpresaForm inicial={editando} empresas={empresas} onFechar={() => setEditando(null)} />}
    </>
  );
}

function EmpresaForm({ inicial, empresas, onFechar }: { inicial: Partial<Empresa>; empresas: Empresa[]; onFechar: () => void }) {
  const qc = useQueryClient();
  const { pode } = useAuth();
  const [f, setF] = useState<Partial<Empresa>>({ ...inicial, cnpj: formatarCNPJ(inicial.cnpj) });
  const [erro, setErro] = useState('');
  const [infoCnpj, setInfoCnpj] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [ultimoConsultado, setUltimoConsultado] = useState(apenasDigitos(inicial.cnpj ?? ''));
  const [confirmarDesativar, setConfirmarDesativar] = useState(false);
  const set = (k: keyof Empresa) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  // Antiduplicação sem CNPJ: aviso de nome parecido (não bloqueia).
  const parecidas = useMemo(() => {
    const n = normalizar(f.nome_fantasia ?? '').trim();
    if (n.length < 3) return [];
    return empresas.filter((e) => e.id !== f.id && (normalizar(e.nome_fantasia).includes(n) || n.includes(normalizar(e.nome_fantasia)))).slice(0, 3);
  }, [f.nome_fantasia, f.id, empresas]);

  // Ao completar um CNPJ válido, busca os dados na Receita e preenche só os campos vazios.
  async function aoMudarCnpj(valor: string) {
    const d = apenasDigitos(valor).slice(0, 14);
    const atual = { ...f, cnpj: d.length === 14 ? formatarCNPJ(d) : valor };
    setF(atual);
    setInfoCnpj('');
    if (d.length !== 14 || d === ultimoConsultado) return;
    if (!cnpjValido(d)) return setInfoCnpj('CNPJ inválido.');
    const dup = empresas.find((e) => e.cnpj === d && e.id !== f.id);
    if (dup) return setInfoCnpj(`Já existe a empresa ${dup.nome_fantasia} com este CNPJ${dup.ativo ? '' : ' (desativada)'}.`);
    setUltimoConsultado(d);
    setConsultando(true);
    try {
      const r = await consultarCNPJ(d);
      setF((ant) => {
        const novo = { ...ant };
        (['razao_social', 'nome_fantasia', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'telefones', 'emails'] as const).forEach((k) => {
          if (!String(novo[k] ?? '').trim() && r[k]) novo[k] = r[k];
        });
        if (!String(novo.nome_fantasia ?? '').trim()) novo.nome_fantasia = r.razao_social;
        return novo;
      });
      setInfoCnpj(`Dados preenchidos pela Receita Federal${r.situacao ? ` · situação: ${r.situacao}` : ''}. Confira antes de salvar.`);
    } catch (e) {
      setUltimoConsultado(''); // permite tentar de novo
      setInfoCnpj(mensagemErro(e));
    } finally {
      setConsultando(false);
    }
  }

  const m = useMutation({
    mutationFn: salvarEmpresa,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresas'] });
      onFechar();
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  const desativar = useMutation({
    mutationFn: () => definirAtivoEmpresa(f.id!, false),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresas'] });
      onFechar();
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro('');
    const cnpj = apenasDigitos(f.cnpj ?? '');
    if (!f.nome_fantasia?.trim()) return setErro('Informe o nome da empresa.');
    if (cnpj && !cnpjValido(cnpj)) return setErro('CNPJ inválido.');
    m.mutate({ ...f, cnpj: cnpj || null, uf: (f.uf ?? '').toUpperCase().slice(0, 2) });
  }

  return (
    <Modal aberto titulo={f.id ? 'Editar empresa' : 'Nova empresa'} onFechar={onFechar} largura="max-w-2xl">
      <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-6">
        {erro && <div className="sm:col-span-6"><Aviso>{erro}</Aviso></div>}
        <Campo rotulo="CNPJ (preenche os dados automaticamente)" className="sm:col-span-3">
          <div className="relative">
            <Entrada value={f.cnpj ?? ''} onChange={(e) => aoMudarCnpj(e.target.value)} placeholder="00.000.000/0000-00" inputMode="numeric" autoFocus={!f.id} />
            {consultando && <Loader2 size={16} className="absolute right-3 top-2.5 animate-spin text-roxo-500" />}
          </div>
        </Campo>
        <Campo rotulo="Inscrição estadual" className="sm:col-span-3"><Entrada value={f.inscricao_estadual} onChange={set('inscricao_estadual')} /></Campo>
        {infoCnpj && <div className="sm:col-span-6"><Aviso tipo={infoCnpj.startsWith('Dados') ? 'info' : 'erro'}>{infoCnpj}</Aviso></div>}
        <Campo rotulo="Nome fantasia *" className="sm:col-span-3"><Entrada value={f.nome_fantasia} onChange={set('nome_fantasia')} /></Campo>
        <Campo rotulo="Razão social" className="sm:col-span-3"><Entrada value={f.razao_social} onChange={set('razao_social')} /></Campo>
        {parecidas.length > 0 && (
          <div className="sm:col-span-6"><Aviso tipo="info">Já existem empresas com nome parecido: {parecidas.map((p) => p.nome_fantasia).join(', ')}. Confira para não duplicar.</Aviso></div>
        )}
        <Campo rotulo="CEP" className="sm:col-span-2"><Entrada value={f.cep} onChange={set('cep')} /></Campo>
        <Campo rotulo="Logradouro" className="sm:col-span-3"><Entrada value={f.logradouro} onChange={set('logradouro')} /></Campo>
        <Campo rotulo="Número" className="sm:col-span-1"><Entrada value={f.numero} onChange={set('numero')} /></Campo>
        <Campo rotulo="Complemento" className="sm:col-span-2"><Entrada value={f.complemento} onChange={set('complemento')} /></Campo>
        <Campo rotulo="Bairro" className="sm:col-span-2"><Entrada value={f.bairro} onChange={set('bairro')} /></Campo>
        <Campo rotulo="Cidade" className="sm:col-span-1"><Entrada value={f.cidade} onChange={set('cidade')} /></Campo>
        <Campo rotulo="UF" className="sm:col-span-1"><Entrada value={f.uf} onChange={set('uf')} maxLength={2} /></Campo>
        <Campo rotulo="Telefones" className="sm:col-span-3"><Entrada value={f.telefones} onChange={set('telefones')} /></Campo>
        <Campo rotulo="E-mails" className="sm:col-span-3"><Entrada value={f.emails} onChange={set('emails')} /></Campo>
        <Campo rotulo="Site" className="sm:col-span-6"><Entrada value={f.site} onChange={set('site')} /></Campo>
        <Campo rotulo="Observações" className="sm:col-span-6"><AreaTexto value={f.observacoes} onChange={set('observacoes')} /></Campo>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-6">
          <div>
            {f.id && f.ativo && pode('vendas', 'editar') && (
              <Botao type="button" variante="secundario" className="text-red-600 ring-red-200 hover:bg-red-50 dark:text-red-300" onClick={() => setConfirmarDesativar(true)}>
                <Ban size={15} /> Desativar empresa
              </Botao>
            )}
          </div>
          <div className="flex gap-2">
            <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
            <Botao type="submit" disabled={m.isPending}>{m.isPending ? 'Salvando…' : 'Salvar'}</Botao>
          </div>
        </div>
      </form>

      <Modal aberto={confirmarDesativar} titulo={`Desativar ${f.nome_fantasia}?`} onFechar={() => setConfirmarDesativar(false)}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          A empresa vai para a lista de desativadas e deixa de aparecer ao cadastrar contatos e propostas. Nada é apagado:
          contatos, propostas e histórico continuam preservados, e você pode reativá-la quando quiser.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setConfirmarDesativar(false)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={() => desativar.mutate()} disabled={desativar.isPending}>{desativar.isPending ? 'Desativando…' : 'Desativar'}</Botao>
        </div>
      </Modal>
    </Modal>
  );
}
