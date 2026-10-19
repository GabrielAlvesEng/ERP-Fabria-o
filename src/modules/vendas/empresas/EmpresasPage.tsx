import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { apenasDigitos, cnpjValido, formatarCNPJ, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, Cartao, Entrada, Modal, Vazio } from '@/shared/ui';
import { listarContatos, listarEmpresas, salvarEmpresa } from '../api';
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
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Partial<Empresa> | null>(null);
  const { data: empresas = [], isLoading, error } = useQuery({ queryKey: ['empresas'], queryFn: listarEmpresas });
  const { data: contatos = [] } = useQuery({ queryKey: ['contatos'], queryFn: listarContatos });

  const qtdContatos = useMemo(() => {
    const m = new Map<string, number>();
    contatos.forEach((c) => m.set(c.empresa_id, (m.get(c.empresa_id) ?? 0) + 1));
    return m;
  }, [contatos]);

  const filtradas = empresas.filter((e) => {
    const t = normalizar(busca);
    return !t || normalizar(`${e.nome_fantasia} ${e.razao_social} ${e.cidade} ${e.cnpj ?? ''}`).includes(t);
  });

  return (
    <>
      <Cabecalho
        titulo="Empresas"
        subtitulo={`${empresas.length} empresas cadastradas`}
        acoes={pode('vendas', 'criar') && <Botao onClick={() => setEditando({ ...vazia })}><Plus size={16} /> Nova empresa</Botao>}
      />
      <Cartao className="p-0">
        <div className="border-b border-slate-200 p-3 dark:border-marinho-700">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <Entrada placeholder="Buscar por nome, cidade ou CNPJ" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        {error && <div className="p-3"><Aviso>{mensagemErro(error)}</Aviso></div>}
        {isLoading ? <Vazio>Carregando…</Vazio> : filtradas.length === 0 ? <Vazio>Nenhuma empresa encontrada.</Vazio> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-marinho-700/50">
                <tr><th className="px-4 py-2">Empresa</th><th className="px-4 py-2">CNPJ</th><th className="px-4 py-2">Cidade</th><th className="px-4 py-2">Contatos</th><th /></tr>
              </thead>
              <tbody>
                {filtradas.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50 dark:border-marinho-700 dark:hover:bg-marinho-700/40">
                    <td className="px-4 py-2"><div className="font-medium">{e.nome_fantasia}</div>{e.razao_social && <div className="text-xs text-slate-500">{e.razao_social}</div>}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatarCNPJ(e.cnpj) || '—'}</td>
                    <td className="px-4 py-2">{[e.cidade, e.uf].filter(Boolean).join('-') || '—'}</td>
                    <td className="px-4 py-2">{qtdContatos.get(e.id) ?? 0}</td>
                    <td className="px-4 py-2 text-right">
                      {pode('vendas', 'editar') && <Botao variante="fantasma" onClick={() => setEditando(e)} aria-label="Editar"><Pencil size={15} /></Botao>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
      {editando && <EmpresaForm inicial={editando} empresas={empresas} onFechar={() => setEditando(null)} />}
    </>
  );
}

function EmpresaForm({ inicial, empresas, onFechar }: { inicial: Partial<Empresa>; empresas: Empresa[]; onFechar: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<Partial<Empresa>>({ ...inicial, cnpj: formatarCNPJ(inicial.cnpj) });
  const [erro, setErro] = useState('');
  const set = (k: keyof Empresa) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  // Antiduplicação sem CNPJ: aviso de nome parecido (não bloqueia).
  const parecidas = useMemo(() => {
    const n = normalizar(f.nome_fantasia ?? '').trim();
    if (n.length < 3) return [];
    return empresas.filter((e) => e.id !== f.id && (normalizar(e.nome_fantasia).includes(n) || n.includes(normalizar(e.nome_fantasia)))).slice(0, 3);
  }, [f.nome_fantasia, f.id, empresas]);

  const m = useMutation({
    mutationFn: salvarEmpresa,
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
        <Campo rotulo="Nome fantasia *" className="sm:col-span-3"><Entrada value={f.nome_fantasia} onChange={set('nome_fantasia')} autoFocus /></Campo>
        <Campo rotulo="Razão social" className="sm:col-span-3"><Entrada value={f.razao_social} onChange={set('razao_social')} /></Campo>
        {parecidas.length > 0 && (
          <div className="sm:col-span-6"><Aviso tipo="info">Já existem empresas com nome parecido: {parecidas.map((p) => p.nome_fantasia).join(', ')}. Confira para não duplicar.</Aviso></div>
        )}
        <Campo rotulo="CNPJ" className="sm:col-span-3"><Entrada value={f.cnpj ?? ''} onChange={set('cnpj')} placeholder="00.000.000/0000-00" /></Campo>
        <Campo rotulo="Inscrição estadual" className="sm:col-span-3"><Entrada value={f.inscricao_estadual} onChange={set('inscricao_estadual')} /></Campo>
        <Campo rotulo="CEP" className="sm:col-span-2"><Entrada value={f.cep} onChange={set('cep')} /></Campo>
        <Campo rotulo="Logradouro" className="sm:col-span-3"><Entrada value={f.logradouro} onChange={set('logradouro')} /></Campo>
        <Campo rotulo="Número" className="sm:col-span-1"><Entrada value={f.numero} onChange={set('numero')} /></Campo>
        <Campo rotulo="Bairro" className="sm:col-span-2"><Entrada value={f.bairro} onChange={set('bairro')} /></Campo>
        <Campo rotulo="Cidade" className="sm:col-span-3"><Entrada value={f.cidade} onChange={set('cidade')} /></Campo>
        <Campo rotulo="UF" className="sm:col-span-1"><Entrada value={f.uf} onChange={set('uf')} maxLength={2} /></Campo>
        <Campo rotulo="Telefones" className="sm:col-span-3"><Entrada value={f.telefones} onChange={set('telefones')} /></Campo>
        <Campo rotulo="E-mails" className="sm:col-span-3"><Entrada value={f.emails} onChange={set('emails')} /></Campo>
        <Campo rotulo="Site" className="sm:col-span-6"><Entrada value={f.site} onChange={set('site')} /></Campo>
        <Campo rotulo="Observações" className="sm:col-span-6"><AreaTexto value={f.observacoes} onChange={set('observacoes')} /></Campo>
        <div className="flex justify-end gap-2 sm:col-span-6">
          <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={m.isPending}>{m.isPending ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </form>
    </Modal>
  );
}
