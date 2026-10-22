import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Lock, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, mensagemErro, moeda, numeroBR } from '@/shared/lib/formato';
import { useIndicadorAbas } from '@/shared/ui/AbasModulo';
import { AreaTexto, Aviso, Botao, Campo, CampoData, Entrada, EntradaMoeda, EsqueletoDetalhe, Selecao, Selo, Vazio } from '@/shared/ui';
import {
  abrirArquivo, atualizarRascunho, enviarArquivoRevisao, listarArquivos, listarContatos, listarEventos, listarReprovacoes, listarRevisoes,
  moverProposta, obterAprovacao, obterProposta, removerArquivo,
} from '../api';
import type { Arquivo, Proposta, StatusProposta } from '../types';
import { rotuloRevisao, tipoTransicao, validadeAte } from './regras';
import type { Pendente } from './PropostasPage';
import { FollowupModal } from './TransicaoModais';
import { DocumentosAba } from '../documentos/DocumentosAba';
import { CampoVendedor } from '../vendedores/CampoVendedor';
import { CustosAba } from '../custos/CustosAba';
import { KickoffAba } from '../kickoff/KickoffAba';
import { ExcluirModal } from './ExcluirModal';

const abas = ['Dados', 'Custos', 'Documentos', 'Revisões e arquivos', 'Aprovação', 'Kick-off', 'Histórico'] as const;
const tiposArquivo: Record<Arquivo['tipo'], string> = { comercial: 'Proposta comercial', tecnica: 'Proposta técnica', documento_tecnico: 'Documento técnico', anexo: 'Anexo', imagem_documento: 'Imagem do documento' };

const proximos: Partial<Record<StatusProposta, StatusProposta[]>> = {
  'À enviar': ['Enviados'],
  Enviados: ['Aprovado', 'Reprovado', 'À enviar'],
  'Follow-up': ['Enviados', 'Aprovado', 'Reprovado', 'À enviar'],
  Reprovado: ['À enviar'],
  Aprovado: ['Finalizado'],
  Finalizado: ['Emitido NF'],
  'Emitido NF': ['Pago'],
};

