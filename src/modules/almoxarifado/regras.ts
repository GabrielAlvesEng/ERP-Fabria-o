// Regras do Almoxarifado (decisão 104), sem acesso ao banco.

export type SituacaoEstoque = 'ok' | 'baixo' | 'zerado';
export type TipoMovimento = 'entrada' | 'retirada' | 'devolucao' | 'ajuste' | 'estorno';

export const ROTULO_SITUACAO: Record<SituacaoEstoque, { rotulo: string; cor: 'verde' | 'amarelo' | 'vermelho' }> = {
  ok: { rotulo: 'OK', cor: 'verde' },
  baixo: { rotulo: 'Baixo', cor: 'amarelo' },
  zerado: { rotulo: 'Zerado', cor: 'vermelho' },
};

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  entrada: 'Entrada', retirada: 'Retirada', devolucao: 'Devolução', ajuste: 'Ajuste', estorno: 'Estorno',
};

// Zerado = sem saldo; Baixo = no mínimo ou abaixo (só quando há mínimo).
export function situacaoEstoque(saldo: number, minimo: number): SituacaoEstoque {
  if (saldo <= 0) return 'zerado';
  if (minimo > 0 && saldo <= minimo) return 'baixo';
  return 'ok';
}

// Quantidade sugerida para comprar: o que falta para chegar a duas vezes o mínimo (planejamento 2.2).
export function sugestaoCompra(saldo: number, minimo: number): number {
  const alvo = Math.max(minimo * 2, minimo > 0 ? minimo + 1 : 1);
  return Math.max(Math.ceil(alvo - saldo), 1);
}

// 3 casas no banco; na tela, sem zeros sobrando (7 un, 2,5 m).
export function qtd(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

// "2,5" ou "2.5" vira 2.5; vazio ou inválido vira null.
export function lerQuantidade(s: string): number | null {
  const bruto = s.trim();
  const t = (bruto.includes(',') ? bruto.replace(/\./g, '') : bruto).replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Unidade sugerida ao incluir um produto no estoque: a do cadastro para itens, chapa em unidade, perfil em metro.
export function unidadePadrao(bibTipo: string, unidadeCadastro: string): string {
  if (bibTipo === 'chapa') return 'un';
  if (bibTipo === 'perfil') return 'm';
  return unidadeCadastro || 'un';
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Todas as palavras, em qualquer ordem ("disco 7 corte" acha "Disco de corte 7\"").
export function combina(texto: string, busca: string): boolean {
  const t = semAcento(texto);
  return semAcento(busca).split(/\s+/).filter(Boolean).every((p) => t.includes(p));
}
