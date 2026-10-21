import { supabase } from '@/shared/lib/supabase';

// Assinatura de e-mail importada do Outlook (decisão 66). O Outlook guarda cada assinatura em
// %APPDATA%\Microsoft\Signatures: um arquivo .htm e uma pasta "<nome>_arquivos" (ou "_files") com as imagens.
// Aqui o .htm é lido, limpo (sem scripts nem links perigosos) e as imagens entram no próprio HTML.

export const PASTA_ASSINATURAS = '%APPDATA%\\Microsoft\\Signatures';

export async function lerMinhaAssinatura(uid: string): Promise<{ html: string; atualizada: string | null }> {
  const { data, error } = await supabase.from('usuarios').select('assinatura_html, assinatura_atualizada_em').eq('id', uid).maybeSingle();
  if (error) throw error;
  return { html: (data?.assinatura_html as string) ?? '', atualizada: (data?.assinatura_atualizada_em as string | null) ?? null };
}

export async function salvarMinhaAssinatura(html: string): Promise<void> {
  const { error } = await supabase.rpc('salvar_minha_assinatura_html', { p_html: html });
  if (error) throw error;
}

// O Outlook grava o .htm em windows-1252 (ou o que estiver no <meta charset>).
async function lerTexto(f: File): Promise<string> {
  const bytes = new Uint8Array(await f.arrayBuffer());
  const inicio = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const cs = /charset\s*=\s*["']?([\w-]+)/i.exec(inicio)?.[1]?.toLowerCase() ?? 'windows-1252';
  try { return new TextDecoder(cs).decode(bytes); } catch { return new TextDecoder('windows-1252').decode(bytes); }
}

const paraDataUrl = (f: File) => new Promise<string>((ok, falha) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => falha(r.error);
  r.readAsDataURL(f);
});

const nomeBase = (caminho: string) => {
  const limpo = caminho.split(/[?#]/)[0].replace(/\\/g, '/');
  try { return decodeURIComponent(limpo.split('/').pop() ?? '').toLowerCase(); } catch { return (limpo.split('/').pop() ?? '').toLowerCase(); }
};

const PROIBIDOS = 'script, iframe, object, embed, link, meta, base, form, input, button, textarea, select, title';

export interface AssinaturaLida { html: string; faltando: string[]; nomeArquivo: string }

// Recebe o .htm (e, se quiser, as imagens da pasta). Devolve o HTML pronto e as imagens que faltaram.
export async function importarAssinaturaOutlook(arquivos: File[]): Promise<AssinaturaLida> {
  const htm = arquivos.find((f) => /\.html?$/i.test(f.name));
  if (!htm) throw new Error('Escolha o arquivo .htm da assinatura (na pasta Signatures do Outlook).');
  const imagens = new Map(arquivos.filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp)$/i.test(f.name)).map((f) => [f.name.toLowerCase(), f]));
  const doc = new DOMParser().parseFromString(await lerTexto(htm), 'text/html');

  doc.querySelectorAll(PROIBIDOS).forEach((el) => el.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const a of [...el.attributes]) {
      const nome = a.name.toLowerCase();
      if (nome.startsWith('on') || (['href', 'src', 'action', 'background'].includes(nome) && /^\s*(javascript|vbscript):/i.test(a.value))) el.removeAttribute(a.name);
    }
  });

  // Comentários condicionais do Outlook (VML) apontam para arquivos locais: saem, fica a imagem comum.
  const comentarios = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
  const lixo: Node[] = [];
  while (comentarios.nextNode()) lixo.push(comentarios.currentNode);
  lixo.forEach((n) => n.parentNode?.removeChild(n));

  const faltando: string[] = [];
  for (const img of [...doc.body.querySelectorAll('img')]) {
    const src = img.getAttribute('src') ?? '';
    if (/^(https?:|data:|cid:)/i.test(src)) continue;
    const f = imagens.get(nomeBase(src));
    if (f) img.setAttribute('src', await paraDataUrl(f));
    else { faltando.push(nomeBase(src) || src); img.remove(); }
  }

  // Estilos do Outlook (classes MsoNormal etc.) vão junto, dentro da própria assinatura.
  const estilos = [...doc.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n').replace(/<!--|-->/g, '').trim();
  const corpo = doc.body.innerHTML.trim();
  if (!corpo.replace(/<[^>]*>|&nbsp;|\s/g, '')) throw new Error('O arquivo não tem nenhuma assinatura.');
  const html = `${estilos ? `<style>${estilos}</style>` : ''}<div class="assinatura-outlook">${corpo}</div>`;
  return { html, faltando: [...new Set(faltando)], nomeArquivo: htm.name };
}
