import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataBR, mensagemErro } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, Entrada, Modal, Selo } from '@/shared/ui';
import { decidirDia, desconsiderarBatida, lancarBatida } from '../api';
import { hhmm, horaDoMomento, ROTULO_BATIDA, SITUACAO_DIA } from '../calculo';
import type { MesPessoa } from '../useMes';

type Dia = MesPessoa['dias'][number];

// RH: tudo de um dia de um funcionário: aprovar/abonar, lançar batida, desconsiderar batida.
export function DiaModal({ pessoa, dia, onFechar, editavel }: { pessoa: MesPessoa['pessoa']; dia: Dia | null; onFechar: () => void; editavel: boolean }) {
  const qc = useQueryClient();
  const [hora, setHora] = useState('');
  const [motivo, setMotivo] = useState('');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const pronto = () => { void qc.invalidateQueries({ queryKey: ['ponto'] }); setErro(''); setHora(''); setMotivo(''); setObs(''); };
  const acao = useMutation({ mutationFn: (f: () => Promise<void>) => f(), onSuccess: pronto, onError: (e) => setErro(mensagemErro(e)) });
  if (!dia) return null;
  const s = SITUACAO_DIA[dia.situacao];

  return (
    <Modal aberto titulo={`${pessoa.nome} · ${dataBR(dia.dia)}`} onFechar={onFechar} largura="max-w-xl">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        {s.rotulo && <Selo cor={s.cor}>{s.rotulo}</Selo>}
        {dia.decisao && dia.precisaDecisao && <Selo cor={dia.decisao.decisao === 'aprovado' ? 'verde' : 'azul'}>{dia.decisao.decisao === 'aprovado' ? 'Aprovado' : 'Abonado'}{dia.decisao.observacao && `: ${dia.decisao.observacao}`}</Selo>}
        <span className="text-suave">Previsto {hhmm(dia.previsto)} · trabalhado {hhmm(dia.trabalhado)}{dia.precisaDecisao && <> · saldo {hhmm(dia.saldo, true)}</>}</span>
      </div>
      {(dia.alertas.length > 0 || dia.justificativa) && <Aviso tipo="info">{[dia.justificativa, ...dia.alertas].filter(Boolean).join(' · ')}</Aviso>}

      <h3 className="mb-2 mt-4 text-sm font-semibold">Batidas</h3>
      {dia.batidas.length === 0 && <p className="text-sm text-suave">Nenhuma batida.</p>}
      <div className="space-y-1.5">
        {dia.batidas.map((b, i) => (
          <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-pagina px-3 py-2 text-sm">
            <span className="w-14 font-semibold tabular-nums">{horaDoMomento(b.momento)}</span>
            <span className="text-suave">{ROTULO_BATIDA[i] ?? 'Extra'}</span>
            <span className="flex-1 text-xs text-suave">
              {b.origem === 'app' ? `Pelo ERP${b.distancia_m != null ? `, a ${Math.round(b.distancia_m)} m` : ''}${b.precisao_m != null ? `, precisão ${Math.round(b.precisao_m)} m` : ''}` : `${b.origem === 'ajuste' ? 'Ajuste aprovado' : 'Lançada pelo RH'}: ${b.motivo}`}
            </span>
            {editavel && (
              <Botao tamanho="sm" variante="fantasma" disabled={acao.isPending} onClick={() => {
                const m = window.prompt('Por que desconsiderar esta batida?');
                if (m) acao.mutate(() => desconsiderarBatida(b.id, m));
              }}>Desconsiderar</Botao>
            )}
          </div>
        ))}
        {dia.desconsideradas.map((b) => (
          <div key={b.id} className="flex gap-2 px-3 text-xs text-suave"><span className="line-through">{horaDoMomento(b.momento)}</span> desconsiderada: {b.desconsiderada_motivo}</div>
        ))}
      </div>

      {editavel && (
        <>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Lançar batida</h3>
          <div className="grid gap-2 sm:grid-cols-[7rem_1fr_auto]">
            <Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            <Entrada placeholder="Motivo (ex.: esqueceu de bater)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <Botao variante="secundario" disabled={!hora || motivo.trim().length < 3 || acao.isPending} onClick={() => acao.mutate(() => lancarBatida(pessoa.id, dia.dia, hora, motivo.trim()))}>Lançar</Botao>
          </div>

          {dia.precisaDecisao && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-semibold">Decisão do RH</h3>
              <p className="mb-2 text-xs text-suave"><b>Aprovar</b>: o saldo do dia ({hhmm(dia.saldo, true)}) entra no relatório oficial. <b>Abonar</b>: o dia conta como normal (saldo zero), com o motivo.</p>
              <Campo rotulo="Observação"><AreaTexto rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Obrigatória para abonar" /></Campo>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {dia.decisao && <Botao variante="fantasma" disabled={acao.isPending} onClick={() => acao.mutate(() => decidirDia(pessoa.id, dia.dia, 'desfazer'))}>Desfazer decisão</Botao>}
                <Botao variante="secundario" disabled={obs.trim().length < 3 || acao.isPending} onClick={() => acao.mutate(() => decidirDia(pessoa.id, dia.dia, 'abonado', obs))}>Abonar</Botao>
                <Botao disabled={acao.isPending} onClick={() => acao.mutate(() => decidirDia(pessoa.id, dia.dia, 'aprovado', obs))}>Aprovar</Botao>
              </div>
            </>
          )}
        </>
      )}
      {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
    </Modal>
  );
}
