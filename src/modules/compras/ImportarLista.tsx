import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mensagemErro } from '@/shared/lib/formato';
import { Aviso, Botao, Caixa, Modal, Vazio } from '@/shared/ui';
import { pecasDoProjeto, type DadosItem } from './api';
import { agruparLista } from './regras';

// Lista de materiais da Engenharia somada para compra (decisão 101). Compras escolhe as linhas que entram.
export function ImportarListaModal({ projetoId, projetoNome, onFechar, onConfirmar }: {
  projetoId: string; projetoNome: string; onFechar: () => void; onConfirmar: (itens: DadosItem[]) => Promise<void>;
}) {
  const { data: pecas, isLoading, error } = useQuery({ queryKey: ['compras', 'pecas', projetoId], queryFn: () => pecasDoProjeto(projetoId) });
  const linhas = pecas ? agruparLista(pecas) : [];
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  useEffect(() => { if (pecas) setMarcadas(new Set(agruparLista(pecas).map((l) => l.chave))); }, [pecas]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    setSalvando(true); setErro('');
    try {
      await onConfirmar(linhas.filter((l) => marcadas.has(l.chave)).map(({ grupo, descricao, quantidade, unidade, observacoes }) => ({ grupo, descricao, quantidade, unidade, observacoes })));
    } catch (e) { setErro(mensagemErro(e)); setSalvando(false); }
  }

  return (
    <Modal aberto titulo={`Lista de materiais · ${projetoNome}`} onFechar={onFechar} largura="max-w-3xl">
      <p className="mb-3 text-sm text-suave">Somada pela quantidade das peças e dos conjuntos: chapas em kg (material e espessura), perfis em metros e itens comerciais em unidades. Desmarque o que não vai comprar; dá para ajustar as quantidades depois.</p>
      {error && <Aviso>{mensagemErro(error)}</Aviso>}
      {isLoading ? <Vazio>Carregando a lista…</Vazio> : linhas.length === 0 ? <Vazio>Este projeto ainda não tem peças na lista de materiais.</Vazio> : (
        <div className="max-h-[55vh] overflow-y-auto rounded-lg ring-1 ring-borda">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-pagina text-left text-xs text-suave"><tr><th className="w-8 px-2 py-2" /><th className="px-2 py-2">Grupo</th><th className="px-2 py-2">Descrição</th><th className="px-2 py-2 text-right">Quantidade</th></tr></thead>
            <tbody className="divide-y divide-borda">
              {linhas.map((l) => (
                <tr key={l.chave} className={marcadas.has(l.chave) ? '' : 'opacity-50'}>
                  <td className="px-2 py-1.5"><Caixa marcado={marcadas.has(l.chave)} onChange={(v) => setMarcadas((m) => { const n = new Set(m); if (v) n.add(l.chave); else n.delete(l.chave); return n; })} /></td>
                  <td className="px-2 py-1.5 text-xs text-suave">{l.grupo}</td>
                  <td className="px-2 py-1.5">{l.descricao}{l.observacoes && <span className="block text-xs text-amber-600">{l.observacoes}</span>}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.quantidade.toLocaleString('pt-BR')} {l.unidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao onClick={confirmar} disabled={salvando || !marcadas.size}>{salvando ? 'Gravando…' : `Adicionar ${marcadas.size} item(ns)`}</Botao>
      </div>
    </Modal>
  );
}
