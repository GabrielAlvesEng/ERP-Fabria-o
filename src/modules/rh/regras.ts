import { apenasDigitos } from '@/shared/lib/formato';

// Regras do RH (decisão 69) que a tela usa antes de enviar ao banco. O banco confere de novo.

export type Situacao = 'ativo' | 'ferias' | 'afastado' | 'desligado';
export const SITUACOES: { valor: Situacao; rotulo: string; cor: 'verde' | 'azul' | 'amarelo' | 'cinza' }[] = [
  { valor: 'ativo', rotulo: 'Ativo', cor: 'verde' },
  { valor: 'ferias', rotulo: 'Férias', cor: 'azul' },
  { valor: 'afastado', rotulo: 'Afastado', cor: 'amarelo' },
  { valor: 'desligado', rotulo: 'Desligado', cor: 'cinza' },
];
export const situacao = (s: Situacao) => SITUACOES.find((x) => x.valor === s) ?? SITUACOES[0]!;

export const VINCULOS = ['CLT', 'PJ', 'Sócio', 'Temporário', 'Estágio'] as const;
export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export function cpfValido(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const digito = (base: string) => {
    const soma = base.split('').reduce((s, n, i) => s + Number(n) * (base.length + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = digito(d.slice(0, 9));
  const d2 = digito(d.slice(0, 9) + d1);
  return d.endsWith(`${d1}${d2}`);
}

export function formatarCPF(cpf: string | null | undefined): string {
  const d = apenasDigitos(cpf ?? '');
  return d.length === 11 ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : cpf ?? '';
}

export interface DadosFicha {
  nome: string; cpf: string; nascimento: string; admissao: string; situacao: Situacao; desligamento: string; email_pessoal: string; email_corporativo: string;
}

const emailOk = (e: string) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Devolve a primeira mensagem de erro, ou '' quando a ficha pode ser salva.
export function validarFicha(f: DadosFicha, hoje: string): string {
  if (f.nome.trim().length < 3) return 'Informe o nome completo.';
  if (f.cpf && !cpfValido(f.cpf)) return 'CPF inválido.';
  if (f.nascimento && (f.nascimento < '1920-01-01' || f.nascimento > hoje)) return 'Data de nascimento inválida.';
  if (!emailOk(f.email_pessoal.trim()) || !emailOk(f.email_corporativo.trim())) return 'E-mail inválido.';
  if (f.situacao === 'desligado' && !f.desligamento) return 'Informe a data de desligamento.';
  if (f.desligamento && f.admissao && f.desligamento < f.admissao) return 'O desligamento não pode ser antes da admissão.';
  return '';
}

// Situação de um requisito (a mesma conta da visão situacao_requisitos do banco).
export type SituacaoReq = 'em_dia' | 'vencendo' | 'vencido' | 'faltando';
export const SITUACAO_REQ: Record<SituacaoReq, { rotulo: string; cor: 'verde' | 'amarelo' | 'vermelho' | 'cinza'; ordem: number }> = {
  vencido: { rotulo: 'Vencido', cor: 'vermelho', ordem: 0 },
  faltando: { rotulo: 'Faltando', cor: 'cinza', ordem: 1 },
  vencendo: { rotulo: 'Vence em breve', cor: 'amarelo', ordem: 2 },
  em_dia: { rotulo: 'Em dia', cor: 'verde', ordem: 3 },
};

const somarDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

export function situacaoDocumento(validade: string | null, avisoDias: number, hoje: string): Exclude<SituacaoReq, 'faltando'> {
  if (!validade) return 'em_dia';
  if (validade < hoje) return 'vencido';
  return validade <= somarDias(hoje, avisoDias) ? 'vencendo' : 'em_dia';
}

// Validade sugerida: emissão + meses do tipo (31/01 + 1 mês = 28 ou 29/02).
export function sugerirValidade(emissao: string, meses: number | null): string {
  if (!emissao || !meses) return '';
  const [a, m, d] = emissao.split('-').map(Number) as [number, number, number];
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

export function diasAte(iso: string, hoje: string): number {
  return Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
}
