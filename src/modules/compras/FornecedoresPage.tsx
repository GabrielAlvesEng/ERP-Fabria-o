import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { formatarCNPJ, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Caixa, Campo, Entrada, EsqueletoTabela, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { listarFornecedores, salvarFornecedor, type Fornecedor } from './api';
import { ROTULO_PAGAMENTO } from './regras';

// Compras → Fornecedores (decisão 101): o mesmo cadastro de Administração → Predefinições, com CNPJ, categorias e pagamento.
export function FornecedoresPage() {
  const { pode } = useAuth();
  const editavel = pode('compras', 'editar') || pode('admin', 'editar');
  const { data: lista = [], isLoading } = useQuery({ queryKey: ['compras', 'fornecedores'], queryFn: listarFornecedores });
  const [busca, setBusca] = useState('');
  const [inativos, setInativos] = useState(false);
  const [editando, setEditando] = useState<Partial<Fornecedor> | null>(null);
  const filtrados = lista.filter((f) => (inativos || f.ativo) && (!busca || `${f.nome} ${f.cidade} ${f.categorias} ${f.contato}`.toLowerCase().includes(busca.toLowerCase())));
  return (
    <>
      <Cabecalho titulo="Fornecedores" subtitulo="Quem a Fabriaço cota e compra. Os serviços por hora/kg continuam em Administração → Predefinições."
        acoes={editavel ? <Botao onClick={() => setEditando({ nome: '', ativo: true, condicao_pagamento: 'a_combinar' })}><Plus size={15} /> Fornecedor</Botao> : undefined} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, cidade, categoria…" className="pl-9" />
        </div>
        <Caixa marcado={inativos} onChange={setInativos}>Mostrar inativos</Caixa>
      </div>
      {isLoading ? <EsqueletoTabela /> : filtrados.length === 0 ? <Vazio>Nenhum fornecedor.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Categorias</th><th className="px-3 py-2">Contato</th><th className="px-3 py-2">Pagamento</th><th className="w-10" />
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {filtrados.map((f) => (
                <tr key={f.id} className={f.ativo ? '' : 'opacity-60'}>
                  <td className="px-3 py-2"><span className="font-medium">{f.nome}</span>{!f.ativo && <> <Selo>Inativo</Selo></>}<span className="block text-xs text-suave">{[f.cnpj && formatarCNPJ(f.cnpj), f.cidade].filter(Boolean).join(' · ')}</span></td>
                  <td className="px-3 py-2 text-xs">{f.categorias || '—'}</td>
                  <td className="px-3 py-2 text-xs">{[f.contato, f.telefone, f.email].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-3 py-2 text-xs">{ROTULO_PAGAMENTO[f.condicao_pagamento]}</td>
                  <td className="px-2">{editavel && <button type="button" title="Editar" onClick={() => setEditando(f)} className="rounded p-1.5 text-suave hover:bg-pagina hover:text-texto"><Pencil size={15} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && <EditarFornecedor f={editando} onFechar={() => setEditando(null)} />}
    </>
  );
}

function EditarFornecedor({ f, onFechar }: { f: Partial<Fornecedor>; onFechar: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<Partial<Fornecedor>>(f);
  const [erro, setErro] = useState('');
  const set = <K extends keyof Fornecedor>(k: K, v: Fornecedor[K]) => setD((x) => ({ ...x, [k]: v }));
  async function salvar() {
    if ((d.nome ?? '').trim().length < 2) return setErro('Informe o nome.');
    try {
      const { id, nome, cnpj, cidade, contato, telefone, email, categorias, condicao_pagamento, observacoes, ativo } = d;
      await salvarFornecedor({ id, nome: nome!.trim(), cnpj: cnpj ?? '', cidade: cidade ?? '', contato: contato ?? '', telefone: telefone ?? '', email: email ?? '', categorias: categorias ?? '', condicao_pagamento: condicao_pagamento ?? 'a_combinar', observacoes: observacoes ?? '', ativo: ativo ?? true });
      await qc.invalidateQueries({ queryKey: ['compras', 'fornecedores'] });
      await qc.invalidateQueries({ queryKey: ['bib', 'fornecedores'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e).includes('fornecedores_nome_key') ? 'Já existe um fornecedor com este nome.' : mensagemErro(e)); }
  }
  return (
    <Modal aberto titulo={f.id ? 'Editar fornecedor' : 'Novo fornecedor'} onFechar={onFechar}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome"><Entrada value={d.nome ?? ''} onChange={(e) => set('nome', e.target.value)} autoFocus /></Campo>
          <Campo rotulo="CNPJ"><Entrada value={d.cnpj ?? ''} onChange={(e) => set('cnpj', e.target.value)} onBlur={(e) => set('cnpj', formatarCNPJ(e.target.value))} /></Campo>
          <Campo rotulo="Cidade"><Entrada value={d.cidade ?? ''} onChange={(e) => set('cidade', e.target.value)} /></Campo>
          <Campo rotulo="Contato"><Entrada value={d.contato ?? ''} onChange={(e) => set('contato', e.target.value)} /></Campo>
          <Campo rotulo="Telefone"><Entrada value={d.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} /></Campo>
          <Campo rotulo="E-mail"><Entrada type="email" value={d.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Campo>
        </div>
        <Campo rotulo="Categorias (o que fornece)"><Entrada value={d.categorias ?? ''} onChange={(e) => set('categorias', e.target.value)} placeholder="Ex.: chapas, perfis, parafusos, galvanização" /></Campo>
        <Campo rotulo="Pagamento ao fornecedor">
          <Selecao value={d.condicao_pagamento ?? 'a_combinar'} onChange={(e) => set('condicao_pagamento', e.target.value as Fornecedor['condicao_pagamento'])}>
            {Object.entries(ROTULO_PAGAMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Observações"><AreaTexto rows={2} value={d.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></Campo>
        {f.id && <Caixa marcado={d.ativo ?? true} onChange={(v) => set('ativo', v)}>Ativo (inativo não aparece em novas cotações)</Caixa>}
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar}>Salvar</Botao>
        </div>
      </div>
    </Modal>
  );
}
