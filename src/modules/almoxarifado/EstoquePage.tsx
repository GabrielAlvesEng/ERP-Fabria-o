import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { Botao, Cabecalho, Entrada, EsqueletoTabela, Selecao, Selo, Vazio } from '@/shared/ui';
import { listarEstoque, type ItemEstoque } from './api';
import { ROTULO_SITUACAO, combina, qtd, situacaoEstoque, type SituacaoEstoque } from './regras';
import { IncluirItemModal, ItemModal } from './ItemModal';
import { SolicitarCompraBotao } from './SolicitarCompra';

// Almoxarifado → Estoque (decisão 104): a lista do que tem, com saldo, mínimo, local e situação.
export function EstoquePage() {
  const { pode } = useAuth();
  const { data: itens = [], isLoading } = useQuery({ queryKey: ['almoxarifado', 'estoque'], queryFn: listarEstoque });
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [situacao, setSituacao] = useState<SituacaoEstoque | ''>('');
  const [inativos, setInativos] = useState(false);
  const [incluir, setIncluir] = useState(false);
  const [aberto, setAberto] = useState<ItemEstoque | null>(null);

  const grupos = [...new Set(itens.map((i) => i.grupo))].sort();
  const lista = itens.filter((i) => (inativos || i.ativo) && (!grupo || i.grupo === grupo)
    && (!situacao || situacaoEstoque(i.saldo, i.minimo) === situacao) && (!busca || combina(`${i.descricao} ${i.local}`, busca)));
  const atual = aberto && itens.find((i) => i.id === aberto.id);

  return (
    <>
      <Cabecalho titulo="Estoque" subtitulo="Produtos que o Almoxarifado controla. O saldo muda só por retirada, devolução, recebimento ou ajuste."
        acoes={pode('almoxarifado', 'editar') ? <Botao onClick={() => setIncluir(true)}><Plus size={15} /> Incluir produto</Botao> : undefined} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto ou local…" className="pl-9" />
        </div>
        <Selecao value={grupo} onChange={(e) => setGrupo(e.target.value)} className="w-44">
          <option value="">Todos os grupos</option>{grupos.map((g) => <option key={g}>{g}</option>)}
        </Selecao>
        <Selecao value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoEstoque | '')} className="w-40">
          <option value="">Todas as situações</option><option value="baixo">Baixo</option><option value="zerado">Zerado</option><option value="ok">OK</option>
        </Selecao>
        <Selecao value={inativos ? 's' : ''} onChange={(e) => setInativos(e.target.value === 's')} className="w-44">
          <option value="">Só os ativos</option><option value="s">Com os desativados</option>
        </Selecao>
      </div>
      {isLoading ? <EsqueletoTabela /> : lista.length === 0 ? (
        <Vazio>{itens.length ? 'Nenhum produto com esses filtros.' : 'O estoque ainda está vazio. Use "Incluir produto" para começar, com o saldo contado.'}</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-pagina text-left text-xs text-suave"><tr>
              <th className="px-3 py-2">Produto</th><th className="px-3 py-2">Grupo</th><th className="px-3 py-2">Local</th>
              <th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2 text-right">Mínimo</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-borda">
              {lista.map((i) => {
                const s = situacaoEstoque(i.saldo, i.minimo);
                return (
                  <tr key={i.id} className={`cursor-pointer hover:bg-pagina ${i.ativo ? '' : 'opacity-60'}`} onClick={() => setAberto(i)}>
                    <td className="px-3 py-2 font-medium">{i.descricao}{!i.ativo && <span className="ml-2 text-xs text-suave">(desativado)</span>}</td>
                    <td className="px-3 py-2 text-suave">{i.grupo}</td>
                    <td className="px-3 py-2">{i.local || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{qtd(i.saldo)} <span className="text-xs text-suave">{i.unidade}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums text-suave">{i.minimo ? qtd(i.minimo) : '—'}</td>
                    <td className="px-3 py-2"><Selo cor={ROTULO_SITUACAO[s].cor}>{ROTULO_SITUACAO[s].rotulo}</Selo></td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>{s !== 'ok' && i.ativo && <SolicitarCompraBotao itens={[i]} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {incluir && <IncluirItemModal onFechar={() => setIncluir(false)} />}
      {atual && <ItemModal item={atual} onFechar={() => setAberto(null)} />}
    </>
  );
}
