// Texto do item do Escopo que passa por baixo das imagens: estima as linhas no PDF e corta o texto
// onde a coluna de imagens termina. O resto vai na faixa de largura total, logo abaixo das imagens.

// Largura dos caracteres da Geist 400, em fração do tamanho da fonte (medida na própria fonte).
const LARGURAS: Record<string, number> = {
  ' ': 0.25, '.': 0.203, ',': 0.203, ';': 0.293, ':': 0.293, '-': 0.426, '(': 0.313, ')': 0.313, '/': 0.483,
  f: 0.399, i: 0.246, j: 0.261, l: 0.284, m: 0.878, r: 0.383, t: 0.397, w: 0.82, I: 0.272, M: 0.878, W: 0.912, '1': 0.385,
};
const larguraChar = (c: string) => LARGURAS[c] ?? (c >= 'A' && c <= 'Z' ? 0.67 : 0.58);
export const larguraTexto = (t: string, fonte: number) => [...t].reduce((a, c) => a + larguraChar(c), 0) * fonte;

// Quebra uma linha (sem \n) como o PDF faz: palavra por palavra, sem hifenizar.
export function quebrarLinha(linha: string, largura: number, fonte: number): string[] {
  const palavras = linha.split(' ').filter(Boolean);
  if (!palavras.length) return [''];
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (atual && larguraTexto(tentativa, fonte) > largura) { linhas.push(atual); atual = p; } else atual = tentativa;
  }
  linhas.push(atual);
  return linhas;
}

// Divide o texto para caber em "maxLinhas" linhas de "largura" pt. Corta entre palavras e prefere o fim de
// um parágrafo; o que sobra perde as linhas em branco do começo. Sem sobra, devolve o texto inteiro e "depois" vazio.
export function dividirTexto(texto: string, largura: number, fonte: number, maxLinhas: number): { antes: string; depois: string } {
  const linhas = texto.replace(/\r/g, '').split('\n');
  const antes: string[] = [];
  let usadas = 0;
  for (let k = 0; k < linhas.length; k++) {
    const visuais = quebrarLinha(linhas[k], largura, fonte);
    if (usadas + visuais.length <= maxLinhas) { antes.push(linhas[k]); usadas += visuais.length; continue; }
    const cabem = maxLinhas - usadas;
    // Parágrafo cortado no meio: só se ficarem ao menos 2 linhas de cada lado (como no Word).
    if (cabem >= 2 && visuais.length - cabem >= 2) {
      antes.push(visuais.slice(0, cabem).join(' '));
      const resto = [visuais.slice(cabem).join(' '), ...linhas.slice(k + 1)];
      return { antes: antes.join('\n').trimEnd(), depois: resto.join('\n').replace(/^\s*\n/, '').trim() };
    }
    return { antes: antes.join('\n').trimEnd(), depois: linhas.slice(k).join('\n').trim() };
  }
  return { antes: texto, depois: '' };
}
