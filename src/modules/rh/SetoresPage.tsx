import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Caixa, Campo, Entrada, EsqueletoCartoes, Modal, Selecao, Selo } from '@/shared/ui';
import { listarFuncionarios, listarFuncoes, listarSetores, salvarFuncao, salvarSetor, type Funcao, type Setor } from './api';

type Editando = { tipo: 'setor'; item: Partial<Setor> } | { tipo: 'funcao'; item: Partial<Funcao> };

// RH → Setores e funções (decisão 69). Nada é apagado: setor ou função sem uso fica inativo.
// Os requisitos de cada função (documentos e treinamentos) entram na próxima entrega.
export function SetoresPage() {
  const { pode } = useAuth();
  const editavel = pode('rh', 'editar');
  const { data: setores = [], isLoading } = useQuery({ queryKey: ['rh', 'setores'], queryFn: listarSetores });
  const { data: funcoes = [] } = useQuery({ queryKey: ['rh', 'funcoes'], queryFn: listarFuncoes });
  const { data: funcionarios = [] } = useQuery({ queryKey: ['rh', 'funcionarios'], queryFn: listarFuncionarios, enabled: pode('rh', 'ler') });
  const [editando, setEditando] = useState<Editando | null>(null);
  const pessoas = (funcaoId: string) => funcionarios.filter((f) => f.funcao_id === funcaoId && f.situacao !== 'desligado').length;

  return (
    <>
      <Cabecalho titulo="Setores e funções" subtitulo="Cada funcionário tem uma função, e cada função pertence a um setor."
        acoes={editavel ? <>
          <Botao variante="secundario" onClick={() => setEditando({ tipo: 'setor', item: { nome: '', ativo: true } })}><Plus size={15} /> Setor</Botao>
          <Botao onClick={() => setEditando({ tipo: 'funcao', item: { nome: '', descricao: '', ativo: true, setor_id: setores.find((s) => s.ativo)?.id ?? '' } })}><Plus size={15} /> Função</Botao>
        </> : undefined} />
      {isLoading ? <EsqueletoCartoes /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {setores.map((s) => {
            const lista = funcoes.filter((f) => f.setor_id === s.id);
            return (
              <div key={s.id} className={`rounded-xl bg-superficie p-4 shadow-sm ring-1 ring-borda ${s.ativo ? '' : 'opacity-70'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold">{s.nome}{!s.ativo && <Selo>Inativo</Selo>}</div>
                  {editavel && <button type="button" onClick={() => setEditando({ tipo: 'setor', item: s })} className="rounded p-1.5 text-suave hover:bg-pagina hover:text-texto" title="Editar setor"><Pencil size={15} /></button>}
                </div>
                {lista.length === 0 ? <p className="mt-2 text-xs text-suave">Nenhuma função.</p> : (
                  <ul className="mt-2 divide-y divide-borda text-sm">
                    {lista.map((f) => (
                      <li key={f.id} className={`flex items-center justify-between gap-2 py-1.5 ${f.ativo ? '' : 'text-suave'}`}>
                        <span className="min-w-0">
                          <span className="block truncate">{f.nome}{!f.ativo && ' (inativa)'}</span>
                          {f.descricao && <span className="block truncate text-xs text-suave">{f.descricao}</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {pessoas(f.id) > 0 && <Selo cor="roxo">{pessoas(f.id)} pessoa(s)</Selo>}
                          {editavel && <button type="button" onClick={() => setEditando({ tipo: 'funcao', item: f })} className="rounded p-1 text-suave hover:bg-pagina hover:text-texto" title="Editar função"><Pencil size={14} /></button>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
      {editando && <EditarModal editando={editando} setores={setores} onFechar={() => setEditando(null)} />}
    </>
  );
}

function EditarModal({ editando, setores, onFechar }: { editando: Editando; setores: Setor[]; onFechar: () => void }) {
  const qc = useQueryClient();
  const [item, setItem] = useState(editando.item);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const setor = editando.tipo === 'setor';

  async function salvar() {
    setErro('');
    const nome = (item.nome ?? '').trim();
    if (nome.length < 2) return setErro('Informe o nome.');
    setSalvando(true);
    try {
      if (setor) await salvarSetor({ id: item.id, nome, ativo: item.ativo ?? true });
      else {
        const f = item as Partial<Funcao>;
        if (!f.setor_id) { setSalvando(false); return setErro('Escolha o setor.'); }
        await salvarFuncao({ id: f.id, setor_id: f.setor_id, nome, descricao: (f.descricao ?? '').trim(), ativo: f.ativo ?? true });
      }
      await qc.invalidateQueries({ queryKey: ['rh'] });
      onFechar();
    } catch (e) {
      const m = mensagemErro(e);
      setErro(m.includes('_nome_unico') ? (setor ? 'Já existe um setor com este nome.' : 'Já existe uma função com este nome neste setor.') : m);
    }
    setSalvando(false);
  }

  const novo = !item.id;
  return (
    <Modal aberto titulo={`${novo ? 'Novo' : 'Editar'} ${setor ? 'setor' : 'função'}`} onFechar={onFechar}>
      <div className="space-y-3">
        {erro && <Aviso>{erro}</Aviso>}
        {!setor && (
          <Campo rotulo="Setor *">
            <Selecao value={(item as Partial<Funcao>).setor_id ?? ''} onChange={(e) => setItem({ ...item, setor_id: e.target.value })}>
              <option value="">Escolha…</option>
              {setores.filter((s) => s.ativo || s.id === (item as Partial<Funcao>).setor_id).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </Selecao>
          </Campo>
        )}
        <Campo rotulo="Nome *"><Entrada value={item.nome ?? ''} onChange={(e) => setItem({ ...item, nome: e.target.value })} placeholder={setor ? 'Ex.: Fabricação' : 'Ex.: Motorista de munck'} /></Campo>
        {!setor && <Campo rotulo="Descrição"><AreaTexto rows={2} value={(item as Partial<Funcao>).descricao ?? ''} onChange={(e) => setItem({ ...item, descricao: e.target.value })} /></Campo>}
        {!novo && <Caixa marcado={item.ativo ?? true} onChange={(ativo) => setItem({ ...item, ativo })}>{setor ? 'Setor ativo' : 'Função ativa'} (inativo não aparece para novos cadastros)</Caixa>}
        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </div>
    </Modal>
  );
}
