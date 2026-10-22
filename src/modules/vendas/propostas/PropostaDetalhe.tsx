import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Lock, Trash2, X } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, mensagemErro, moeda, numeroBR } from '@/shared/lib/formato';
import { useIndicadorAbas } from '@/shared/ui/AbasModulo';
import { AreaTexto, Aviso, Botao, Campo, CampoData, CampoInteiro, Entrada, EntradaMoeda, EsqueletoDetalhe, Selecao, Selo, Vazio } from '@/shared/ui';
import {
  abrirArquivo, atualizarRascunho, listarContatos, listarEmpresas, listarEventos, listarReprovacoes,
  moverProposta, obterAprovacao, obterProposta,
} from '../api';
import type { Proposta, StatusProposta } from '../types';
import { rotuloRevisao, tipoTransicao, validadeAte } from './regras';
import type { Pendente } from './PropostasPage';
import { FollowupModal } from './TransicaoModais';
import { DocumentosAba } from '../documentos/DocumentosAba';
import { CampoVendedor } from '../vendedores/CampoVendedor';
import { CustosAba } from '../custos/CustosAba';
import { KickoffAba } from '../kickoff/KickoffAba';
import { ExcluirModal } from './ExcluirModal';
import { ArquivosAba } from './ArquivosAba';
import { enderecoEntrega } from '../documentos/api';

