// Tamanho (px) de uma imagem PNG, JPEG ou WebP em data URL, lido do cabeçalho do arquivo (sem carregar a imagem).
// Usado no PDF para a imagem comprida ocupar a largura toda do card (decisão 119). Formato desconhecido: null.
export function dimensoesImagem(dataUrl: string): { largura: number; altura: number } | null {
  const virgula = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || virgula < 0) return null;
  let bin: string;
  try { bin = atob(dataUrl.slice(virgula + 1, virgula + 1 + 400000)); } catch { return null; }
  const b = (i: number) => bin.charCodeAt(i) & 0xff;
  const u16 = (i: number) => (b(i) << 8) | b(i + 1);
  const u32 = (i: number) => ((b(i) << 24) >>> 0) + (b(i + 1) << 16) + (b(i + 2) << 8) + b(i + 3);
  if (bin.startsWith('\x89PNG')) return { largura: u32(16), altura: u32(20) };
  if (b(0) === 0xff && b(1) === 0xd8) {
    let i = 2;
    while (i + 9 < bin.length) {
      if (b(i) !== 0xff) { i++; continue; }
      const m = b(i + 1);
      // SOF0..SOF15 (menos DHT, JPG e DAC) trazem altura e largura.
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { altura: u16(i + 5), largura: u16(i + 7) };
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + u16(i + 2);
    }
    return null;
  }
  if (bin.slice(0, 4) === 'RIFF' && bin.slice(8, 12) === 'WEBP') {
    const tipo = bin.slice(12, 16);
    if (tipo === 'VP8X') return { largura: 1 + (b(24) | (b(25) << 8) | (b(26) << 16)), altura: 1 + (b(27) | (b(28) << 8) | (b(29) << 16)) };
    if (tipo === 'VP8 ') return { largura: (b(26) | (b(27) << 8)) & 0x3fff, altura: (b(28) | (b(29) << 8)) & 0x3fff };
    if (tipo === 'VP8L') {
      const v = b(21) | (b(22) << 8) | (b(23) << 16) | (b(24) << 24);
      return { largura: (v & 0x3fff) + 1, altura: ((v >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

// Altura (pt) do card de cada imagem: a imagem ocupa a largura útil do card; a comprida cresce até "maxima".
// Se a coluna toda passar de "coluna", volta todas para a altura padrão (para caber numa página).
export function alturasDasImagens(proporcoes: (number | null)[], o: { largura: number; padrao: number; maxima: number; coluna: number; espaco: number; extras: number[] }): number[] {
  const alturas = proporcoes.map((p, k) => {
    if (!p) return o.padrao;
    return Math.min(o.maxima, Math.max(o.padrao, (o.largura - 10) * p + 10 + o.extras[k]));
  });
  const total = alturas.reduce((a, h) => a + h, 0) + o.espaco * (alturas.length - 1);
  return total > o.coluna ? alturas.map(() => o.padrao) : alturas;
}
