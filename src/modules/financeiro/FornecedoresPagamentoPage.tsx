import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Search } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { formatarCNPJ, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, CampoInteiro, Entrada, EsqueletoTabela, Modal, Vazio } from '@/shared/ui';
import { listarDadosPagamento, listarFornecedores, salvarDadosPagamento, type DadosPagamentoFornecedor } from './api';
import { ROTULO_CONDICAO } from './regras';

const VAZIO = { banco: '', agencia: '', conta: '', titular: '', documento_titular: '', chave_pix: '', prazo_apos_recebimento: 28, observacoes: '' };

// Financeiro → Dados de pagamento (decisão 105): banco, PIX e prazo depois da entrega de cada fornecedor.
// O cadastro do fornecedor continua em Compras; esta parte só o Financeiro vê.
export function FornecedoresPagamentoPage() {
  const { pode } = useAuth();
  const { data: fornecedores = [], isLoading } = useQuery({ queryKey: ['financeiro', 'fornecedores'], queryFn: listarFornecedores });
  const { data: dados = [] } = useQuery({ queryKey: ['financeiro', 'fornecedores_pagamento'], queryFn: listarDadosPagamento });
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<DadosPagamentoFornecedor & { nome: string } | null>(null);
  const deFornecedor = new Map(dados.map((d) => [d.fornecedor_id, d]));
  const lista = fornecedores.filter((f) => f.ativo && (!busca || `${f.nome} ${f.cnpj}`.toLowerCase().includes(busca.toLowerCase())));

  return (
    <>
      <Cabecalho titulo="Dados de pagamento" subtitulo="Banco, PIX e prazo de pagamento depois da entrega. O cadastro do fornecedor fica em Compras." />
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
        <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar fornecedor ou CNPJ…" className="pl-9" />
      </div>
      {isLoading ? <EsqueletoTabela /> : lista.length === 0 ? <Vazio>Nenhum fornecedor ativo.</Vazio> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Condição (Compras)</th><th className="px-3 py-2">Prazo após entrega</th>
              <th className="px-3 py-2">PIX</th><th className="px-3 py-2">Banco / conta</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {lista.map((f) => {
                const d = deFornecedor.get(f.id);
                return (
                  <tr key={f.id} className="hover:bg-pagina">
                    <td className="px-3 py-2 font-medium">{f.nome}<span className="block text-xs font-normal text-suave">{formatarCNPJ(f.cnpj)}</span></td>
                    <td className="px-3 py-2">{ROTULO_CONDICAO[f.condicao_pagamento] ?? f.condicao_pagamento}</td>
                    <td className="px-3 py-2">{d?.prazo_apos_recebimento ?? 28} dias</td>
                    <td className="px-3 py-2 font-mono text-xs">{d?.chave_pix || <span className="font-sans text-suave">—</span>}</td>
                    <td className="px-3 py-2 text-xs">{d?.banco ? `${d.banco} · ${d.agencia} / ${d.conta}` : <span className="text-suave">—</span>}</td>
                    <td className="px-3 py-2 text-right">
                      {pode('financeiro', 'editar') && <Botao variante="secundario" tamanho="sm" onClick={() => setEditando({ ...VAZIO, ...d, fornecedor_id: f.id, nome: f.nome })}><Pencil size={13} /> Editar</Botao>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editando && <EditarModal inicial={editando} onFechar={() => setEditando(null)} />}
    </>
  );
}

function EditarModal({ inicial, onFechar }: { inicial: DadosPagamentoFornecedor & { nome: string }; onFechar: () => void }) {
  const qc = useQueryClient();
  const { nome, ...resto } = inicial;
  const [d, setD] = useState<DadosPagamentoFornecedor>(resto);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const campo = (k: keyof DadosPagamentoFornecedor) => ({ value: String(d[k] ?? ''), onChange: (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value }) });

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      await salvarDadosPagamento({ ...d, prazo_apos_recebimento: Number(d.prazo_apos_recebimento) || 0 });
      await qc.invalidateQueries({ queryKey: ['financeiro', 'fornecedores_pagamento'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); } finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo={`Dados de pagamento · ${nome}`} onFechar={onFechar} largura="max-w-xl">
      <div className="space-y-3">
        <Campo rotulo="Chave PIX"><Entrada {...campo('chave_pix')} /></Campo>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Banco"><Entrada {...campo('banco')} /></Campo>
          <Campo rotulo="Agência"><Entrada {...campo('agencia')} /></Campo>
          <Campo rotulo="Conta"><Entrada {...campo('conta')} /></Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Titular"><Entrada {...campo('titular')} /></Campo>
          <Campo rotulo="CPF/CNPJ do titular"><Entrada {...campo('documento_titular')} /></Campo>
        </div>
        <Campo rotulo="Prazo para pagar depois da entrega (dias)">
          <CampoInteiro valor={d.prazo_apos_recebimento} min={0} max={365} onChange={(v) => setD({ ...d, prazo_apos_recebimento: v ?? 0 })} sufixo="dias" />
        </Campo>
        <p className="text-xs text-suave">Usado quando a ordem de compra é "após o recebimento" e Compras não informou os dias.</p>
        <Campo rotulo="Observações"><AreaTexto {...campo('observacoes')} rows={2} /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </div>
    </Modal>
  );
}
