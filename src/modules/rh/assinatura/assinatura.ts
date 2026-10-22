// Assinatura de e-mail gerada pelo RH (decisão 89): o mesmo texto do HTML que a Fabriaço usa no Outlook,
// com a imagem (banner) feita no navegador em vez de anexada à mão.

export const EMPRESA_ASSINATURA = {
  endereco: 'Fabriaço Brasil | R. Paraná, 731 – Vila Santa Rosa, CEP 13731-160 – Mococa – São Paulo - Brasil',
  site: 'www.fabriacobrasil.com.br',
  lema: ['QUALIDADE', 'SEGURANÇA', 'COMPROMISSO', 'EXCELÊNCIA'],
};

export interface DadosAssinatura { nome: string; cargo: string; email: string; telefone: string }

// "19989010359", "(19) 98901-0359" ou "+55 19 98901 0359" → "+55 (19) 98901-0359". Outro formato fica como veio.
export function formatarTelefone(t: string): string {
  let d = t.replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) return `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `+55 (${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t.trim();
}

// No banner o primeiro nome vai em negrito e o resto normal, como no modelo.
export function dividirNome(nome: string): [string, string] {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return [partes[0] ?? '', partes.slice(1).join(' ')];
}

// O que falta para gerar (nome, cargo, e-mail e telefone aparecem na imagem).
export function faltaParaAssinatura(d: DadosAssinatura): string[] {
  const falta: string[] = [];
  if (!d.nome.trim()) falta.push('nome');
  if (!d.cargo.trim()) falta.push('função');
  if (!d.email.trim()) falta.push('e-mail corporativo');
  if (!d.telefone.trim()) falta.push('telefone');
  return falta;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Mesmo texto do modelo do Outlook (Eng_Guilherme_Ass.html), com a imagem embutida (data:). O e-mail da
// proposta transforma a imagem embutida em anexo "cid:", que o Outlook mostra.
export function montarHtmlAssinatura(d: DadosAssinatura, imagem: string): string {
  const fonte = 'font-size: 11pt;';
  const site = EMPRESA_ASSINATURA.site;
  return [
    `<b style="${fonte}">${esc(d.nome.trim())}</b>`,
    '<br>',
    `<i style="${fonte}">${esc(d.cargo.trim())}</i>`,
    '<br>',
    `<span style="${fonte}">${esc(EMPRESA_ASSINATURA.endereco)}</span>`,
    '<br>',
    `<span style="${fonte}">📞Phone: ${esc(formatarTelefone(d.telefone))}`,
    '<br>',
    `📧 <a href="mailto:${esc(d.email.trim())}">${esc(d.email.trim())}</a> | 🌐 acesse: <a href="https://${site}" target="_blank">${site}</a></span>`,
    '<br>',
    `<img src="${imagem}" alt="Fabriaço Brasil" width="567" style="display: block; width: 15cm; height: auto; border: 0;">`,
  ].join('\n');
}
