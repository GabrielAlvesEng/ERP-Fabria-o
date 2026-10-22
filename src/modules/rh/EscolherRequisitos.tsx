import { useState } from 'react';
import { mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Caixa, Modal } from '@/shared/ui';
import { CATEGORIAS, type TipoDocumento } from './api';

// Lista de tipos de documento com caixas de marcar, agrupada por categoria. Usada nos requisitos da função
// e nos requisitos individuais do funcionário. Tipos inativos só aparecem se já estavam marcados.
export function EscolherRequisitos({ titulo, explicacao, tipos, marcados, onSalvar, onFechar }: {
  titulo: string; explicacao: string; tipos: TipoDocumento[]; marcados: string[]; onSalvar: (ids: string[]) => Promise<void>; onFechar: () => void;
}) {
  const [sel, setSel] = useState<string[]>(marcados);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const visiveis = tipos.filter((t) => t.ativo || marcados.includes(t.id));
  const grupos = CATEGORIAS.map((c) => ({ c, lista: visiveis.filter((t) => t.categoria === c) })).filter((g) => g.lista.length);

  async function salvar() {
    setErro(''); setSalvando(true);
    try { await onSalvar(sel); onFechar(); } catch (e) { setErro(mensagemErro(e)); }
    setSalvando(false);
  }

  return (
    <Modal aberto titulo={titulo} onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-sm text-suave">{explicacao}</p>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {grupos.map((g) => (
            <div key={g.c}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-suave">{g.c}</div>
              <div className="space-y-1.5">
                {g.lista.map((t) => (
                  <div key={t.id}>
                    <Caixa marcado={sel.includes(t.id)} onChange={(v) => setSel(v ? [...sel, t.id] : sel.filter((x) => x !== t.id))}>{t.nome}</Caixa>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </div>
    </Modal>
  );
}
