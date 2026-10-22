import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, History, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { dataBR, hojeISO, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, CampoArquivo, CampoData, Modal, Selecao, Selo } from '@/shared/ui';
import {
  abrirArquivoRh, excluirIntegracao, lancarIntegracao, listarEmpresasClientes, listarExigencias, listarHistoricoIntegracoes, listarIntegracoes,
  type IntegracaoAtual,
} from './api';
import { diasAte, SITUACAO_REQ, sugerirValidade } from './regras';

// Integrações do funcionário nos clientes (decisão 69): a atual de cada cliente, com a situação de hoje,
// e o histórico das renovações. Só o RH lança (editavel); o próprio funcionário só vê.
export function IntegracoesFicha({ funcionarioId, editavel }: { funcionarioId: string; editavel: boolean }) {
  const qc = useQueryClient();
  const hoje = hojeISO();
  const { data: integracoes = [] } = useQuery({ queryKey: ['rh', 'integracoes', funcionarioId], queryFn: () => listarIntegracoes(funcionarioId) });
  const { data: historico = [] } = useQuery({ queryKey: ['rh', 'integracoes_hist', funcionarioId], queryFn: () => listarHistoricoIntegracoes(funcionarioId) });
  const [lancando, setLancando] = useState<{ empresa?: string } | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);
  const [erro, setErro] = useState('');
  const nomeCliente = new Map(integracoes.map((i) => [i.empresa_id, i.empresa_nome]));

  async function excluir(i: IntegracaoAtual) {
    if (!window.confirm(`Excluir a integração em ${i.empresa_nome} lançada por engano? Se houver uma anterior, ela volta a valer.`)) return;
    setErro('');
    try { await excluirIntegracao(i.id); await qc.invalidateQueries({ queryKey: ['rh'] }); } catch (e) { setErro(mensagemErro(e)); }
  }

  return (
    <div className="space-y-3">
      {erro && <Aviso>{erro}</Aviso>}
      {editavel && <div className="flex justify-end"><Botao tamanho="sm" onClick={() => setLancando({})}><Plus size={14} /> Lançar integração</Botao></div>}
      {integracoes.length === 0 ? <p className="text-sm text-suave">Nenhuma integração lançada.</p> : (
        <ul className="divide-y divide-borda rounded-lg px-3 text-sm ring-1 ring-borda">
          {integracoes.map((i) => {
            const dias = diasAte(i.validade, hoje);
            return (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block font-medium">{i.empresa_nome}</span>
                  <span className="block text-xs text-suave">Feita em {dataBR(i.realizada_em)} · válida até {dataBR(i.validade)}{dias < 0 ? ` · venceu há ${-dias} dia(s)` : ` · faltam ${dias} dia(s)`}</span>
                  {i.observacoes && <span className="block text-xs text-suave">{i.observacoes}</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Selo cor={SITUACAO_REQ[i.situacao].cor}>{SITUACAO_REQ[i.situacao].rotulo}</Selo>
                  {i.arquivo_caminho && <Botao variante="fantasma" tamanho="sm" onClick={() => abrirArquivoRh(i.arquivo_caminho!).catch((e) => setErro(mensagemErro(e)))} title={i.arquivo_nome}><FileText size={14} /> Comprovante</Botao>}
                  {editavel && <Botao variante="fantasma" tamanho="sm" onClick={() => setLancando({ empresa: i.empresa_id })}><RefreshCw size={14} /> Renovar</Botao>}
                  {editavel && <button type="button" onClick={() => excluir(i)} className="rounded p-1.5 text-suave hover:bg-pagina hover:text-red-600" title="Excluir (lançada por engano)"><Trash2 size={14} /></button>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {historico.length > 0 && (
        <button type="button" onClick={() => setVerHistorico(!verHistorico)} className="inline-flex items-center gap-1 text-xs font-medium text-roxo-600 hover:underline dark:text-roxo-100">
          <History size={13} /> {verHistorico ? 'Esconder histórico' : `Ver histórico (${historico.length} renovada(s))`}
        </button>
      )}
      {verHistorico && (
        <ul className="divide-y divide-borda rounded-lg px-3 text-sm text-suave ring-1 ring-borda">
          {historico.map((h) => <li key={h.id} className="py-2">{nomeCliente.get(h.empresa_id) ?? 'Cliente'} · feita em {dataBR(h.realizada_em)} · válida até {dataBR(h.validade)} · substituída em {dataBR(h.substituido_em)}</li>)}
        </ul>
      )}
      {lancando && <LancarIntegracao funcionarioId={funcionarioId} empresaInicial={lancando.empresa} onFechar={() => setLancando(null)} />}
    </div>
  );
}

function LancarIntegracao({ funcionarioId, empresaInicial, onFechar }: { funcionarioId: string; empresaInicial?: string; onFechar: () => void }) {
  const qc = useQueryClient();
  const { data: empresas = [] } = useQuery({ queryKey: ['rh', 'empresas'], queryFn: listarEmpresasClientes });
  const { data: exigencias = [] } = useQuery({ queryKey: ['rh', 'exigencias'], queryFn: listarExigencias });
  const [f, setF] = useState({ empresa: empresaInicial ?? '', realizada: hojeISO(), validade: '', observacoes: '' });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const meses = exigencias.find((e) => e.empresa_id === f.empresa)?.validade_meses ?? null;
  const validade = f.validade || sugerirValidade(f.realizada, meses);

  async function salvar() {
    setErro('');
    if (!f.empresa) return setErro('Escolha o cliente.');
    if (!f.realizada || !validade) return setErro('Informe a data da integração e a validade.');
    if (validade < f.realizada) return setErro('A validade não pode ser antes da integração.');
    if (arquivo && arquivo.size > 10 * 1024 * 1024) return setErro('O arquivo pode ter no máximo 10 MB.');
    setSalvando(true);
    try {
      await lancarIntegracao({ funcionario_id: funcionarioId, empresa_id: f.empresa, realizada_em: f.realizada, validade, observacoes: f.observacoes.trim() }, arquivo);
      await qc.invalidateQueries({ queryKey: ['rh'] });
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); }
    setSalvando(false);
  }

  return (
    <Modal aberto titulo={empresaInicial ? 'Renovar integração' : 'Lançar integração'} onFechar={onFechar}>
      <div className="space-y-3">
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Cliente *">
          <Selecao value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value, validade: '' })}>
            <option value="">Escolha…</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome_fantasia}{e.cidade ? ` · ${e.cidade}` : ''}</option>)}
          </Selecao>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Feita em *"><CampoData value={f.realizada} onChange={(realizada) => setF({ ...f, realizada, validade: '' })} /></Campo>
          <Campo rotulo="Válida até *"><CampoData value={validade} onChange={(v) => setF({ ...f, validade: v })} /></Campo>
        </div>
        {f.empresa && <p className="text-xs text-suave">{meses ? `Este cliente define validade de ${meses} meses.` : 'Este cliente ainda não tem a validade definida em RH → Integrações; informe a data.'}</p>}
        <Campo rotulo="Comprovante (PDF ou foto, até 10 MB)"><CampoArquivo arquivo={arquivo} onChange={setArquivo} accept="application/pdf,image/jpeg,image/png,image/webp" /></Campo>
        <Campo rotulo="Observações"><AreaTexto rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Campo>
        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Lançar'}</Botao>
        </div>
      </div>
    </Modal>
  );
}
