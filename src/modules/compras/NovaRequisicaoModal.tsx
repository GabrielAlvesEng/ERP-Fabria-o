import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Caixa, Campo, CampoData, Entrada, Modal, Selecao } from '@/shared/ui';
import { listarProjetos, solicitar, type DadosItem, type DadosRequisicao } from './api';
import { SETORES } from './regras';
import { ImportarListaModal } from './ImportarLista';

// Nova requisição de compra: de um projeto da Engenharia (com a lista de materiais, se quiser) ou de um setor.
export function NovaRequisicaoModal({ onFechar, onCriada }: { onFechar: () => void; onCriada: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: projetos = [] } = useQuery({ queryKey: ['compras', 'projetos'], queryFn: listarProjetos });
  const [d, setD] = useState<DadosRequisicao>({ titulo: '', projeto_id: null, setor: 'Engenharia', necessario_em: null, prioridade: 'normal', observacoes: '' });
  const [trazerLista, setTrazerLista] = useState(true);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const projeto = projetos.find((p) => p.id === d.projeto_id);
  const set = <K extends keyof DadosRequisicao>(k: K, v: DadosRequisicao[K]) => setD((x) => ({ ...x, [k]: v }));

  async function criar(itens: DadosItem[]) {
    const id = await solicitar('compras', { ...d, titulo: d.titulo.trim() }, itens);
    await qc.invalidateQueries({ queryKey: ['compras'] });
    onCriada(id);
  }
  async function continuar() {
    if (d.titulo.trim().length < 2) return setErro('Informe o título da requisição.');
    setErro('');
    if (projeto && trazerLista) return setImportando(true);
    setSalvando(true);
    try { await criar([]); } catch (e) { setErro(mensagemErro(e)); setSalvando(false); }
  }

  if (importando && projeto) {
    return <ImportarListaModal projetoId={projeto.id} projetoNome={`${projeto.codigo} ${projeto.titulo}`} onFechar={() => setImportando(false)} onConfirmar={criar} />;
  }
  return (
    <Modal aberto titulo="Nova requisição de compra" onFechar={onFechar}>
      <div className="space-y-3">
        <Campo rotulo="Título"><Entrada value={d.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex.: Chapas e perfis da plataforma" autoFocus /></Campo>
        <Campo rotulo="Projeto">
          <Selecao value={d.projeto_id ?? ''} onChange={(e) => { set('projeto_id', e.target.value || null); if (!d.titulo && e.target.value) { const p = projetos.find((x) => x.id === e.target.value); if (p) set('titulo', `Materiais ${p.codigo} ${p.titulo}`); } }}>
            <option value="">Sem projeto (compra de um setor)</option>
            {projetos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.titulo} · {p.cliente}</option>)}
          </Selecao>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Setor que pede"><Selecao value={d.setor} onChange={(e) => set('setor', e.target.value)}>{SETORES.map((s) => <option key={s}>{s}</option>)}</Selecao></Campo>
          <Campo rotulo="Precisa em"><CampoData value={d.necessario_em} onChange={(v) => set('necessario_em', v || null)} /></Campo>
          <Campo rotulo="Prioridade"><Selecao value={d.prioridade} onChange={(e) => set('prioridade', e.target.value as DadosRequisicao['prioridade'])}><option value="normal">Normal</option><option value="urgente">Urgente</option></Selecao></Campo>
        </div>
        <Campo rotulo="Observações"><AreaTexto value={d.observacoes} onChange={(e) => set('observacoes', e.target.value)} rows={2} /></Campo>
        {projeto && <Caixa marcado={trazerLista} onChange={setTrazerLista}>Trazer a lista de materiais da Engenharia</Caixa>}
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={continuar} disabled={salvando}>{projeto && trazerLista ? 'Continuar' : salvando ? 'Criando…' : 'Criar requisição'}</Botao>
        </div>
      </div>
    </Modal>
  );
}
