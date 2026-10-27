// Cálculo do ponto (decisão 115). Funções puras: recebem as batidas, justificativas, feriados e decisões
// e devolvem o dia e o mês. Horas em minutos. Datas ISO (AAAA-MM-DD) no fuso de Brasília.

export interface ConfigPonto {
  manha_inicio: string; manha_fim: string; tarde_inicio: string; tarde_fim: string;
  dias_semana: number[]; // 0 = domingo ... 6 = sábado
  tolerancia_batida_min: number; // batida até X min antes da entrada ou depois da saída não conta como extra
  tolerancia_atraso_dia_min: number; // atraso/saída antecipada somados até X min no dia não contam
  precisao_max_m: number;
  inicio?: string | null; // dia em que o ponto começou a valer; antes dele nada conta
}

export const CONFIG_PADRAO: ConfigPonto = {
  manha_inicio: '07:00', manha_fim: '11:30', tarde_inicio: '13:00', tarde_fim: '17:18',
  dias_semana: [1, 2, 3, 4, 5], tolerancia_batida_min: 5, tolerancia_atraso_dia_min: 10, precisao_max_m: 100,
};

export interface BatidaCalc { momento: string }
export interface JustificativaCalc { inicio: string; fim: string; periodo: 'dia' | 'manha' | 'tarde'; tipo: string }
export interface DecisaoCalc { decisao: 'aprovado' | 'abonado'; observacao: string }

export type SituacaoDia = 'futuro' | 'fora' | 'sem_expediente' | 'feriado' | 'justificado' | 'em_andamento' | 'normal' | 'divergente' | 'falta' | 'incompleto';

export interface ResultadoDia {
  dia: string;
  situacao: SituacaoDia;
  previsto: number;
  trabalhado: number;
  extra: number; // já com a tolerância
  deficit: number; // atraso + saída antecipada + falta, já com a tolerância
  saldo: number; // extra − deficit
  alertas: string[];
  precisaDecisao: boolean; // fora da tolerância e o dia já passou
  decisao: DecisaoCalc | null;
  saldoOficial: number; // o que entra no relatório: 0 se dentro da tolerância, abonado ou ainda pendente
  pendente: boolean; // precisa de decisão do RH e ainda não tem
  feriado?: string;
  justificativa?: string;
}

export const minutos = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

const fmtHora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const minutosDoMomento = (iso: string) => minutos(fmtHora.format(new Date(iso)));
export const horaDoMomento = (iso: string) => fmtHora.format(new Date(iso));

export function hhmm(min: number, sinal = false): string {
  const s = min < 0 ? '-' : sinal && min > 0 ? '+' : '';
  const a = Math.abs(Math.round(min));
  return `${s}${Math.floor(a / 60)}h${String(a % 60).padStart(2, '0')}`;
}

export const diaDaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

export function diasDoMes(mes: string): string[] {
  const [a, m] = mes.split('-').map(Number);
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
}

export const ROTULO_BATIDA = ['Entrada da manhã', 'Saída para almoço', 'Volta do almoço', 'Saída da tarde'];

export function calcularDia(p: {
  dia: string; hoje: string; config: ConfigPonto; batidas: BatidaCalc[]; justificativas: JustificativaCalc[];
  feriado?: string | null; decisao?: DecisaoCalc | null; admissao?: string | null; desligamento?: string | null;
}): ResultadoDia {
  const { dia, hoje, config: c } = p;
  const b = [...p.batidas].map((x) => minutosDoMomento(x.momento)).sort((x, y) => x - y);
  const base = { dia, previsto: 0, trabalhado: 0, extra: 0, deficit: 0, saldo: 0, alertas: [] as string[], precisaDecisao: false, decisao: p.decisao ?? null, saldoOficial: 0, pendente: false, feriado: p.feriado ?? undefined };
  if (dia > hoje) return { ...base, situacao: 'futuro' };
  if ((c.inicio && dia < c.inicio) || (p.admissao && dia < p.admissao) || (p.desligamento && dia > p.desligamento)) return { ...base, situacao: 'fora' };

  const just = p.justificativas.filter((j) => j.inicio <= dia && j.fim >= dia);
  const justDia = just.find((j) => j.periodo === 'dia');
  const manhaJust = Boolean(justDia || just.some((j) => j.periodo === 'manha'));
  const tardeJust = Boolean(justDia || just.some((j) => j.periodo === 'tarde'));
  const util = c.dias_semana.includes(diaDaSemana(dia)) && !p.feriado;
  const mI = minutos(c.manha_inicio), mF = minutos(c.manha_fim), tI = minutos(c.tarde_inicio), tF = minutos(c.tarde_fim);
  const temManha = util && !manhaJust;
  const temTarde = util && !tardeJust;
  const previsto = (temManha ? mF - mI : 0) + (temTarde ? tF - tI : 0);
  const justificativa = just.map((j) => j.periodo === 'dia' ? j.tipo : `${j.tipo} (${j.periodo === 'manha' ? 'manhã' : 'tarde'})`).join(', ') || undefined;

  const trabalhado = (b.length >= 2 ? b[1] - b[0] : 0) + (b.length >= 4 ? b[3] - b[2] : 0);
  const r = { ...base, previsto, trabalhado, justificativa };

  if (b.length === 0) {
    if (previsto === 0) return { ...r, situacao: p.feriado && c.dias_semana.includes(diaDaSemana(dia)) ? 'feriado' : justificativa && util ? 'justificado' : 'sem_expediente' };
    if (dia === hoje) return { ...r, situacao: 'em_andamento' };
    return fechar({ ...r, deficit: previsto, alertas: temManha && temTarde ? [] : [`Faltou à ${temManha ? 'manhã' : 'tarde'}`] }, 'falta');
  }
  if (dia === hoje && b.length < 4 && (b.length % 2 === 1 || previsto > trabalhado)) {
    return { ...r, situacao: 'em_andamento' };
  }

  const alertas: string[] = [];
  const avisosAtraso: string[] = [];
  let extra = 0, atraso = 0;
  const tol = c.tolerancia_batida_min;
  if (b.length === 4 && temManha && temTarde) {
    // Dia completo: compara cada batida com o horário. Positivo = a mais, negativo = a menos.
    const d = [mI - b[0], b[1] - mF, tI - b[2], b[3] - tF];
    const mais = ['Chegou %s antes', 'Saiu para o almoço %s depois', 'Voltou do almoço %s antes', 'Saiu %s depois'];
    const menos = ['Chegou %s atrasado', 'Saiu para o almoço %s antes', 'Voltou do almoço %s atrasado', 'Saiu %s antes'];
    d.forEach((v, i) => {
      if (v > tol) { extra += v; alertas.push(mais[i].replace('%s', hhmm(v))); }
      else if (v < 0) { atraso += -v; avisosAtraso.push(menos[i].replace('%s', hhmm(-v))); }
    });
    if (b[2] - b[1] < 60) alertas.push('Almoço menor que 1 hora');
  } else {
    // Dia parcial, sem expediente ou com batida faltando: compara o total.
    if (b.length % 2 === 1) alertas.push('Batida faltando');
    if (previsto === 0) alertas.push(p.feriado ? `Trabalhou no feriado (${p.feriado})` : util ? 'Trabalhou em dia justificado' : 'Trabalhou em dia sem expediente');
    else if (b.length === 2 && temManha && temTarde) alertas.push('Só um período batido');
    if (trabalhado > previsto) extra = previsto === 0 || trabalhado - previsto > tol ? trabalhado - previsto : 0;
    else if (previsto > trabalhado) { atraso = previsto - trabalhado; avisosAtraso.push(`Faltaram ${hhmm(atraso)}`); }
  }
  // Atraso e saída antecipada somados até a tolerância do dia não contam.
  const deficit = atraso > c.tolerancia_atraso_dia_min ? atraso : 0;
  if (deficit) alertas.push(...avisosAtraso);
  const situacao: SituacaoDia = b.length % 2 === 1 ? 'incompleto' : alertas.length || extra || deficit ? 'divergente' : 'normal';
  return fechar({ ...r, extra, deficit, alertas }, situacao);
}

