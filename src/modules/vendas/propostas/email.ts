// E-mail de envio da proposta (decisão 32): assunto, texto padrão e rascunho .eml com anexos.

export function codigoComRevisao(codigo: string, revisao: number): string {
  return revisao > 0 ? `${codigo}-R${revisao}` : codigo;
}

export function assuntoProposta(codigo: string, revisao: number, titulo: string): string {
  return `Proposta ${codigoComRevisao(codigo, revisao)} FABRIAÇO - ${titulo.trim()}`;
}

export function corpoPadrao(contato: string, codigo: string, revisao: number, titulo: string): string {
  return [
    `Prezado ${contato.trim()}`,
    '',
    `Espero que este e-mail os encontre bem. Conforme alinhado, estou encaminhando em anexo a proposta: ${codigoComRevisao(codigo, revisao)} - ${titulo.trim()}.`,
    '',
    'Por favor, sinta-se à vontade para revisar o documento e entrar em contato caso tenha alguma dúvida ou precise de mais informações.',
    '',
    'Agradeço antecipadamente pela oportunidade de colaborar em seu projeto e aguardo ansiosamente sua resposta.',
    '',
    'Atenciosamente,',
  ].join('\n');
}

export function separarEmails(texto: string): string[] {
  return texto.split(/[;,\s]+/).map((e) => e.trim()).filter(Boolean);
}

export function emailValido(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// --- Montagem do .eml (MIME) ---------------------------------------------------

export interface Anexo { nome: string; tipo: string; base64: string }

function b64utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

// Cabeçalho com acentos (RFC 2047).
function cabecalho(s: string): string {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64utf8(s)}?=`;
}

function quebrar76(b64: string): string {
  return b64.replace(/.{1,76}/g, '$&\r\n').trimEnd();
}

function escaparHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Sem assinatura: o vendedor usa a que já está no Outlook/Thunderbird (pedido do Gabriel, 21/10/2026).
export function montarEml(p: { para: string[]; cc: string[]; assunto: string; corpo: string; anexos: Anexo[]; data?: Date }): string {
  const misto = `misto_${Math.random().toString(36).slice(2)}`;
  const alt = `alt_${Math.random().toString(36).slice(2)}`;
  const texto = p.corpo;
  const html =
    `<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">` +
    p.corpo.split('\n').map((l) => (l ? `<p style="margin:0">${escaparHtml(l)}</p>` : '<p style="margin:0">&nbsp;</p>')).join('') +
    `</div>`;
  const linhas = [
    `To: ${p.para.join(', ')}`,
    ...(p.cc.length ? [`Cc: ${p.cc.join(', ')}`] : []),
    `Subject: ${cabecalho(p.assunto)}`,
    `Date: ${(p.data ?? new Date()).toUTCString()}`,
    'X-Unsent: 1', // Outlook abre como mensagem nova, pronta para enviar
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${misto}"`,
    '',
    `--${misto}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    quebrar76(b64utf8(texto)),
    `--${alt}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    quebrar76(b64utf8(html)),
    `--${alt}--`,
  ];
  for (const a of p.anexos) {
    const ascii = a.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    linhas.push(
      `--${misto}`,
      `Content-Type: ${a.tipo || 'application/octet-stream'}; name="${ascii}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(a.nome)}`,
      '',
      quebrar76(a.base64),
    );
  }
  linhas.push(`--${misto}--`, '');
  return linhas.join('\r\n');
}

export async function blobParaBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const passo = 0x8000;
  for (let i = 0; i < buf.length; i += passo) bin += String.fromCharCode(...buf.subarray(i, i + passo));
  return btoa(bin);
}

export function baixarArquivo(conteudo: string | Blob, nome: string, tipo = 'message/rfc822') {
  const blob = typeof conteudo === 'string' ? new Blob([conteudo], { type: tipo }) : conteudo;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
