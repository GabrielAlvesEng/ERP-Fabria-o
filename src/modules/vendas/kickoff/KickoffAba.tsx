import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Lock, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { dataBR, dataHoraBR, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, CampoCelula, CampoData, CampoNumero, Entrada, EsqueletoDetalhe, Modal, Selecao, Selo, Vazio } from '@/shared/ui';
import { adicionarItem, atualizarItem, atualizarKickoff, finalizarKickoff, iniciarKickoff, listarItens, listarKickoffs, removerItem, type Kickoff, type KickoffItem, type Marco } from './api';

const APROVADAS = ['Aprovado', 'Finalizado', 'Emitido NF', 'Pago'];
const OPCOES: { v: KickoffItem['necessario']; rotulo: string; cor: string }[] = [
  { v: 'sim', rotulo: 'Sim', cor: 'bg-petroleo-500 text-white' },
  { v: 'nao', rotulo: 'Não', cor: 'bg-slate-500 text-white' },
  { v: 'a_definir', rotulo: 'A definir', cor: 'bg-amber-500 text-white' },
];

// Usado na proposta (edição pelo Comercial) e no projeto de Engenharia (só leitura).
export function KickoffAba({ propostaId, statusProposta, somenteLeitura = false }: { propostaId: string; statusProposta: string; somenteLeitura?: boolean }) {
  const { pode } = useAuth();
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const { data: versoes = [], isLoading } = useQuery({ queryKey: ['kickoff', propostaId], queryFn: () => listarKickoffs(propostaId) });
  const [versaoId, setVersaoId] = useState<string | null>(null);
  const k = versoes.find((v) => v.id === versaoId) ?? versoes[0];
  const podeEditar = !somenteLeitura && pode('vendas', 'editar');

  const iniciar = useMutation({
    mutationFn: () => iniciarKickoff(propostaId),
    onSuccess: (n) => { setVersaoId(n.id); qc.invalidateQueries({ queryKey: ['kickoff', propostaId] }); qc.invalidateQueries({ queryKey: ['proposta', propostaId, 'eventos'] }); },
    onError: (e) => setErro(mensagemErro(e)),
  });

  if (isLoading) return <EsqueletoDetalhe />;
  if (!APROVADAS.includes(statusProposta)) return <Vazio>O kick-off fica disponível depois que a proposta é aprovada.</Vazio>;

  if (!k) {
    return (
      <div className="space-y-3 py-6 text-center">
        {erro && <Aviso>{erro}</Aviso>}
        <ClipboardList size={36} className="mx-auto text-roxo-500" />
        <p className="text-sm text-suave">Nenhum kick-off registrado. A reunião alinha a execução com todos os setores.</p>
        {podeEditar && <Botao onClick={() => iniciar.mutate()} disabled={iniciar.isPending}>{iniciar.isPending ? 'Iniciando…' : 'Iniciar kick-off'}</Botao>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {erro && <Aviso>{erro}</Aviso>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {versoes.length > 1 ? (
            <Selecao value={k.id} onChange={(e) => setVersaoId(e.target.value)} className="w-56">
              {versoes.map((v) => <option key={v.id} value={v.id}>Versão {v.versao} · {v.status === 'finalizado' ? 'finalizada' : 'em andamento'}</option>)}
            </Selecao>
          ) : <span className="font-semibold">Kick-off · versão {k.versao}</span>}
          {k.status === 'finalizado'
            ? <Selo cor="verde">Finalizado {k.finalizado_em ? `em ${dataHoraBR(k.finalizado_em)}` : ''}{k.usuarios?.nome ? ` por ${k.usuarios.nome}` : ''}</Selo>
            : <Selo cor="amarelo">Em andamento</Selo>}
        </div>
        {podeEditar && k.status === 'finalizado' && k.id === versoes[0].id && (
          <Botao variante="secundario" onClick={() => iniciar.mutate()} disabled={iniciar.isPending}><Plus size={15} /> Nova versão</Botao>
        )}
      </div>
      <KickoffConteudo key={k.id} k={k} editavel={podeEditar && k.status === 'rascunho'} propostaId={propostaId} onErro={(e) => setErro(mensagemErro(e))} />
    </div>
  );
}

function KickoffConteudo({ k, editavel, propostaId, onErro }: { k: Kickoff; editavel: boolean; propostaId: string; onErro: (e: unknown) => void }) {
  const qc = useQueryClient();
  const { data: itens = [] } = useQuery({ queryKey: ['kickoff', propostaId, 'itens', k.id], queryFn: () => listarItens(k.id) });
  const [marcos, setMarcos] = useState<Marco[]>(k.marcos ?? []);
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => setMarcos(k.marcos ?? []), [k.marcos]);
  const recarregar = () => qc.invalidateQueries({ queryKey: ['kickoff', propostaId] });
  const tentar = async (fn: () => Promise<unknown>) => { try { await fn(); recarregar(); } catch (e) { onErro(e); } };

  const setores = useMemo(() => {
    const m = new Map<string, KickoffItem[]>();
    itens.forEach((i) => m.set(i.setor, [...(m.get(i.setor) ?? []), i]));
    return [...m.entries()];
  }, [itens]);
  const pendentes = itens.filter((i) => i.necessario === 'a_definir').length;
  const somaMarcos = marcos.reduce((s, m) => s + Number(m.percentual || 0), 0);

  const finalizar = useMutation({
    mutationFn: () => finalizarKickoff(k.id),
    onSuccess: () => { setConfirmar(false); recarregar(); qc.invalidateQueries({ queryKey: ['proposta', propostaId, 'eventos'] }); },
    onError: (e) => { setConfirmar(false); onErro(e); },
  });

  const salvarMarcos = (novos: Marco[]) => { setMarcos(novos); tentar(() => atualizarKickoff(k.id, { marcos: novos })); };

  return (
    <div className="space-y-4">
      {!editavel && k.status === 'finalizado' && (
        <Aviso tipo="info"><Lock size={14} className="mr-1 inline" /> Kick-off finalizado: só leitura. Para mudar algo, crie uma nova versão.</Aviso>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Data da reunião"><CampoData value={k.data_reuniao} disabled={!editavel} onChange={(v) => tentar(() => atualizarKickoff(k.id, { data_reuniao: v || null }))} /></Campo>
        <Campo rotulo="Participantes" className="sm:col-span-2">
          <Entrada key={k.participantes} defaultValue={k.participantes} disabled={!editavel} placeholder="Ex.: Gabriel (Comercial), Kenny (cliente), Engenharia, Fabricação"
            onBlur={(e) => e.target.value !== k.participantes && tentar(() => atualizarKickoff(k.id, { participantes: e.target.value }))} />
        </Campo>
      </div>

      {setores.map(([setor, lista]) => (
        <div key={setor} className="rounded-xl ring-1 ring-borda">
          <div className="flex items-center justify-between border-b border-borda px-3 py-2">
            <span className="font-semibold">{setor}</span>
            <span className="text-xs text-suave">{lista.filter((i) => i.necessario === 'sim').length} necessário(s) · {lista.filter((i) => i.necessario === 'a_definir').length} a definir</span>
          </div>
          <div className="divide-y divide-borda">
            {lista.map((i) => (
              <div key={i.id} className={`grid gap-2 px-3 py-2 text-sm md:grid-cols-[1fr_auto_160px_150px] md:items-center ${i.necessario === 'nao' ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2">
                  {editavel && <button onClick={() => tentar(() => removerItem(i.id))} className="text-slate-300 hover:text-red-600" aria-label="Remover item"><Trash2 size={13} /></button>}
                  <span>{i.descricao}</span>
                </div>
                <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-borda">
                  {OPCOES.map((o) => (
                    <button key={o.v} disabled={!editavel} onClick={() => tentar(() => atualizarItem(i.id, { necessario: o.v }))}
                      className={`px-2.5 py-1 text-xs font-medium transition ${i.necessario === o.v ? o.cor : 'bg-superficie text-suave hover:bg-pagina'} ${!editavel ? 'cursor-default' : ''}`}>
                      {o.rotulo}
                    </button>
                  ))}
                </div>
                <div className="rounded-md ring-1 ring-borda">
                  <CampoCelula valor={i.responsavel} disabled={!editavel} placeholder="Responsável" onConfirmar={(v) => tentar(() => atualizarItem(i.id, { responsavel: v }))} />
                </div>
                <CampoData value={i.prazo} disabled={!editavel} onChange={(v) => tentar(() => atualizarItem(i.id, { prazo: v || null }))} />
                {(i.observacao || editavel) && (
                  <div className="md:col-span-4">
                    <CampoCelula valor={i.observacao} disabled={!editavel} placeholder="Observação (opcional)" onConfirmar={(v) => tentar(() => atualizarItem(i.id, { observacao: v }))} />
                  </div>
                )}
              </div>
            ))}
          </div>
          {editavel && <NovoItem onAdicionar={(d) => tentar(() => adicionarItem(k.id, setor, d, (lista[lista.length - 1]?.ordem ?? 0) + 1))} />}
        </div>
      ))}

      <div className="rounded-xl ring-1 ring-borda">
        <div className="flex items-center justify-between border-b border-borda px-3 py-2">
          <span className="font-semibold">Condições de medição e faturamento</span>
          <span className={`text-xs ${marcos.length && Math.abs(somaMarcos - 100) > 0.01 ? 'text-amber-600' : 'text-suave'}`}>{marcos.length ? `Total ${somaMarcos.toLocaleString('pt-BR')}%` : 'Faturamento único na finalização'}</span>
        </div>
        <div className="space-y-1 p-2">
          {marcos.map((m, idx) => (
            <div key={idx} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_90px_1fr_auto]">
              <CampoCelula valor={m.descricao} disabled={!editavel} placeholder="Marco (ex.: Sinal, Entrega da estrutura)" onConfirmar={(v) => salvarMarcos(marcos.map((x, j) => (j === idx ? { ...x, descricao: v } : x)))} />
              <div className="flex items-center gap-1 rounded-md ring-1 ring-borda"><CampoNumero valor={m.percentual} disabled={!editavel} onConfirmar={(n) => salvarMarcos(marcos.map((x, j) => (j === idx ? { ...x, percentual: n } : x)))} /><span className="pr-2 text-xs text-suave">%</span></div>
              <CampoCelula valor={m.evento} disabled={!editavel} placeholder="Quando faturar (evento)" onConfirmar={(v) => salvarMarcos(marcos.map((x, j) => (j === idx ? { ...x, evento: v } : x)))} />
              {editavel && <button onClick={() => salvarMarcos(marcos.filter((_, j) => j !== idx))} className="text-slate-300 hover:text-red-600" aria-label="Remover marco"><Trash2 size={13} /></button>}
            </div>
          ))}
          {editavel && (
            <button onClick={() => salvarMarcos([...marcos, { descricao: '', percentual: 0, evento: '' }])} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-roxo-600 hover:bg-roxo-50 dark:hover:bg-marinho-700">
              <Plus size={13} /> Adicionar marco
            </button>
          )}
        </div>
      </div>

      <Campo rotulo="Observações gerais da reunião">
        <AreaTexto key={k.observacoes} defaultValue={k.observacoes} rows={4} disabled={!editavel} onBlur={(e) => e.target.value !== k.observacoes && tentar(() => atualizarKickoff(k.id, { observacoes: e.target.value }))} />
      </Campo>

      {editavel && (
        <div className="flex items-center justify-end gap-3">
          {pendentes > 0 && <span className="text-xs text-amber-600">{pendentes} item(ns) "A definir"</span>}
          <Botao onClick={() => setConfirmar(true)}><CheckCircle2 size={16} /> Finalizar kick-off</Botao>
        </div>
      )}
      {k.status === 'finalizado' && k.data_reuniao && <div className="text-right text-xs text-suave">Reunião em {dataBR(k.data_reuniao)}</div>}

      <Modal aberto={confirmar} titulo="Finalizar o kick-off?" onFechar={() => setConfirmar(false)}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Depois de finalizado, o kick-off fica só leitura e passa a valer para Engenharia e os demais setores. Mudanças futuras geram uma nova versão, e esta fica preservada.</p>
        {pendentes > 0 && <div className="mt-3"><Aviso>Ainda há {pendentes} item(ns) "A definir". Marque Sim ou Não em todos.</Aviso></div>}
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setConfirmar(false)}>Cancelar</Botao>
          <Botao onClick={() => finalizar.mutate()} disabled={finalizar.isPending || pendentes > 0}>{finalizar.isPending ? 'Finalizando…' : 'Finalizar'}</Botao>
        </div>
      </Modal>
    </div>
  );
}

function NovoItem({ onAdicionar }: { onAdicionar: (descricao: string) => void }) {
  const [t, setT] = useState('');
  return (
    <form className="flex gap-2 px-3 pb-2" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onAdicionar(t.trim()); setT(''); } }}>
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Adicionar item a este setor" className="flex-1 rounded-md border border-dashed border-slate-300 bg-transparent px-2 py-1 text-xs outline-none focus:border-roxo-500 dark:border-marinho-500" />
      {t.trim() && <Botao type="submit" className="px-2 py-1 text-xs"><Plus size={13} /> Adicionar</Botao>}
    </form>
  );
}
