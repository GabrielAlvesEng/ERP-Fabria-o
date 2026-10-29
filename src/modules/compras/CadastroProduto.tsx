import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { hojeISO, mensagemErro, moeda } from '@/shared/lib/formato';
import { Aviso, Botao, Campo, CampoNumero, Entrada, Modal, Selecao } from '@/shared/ui';
import { molduraNumero } from '@/modules/admin/predefinicoes/comum';
import { listarFornecedores, salvarProduto, type ProdutoCompras } from './api';
import { ROTULO_TIPO, TIPOS_PRODUTO, UNIDADES_PRODUTO, comImpostos, type TipoProduto } from './regras';

// Compras → Produtos → "Cadastrar produto" (decisão 121): um formulário só para todos os tipos.
// O material vai na descrição, entre parênteses. O preço digitado entra no histórico: sem fornecedor é "estimado".
const EXEMPLO: Record<TipoProduto, string> = {
  Chapas: 'Chapa lisa 5,00 x 1250 x 3000 (304)', Perfis: 'Tubo quadrado 30 x 30 x 1,50 (304)', Barras: 'Barra redonda 5/16" (304)',
  Comerciais: 'Rolamento 6205 2RS', Fixadores: 'Parafuso sextavado M12 x 40 (inox 304)', Consumíveis: 'Disco de corte 7" x 1,6 mm',
};
const UNIDADE_PADRAO: Record<TipoProduto, string> = { Chapas: 'kg', Perfis: 'm', Barras: 'm', Comerciais: 'un', Fixadores: 'un', Consumíveis: 'un' };

export function CadastroProdutoModal({ produto, onFechar, onSalvo }: { produto?: ProdutoCompras | null; onFechar: () => void; onSalvo: (id: string) => void }) {
  const { data: fornecedores = [] } = useQuery({ queryKey: ['compras', 'fornecedores'], queryFn: listarFornecedores });
  const [d, setD] = useState({
    grupo: (produto?.grupo ?? 'Chapas') as TipoProduto, descricao: produto?.descricao ?? '', unidade: produto?.unidade ?? 'kg',
    valor: Number(produto?.valor ?? 0), ipi: Number(produto?.ipi ?? 0), fornecedor_id: produto?.fornecedor_id ?? '', data: produto?.preco_data ?? hojeISO(),
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const unidades = UNIDADES_PRODUTO.some((u) => u.valor === d.unidade) ? UNIDADES_PRODUTO : [...UNIDADES_PRODUTO, { valor: d.unidade, rotulo: d.unidade }];

  async function salvar() {
    if (d.descricao.trim().length < 2) return setErro('Informe a descrição.');
    setSalvando(true); setErro('');
    try {
      const id = await salvarProduto(produto?.id ?? null, { ...d, descricao: d.descricao.trim(), fornecedor_id: d.fornecedor_id || null, data: d.data || null });
      onSalvo(id); onFechar();
    } catch (e) { setErro(mensagemErro(e)); }
    setSalvando(false);
  }

  return (
    <Modal aberto titulo={produto ? 'Editar produto' : 'Cadastrar produto'} onFechar={onFechar} largura="max-w-3xl">
      <div className="space-y-4 text-sm">
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex flex-wrap gap-2">
          {TIPOS_PRODUTO.map((t) => (
            <button key={t} type="button" onClick={() => setD({ ...d, grupo: t, unidade: produto ? d.unidade : UNIDADE_PADRAO[t] })}
              className={`rounded-full px-3 py-1.5 text-sm ring-1 transition ${d.grupo === t ? 'bg-roxo-600 text-white ring-roxo-600' : 'bg-superficie text-texto ring-borda hover:ring-roxo-300'}`}>{ROTULO_TIPO[t]}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Campo rotulo="Descrição (com o material entre parênteses)">
            <Entrada value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} placeholder={`Ex.: ${EXEMPLO[d.grupo]}`} autoFocus />
          </Campo>
          <Campo rotulo="Unidade de medida">
            <Selecao value={d.unidade} onChange={(e) => setD({ ...d, unidade: e.target.value })}>
              {unidades.map((u) => <option key={u.valor} value={u.valor}>{u.rotulo}</option>)}
            </Selecao>
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo={`Valor unitário (sem IPI, por ${d.unidade})`}><div className={molduraNumero}><CampoNumero moeda valor={d.valor} casas={4} className="py-1.5" onConfirmar={(n) => setD({ ...d, valor: n })} /></div></Campo>
          <Campo rotulo="IPI (%)"><div className={molduraNumero}><CampoNumero valor={d.ipi} casas={2} className="py-1.5" onConfirmar={(n) => setD({ ...d, ipi: Math.min(100, Math.max(0, n)) })} /></div></Campo>
          <Campo rotulo="Valor com impostos"><p className="rounded-lg bg-pagina px-3 py-2 text-right font-medium tabular-nums">{moeda(comImpostos(d.valor, d.ipi))}</p></Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Fornecedor (última cotação)">
            <Selecao value={d.fornecedor_id} onChange={(e) => setD({ ...d, fornecedor_id: e.target.value })}>
              <option value="">Sem fornecedor: valor estimado (internet)</option>
              {fornecedores.filter((f) => f.ativo || f.id === d.fornecedor_id).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Data (última cotação)"><Entrada type="date" value={d.data} onChange={(e) => setD({ ...d, data: e.target.value })} /></Campo>
        </div>
        <p className="text-xs text-suave">
          {d.fornecedor_id ? 'O preço entra no histórico como "Cotado".' : 'Sem fornecedor, o preço entra como "Estimado": serve para o levantamento de custo e é trocado quando chegar uma cotação.'}
          {produto && ' Se o preço não mudar, o histórico fica como está.'}
        </p>
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao disabled={salvando} onClick={salvar}><Plus size={15} /> {produto ? 'Salvar alterações' : 'Cadastrar'}</Botao>
        </div>
      </div>
    </Modal>
  );
}