function fechar(r: Omit<ResultadoDia, 'situacao' | 'saldo' | 'saldoOficial' | 'pendente' | 'precisaDecisao'> & Partial<ResultadoDia>, situacao: SituacaoDia): ResultadoDia {
  const saldo = r.extra - r.deficit;
  const precisaDecisao = situacao !== 'normal';
  const d = r.decisao ?? null;
  const saldoOficial = !precisaDecisao || !d || d.decisao === 'abonado' ? 0 : saldo;
  return { ...r, situacao, saldo, precisaDecisao, saldoOficial, pendente: precisaDecisao && !d } as ResultadoDia;
}

export interface ResumoMes {
  previsto: number; trabalhado: number; extrasAprovadas: number; deficitAprovado: number; saldoOficial: number;
  faltas: number; pendentes: number; divergentes: number; diasTrabalhados: number;
}

export function resumirMes(dias: ResultadoDia[]): ResumoMes {
  const r: ResumoMes = { previsto: 0, trabalhado: 0, extrasAprovadas: 0, deficitAprovado: 0, saldoOficial: 0, faltas: 0, pendentes: 0, divergentes: 0, diasTrabalhados: 0 };
  for (const d of dias) {
    r.previsto += d.previsto;
    r.trabalhado += d.trabalhado;
    if (d.trabalhado > 0) r.diasTrabalhados++;
    if (d.situacao === 'falta') r.faltas++;
    if (d.precisaDecisao) r.divergentes++;
    if (d.pendente) r.pendentes++;
    if (d.decisao?.decisao === 'aprovado' && d.precisaDecisao) { r.extrasAprovadas += d.extra; r.deficitAprovado += d.deficit; }
    r.saldoOficial += d.saldoOficial;
  }
  return r;
}

export const SITUACAO_DIA: Record<SituacaoDia, { rotulo: string; cor: 'cinza' | 'roxo' | 'verde' | 'vermelho' | 'amarelo' | 'azul' }> = {
  futuro: { rotulo: '', cor: 'cinza' },
  fora: { rotulo: 'Fora do contrato', cor: 'cinza' },
  sem_expediente: { rotulo: 'Sem expediente', cor: 'cinza' },
  feriado: { rotulo: 'Feriado', cor: 'azul' },
  justificado: { rotulo: 'Justificado', cor: 'azul' },
  em_andamento: { rotulo: 'Em andamento', cor: 'roxo' },
  normal: { rotulo: 'Normal', cor: 'verde' },
  divergente: { rotulo: 'Fora da tolerância', cor: 'amarelo' },
  falta: { rotulo: 'Falta', cor: 'vermelho' },
  incompleto: { rotulo: 'Batida faltando', cor: 'vermelho' },
};

// Distância em metros (haversine), igual à do banco, para mostrar antes de bater.
export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (g: number) => (g * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export const distanciaTexto = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`);

// Lê latitude e longitude de um link do Google Maps (o "!3d…!4d…" do lugar vale mais que o "@…" da câmera)
// ou de "lat, lng" digitado.
export function coordenadasDoTexto(t: string): { latitude: number; longitude: number } | null {
  const s = decodeURIComponent(t.trim());
  const m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ?? s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    ?? s.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) ?? s.match(/^(-?\d+(?:[.]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.]\d+)?)$/);
  if (!m) return null;
  const latitude = Number(m[1]), longitude = Number(m[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}
