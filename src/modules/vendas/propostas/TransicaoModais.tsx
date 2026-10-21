import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { hojeISO, mensagemErro, moeda, numeroBR } from '@/shared/lib/formato';
import { AreaTexto, Aviso, Botao, Campo, CampoArquivo, CampoData, Entrada, Modal, Selecao, EntradaMoeda } from '@/shared/ui';
import { aprovarProposta, enviarComprovante, moverProposta, registrarFollowup, reprovarProposta } from '../api';
import type { Proposta, StatusProposta } from '../types';

function useAcao(fn: () => Promise<void>, onFechar: () => void) {
  const qc = useQueryClient();
  const [erro, setErro] = useState('');
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propostas'] });
      qc.invalidateQueries({ queryKey: ['proposta'] });
      qc.invalidateQueries({ queryKey: ['contatos'] });
      onFechar();
    },
    onError: (e) => setErro(mensagemErro(e)),
  });
  return { erro, setErro, m };
}

function Rodape({ onFechar, ocupado, rotulo, variante = 'primario' }: { onFechar: () => void; ocupado: boolean; rotulo: string; variante?: 'primario' | 'perigo' }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
      <Botao type="submit" variante={variante} disabled={ocupado}>{ocupado ? 'Salvando…' : rotulo}</Botao>
    </div>
  );
}

function Form({ children, onSubmit }: { children: ReactNode; onSubmit: () => void }) {
  return (
    <form className="space-y-3" onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit(); }}>
      {children}
    </form>
  );
}

// O envio ao cliente (com e-mail, CC e anexos) fica em EnviarEmailModal.
export { EnviarEmailModal as EnviarModal } from './EnviarEmailModal';

export function AprovarModal({ proposta, onFechar }: { proposta: Proposta; onFechar: () => void }) {
  const [f, setF] = useState({ forma: 'PC', numero_documento: '', data_aprovacao: hojeISO(), valor_aprovado: String(proposta.valor), observacoes: '' });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const { erro, setErro, m } = useAcao(async () => {
    if (!arquivo) throw new Error('Anexe o comprovante da aprovação.');
    const caminho = await enviarComprovante(proposta.id, arquivo);
    await aprovarProposta(proposta.id, { ...f, valor_aprovado: numeroBR(f.valor_aprovado), comprovante_caminho: caminho, comprovante_nome: arquivo.name });
  }, onFechar);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal aberto titulo={`Aprovar ${proposta.codigo} R${proposta.revisao_atual}`} onFechar={onFechar}>
      <Form onSubmit={() => (arquivo ? m.mutate() : setErro('Anexe o comprovante da aprovação.'))}>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Forma de aprovação *">
            <Selecao value={f.forma} onChange={set('forma')}>
              {['PC', 'E-mail', 'WhatsApp', 'Contrato', 'Outra'].map((o) => <option key={o}>{o}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Nº do documento (PC, contrato…)"><Entrada value={f.numero_documento} onChange={set('numero_documento')} /></Campo>
          <Campo rotulo="Data da aprovação"><CampoData value={f.data_aprovacao} onChange={(v) => setF({ ...f, data_aprovacao: v })} /></Campo>
          <Campo rotulo={`Valor aprovado (proposta: ${moeda(proposta.valor)})`}><EntradaMoeda value={f.valor_aprovado} onChange={(v) => setF({ ...f, valor_aprovado: v })} /></Campo>
        </div>
        <Campo rotulo="Comprovante * (PDF ou imagem)">
          <CampoArquivo arquivo={arquivo} onChange={setArquivo} accept=".pdf,image/*,.eml,.msg" />
        </Campo>
        <Campo rotulo="Observações"><AreaTexto value={f.observacoes} onChange={set('observacoes')} /></Campo>
        <Aviso tipo="info">Ao aprovar, o contato passa a ser Cliente.</Aviso>
        <Rodape onFechar={onFechar} ocupado={m.isPending} rotulo="Aprovar proposta" />
      </Form>
    </Modal>
  );
}

export function ReprovarModal({ proposta, onFechar }: { proposta: Proposta; onFechar: () => void }) {
  const [f, setF] = useState({ motivo: 'Preço', concorrente: '', valor_concorrente: '', observacoes: '' });
  const { erro, m } = useAcao(() => reprovarProposta(proposta.id, { ...f, valor_concorrente: numeroBR(f.valor_concorrente) }), onFechar);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal aberto titulo={`Reprovar ${proposta.codigo}`} onFechar={onFechar}>
      <Form onSubmit={() => m.mutate()}>
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Motivo da perda *">
          <Selecao value={f.motivo} onChange={set('motivo')}>
            {['Preço', 'Prazo', 'Concorrência', 'Projeto cancelado', 'Cliente desistiu', 'Outro'].map((o) => <option key={o}>{o}</option>)}
          </Selecao>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Concorrente vencedor"><Entrada value={f.concorrente} onChange={set('concorrente')} /></Campo>
          <Campo rotulo="Valor do concorrente"><EntradaMoeda value={f.valor_concorrente} onChange={(v) => setF({ ...f, valor_concorrente: v })} /></Campo>
        </div>
        <Campo rotulo="Observações"><AreaTexto value={f.observacoes} onChange={set('observacoes')} /></Campo>
        <Rodape onFechar={onFechar} ocupado={m.isPending} rotulo="Reprovar" variante="perigo" />
      </Form>
    </Modal>
  );
}

