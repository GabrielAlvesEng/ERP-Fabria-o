// Datas: ISO no banco, DD/MM/AAAA na tela.
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : '—';
}

export function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}

export function hojeISO(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

export function moeda(v: number | string | null | undefined): string {
  return Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function apenasDigitos(s: string): string {
  return s.replace(/\D/g, '');
}

export function formatarCNPJ(cnpj: string | null | undefined): string {
  const d = apenasDigitos(cnpj ?? '');
  if (d.length !== 14) return cnpj ?? '';
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function cnpjValido(cnpj: string): boolean {
  const d = apenasDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((s, n, i) => s + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(d.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d.endsWith(`${d1}${d2}`);
}

export function mensagemErro(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = String((e as { message: string }).message);
    if (msg.includes('empresas_cnpj_unico')) return 'Já existe uma empresa com este CNPJ.';
    if (msg.includes('row-level security')) return 'Sem permissão para esta ação.';
    return msg;
  }
  return 'Erro inesperado.';
}

// Aceita "1.234,56", "1234,56" ou "1234.56" e devolve texto numérico para o banco.
export function numeroBR(s: string): string {
  const t = s.trim();
  if (!t) return '';
  return t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
}
