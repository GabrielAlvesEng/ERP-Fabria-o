import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AreaTexto, Aviso, Botao, Campo, CampoArquivo, CampoData, CampoInteiro, EntradaMoeda, Modal, Selecao } from '@/shared/ui';
import { dataBR, hojeISO, mensagemErro, moeda } from '@/shared/lib/formato';
import { definirDiasAviso, obterDiasAviso, registrarPagamento, type Conta } from './api';
import { COR_PRAZO, DIAS_AVISO, ROTULO_FORMA, ROTULO_PRAZO, emAberto, lerValor, proximaParcela, saldo, type FormaPagamento, type Prazo } from './regras';

const ESTILO_PRAZO: Partial<Record<Prazo, string>> = {
  hoje: 'bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200',
};
const ESTILO_COR = {
  vermelho: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  amarelo: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  verde: 'bg-petroleo-50 text-petroleo-600 dark:bg-petroleo-600/30 dark:text-teal-100',
  azul: 'bg-marinho-50 text-marinho-500 dark:bg-marinho-500/40 dark:text-slate-100',
  cinza: 'bg-slate-100 text-slate-700 dark:bg-marinho-700 dark:text-slate-200',
};

// Dias de antecedência do aviso "vence em breve" (decisão 109); enquanto carrega, vale o padrão.
export function useDiasAviso(ativo = true): number {
  const { data } = useQuery({ queryKey: ['financeiro', 'dias_aviso'], queryFn: obterDiasAviso, enabled: ativo, staleTime: 5 * 60_000 });
  return data ?? DIAS_AVISO;
}

export function DiasAvisoModal({ atual, onFechar }: { atual: number; onFechar: () => void }) {
  const qc = useQueryClient();
  const [dias, setDias] = useState<number | null>(atual);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    if (!dias) return setErro('Informe os dias.');
    setSalvando(true);
    setErro('');
    try {
      await definirDiasAviso(dias);
      await qc.invalidateQueries({ queryKey: ['financeiro', 'dias_aviso'] });
      onFechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Modal aberto titulo="Aviso de vencimento" onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-sm text-suave">A conta passa para "Vence em breve" (amarelo, no sino e no painel) quando faltam estes dias para o vencimento. Vale para todos do Financeiro.</p>
        <Campo rotulo="Avisar com quantos dias de antecedência"><CampoInteiro valor={dias} onChange={setDias} min={1} max={60} sufixo="dias" className="w-40" /></Campo>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </div>
    </Modal>
  );
}

// Selo do prazo: vermelho vencida, laranja vence hoje, amarelo dentro do aviso, verde paga (planejamento 2.2).
export function SeloPrazo({ prazo, data }: { prazo: Prazo; data?: string | null }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTILO_PRAZO[prazo] ?? ESTILO_COR[COR_PRAZO[prazo]]}`}>
      {ROTULO_PRAZO[prazo]}{data && prazo !== 'paga' ? ` · ${dataBR(data)}` : ''}
    </span>
  );
}

// Registrar pagamento de uma parcela (total ou parcial), com comprovante.
export function PagamentoModal({ conta, parcelaId, onFechar }: { conta: Conta; parcelaId?: string; onFechar: () => void }) {
  const qc = useQueryClient();
  const abertas = emAberto(conta.fin_parcelas);
  const [parcela, setParcela] = useState(parcelaId ?? proximaParcela(conta.fin_parcelas)?.id ?? '');
  const atual = abertas.find((p) => p.id === parcela);
  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState(atual ? saldo(atual).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [obs, setObs] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function trocarParcela(id: string) {
    setParcela(id);
    const p = abertas.find((x) => x.id === id);
    if (p) setValor(saldo(p).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  }

  async function salvar() {
    const v = lerValor(valor);
    if (!atual) return setErro('Escolha a parcela.');
    if (!(v > 0)) return setErro('Informe o valor pago.');
    if (v > saldo(atual) + 0.001) return setErro(`O valor passa do saldo da parcela (${moeda(saldo(atual))}).`);
    setSalvando(true);
    setErro('');
    try {
      await registrarPagamento(conta.id, { parcela, data, valor: v, forma, observacao: obs, comprovante: arquivo });
      await qc.invalidateQueries({ queryKey: ['financeiro'] });
      onFechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto titulo={`Pagar · ${conta.fornecedor_nome}`} onFechar={onFechar}>
      {abertas.length === 0 ? <Aviso tipo="info">Esta conta não tem parcela em aberto.</Aviso> : (
        <div className="space-y-3">
          <Campo rotulo="Parcela">
            <Selecao value={parcela} onChange={(e) => trocarParcela(e.target.value)}>
              {abertas.map((p) => <option key={p.id} value={p.id}>Parcela {p.numero} · {p.vencimento ? dataBR(p.vencimento) : 'sem data'} · saldo {moeda(saldo(p))}</option>)}
            </Selecao>
          </Campo>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Data do pagamento"><CampoData value={data} onChange={setData} required /></Campo>
            <Campo rotulo="Valor pago"><EntradaMoeda value={valor} onChange={setValor} /></Campo>
            <Campo rotulo="Forma">
              <Selecao value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
                {Object.entries(ROTULO_FORMA).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
              </Selecao>
            </Campo>
          </div>
          <Campo rotulo="Comprovante (PDF ou imagem)"><CampoArquivo arquivo={arquivo} onChange={setArquivo} accept="application/pdf,image/png,image/jpeg,image/webp" /></Campo>
          <Campo rotulo="Observação"><AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} rows={2} /></Campo>
          {atual && lerValor(valor) > 0 && lerValor(valor) < saldo(atual) - 0.001 && (
            <p className="text-xs text-suave">Pagamento parcial: fica {moeda(saldo(atual) - lerValor(valor))} em aberto nesta parcela.</p>
          )}
          {erro && <Aviso>{erro}</Aviso>}
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
            <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Registrar pagamento'}</Botao>
          </div>
        </div>
      )}
    </Modal>
  );
}
