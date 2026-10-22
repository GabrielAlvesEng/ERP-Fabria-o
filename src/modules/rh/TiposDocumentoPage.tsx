import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Cabecalho, Caixa, Campo, Entrada, EsqueletoTabela, Modal, Selecao, Selo } from '@/shared/ui';
import { CATEGORIAS, listarTiposDocumento, salvarTipoDocumento, type TipoDocumento } from './api';

const novo: Omit<TipoDocumento, 'id'> = { nome: '', categoria: 'Treinamento NR', tem_validade: true, validade_meses: null, aviso_dias: 30, descricao: '', ativo: true };

// RH → Tipos de documento (decisão 69): o catálogo de documentos e treinamentos que as funções exigem.
// A validade padrão sugere a data de vencimento ao lançar; o aviso (30 dias) vale para o painel e o sino do RH.
export function TiposDocumentoPage() {
  const { pode } = useAuth();
  const editavel = pode('rh', 'editar');
  const { data: tipos = [], isLoading } = useQuery({ queryKey: ['rh', 'tipos_documento'], queryFn: listarTiposDocumento });
  const [editando, setEditando] = useState<(Omit<TipoDocumento, 'id'> & { id?: string }) | null>(null);

  return (
    <>
      <Cabecalho titulo="Tipos de documento" subtitulo="Documentos, exames e treinamentos que o RH controla. Os requisitos de cada função são escolhidos em Setores e funções."
        acoes={editavel ? <Botao onClick={() => setEditando({ ...novo })}><Plus size={15} /> Tipo de documento</Botao> : undefined} />
      {isLoading ? <EsqueletoTabela /> : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-borda">
          <table className="w-full text-sm">
            <thead className="bg-pagina text-left text-xs uppercase text-suave">
              <tr><th className="px-4 py-2">Documento</th><th className="px-4 py-2">Categoria</th><th className="px-4 py-2">Validade padrão</th><th className="px-4 py-2">Aviso</th><th /></tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={t.id} className={`border-t border-borda ${t.ativo ? '' : 'text-suave'}`}>
                  <td className="px-4 py-2">
                    <div className="font-medium">{t.nome}{!t.ativo && <span className="ml-2"><Selo>Inativo</Selo></span>}</div>
                    {t.descricao && <div className="text-xs text-suave">{t.descricao}</div>}
                  </td>
                  <td className="px-4 py-2">{t.categoria}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{!t.tem_validade ? 'Não vence' : t.validade_meses ? `${t.validade_meses} meses` : 'Informada em cada documento'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{t.tem_validade ? `${t.aviso_dias} dias antes` : '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {editavel && <button type="button" onClick={() => setEditando(t)} className="rounded p-1.5 text-suave hover:bg-pagina hover:text-texto" title="Editar"><Pencil size={15} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && <EditarTipo tipo={editando} onFechar={() => setEditando(null)} />}
    </>
  );
}

function EditarTipo({ tipo, onFechar }: { tipo: Omit<TipoDocumento, 'id'> & { id?: string }; onFechar: () => void }) {
  const qc = useQueryClient();
  const [t, setT] = useState({ ...tipo, meses: tipo.validade_meses ? String(tipo.validade_meses) : '', aviso: String(tipo.aviso_dias) });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro('');
    const meses = t.meses.trim() ? Number(t.meses) : null;
    const aviso = Number(t.aviso);
    if (t.nome.trim().length < 2) return setErro('Informe o nome.');
    if (t.tem_validade && meses !== null && !(Number.isInteger(meses) && meses >= 1 && meses <= 120)) return setErro('Validade padrão: de 1 a 120 meses, ou em branco.');
    if (t.tem_validade && !(Number.isInteger(aviso) && aviso >= 1 && aviso <= 365)) return setErro('Aviso: de 1 a 365 dias.');
    setSalvando(true);
    try {
      await salvarTipoDocumento({
        id: t.id, nome: t.nome.trim(), categoria: t.categoria, tem_validade: t.tem_validade, validade_meses: t.tem_validade ? meses : null,
        aviso_dias: t.tem_validade ? aviso : 30, descricao: t.descricao.trim(), ativo: t.ativo,
      });
      await qc.invalidateQueries({ queryKey: ['rh'] });
      onFechar();
    } catch (e) {
      const m = mensagemErro(e);
      setErro(m.includes('tipos_documento_nome_unico') ? 'Já existe um tipo de documento com este nome.' : m);
    }
    setSalvando(false);
  }

  return (
    <Modal aberto titulo={t.id ? 'Editar tipo de documento' : 'Novo tipo de documento'} onFechar={onFechar}>
      <div className="space-y-3">
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Nome *"><Entrada value={t.nome} onChange={(e) => setT({ ...t, nome: e.target.value })} placeholder="Ex.: NR-35 (trabalho em altura)" /></Campo>
        <Campo rotulo="Categoria">
          <Selecao value={t.categoria} onChange={(e) => setT({ ...t, categoria: e.target.value })}>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Selecao>
        </Campo>
        <Caixa marcado={t.tem_validade} onChange={(tem_validade) => setT({ ...t, tem_validade })}>Tem validade (vence)</Caixa>
        {t.tem_validade && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Validade padrão (meses)"><Entrada inputMode="numeric" value={t.meses} onChange={(e) => setT({ ...t, meses: e.target.value })} placeholder="Em branco: informada em cada documento" /></Campo>
            <Campo rotulo="Avisar quantos dias antes"><Entrada inputMode="numeric" value={t.aviso} onChange={(e) => setT({ ...t, aviso: e.target.value })} /></Campo>
          </div>
        )}
        <Campo rotulo="Descrição"><AreaTexto rows={2} value={t.descricao} onChange={(e) => setT({ ...t, descricao: e.target.value })} /></Campo>
        {t.id && <Caixa marcado={t.ativo} onChange={(ativo) => setT({ ...t, ativo })}>Ativo (inativo não pode ser lançado de novo)</Caixa>}
        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </div>
    </Modal>
  );
}
