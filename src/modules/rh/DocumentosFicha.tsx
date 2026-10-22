import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, History, ListChecks, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { dataBR, hojeISO, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, CampoArquivo, CampoData, Entrada, Modal, Selecao, Selo } from '@/shared/ui';
import {
  abrirArquivoRh, excluirDocumento, lancarDocumento, listarDocumentos, listarRequisitosExtras, listarSituacoes, listarTiposDocumento,
  salvarRequisitosExtras, type DocumentoFuncionario, type TipoDocumento,
} from './api';
import { EscolherRequisitos } from './EscolherRequisitos';
import { diasAte, situacaoDocumento, SITUACAO_REQ, sugerirValidade } from './regras';

// Documentos e treinamentos do funcionário (decisão 69): a situação de cada requisito (da função e individuais),
// os documentos atuais e o histórico das renovações. Só o RH lança (editavel); o próprio funcionário só vê.
export function DocumentosFicha({ funcionarioId, editavel }: { funcionarioId: string; editavel: boolean }) {
  const qc = useQueryClient();
  const hoje = hojeISO();
  const { data: tipos = [] } = useQuery({ queryKey: ['rh', 'tipos_documento'], queryFn: listarTiposDocumento });
  const { data: situacoes = [] } = useQuery({ queryKey: ['rh', 'situacoes', funcionarioId], queryFn: () => listarSituacoes(funcionarioId) });
  const { data: documentos = [] } = useQuery({ queryKey: ['rh', 'documentos', funcionarioId], queryFn: () => listarDocumentos(funcionarioId) });
  const { data: extras = [] } = useQuery({ queryKey: ['rh', 'requisitos_extras', funcionarioId], queryFn: () => listarRequisitosExtras(funcionarioId), enabled: editavel });
  const [lancando, setLancando] = useState<{ tipo?: string } | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [historico, setHistorico] = useState(false);
  const [erro, setErro] = useState('');

  const tipoDe = new Map(tipos.map((t) => [t.id, t]));
  const atuais = documentos.filter((d) => !d.substituido_em);
  const antigos = documentos.filter((d) => d.substituido_em);
  const exigidos = [...situacoes.filter((s) => s.exigido)].sort((a, b) => SITUACAO_REQ[a.situacao].ordem - SITUACAO_REQ[b.situacao].ordem || a.tipo_nome.localeCompare(b.tipo_nome));
  const outros = atuais.filter((d) => !exigidos.some((s) => s.tipo_documento_id === d.tipo_documento_id));
  const atualizar = () => qc.invalidateQueries({ queryKey: ['rh'] });

  async function excluir(d: DocumentoFuncionario) {
    if (!window.confirm(`Excluir o documento "${tipoDe.get(d.tipo_documento_id)?.nome}" lançado por engano? Se houver um anterior, ele volta a valer.`)) return;
    setErro('');
    try { await excluirDocumento(d.id); await atualizar(); } catch (e) { setErro(mensagemErro(e)); }
  }

  const linhaDocumento = (d: DocumentoFuncionario, antigo = false) => {
    const t = tipoDe.get(d.tipo_documento_id);
    const s = situacaoDocumento(d.validade, t?.aviso_dias ?? 30, hoje);
    return (
      <li key={d.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${antigo ? 'text-suave' : ''}`}>
        <span className="min-w-0">
          <span className="block font-medium">{t?.nome}</span>
          <span className="block text-xs text-suave">
            {[d.numero && `Nº ${d.numero}`, d.emissao && `emitido ${dataBR(d.emissao)}`, d.validade ? `válido até ${dataBR(d.validade)}` : 'não vence', antigo && d.substituido_em && `substituído em ${dataBR(d.substituido_em)}`].filter(Boolean).join(' · ')}
          </span>
          {d.observacoes && <span className="block text-xs text-suave">{d.observacoes}</span>}
        </span>
        <span className="flex items-center gap-1">
          {!antigo && d.validade && <Selo cor={SITUACAO_REQ[s].cor}>{SITUACAO_REQ[s].rotulo}</Selo>}
          {d.arquivo_caminho && <Botao variante="fantasma" tamanho="sm" onClick={() => abrirArquivoRh(d.arquivo_caminho!).catch((e) => setErro(mensagemErro(e)))} title={d.arquivo_nome}><FileText size={14} /> Arquivo</Botao>}
          {editavel && !antigo && <Botao variante="fantasma" tamanho="sm" onClick={() => setLancando({ tipo: d.tipo_documento_id })}><RefreshCw size={14} /> Renovar</Botao>}
          {editavel && !antigo && <button type="button" onClick={() => excluir(d)} className="rounded p-1.5 text-suave hover:bg-pagina hover:text-red-600" title="Excluir (lançado por engano)"><Trash2 size={14} /></button>}
        </span>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Requisitos</h3>
          {editavel && (
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="sm" onClick={() => setEscolhendo(true)}><ListChecks size={14} /> Requisitos individuais</Botao>
              <Botao tamanho="sm" onClick={() => setLancando({})}><Plus size={14} /> Lançar documento</Botao>
            </div>
          )}
        </div>
        {exigidos.length === 0 ? (
          <p className="text-sm text-suave">{editavel ? 'A função não exige documentos. Escolha os requisitos da função em RH → Setores e funções, ou acrescente requisitos individuais.' : 'Nenhum documento exigido.'}</p>
        ) : (
          <ul className="divide-y divide-borda rounded-lg px-3 ring-1 ring-borda">
            {exigidos.map((r) => {
              const dias = r.validade ? diasAte(r.validade, hoje) : null;
              return (
                <li key={r.tipo_documento_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{r.tipo_nome}{extras.includes(r.tipo_documento_id) && <span className="ml-1 text-xs font-normal text-suave">(individual)</span>}</span>
                    <span className="block text-xs text-suave">
                      {r.situacao === 'faltando' ? 'Nenhum documento lançado.' : r.validade ? `Válido até ${dataBR(r.validade)}${dias! < 0 ? ` · venceu há ${-dias!} dia(s)` : ` · faltam ${dias} dia(s)`}` : 'Não vence.'}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Selo cor={SITUACAO_REQ[r.situacao].cor}>{SITUACAO_REQ[r.situacao].rotulo}</Selo>
                    {editavel && r.situacao !== 'em_dia' && <Botao variante="fantasma" tamanho="sm" onClick={() => setLancando({ tipo: r.tipo_documento_id })}>{r.situacao === 'faltando' ? 'Lançar' : 'Renovar'}</Botao>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Documentos atuais</h3>
        {atuais.length === 0 ? <p className="text-sm text-suave">Nenhum documento lançado.</p> : (
          <ul className="divide-y divide-borda rounded-lg px-3 text-sm ring-1 ring-borda">
            {[...atuais.filter((d) => !outros.includes(d)), ...outros].map((d) => linhaDocumento(d))}
          </ul>
        )}
        {antigos.length > 0 && (
          <button type="button" onClick={() => setHistorico(!historico)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-roxo-600 hover:underline dark:text-roxo-100">
            <History size={13} /> {historico ? 'Esconder histórico' : `Ver histórico (${antigos.length} renovado(s))`}
          </button>
        )}
        {historico && <ul className="mt-1 divide-y divide-borda rounded-lg px-3 text-sm ring-1 ring-borda">{antigos.map((d) => linhaDocumento(d, true))}</ul>}
      </div>

      {lancando && <LancarDocumento funcionarioId={funcionarioId} tipos={tipos} tipoInicial={lancando.tipo} onFechar={() => setLancando(null)} onLancado={atualizar} />}
      {escolhendo && (
        <EscolherRequisitos titulo="Requisitos individuais" tipos={tipos} marcados={extras} onFechar={() => setEscolhendo(false)}
          explicacao="Além dos requisitos da função, documentos e treinamentos cobrados só desta pessoa (ex.: um montador que também opera plataforma)."
          onSalvar={async (ids) => { await salvarRequisitosExtras(funcionarioId, extras, ids); await atualizar(); }} />
      )}
    </div>
  );
}

function LancarDocumento({ funcionarioId, tipos, tipoInicial, onFechar, onLancado }: {
  funcionarioId: string; tipos: TipoDocumento[]; tipoInicial?: string; onFechar: () => void; onLancado: () => Promise<unknown>;
}) {
  const [f, setF] = useState({ tipo: tipoInicial ?? '', numero: '', emissao: '', validade: '', observacoes: '' });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const tipo = tipos.find((t) => t.id === f.tipo);

  function emitir(emissao: string) {
    const sugerida = sugerirValidade(emissao, tipo?.validade_meses ?? null);
    setF({ ...f, emissao, validade: sugerida || f.validade });
  }

  async function salvar() {
    setErro('');
    if (!tipo) return setErro('Escolha o tipo de documento.');
    if (tipo.tem_validade && !f.validade) return setErro('Informe a validade.');
    if (f.emissao && f.validade && f.validade < f.emissao) return setErro('A validade não pode ser antes da emissão.');
    if (arquivo && arquivo.size > 10 * 1024 * 1024) return setErro('O arquivo pode ter no máximo 10 MB.');
    setSalvando(true);
    try {
      await lancarDocumento({ funcionario_id: funcionarioId, tipo_documento_id: tipo.id, numero: f.numero.trim(), emissao: f.emissao || null, validade: tipo.tem_validade ? f.validade : null, observacoes: f.observacoes.trim() }, arquivo);
      await onLancado();
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); }
    setSalvando(false);
  }

  return (
    <Modal aberto titulo={tipoInicial ? 'Renovar documento' : 'Lançar documento'} onFechar={onFechar}>
      <div className="space-y-3">
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Tipo de documento *">
          <Selecao value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="">Escolha…</option>
            {tipos.filter((t) => t.ativo).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Número / identificação"><Entrada value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} placeholder={tipo?.categoria === 'CNH' ? 'Número e categoria (ex.: 01234567890 - D)' : ''} /></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Emissão / realização"><CampoData value={f.emissao} onChange={emitir} /></Campo>
          {(!tipo || tipo.tem_validade) && <Campo rotulo="Validade *"><CampoData value={f.validade} onChange={(validade) => setF({ ...f, validade })} /></Campo>}
        </div>
        {tipo?.validade_meses && <p className="text-xs text-suave">Validade padrão deste tipo: {tipo.validade_meses} meses depois da emissão. Confira a data do documento.</p>}
        <Campo rotulo="Arquivo (PDF ou foto, até 10 MB)"><CampoArquivo arquivo={arquivo} onChange={setArquivo} accept="application/pdf,image/jpeg,image/png,image/webp" /></Campo>
        <Campo rotulo="Observações"><AreaTexto rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Campo>
        {tipoInicial && <p className="text-xs text-suave">O documento atual vai para o histórico; nada é apagado.</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Lançar'}</Botao>
        </div>
      </div>
    </Modal>
  );
}
