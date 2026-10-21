// Fixadores em pastas (decisão 58): ordenação e leitura das medidas digitadas.

// Valor em mm para ordenar: "M8" → 8; '1/4"' → 6,35; '1.1/2"' → 38,1; "3,2" → 3,2; "10 mm" → 10. Texto sem número vai para o fim.
export function medidaEmMm(texto: string): number {
  const t = texto.trim().replace(/^Ø/i, '').replace(/^M/i, '');
  const pol = /^(?:(\d+)[.\s-])?(?:(\d+)\/(\d+)|(\d+))\s*"$/.exec(t);
  if (pol) {
    const inteiro = Number(pol[1] ?? 0) + (pol[4] ? Number(pol[4]) : 0);
    const fracao = pol[2] ? Number(pol[2]) / Number(pol[3]) : 0;
    return (inteiro + fracao) * 25.4;
  }
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

const ehPolegada = (s: string) => s.trim().endsWith('"');

// Métricos primeiro, depois polegada; dentro de cada um pela medida e depois pelo comprimento.
export function compararTamanho(a: { medida: string; comprimento: string }, b: { medida: string; comprimento: string }): number {
  return Number(ehPolegada(a.medida)) - Number(ehPolegada(b.medida))
    || medidaEmMm(a.medida) - medidaEmMm(b.medida)
    || medidaEmMm(a.comprimento) - medidaEmMm(b.comprimento)
    || a.medida.localeCompare(b.medida) || a.comprimento.localeCompare(b.comprimento);
}

// Lista digitada ("M6, M8; M10  M12") → ["M6","M8","M10","M12"], sem repetidos.
export function lerLista(texto: string): string[] {
  return [...new Set(texto.split(/[,;\n]+|\s{2,}/).map((s) => s.trim()).filter(Boolean))];
}

// Combinações de "Gerar vários" que ainda não existem.
export function combinacoesNovas(medidas: string[], comprimentos: string[], existentes: { medida: string; comprimento: string }[]): { medida: string; comprimento: string }[] {
  const ja = new Set(existentes.map((e) => `${e.medida}|${e.comprimento}`));
  const comps = comprimentos.length ? comprimentos : [''];
  return medidas.flatMap((medida) => comps.map((comprimento) => ({ medida, comprimento }))).filter((c) => !ja.has(`${c.medida}|${c.comprimento}`));
}