export function PropostaDetalhe({ id, onFechar, onTransicao }: { id: string; onFechar: () => void; onTransicao: (p: Pendente) => void }) {
  const { pode } = useAuth();
  const qc = useQueryClient();
  const [aba, setAba] = useState<(typeof abas)[number]>('Dados');
  const [erro, setErro] = useState('');
  const [followup, setFollowup] = useState(false);
  const [excluir, setExcluir] = useState(false);
  const { data: p } = useQuery({ queryKey: ['proposta', id], queryFn: () => obterProposta(id) });
  const linhaAbas = useIndicadorAbas(`${aba}|${p ? 1 : 0}`);

  const mover = useMutation({
    mutationFn: (para: StatusProposta) => moverProposta(id, para),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propostas'] });
      qc.invalidateQueries({ queryKey: ['proposta'] });
    },
    onError: (e) => setErro(mensagemErro(e)),
  });

  function acao(para: StatusProposta) {
    if (!p) return;
    setErro('');
    const tipo = tipoTransicao(p.status, para);
    if (tipo === 'simples' || tipo === 'financeiro') mover.mutate(para);
    else if (tipo !== 'proibida') onTransicao({ proposta: p, para, tipo });
  }

  const botoes = (p ? proximos[p.status] ?? [] : []).filter((s) => {
    const t = p ? tipoTransicao(p.status, s) : 'proibida';
    if (t === 'financeiro') return pode('financeiro', 'editar');
    if (t === 'aprovar') return pode('vendas', 'aprovar');
    return pode('vendas', 'editar');
  });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-marinho-900/40" onMouseDown={onFechar}>
      <div className={`flex h-full w-full flex-col bg-superficie shadow-xl transition-[max-width] ${aba === 'Custos' || aba === 'Documentos' ? 'max-w-6xl' : aba === 'Kick-off' ? 'max-w-4xl' : 'max-w-2xl'}`} onMouseDown={(e) => e.stopPropagation()}>
        {!p ? <EsqueletoDetalhe /> : (
          <>
            <div className="border-b border-borda px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-roxo-600 dark:text-roxo-100">{p.codigo}</span>
                    <Selo cor="azul">{rotuloRevisao(p.revisao_atual)}</Selo>
                    <Selo cor={p.status === 'Reprovado' ? 'vermelho' : ['Aprovado', 'Finalizado', 'Emitido NF', 'Pago'].includes(p.status) ? 'verde' : 'roxo'}>{p.status}</Selo>
                  </div>
                  <div className="mt-1 font-semibold">{p.titulo}</div>
                  <div className="text-sm text-suave">{p.empresas?.nome_fantasia} · {p.contatos?.nome} · {moeda(p.valor)}</div>
                </div>
                <button onClick={onFechar} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-marinho-700" aria-label="Fechar"><X size={18} /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {botoes.map((s) => (
                  <Botao key={s} variante={s === 'Reprovado' ? 'secundario' : s === 'À enviar' ? 'secundario' : 'primario'} onClick={() => acao(s)} disabled={mover.isPending}>
                    {s === 'À enviar' ? `Nova revisão (R${p.revisao_atual + 1})` : s === 'Enviados' && p.status === 'À enviar' ? 'Enviar ao cliente' : `Mover para ${s}`}
                  </Botao>
                ))}
                {['Enviados', 'Follow-up'].includes(p.status) && pode('vendas', 'editar') && (
                  <Botao variante="secundario" onClick={() => setFollowup(true)}>Registrar follow-up</Botao>
                )}
                {pode('vendas', 'excluir') && !['Aprovado', 'Finalizado', 'Emitido NF', 'Pago'].includes(p.status) && (
                  <Botao variante="fantasma" className="ml-auto text-red-600" onClick={() => setExcluir(true)}><Trash2 size={15} /> Excluir</Botao>
                )}
              </div>
              {erro && <div className="mt-2"><Aviso>{erro}</Aviso></div>}
            </div>
            <div ref={linhaAbas} className="abas abas-indicador gap-x-1 border-b border-borda px-3" role="tablist">
              {abas.filter((a) => a !== 'Custos' || pode('custos', 'ler')).map((a) => (
                <button key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)} className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors duration-150 ${aba === a ? 'border-roxo-500 font-semibold text-roxo-600 dark:border-roxo-300 dark:text-roxo-100' : 'border-transparent text-suave hover:text-texto'}`}>{a}</button>
              ))}
              <span className="abas-linha" />
            </div>
            <div key={aba} className="entrar flex-1 overflow-y-auto p-5">
              {aba === 'Dados' && <AbaDados p={p} />}
              {aba === 'Custos' && <CustosAba proposta={p} />}
              {aba === 'Documentos' && <DocumentosAba proposta={p} />}
              {aba === 'Revisões e arquivos' && <AbaRevisoes p={p} />}
              {aba === 'Aprovação' && <AbaAprovacao p={p} />}
              {aba === 'Kick-off' && <KickoffAba propostaId={p.id} statusProposta={p.status} />}
              {aba === 'Histórico' && <AbaHistorico id={p.id} />}
            </div>
          </>
        )}
      </div>
      {followup && p && <FollowupModal proposta={p} onFechar={() => setFollowup(false)} />}
      {excluir && p && <ExcluirModal proposta={p} onFechar={() => setExcluir(false)} onExcluida={() => { setExcluir(false); onFechar(); }} />}
    </div>
  );
}

function AbaDados({ p }: { p: Proposta }) {
  const { pode } = useAuth();
  const qc = useQueryClient();
  const editavel = p.status === 'À enviar' && pode('vendas', 'editar');
  const [f, setF] = useState(p);
  const [msg, setMsg] = useState('');
  const { data: contatos = [] } = useQuery({ queryKey: ['contatos'], queryFn: listarContatos });
  const comprador = contatos.find((c) => c.id === p.contato_id);
  const daEmpresa = contatos.filter((c) => c.empresa_id === p.empresa_id && c.id !== p.contato_id).sort((a, b) => a.nome.localeCompare(b.nome));
  useEffect(() => setF(p), [p]);
  const set = (k: keyof Proposta) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const m = useMutation({
    mutationFn: () =>
      atualizarRascunho(p.id, {
        titulo: f.titulo, responsavel_id: f.responsavel_id, descricao: f.descricao, valor: Number(numeroBR(String(f.valor)) || 0), prazo_previsto: f.prazo_previsto,
        validade_dias: f.validade_dias || null, condicoes_comerciais: f.condicoes_comerciais, observacoes: f.observacoes, data_emissao: f.data_emissao,
        contato_tecnico_id: f.contato_tecnico_id || null,
      }),
    onSuccess: () => {
      setMsg('Salvo. Edição em À enviar não gera revisão.');
      qc.invalidateQueries({ queryKey: ['propostas'] });
      qc.invalidateQueries({ queryKey: ['proposta'] });
    },
    onError: (e) => setMsg(mensagemErro(e)),
  });

  return (
    <div className="space-y-3">
      {!editavel && p.status !== 'À enviar' && (
        <Aviso tipo="info"><Lock size={14} className="mr-1 inline" /> Proposta enviada: os dados estão congelados. Para alterar, crie uma nova revisão.</Aviso>
      )}
      {msg && <Aviso tipo="info">{msg}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Título do fornecimento" className="sm:col-span-2"><Entrada value={f.titulo} onChange={set('titulo')} disabled={!editavel} /></Campo>
        <Campo rotulo="Vendedor" className="sm:col-span-2"><CampoVendedor valor={f.responsavel_id} onChange={(id) => setF({ ...f, responsavel_id: id })} disabled={!editavel} /></Campo>
        <Campo rotulo="Contato da proposta (recebe a comercial)"><Entrada value={comprador ? `${comprador.nome}${comprador.cargo ? ` · ${comprador.cargo}` : ''}` : '—'} disabled /></Campo>
        <Campo rotulo="Contato técnico (recebe a técnica e vai em C/C)">
          <Selecao value={f.contato_tecnico_id ?? ''} onChange={(e) => setF({ ...f, contato_tecnico_id: e.target.value || null })} disabled={!editavel}>
            <option value="">O mesmo contato da proposta</option>
            {daEmpresa.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` · ${c.cargo}` : ''}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Descrição" className="sm:col-span-2"><AreaTexto value={f.descricao} onChange={set('descricao')} disabled={!editavel} /></Campo>
        <Campo rotulo="Valor (R$)"><EntradaMoeda value={String(f.valor)} onChange={(v) => set('valor')({ target: { value: v } })} disabled={!editavel} /></Campo>
        <Campo rotulo="Data de emissão"><CampoData value={f.data_emissao} onChange={(v) => setF({ ...f, data_emissao: v })} disabled={!editavel} /></Campo>
        <Campo rotulo="Prazo previsto"><Entrada value={f.prazo_previsto} onChange={set('prazo_previsto')} disabled={!editavel} /></Campo>
        <Campo rotulo="Validade (dias)">
          <div className="flex items-center gap-2">
            <Entrada type="number" min={1} max={3650} className="w-24" value={f.validade_dias ?? ''} disabled={!editavel}
              onChange={(e) => setF({ ...f, validade_dias: e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : null })} />
            <span className="text-xs text-suave">{validadeAte(f.data_emissao, f.validade_dias)}</span>
          </div>
        </Campo>
        <Campo rotulo="Condições comerciais" className="sm:col-span-2"><AreaTexto value={f.condicoes_comerciais} onChange={set('condicoes_comerciais')} disabled={!editavel} /></Campo>
        <Campo rotulo="Observações" className="sm:col-span-2"><AreaTexto value={f.observacoes} onChange={set('observacoes')} disabled={!editavel} /></Campo>
        <div className="text-sm text-suave sm:col-span-2">
          Responsável: {p.usuarios?.nome ?? '—'} · Próximo follow-up: {dataBR(p.proximo_followup)}
        </div>
      </div>
      {editavel && <div className="flex justify-end"><Botao onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? 'Salvando…' : 'Salvar alterações'}</Botao></div>}
    </div>
  );
}

function AbaRevisoes({ p }: { p: Proposta }) {
  const { pode } = useAuth();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<Arquivo['tipo']>('comercial');
  const [erro, setErro] = useState('');
  const { data: revisoes = [] } = useQuery({ queryKey: ['proposta', p.id, 'revisoes', p.revisao_atual, p.status], queryFn: () => listarRevisoes(p.id) });
  const { data: arquivos = [] } = useQuery({
    queryKey: ['proposta', p.id, 'arquivos', revisoes.map((r) => r.id).join()],
    queryFn: () => listarArquivos(revisoes.map((r) => r.id)),
    enabled: revisoes.length > 0,
  });
  const atual = revisoes.find((r) => r.numero === p.revisao_atual);
  const podeEnviar = atual?.status === 'rascunho' && pode('vendas', 'editar');

  const up = useMutation({
    mutationFn: (file: File) => enviarArquivoRevisao(p.id, atual!.id, tipo, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposta', p.id, 'arquivos'] }),
    onError: (e) => setErro(mensagemErro(e)),
  });
  const rm = useMutation({
    mutationFn: removerArquivo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposta', p.id, 'arquivos'] }),
    onError: (e) => setErro(mensagemErro(e)),
  });

  return (
    <div className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      {podeEnviar && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-pagina p-3">
          <Campo rotulo={`Anexar à ${rotuloRevisao(p.revisao_atual)} (rascunho)`}>
            <Selecao value={tipo} onChange={(e) => setTipo(e.target.value as Arquivo['tipo'])}>
              {Object.entries(tiposArquivo).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selecao>
          </Campo>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-roxo-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-roxo-600">
            <Upload size={16} /> {up.isPending ? 'Enviando…' : 'Escolher arquivo'}
            <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) up.mutate(f); e.target.value = ''; }} />
          </label>
        </div>
      )}
      {revisoes.map((r) => {
        const doR = arquivos.filter((a) => a.revisao_id === r.id);
        return (
          <div key={r.id} className="rounded-xl ring-1 ring-borda">
            <div className="flex items-center justify-between border-b border-borda px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{rotuloRevisao(r.numero)}</span>
                {r.status === 'enviada' ? <Selo cor="verde">Enviada em {dataBR(r.enviada_em)}</Selo> : <Selo cor="amarelo">Rascunho</Selo>}
              </div>
              {r.valor !== null && <span className="text-sm text-suave">{moeda(r.valor)}</span>}
            </div>
            {r.motivo && <div className="px-4 pt-2 text-xs text-suave">Motivo: {r.motivo}</div>}
            <div className="divide-y divide-borda">
              {doR.length === 0 && <div className="px-4 py-3 text-sm text-suave">Sem arquivos.</div>}
              {doR.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <button className="flex items-center gap-2 text-left hover:text-roxo-600" onClick={() => abrirArquivo(a.caminho).catch((e) => setErro(mensagemErro(e)))}>
                    <FileText size={15} /> <span>{a.nome}</span> <span className="text-xs text-suave">({tiposArquivo[a.tipo]})</span>
                  </button>
                  {r.status === 'rascunho' && pode('vendas', 'editar') && (
                    <button onClick={() => rm.mutate(a)} className="rounded p-1 text-slate-400 hover:text-red-600" aria-label="Remover"><Trash2 size={15} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AbaAprovacao({ p }: { p: Proposta }) {
  const { data: apr } = useQuery({ queryKey: ['proposta', p.id, 'aprovacao', p.status], queryFn: () => obterAprovacao(p.id) });
  const { data: reps = [] } = useQuery({ queryKey: ['proposta', p.id, 'reprovacoes', p.status], queryFn: () => listarReprovacoes(p.id) });
  return (
    <div className="space-y-4">
      {apr ? (
        <div className="rounded-xl bg-petroleo-50 p-4 text-sm dark:bg-petroleo-600/20">
          <div className="font-semibold text-petroleo-600 dark:text-teal-100">Aprovada por {apr.forma}{apr.numero_documento && ` nº ${apr.numero_documento}`}</div>
          <div className="mt-1">Data: {dataBR(apr.data_aprovacao)} · Valor aprovado: {moeda(apr.valor_aprovado)}</div>
          {apr.observacoes && <div className="mt-1">{apr.observacoes}</div>}
          <button className="mt-2 inline-flex items-center gap-1 text-roxo-600 hover:underline" onClick={() => abrirArquivo(apr.comprovante_caminho)}>
            <FileText size={14} /> Comprovante: {apr.comprovante_nome || 'abrir'}
          </button>
        </div>
      ) : <Vazio>Sem aprovação registrada.</Vazio>}
      {reps.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-semibold">Reprovações</div>
          {reps.map((r) => (
            <div key={r.id} className="mb-2 rounded-xl bg-red-50 p-3 text-sm dark:bg-red-900/30">
              <div className="font-medium">{r.motivo}{r.concorrente && ` · concorrente: ${r.concorrente}`}</div>
              <div className="text-xs text-suave">{dataHoraBR(r.criado_em)}</div>
              {r.observacoes && <div className="mt-1">{r.observacoes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const { data: eventos = [] } = useQuery({ queryKey: ['proposta', id, 'eventos'], queryFn: () => listarEventos(id) });
  if (!eventos.length) return <Vazio>Sem eventos.</Vazio>;
  return (
    <ol className="space-y-3 border-l-2 border-borda pl-4">
      {eventos.map((e) => (
        <li key={e.id} className="text-sm">
          <div className="font-medium">{e.descricao}</div>
          <div className="text-xs text-suave">{dataHoraBR(e.criado_em)} · {e.usuarios?.nome ?? '—'}</div>
        </li>
      ))}
    </ol>
  );
}

