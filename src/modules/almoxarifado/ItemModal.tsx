import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataHoraBR, mensagemErro, moeda } from '@/shared/lib/formato';
import { Aviso, Botao, Campo, Entrada, Modal, Selo, Vazio } from '@/shared/ui';
import { adicionarItem, ajustarEstoque, atualizarItem, listarMovimentosItem, listarProdutos, type ItemEstoque, type Movimento } from './api';
import { BuscaItem } from './BuscaItem';
import { ROTULO_MOVIMENTO, ROTULO_SITUACAO, lerQuantidade, qtd, situacaoEstoque, unidadePadrao } from './regras';

// Incluir no estoque um produto do cadastro único (o Almoxarifado não cria produto: decisão 104, resposta 1).
export function IncluirItemModal({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const { data: produtos = [] } = useQuery({ queryKey: ['almoxarifado', 'produtos'], queryFn: listarProdutos });
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [unidade, setUnidade] = useState('un');
  const [minimo, setMinimo] = useState('');
  const [local, setLocal] = useState('');
  const [saldo, setSaldo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const chave = (p: { bib_tipo: string; bib_id: string }) => `${p.bib_tipo}:${p.bib_id}`;
  const produto = produtos.find((p) => chave(p) === escolhido);

  async function salvar() {
    if (!produto) return setErro('Escolha o produto.');
    const m = lerQuantidade(minimo || '0'); const s = lerQuantidade(saldo || '0');
    if (m == null || m < 0 || s == null || s < 0) return setErro('Mínimo e saldo precisam ser números (0 ou mais).');
    setSalvando(true); setErro('');
    try {
      await adicionarItem({ bib_tipo: produto.bib_tipo, bib_id: produto.bib_id, unidade: unidade.trim() || 'un', minimo: m, local: local.trim(), saldo_inicial: s });
      await qc.invalidateQueries({ queryKey: ['almoxarifado'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); setSalvando(false); }
  }

  return (
    <Modal aberto titulo="Incluir produto no estoque" onFechar={onFechar}>
      <div className="space-y-3">
        {produto ? (
          <div className="flex items-start justify-between gap-2 rounded-lg bg-pagina px-3 py-2 text-sm">
            <span><span className="font-medium">{produto.descricao}</span><span className="block text-xs text-suave">{produto.grupo}</span></span>
            <Botao tamanho="sm" variante="fantasma" onClick={() => setEscolhido(null)}>Trocar</Botao>
          </div>
        ) : (
          <Campo rotulo="Produto do cadastro">
            <BuscaItem autoFocus placeholder="Digite parte do nome (ex.: disco corte)"
              opcoes={produtos.map((p) => ({ id: chave(p), titulo: p.descricao, detalhe: p.no_estoque ? 'já no estoque' : p.grupo, desativada: p.no_estoque }))}
              onEscolher={(id) => { setEscolhido(id); const p = produtos.find((x) => chave(x) === id); if (p) setUnidade(unidadePadrao(p.bib_tipo, p.unidade)); }} />
          </Campo>
        )}
        <p className="text-xs text-suave">Não achou? O produto precisa ser cadastrado primeiro em Compras (cadastro de produtos da Biblioteca de Materiais).</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Unidade do estoque"><Entrada value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, cx, m, kg…" /></Campo>
          <Campo rotulo="Local (prateleira, armário)"><Entrada value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Prateleira A2" /></Campo>
          <Campo rotulo="Estoque mínimo"><Entrada value={minimo} onChange={(e) => setMinimo(e.target.value)} inputMode="decimal" placeholder="0" /></Campo>
          <Campo rotulo="Saldo contado agora"><Entrada value={saldo} onChange={(e) => setSaldo(e.target.value)} inputMode="decimal" placeholder="0" /></Campo>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Incluindo…' : 'Incluir no estoque'}</Botao>
        </div>
      </div>
    </Modal>
  );
}

// Ficha do item: mínimo, local, ajuste de inventário e o histórico de movimentos.
export function ItemModal({ item, onFechar }: { item: ItemEstoque; onFechar: () => void }) {
  const qc = useQueryClient();
  const { pode } = useAuth();
  const editavel = pode('almoxarifado', 'editar');
  const { data: movimentos = [], isLoading } = useQuery({ queryKey: ['almoxarifado', 'movimentos', item.id], queryFn: () => listarMovimentosItem(item.id) });
  const [minimo, setMinimo] = useState(qtd(item.minimo));
  const [local, setLocal] = useState(item.local);
  const [contado, setContado] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const s = situacaoEstoque(item.saldo, item.minimo);
  const atualizar = () => qc.invalidateQueries({ queryKey: ['almoxarifado'] });

  async function executar(f: () => Promise<void>) {
    setOcupado(true); setErro('');
    try { await f(); await atualizar(); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  const salvarDados = () => executar(async () => {
    const m = lerQuantidade(minimo || '0');
    if (m == null || m < 0) throw new Error('O mínimo precisa ser um número (0 ou mais).');
    await atualizarItem(item.id, { minimo: m, local: local.trim() });
  });
  const ajustar = () => executar(async () => {
    const c = lerQuantidade(contado);
    if (c == null || c < 0) throw new Error('Informe o saldo contado.');
    await ajustarEstoque(item.id, c, motivo.trim());
    setContado(''); setMotivo('');
  });

  return (
    <Modal aberto titulo={item.descricao} onFechar={onFechar} largura="max-w-3xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-2xl font-semibold tabular-nums">{qtd(item.saldo)} <span className="text-sm font-normal text-suave">{item.unidade}</span></span>
          <Selo cor={ROTULO_SITUACAO[s].cor}>{ROTULO_SITUACAO[s].rotulo}</Selo>
          <span className="text-suave">{item.grupo} · custo médio {moeda(item.custo_medio)}</span>
        </div>
        {editavel && (
          <div className="grid gap-3 rounded-xl p-3 ring-1 ring-borda sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Campo rotulo="Estoque mínimo"><Entrada value={minimo} onChange={(e) => setMinimo(e.target.value)} inputMode="decimal" /></Campo>
            <Campo rotulo="Local"><Entrada value={local} onChange={(e) => setLocal(e.target.value)} /></Campo>
            <div className="flex gap-2">
              <Botao variante="secundario" onClick={salvarDados} disabled={ocupado}>Salvar</Botao>
              <Botao variante="fantasma" disabled={ocupado} onClick={() => executar(() => atualizarItem(item.id, { ativo: !item.ativo }))}>{item.ativo ? 'Desativar' : 'Reativar'}</Botao>
            </div>
          </div>
        )}
        {editavel && (
          <div className="grid gap-3 rounded-xl p-3 ring-1 ring-borda sm:grid-cols-[10rem_1fr_auto] sm:items-end">
            <Campo rotulo="Contagem: saldo real"><Entrada value={contado} onChange={(e) => setContado(e.target.value)} inputMode="decimal" placeholder={qtd(item.saldo)} /></Campo>
            <Campo rotulo="Motivo do ajuste"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: inventário mensal, quebra, perda" /></Campo>
            <Botao onClick={ajustar} disabled={ocupado || !contado || motivo.trim().length < 3}>Ajustar saldo</Botao>
          </div>
        )}
        {erro && <Aviso>{erro}</Aviso>}
        <div>
          <div className="mb-2 text-sm font-semibold">Histórico</div>
          {isLoading ? <div className="text-sm text-suave">Carregando…</div> : movimentos.length === 0 ? <Vazio>Nenhum movimento ainda.</Vazio> : (
            <div className="max-h-80 overflow-auto rounded-xl ring-1 ring-borda">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="sticky top-0 bg-pagina text-left text-xs text-suave"><tr>
                  <th className="px-3 py-2">Quando</th><th className="px-3 py-2">Movimento</th><th className="px-3 py-2 text-right">Qtd.</th>
                  <th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2">Detalhe</th>
                </tr></thead>
                <tbody className="divide-y divide-borda">
                  {movimentos.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap px-3 py-1.5 text-xs">{dataHoraBR(m.criado_em)}<span className="block text-suave">{m.usuarios?.nome}</span></td>
                      <td className="px-3 py-1.5">{ROTULO_MOVIMENTO[m.tipo]}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${m.quantidade < 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{m.quantidade > 0 ? '+' : ''}{qtd(m.quantidade)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{qtd(m.saldo_depois)}</td>
                      <td className="px-3 py-1.5 text-xs text-suave">{detalheMovimento(m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function destinoRetirada(r: { destino_tipo: string; projeto_codigo: string; projeto_titulo: string; setor: string }): string {
  return r.destino_tipo === 'projeto' ? `${r.projeto_codigo} ${r.projeto_titulo}` : r.setor;
}

function detalheMovimento(m: Movimento): string {
  const r = m.alm_retiradas;
  const partes = [r && `${r.codigo} · ${r.funcionario_nome} · ${destinoRetirada(r)}`, m.justificativa].filter(Boolean);
  return partes.join(' · ');
}