// Decisão 70: "Revisões e arquivos" e "Aprovação" viraram a aba Arquivos (Propostas, Anexos e Aprovação).
const abas = ['Dados', 'Custos', 'Documentos', 'Arquivos', 'Kick-off', 'Histórico'] as const;

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
              {aba === 'Arquivos' && <ArquivosAba p={p} aprovacao={<AbaAprovacao p={p} />} />}
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
  const { data: empresas = [] } = useQuery({ queryKey: ['empresas'], queryFn: listarEmpresas });
  const empresa = empresas.find((e) => e.id === p.empresa_id);
  const comprador = contatos.find((c) => c.id === p.contato_id);
  const daEmpresa = contatos.filter((c) => c.empresa_id === p.empresa_id && c.id !== p.contato_id).sort((a, b) => a.nome.localeCompare(b.nome));
  const set = (k: keyof Proposta) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  // Decisão 82: salva sozinho 1 s depois da última alteração (sem botão Salvar).
  const dadosDe = (x: Proposta) => ({
    titulo: x.titulo, responsavel_id: x.responsavel_id, descricao: x.descricao, valor: Number(numeroBR(String(x.valor)) || 0), prazo_previsto: x.prazo_previsto,
    validade_dias: x.validade_dias || null, condicoes_comerciais: x.condicoes_comerciais, observacoes: x.observacoes, data_emissao: x.data_emissao,
    contato_tecnico_id: x.contato_tecnico_id || null, frete: x.frete ?? 'CIF',
  });
  const chave = (x: Proposta) => JSON.stringify(dadosDe(x));
  // Dados que vieram do banco: o formulário só é trocado por eles se não houver alteração ainda não salva.
  const base = useRef(chave(p));
  useEffect(() => {
    setF((atual) => (chave(atual) === base.current ? p : atual));
    base.current = chave(p);
  }, [p]); // eslint-disable-line react-hooks/exhaustive-deps
  const [estado, setEstado] = useState<'' | 'salvando' | 'salvo'>('');
  const m = useMutation({
    mutationFn: (x: Proposta) => atualizarRascunho(p.id, dadosDe(x)),
    onMutate: () => { setEstado('salvando'); setMsg(''); },
    onSuccess: (_r, x) => {
      base.current = chave(x);
      setEstado('salvo');
      qc.invalidateQueries({ queryKey: ['propostas'] });
      qc.invalidateQueries({ queryKey: ['proposta'] });
    },
    onError: (e) => { setEstado(''); setMsg(mensagemErro(e)); },
  });
  const pendente = editavel && chave(f) !== base.current;
  useEffect(() => {
    if (!pendente || m.isPending) return;
    const t = setTimeout(() => m.mutate(f), 1000);
    return () => clearTimeout(t);
  }, [f, pendente, m.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      {!editavel && p.status !== 'À enviar' && (
        <Aviso tipo="info"><Lock size={14} className="mr-1 inline" /> Proposta enviada: os dados estão congelados. Para alterar, crie uma nova revisão.</Aviso>
      )}
      {msg && <Aviso tipo="info">{msg}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Título do fornecimento (título da capa das propostas)" className="sm:col-span-2"><Entrada value={f.titulo} onChange={set('titulo')} disabled={!editavel} /></Campo>
        <Campo rotulo="Vendedor" className="sm:col-span-2"><CampoVendedor valor={f.responsavel_id} onChange={(id) => setF({ ...f, responsavel_id: id })} disabled={!editavel} /></Campo>
        <Campo rotulo="Contato da proposta (recebe a comercial)"><Entrada value={comprador ? `${comprador.nome}${comprador.cargo ? ` · ${comprador.cargo}` : ''}` : '—'} disabled /></Campo>
        <Campo rotulo="Contato técnico (recebe a técnica e vai em C/C)">
          <Selecao value={f.contato_tecnico_id ?? ''} onChange={(e) => setF({ ...f, contato_tecnico_id: e.target.value || null })} disabled={!editavel}>
            <option value="">O mesmo contato da proposta</option>
            {daEmpresa.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` · ${c.cargo}` : ''}</option>)}
          </Selecao>
        </Campo>
        {/* Frete (decisão 70): CIF ou FOB; o local de entrega é sempre o endereço da empresa cliente. */}
        <Campo rotulo="Frete">
          <Selecao value={f.frete ?? 'CIF'} onChange={(e) => setF({ ...f, frete: e.target.value as 'CIF' | 'FOB' })} disabled={!editavel}>
            <option value="CIF">CIF · frete por conta da Fabriaço</option>
            <option value="FOB">FOB · frete por conta do cliente</option>
          </Selecao>
        </Campo>
        <Campo rotulo="Local de entrega (endereço da empresa)"><Entrada value={empresa ? enderecoEntrega(empresa) || 'Endereço não cadastrado na empresa' : '—'} disabled /></Campo>
        <Campo rotulo="Descrição (subtítulo da capa das propostas)" className="sm:col-span-2"><AreaTexto value={f.descricao} onChange={set('descricao')} disabled={!editavel} /></Campo>
        <Campo rotulo="Valor (R$)"><EntradaMoeda value={String(f.valor)} onChange={(v) => set('valor')({ target: { value: v } })} disabled={!editavel} /></Campo>
        <Campo rotulo="Data de emissão"><CampoData value={f.data_emissao} onChange={(v) => setF({ ...f, data_emissao: v })} disabled={!editavel} /></Campo>
        <Campo rotulo="Prazo previsto"><Entrada value={f.prazo_previsto} onChange={set('prazo_previsto')} disabled={!editavel} /></Campo>
        <Campo rotulo="Validade (dias)">
          <div className="flex items-center gap-2">
            <CampoInteiro min={1} max={3650} className="w-36" valor={f.validade_dias ?? null} disabled={!editavel}
              onChange={(n) => setF({ ...f, validade_dias: n })} />
            <span className="text-xs text-suave">{validadeAte(f.data_emissao, f.validade_dias)}</span>
          </div>
        </Campo>
        <Campo rotulo="Observações" className="sm:col-span-2"><AreaTexto value={f.observacoes} onChange={set('observacoes')} disabled={!editavel} /></Campo>
        <div className="text-sm text-suave sm:col-span-2">
          Responsável: {p.usuarios?.nome ?? '—'} · Próximo follow-up: {dataBR(p.proximo_followup)}
        </div>
      </div>
      {editavel && (
        <div className="text-right text-xs text-suave" aria-live="polite">
          {pendente || estado === 'salvando' ? 'Salvando…' : estado === 'salvo' ? 'Salvo automaticamente. Edição em À enviar não gera revisão.' : 'As alterações são salvas automaticamente.'}
        </div>
      )}
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

