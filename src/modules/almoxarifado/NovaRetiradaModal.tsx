import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, Entrada, Modal, Selecao } from '@/shared/ui';
import { listarEstoque, listarFuncionarios, listarProjetos, listarSetores, registrarRetirada } from './api';
import { BuscaItem } from './BuscaItem';
import { lerQuantidade, qtd } from './regras';

// Usos internos comuns além dos setores do RH (resposta 5 do planejamento: projeto, ou setor/uso com observação).
const USOS_EXTRAS = ['Manutenção', 'Obra em campo', 'Uso geral da fábrica'];

// Nova retirada (decisão 104): funcionário que recebeu, onde vai ser usado e os itens. Pensada também para o celular.
export function NovaRetiradaModal({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const { data: estoque = [] } = useQuery({ queryKey: ['almoxarifado', 'estoque'], queryFn: listarEstoque });
  const { data: funcionarios = [] } = useQuery({ queryKey: ['almoxarifado', 'funcionarios'], queryFn: listarFuncionarios });
  const { data: projetos = [] } = useQuery({ queryKey: ['almoxarifado', 'projetos'], queryFn: listarProjetos });
  const { data: setores = [] } = useQuery({ queryKey: ['almoxarifado', 'setores'], queryFn: listarSetores });
  const [funcionario, setFuncionario] = useState('');
  const [destino, setDestino] = useState<'projeto' | 'setor'>('setor');
  const [projeto, setProjeto] = useState('');
  const [setor, setSetor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [linhas, setLinhas] = useState<{ item_id: string; texto: string }[]>([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const porId = new Map(estoque.map((i) => [i.id, i]));
  const usos = [...new Set([...setores, ...USOS_EXTRAS])];

  async function salvar() {
    if (!funcionario) return setErro('Escolha o funcionário que recebeu.');
    if (destino === 'projeto' && !projeto) return setErro('Escolha o projeto.');
    if (destino === 'setor' && setor.trim().length < 2) return setErro('Informe o setor ou o uso.');
    if (!linhas.length) return setErro('Inclua pelo menos um item.');
    const itens = [];
    for (const l of linhas) {
      const q = lerQuantidade(l.texto);
      const i = porId.get(l.item_id);
      if (q == null || q <= 0) return setErro(`Informe a quantidade de "${i?.descricao}".`);
      if (i && q > i.saldo) return setErro(`Só há ${qtd(i.saldo)} ${i.unidade} de "${i.descricao}".`);
      itens.push({ item_id: l.item_id, quantidade: q });
    }
    setSalvando(true); setErro('');
    try {
      await registrarRetirada({ funcionario_id: funcionario, destino_tipo: destino, projeto_id: destino === 'projeto' ? projeto : null, setor: setor.trim(), observacao: observacao.trim(), itens });
      await qc.invalidateQueries({ queryKey: ['almoxarifado'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); setSalvando(false); }
  }

  return (
    <Modal aberto titulo="Nova retirada" onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-3">
        <Campo rotulo="Funcionário que recebeu">
          <Selecao value={funcionario} onChange={(e) => setFuncionario(e.target.value)}>
            <option value="">Escolha…</option>
            {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nome}{f.funcao && ` · ${f.funcao}`}</option>)}
          </Selecao>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <Campo rotulo="Onde vai ser usado">
            <Selecao value={destino} onChange={(e) => setDestino(e.target.value as 'projeto' | 'setor')}>
              <option value="setor">Setor / uso interno</option><option value="projeto">Projeto</option>
            </Selecao>
          </Campo>
          {destino === 'projeto' ? (
            <Campo rotulo="Projeto">
              <Selecao value={projeto} onChange={(e) => setProjeto(e.target.value)}>
                <option value="">Escolha…</option>
                {projetos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.titulo}{p.cliente && ` · ${p.cliente}`}</option>)}
              </Selecao>
            </Campo>
          ) : (
            <Campo rotulo="Setor ou uso">
              <Entrada value={setor} onChange={(e) => setSetor(e.target.value)} list="alm-usos" placeholder="Ex.: Fabricação" />
              <datalist id="alm-usos">{usos.map((u) => <option key={u} value={u} />)}</datalist>
            </Campo>
          )}
        </div>
        <Campo rotulo="Itens">
          <BuscaItem placeholder="Buscar item do estoque…"
            opcoes={estoque.filter((i) => i.ativo).map((i) => ({ id: i.id, titulo: i.descricao, detalhe: `${qtd(i.saldo)} ${i.unidade}${i.local ? ` · ${i.local}` : ''}`, desativada: i.saldo <= 0 || linhas.some((l) => l.item_id === i.id) }))}
            onEscolher={(id) => setLinhas((ls) => [...ls, { item_id: id, texto: '1' }])} />
        </Campo>
        {linhas.length > 0 && (
          <ul className="divide-y divide-borda rounded-xl ring-1 ring-borda">
            {linhas.map((l, n) => {
              const i = porId.get(l.item_id);
              return (
                <li key={l.item_id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1"><span className="font-medium">{i?.descricao}</span><span className="block text-xs text-suave">tem {qtd(i?.saldo)} {i?.unidade}</span></span>
                  <div className="w-24 shrink-0"><Entrada value={l.texto} onChange={(e) => setLinhas((ls) => ls.map((x, k) => (k === n ? { ...x, texto: e.target.value } : x)))} inputMode="decimal" className="text-right" aria-label="Quantidade" /></div>
                  <span className="w-8 text-xs text-suave">{i?.unidade}</span>
                  <button onClick={() => setLinhas((ls) => ls.filter((_, k) => k !== n))} className="rounded p-1 text-suave hover:text-red-600" aria-label="Tirar item"><Trash2 size={15} /></button>
                </li>
              );
            })}
          </ul>
        )}
        <Campo rotulo="Observação"><AreaTexto value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Ex.: lixadeira da cabine 2" /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Registrando…' : 'Registrar retirada'}</Botao>
        </div>
      </div>
    </Modal>
  );
}
