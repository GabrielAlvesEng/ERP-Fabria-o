import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Cog, Flame, Globe, HardHat, Mail, Phone, ShieldCheck, type LucideIcon } from 'lucide-react';
import { dividirNome, EMPRESA_ASSINATURA, formatarTelefone, type DadosAssinatura } from './assinatura';

// Banner da assinatura (decisão 89), no estilo do modelo da Fabriaço: painel roxo com a logo à esquerda,
// nome, função e contatos no meio, foto à direita e as faixas do lema e dos ícones embaixo.
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

// Borda do painel roxo: de (520, 0) a (380, 440).
const bordaPainel = (y: number) => 520 - (140 * y) / 440;

export async function desenharBanner(canvas: HTMLCanvasElement, d: DadosAssinatura, foto: HTMLImageElement | null, escala = 1): Promise<void> {
  await Promise.all([400, 500, 600, 700].map((p) => document.fonts.load(`${p} 20px "Geist Sans"`))).catch(() => undefined);
  const [imgLogo, iMail, iFone, iSite, ...iLema] = await Promise.all([
    logo(), icone(Mail), icone(Phone), icone(Globe), icone(HardHat), icone(Cog), icone(Flame), icone(ShieldCheck),
  ]);

  canvas.width = LARGURA * escala;
  canvas.height = ALTURA * escala;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.textBaseline = 'middle';

  // Cartão com cantos arredondados (fora deles, branco: o JPEG não tem transparência).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, LARGURA, ALTURA, 22);
  ctx.clip();
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  // Painel roxo com traços finos de desenho técnico.
  poligono(ctx, [[0, 0], [520, 0], [380, 440], [0, 440]]);
  const g = ctx.createLinearGradient(0, 0, 520, 440);
  g.addColorStop(0, '#4c16b8');
  g.addColorStop(1, COR.roxoEscuro);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const brilho = ctx.createRadialGradient(150, 120, 10, 150, 120, 380);
  brilho.addColorStop(0, 'rgba(255,255,255,0.10)');
  brilho.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = brilho;
  ctx.fillRect(0, 0, 520, 440);
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1;
  ctx.strokeRect(330, 22, 160, 70);
  ctx.strokeRect(20, 345, 120, 95);
  ctx.strokeRect(255, 385, 70, 55);
  ctx.beginPath();
  ctx.moveTo(470, 30); ctx.lineTo(400, 240);
  ctx.moveTo(60, 0); ctx.lineTo(60, 60); ctx.lineTo(0, 60);
  ctx.stroke();
  ctx.restore();

  // Logo e faixa "Montagens industriais e caldeiraria".
  const lw = 300;
  const lh = (lw * 722) / 1322;
  ctx.drawImage(imgLogo, 210 - lw / 2, 62, lw, lh);
  const yFaixa = 62 + lh + 22;
  poligono(ctx, [[0, yFaixa], [bordaPainel(yFaixa) - 20, yFaixa], [bordaPainel(yFaixa + 32) - 30, yFaixa + 32], [0, yFaixa + 32]]);
  ctx.fillStyle = 'rgba(20,20,26,0.82)';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `500 14px ${FONTE}`;
  espacado(ctx, 'MONTAGENS INDUSTRIAIS E CALDEIRARIA', 34, yFaixa + 17, 2.6);

  // Traço roxo inclinado entre o painel e os dados.
  ctx.strokeStyle = COR.roxo;
  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(bordaPainel(130) + 30, 130);
  ctx.lineTo(bordaPainel(345) + 30, 345);
  ctx.stroke();

  // Nome (primeiro em negrito roxo) e função.
  const x0 = 548;
  const limite = 925;
  const [primeiro, resto] = dividirNome(d.nome);
  const tam = caber(ctx, 700, 36, limite - x0, `${primeiro} ${resto}`, 20);
  ctx.font = `700 ${tam}px ${FONTE}`;
  ctx.fillStyle = COR.roxo;
  ctx.fillText(primeiro, x0, 92);
  const wPrimeiro = ctx.measureText(`${primeiro} `).width;
  ctx.font = `400 ${tam}px ${FONTE}`;
  ctx.fillStyle = COR.texto;
  ctx.fillText(resto, x0 + wPrimeiro, 92);

  ctx.fillStyle = COR.roxo;
  poligono(ctx, [[x0 + 6, 132], [x0 + 12, 132], [x0 + 7, 146], [x0 + 1, 146]]);
  ctx.fill();
  poligono(ctx, [[x0 + 13, 132], [x0 + 16, 132], [x0 + 11, 146], [x0 + 8, 146]]);
  ctx.fill();
  const cargo = d.cargo.trim().toUpperCase();
  ctx.font = `600 15px ${FONTE}`;
  let espacoCargo = 2;
  while (espacoCargo > 0 && espacado(ctx, cargo, 0, 0, espacoCargo, true) > limite - x0 - 26) espacoCargo -= 0.5;
  caber(ctx, 600, 15, limite - x0 - 26, cargo, 10);
  espacado(ctx, cargo, x0 + 26, 140, espacoCargo);

  // Linhas de contato com ícone em círculo.
  const linhas: { y: number; icone: HTMLImageElement; rotulo: string; valor: string }[] = [
    { y: 232, icone: iMail, rotulo: 'Email:', valor: d.email.trim() },
    { y: 304, icone: iFone, rotulo: 'Phone:', valor: formatarTelefone(d.telefone) },
    { y: 374, icone: iSite, rotulo: '', valor: EMPRESA_ASSINATURA.site },
  ];
  ctx.strokeStyle = COR.roxo;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.2;
  for (const y of [180, 268, 340]) {
    ctx.beginPath();
    ctx.moveTo(x0 - (y > 200 ? 0 : -10), y);
    ctx.lineTo(limite - (y > 200 ? 30 : 0), y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const l of linhas) {
    const cx = x0 + 22;
    ctx.fillStyle = COR.roxoEscuro;
    ctx.beginPath();
    ctx.arc(cx, l.y, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(l.icone, cx - 11, l.y - 11, 22, 22);
    let x = cx + 36;
    if (l.rotulo) {
      ctx.font = `700 18px ${FONTE}`;
      ctx.fillStyle = COR.roxo;
      ctx.fillText(l.rotulo, x, l.y);
      x += ctx.measureText(l.rotulo).width + 8;
    }
    caber(ctx, 400, l.rotulo ? 16 : 18, limite - x, l.valor, 10);
    ctx.fillStyle = COR.texto;
    ctx.fillText(l.valor, x, l.y);
  }

  // Foto em círculo (ou o símbolo, sem foto).
  const fx = 1056;
  const fy = 222;
  const r = 112;
  ctx.fillStyle = COR.lavandaClara;
  ctx.beginPath();
  ctx.arc(fx + 10, fy + 8, r + 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COR.roxo;
  ctx.beginPath();
  ctx.arc(fx, fy, r + 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(fx, fy, r + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(fx, fy, r, 0, Math.PI * 2);
  ctx.clip();
  if (foto) {
    // Recorte "cobrir", puxado para cima (o rosto costuma ficar no terço de cima).
    const lado = Math.min(foto.naturalWidth, foto.naturalHeight);
    const sx = (foto.naturalWidth - lado) / 2;
    const sy = Math.max(0, (foto.naturalHeight - lado) * 0.3);
    ctx.drawImage(foto, sx, sy, lado, lado, fx - r, fy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = COR.roxoEscuro;
    ctx.fillRect(fx - r, fy - r, r * 2, r * 2);
    const iniciais = d.nome.trim().split(/\s+/).filter(Boolean);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 84px ${FONTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(((iniciais[0]?.[0] ?? '') + (iniciais.length > 1 ? iniciais[iniciais.length - 1][0] : '')).toUpperCase(), fx, fy + 4);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // Faixa preta com o lema e faixa roxa com os ícones.
  poligono(ctx, [[0, 448], [748, 448], [728, 512], [0, 512]]);
  ctx.fillStyle = COR.faixa;
  ctx.fill();
  ctx.font = `500 14px ${FONTE}`;
  let x = 40;
  EMPRESA_ASSINATURA.lema.forEach((p, i) => {
    if (i) {
      ctx.fillStyle = '#7b4fe0';
      const cx = x + 18;
      poligono(ctx, [[cx, 474], [cx + 5, 480], [cx, 486], [cx - 5, 480]]);
      ctx.fill();
      x += 36;
    }
    ctx.fillStyle = '#ffffff';
    x += espacado(ctx, p, x, 481, 3.4);
  });

  poligono(ctx, [[778, 440], [LARGURA, 440], [LARGURA, 512], [752, 512]]);
  const gb = ctx.createLinearGradient(760, 0, LARGURA, 0);
  gb.addColorStop(0, COR.roxoEscuro);
  gb.addColorStop(1, COR.roxo);
  ctx.fillStyle = gb;
  ctx.fill();
  iLema.forEach((img, i) => {
    const cx = 850 + i * 96;
    ctx.drawImage(img, cx - 17, 459, 34, 34);
    if (i) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 48, 456);
      ctx.lineTo(cx - 48, 496);
      ctx.stroke();
    }
  });
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