export function ReabrirModal({ proposta, onFechar }: { proposta: Proposta; onFechar: () => void }) {
  const [motivo, setMotivo] = useState('');
  const { erro, m } = useAcao(() => moverProposta(proposta.id, 'À enviar', { justificativa: motivo }), onFechar);
  return (
    <Modal aberto titulo={`Voltar ${proposta.codigo} para À enviar`} onFechar={onFechar}>
      <Form onSubmit={() => m.mutate()}>
        <Aviso tipo="info">Será criada a revisão R{proposta.revisao_atual + 1}. A R{proposta.revisao_atual} e seus arquivos ficam preservados no histórico.</Aviso>
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Motivo da revisão"><AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: cliente pediu ajuste de escopo" /></Campo>
        <Rodape onFechar={onFechar} ocupado={m.isPending} rotulo={`Criar R${proposta.revisao_atual + 1}`} />
      </Form>
    </Modal>
  );
}

export function VoltarAdminModal({ proposta, para, onFechar }: { proposta: Proposta; para: StatusProposta; onFechar: () => void }) {
  const [just, setJust] = useState('');
  const { erro, m } = useAcao(() => moverProposta(proposta.id, para, { justificativa: just }), onFechar);
  return (
    <Modal aberto titulo={`Voltar ${proposta.codigo} para ${para}`} onFechar={onFechar}>
      <Form onSubmit={() => m.mutate()}>
        <Aviso tipo="info">Somente a Administração pode voltar uma proposta aprovada. Nada é alterado em outros setores.</Aviso>
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Justificativa *"><AreaTexto value={just} onChange={(e) => setJust(e.target.value)} required /></Campo>
        <Rodape onFechar={onFechar} ocupado={m.isPending} rotulo="Confirmar" />
      </Form>
    </Modal>
  );
}

export function FollowupModal({ proposta, onFechar }: { proposta: Proposta; onFechar: () => void }) {
  const [f, setF] = useState({ data_contato: hojeISO(), canal: 'WhatsApp', resumo: '', proxima_data: '' });
  const { erro, m } = useAcao(() => registrarFollowup(proposta.id, f), onFechar);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal aberto titulo={`Registrar follow-up · ${proposta.codigo}`} onFechar={onFechar}>
      <Form onSubmit={() => m.mutate()}>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Data do contato"><CampoData value={f.data_contato} onChange={(v) => setF({ ...f, data_contato: v })} /></Campo>
          <Campo rotulo="Canal">
            <Selecao value={f.canal} onChange={set('canal')}>
              {['Ligação', 'WhatsApp', 'E-mail', 'Presencial', 'Outro'].map((o) => <option key={o}>{o}</option>)}
            </Selecao>
          </Campo>
        </div>
        <Campo rotulo="Resumo"><AreaTexto value={f.resumo} onChange={set('resumo')} /></Campo>
        <Campo rotulo="Próximo follow-up"><CampoData value={f.proxima_data} onChange={(v) => setF({ ...f, proxima_data: v })} /></Campo>
        <Rodape onFechar={onFechar} ocupado={m.isPending} rotulo="Registrar" />
      </Form>
    </Modal>
  );
}
