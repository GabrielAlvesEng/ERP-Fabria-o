import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Globe, Mail, Phone, type LucideIcon } from 'lucide-react';
import { dividirNome, EMPRESA_ASSINATURA, formatarTelefone, type DadosAssinatura } from './assinatura';

// Banner da assinatura (decisão 89): imagem no padrão da Fabriaço, feita no navegador.
// Desenhado em 1200 × 512 (escala 1); a escala 2 dá a imagem para baixar.
export const LARGURA = 1200;
export const ALTURA = 512;

const COR = {
  fundo: '#f3f2f7', roxo: '#410fa0', roxoEscuro: '#2a0a6b', roxoMedio: '#5a2bc4', lavanda: '#c9b6f1', lavandaClara: '#e9e2fa',
  texto: '#1f2433', suave: '#4b5263', faixa: '#17171b',
};
const FONTE = '"Geist Sans", "Segoe UI", Arial, sans-serif';
const MARCA = `${import.meta.env.BASE_URL}marca/`;

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error('Não foi possível carregar uma imagem da assinatura.'));
    img.src = src;
  });
}

const svgParaImagem = (svg: string) => carregar(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

// Logo nova (símbolo + letreiro), com o roxo do símbolo clareado para aparecer sobre o painel roxo.
async function logo(): Promise<HTMLImageElement> {
  const svg = await (await fetch(`${MARCA}fabriaco-logo-cor-escuro.svg`)).text();
  return svgParaImagem(svg.replace(/#8B63E7/gi, COR.lavanda).replace('<svg ', '<svg width="1322" height="722" '));
}

const icone = (Icone: LucideIcon, cor = '#ffffff') =>
  svgParaImagem(renderToStaticMarkup(createElement(Icone, { color: cor, size: 96, strokeWidth: 1.6 })));

// Texto com espaço entre letras (canvas não tem letter-spacing em todos os navegadores). Devolve a largura.
function espacado(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, espaco: number, medir = false): number {
  let cx = x;
  for (const ch of texto) {
    if (!medir) ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + espaco;
  }
  return cx - x - espaco;
}

// Fonte que cabe na largura: começa em "tamanho" e diminui.
function caber(ctx: CanvasRenderingContext2D, peso: number, tamanho: number, largura: number, texto: string, minimo = 11): number {
  let t = tamanho;
  for (; t > minimo; t -= 0.5) {
    ctx.font = `${peso} ${t}px ${FONTE}`;
    if (ctx.measureText(texto).width <= largura) break;
  }
  return t;
}

function poligono(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// Foto "cobrindo" o retângulo, puxada para cima (o rosto costuma ficar no terço de cima).
function cobrir(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / k;
  const sh = h / k;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, Math.max(0, (img.naturalHeight - sh) * 0.25), sw, sh, x, y, w, h);
}

// Desenho corporativo (decisão 89, revisão): painel da marca à esquerda, dados ao centro, foto em painel
// inteiro à direita com corte inclinado e faixa escura com o lema embaixo.
const RODAPE = 440;

export async function desenharBanner(canvas: HTMLCanvasElement, d: DadosAssinatura, foto: HTMLImageElement | null, escala = 1): Promise<void> {
  await Promise.all([400, 500, 600, 700].map((p) => document.fonts.load(`${p} 20px "Geist Sans"`))).catch(() => undefined);
  const [imgLogo, iMail, iFone, iSite] = await Promise.all([logo(), icone(Mail, COR.roxo), icone(Phone, COR.roxo), icone(Globe, COR.roxo)]);

  canvas.width = LARGURA * escala;
  canvas.height = ALTURA * escala;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.textBaseline = 'middle';

  // Fundo branco (o JPEG não tem transparência) e cantos levemente arredondados.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, LARGURA, ALTURA, 12);
  ctx.clip();

  // Painel da marca.
  poligono(ctx, [[0, 0], [372, 0], [322, RODAPE], [0, RODAPE]]);
  const g = ctx.createLinearGradient(0, 0, 372, RODAPE);
  g.addColorStop(0, '#4a14b3');
  g.addColorStop(1, COR.roxoEscuro);
  ctx.fillStyle = g;
  ctx.fill();
  const lw = 250;
  const lh = (lw * 722) / 1322;
  ctx.drawImage(imgLogo, 170 - lw / 2, 100, lw, lh);
  ctx.strokeStyle = 'rgba(201,182,241,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(140, 300); ctx.lineTo(200, 300);
  ctx.stroke();
  ctx.font = `500 12.5px ${FONTE}`;
  ctx.fillStyle = COR.lavanda;
  for (const [t, y] of [['MONTAGENS INDUSTRIAIS', 326], ['E CALDEIRARIA', 346]] as const) {
    const w = espacado(ctx, t, 0, 0, 3, true);
    espacado(ctx, t, 170 - w / 2, y, 3);
  }

  // Painel da foto (ou das iniciais), com faixa roxa no corte.
  const painelFoto: [number, number][] = [[888, 0], [LARGURA, 0], [LARGURA, RODAPE], [836, RODAPE]];
  ctx.save();
  poligono(ctx, painelFoto);
  ctx.clip();
  if (foto) cobrir(ctx, foto, 836, 0, LARGURA - 836, RODAPE);
  else {
    ctx.fillStyle = COR.lavandaClara;
    ctx.fillRect(836, 0, LARGURA - 836, RODAPE);
    const ini = d.nome.trim().split(/\s+/).filter(Boolean);
    ctx.fillStyle = COR.roxo;
    ctx.font = `600 96px ${FONTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(((ini[0]?.[0] ?? '') + (ini.length > 1 ? ini[ini.length - 1][0] : '')).toUpperCase(), 1030, RODAPE / 2);
    ctx.textAlign = 'left';
  }
  ctx.restore();
  poligono(ctx, [[874, 0], [888, 0], [836, RODAPE], [822, RODAPE]]);
  ctx.fillStyle = COR.roxo;
  ctx.fill();

  // Nome (primeiro nome em negrito roxo), função e contatos.
  const x0 = 404;
  const limite = 800;
  const [primeiro, resto] = dividirNome(d.nome);
  const tam = caber(ctx, 700, 38, limite - x0, `${primeiro} ${resto}`, 20);
  ctx.font = `700 ${tam}px ${FONTE}`;
  ctx.fillStyle = COR.roxo;
  ctx.fillText(primeiro, x0, 108);
  const wPrimeiro = ctx.measureText(`${primeiro} `).width;
  ctx.font = `400 ${tam}px ${FONTE}`;
  ctx.fillStyle = COR.texto;
  ctx.fillText(resto, x0 + wPrimeiro, 108);

  const cargo = d.cargo.trim().toUpperCase();
  ctx.font = `600 14px ${FONTE}`;
  let espacoCargo = 2.5;
  while (espacoCargo > 0 && espacado(ctx, cargo, 0, 0, espacoCargo, true) > limite - x0) espacoCargo -= 0.5;
  caber(ctx, 600, 14, limite - x0, cargo, 10);
  ctx.fillStyle = COR.suave;
  espacado(ctx, cargo, x0 + 1, 150, espacoCargo);

  ctx.fillStyle = COR.roxo;
  ctx.fillRect(x0 + 1, 180, 48, 3);
  ctx.fillStyle = '#e5e3ee';
  ctx.fillRect(x0 + 49, 181, limite - x0 - 49, 1);

  const linhas: [HTMLImageElement, string][] = [[iMail, d.email.trim()], [iFone, formatarTelefone(d.telefone)], [iSite, EMPRESA_ASSINATURA.site]];
  linhas.forEach(([img, valor], i) => {
    const y = 236 + i * 56;
    ctx.fillStyle = COR.lavandaClara;
    ctx.beginPath();
    ctx.roundRect(x0, y - 18, 36, 36, 8);
    ctx.fill();
    ctx.drawImage(img, x0 + 8, y - 10, 20, 20);
    caber(ctx, 400, 18, limite - x0 - 52, valor, 10);
    ctx.fillStyle = COR.texto;
    ctx.fillText(valor, x0 + 52, y + 1);
  });

  // Faixa escura com o lema.
  ctx.fillStyle = '#141a2e';
  ctx.fillRect(0, RODAPE, LARGURA, ALTURA - RODAPE);
  const ga = ctx.createLinearGradient(0, 0, LARGURA, 0);
  ga.addColorStop(0, COR.roxoMedio);
  ga.addColorStop(1, COR.roxo);
  ctx.fillStyle = ga;
  ctx.fillRect(0, RODAPE, LARGURA, 4);
  ctx.font = `500 13px ${FONTE}`;
  let x = 40;
  const yLema = RODAPE + 38;
  EMPRESA_ASSINATURA.lema.forEach((p, i) => {
    if (i) {
      ctx.fillStyle = '#7b4fe0';
      const cx = x + 18;
      poligono(ctx, [[cx, yLema - 5], [cx + 5, yLema], [cx, yLema + 5], [cx - 5, yLema]]);
      ctx.fill();
      x += 36;
    }
    ctx.fillStyle = '#ffffff';
    x += espacado(ctx, p, x, yLema, 3.4);
  });
  ctx.font = `600 14px ${FONTE}`;
  ctx.fillStyle = COR.lavanda;
  ctx.textAlign = 'right';
  ctx.fillText('FABRIAÇO BRASIL', LARGURA - 40, yLema);
  ctx.textAlign = 'left';
  ctx.restore();
}

// Lê a foto (arquivo escolhido ou baixada do perfil) sem "sujar" o canvas: vira um blob local.
export async function fotoDeBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await carregar(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export const canvasParaBlob = (canvas: HTMLCanvasElement, tipo: 'image/png' | 'image/jpeg', qualidade?: number) =>
  new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível gerar a imagem.'))), tipo, qualidade));
