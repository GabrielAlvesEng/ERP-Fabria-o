// Regras de tela da Comunicação (sem acesso ao banco), testadas em regras.test.ts.

export interface ItemCaixa { id: string; criado_em: string; fixado_ate: string | null; lido_em: string | null; ciente_em: string | null; exige_ciente: boolean; urgente: boolean }

export const fixado = (c: { fixado_ate: string | null }, hoje: string) => Boolean(c.fixado_ate && c.fixado_ate >= hoje);

// Pendente = ainda não lido, ou pede ciente e ainda não teve.
export const pendente = (c: Pick<ItemCaixa, 'lido_em' | 'ciente_em' | 'exige_ciente'>) => !c.lido_em || (c.exige_ciente && !c.ciente_em);

// Caixa de entrada: fixados no topo, depois os pendentes (urgentes primeiro), depois o resto; mais novos antes.
export function ordenarCaixa<T extends ItemCaixa>(lista: T[], hoje: string): T[] {
  const peso = (c: T) => (fixado(c, hoje) ? 0 : pendente(c) ? (c.urgente ? 1 : 2) : 3);
  return [...lista].sort((a, b) => peso(a) - peso(b) || b.criado_em.localeCompare(a.criado_em));
}

export interface Leitura { lido_em: string | null; ciente_em: string | null; push_enviado_em?: string | null }

export function resumoLeitura(linhas: Leitura[]) {
  return {
    total: linhas.length,
    lidos: linhas.filter((l) => l.lido_em).length,
    cientes: linhas.filter((l) => l.ciente_em).length,
    celular: linhas.filter((l) => l.push_enviado_em).length,
  };
}

// "Para quem" em uma linha.
export function rotuloAlcance(alcance: 'empresa' | 'setores' | 'pessoas', setores: string[], pessoas: number): string {
  if (alcance === 'empresa') return 'Toda a empresa';
  if (alcance === 'setores') return setores.length ? `Setor${setores.length > 1 ? 'es' : ''} ${setores.join(', ')}` : 'Setores';
  return `${pessoas} pessoa${pessoas === 1 ? '' : 's'}`;
}

// Nome curto do aparelho para a lista em Meu perfil (ex.: "Android · Chrome").
export function nomeAparelho(ua: string, toque = false): string {
  const sistema = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && toque) ? 'iPad'
    : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Aparelho';
  const navegador = /EdgA?\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\//.test(ua) ? 'Opera'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
  return navegador ? `${sistema} · ${navegador}` : sistema;
}

// Em que situação está este aparelho para receber o aviso, e o que a tela deve sugerir.
export type SituacaoAparelho = 'sem-suporte' | 'iphone-instalar' | 'bloqueado' | 'ativo' | 'desligado';
export function situacaoAparelho(o: { suporta: boolean; ios: boolean; instalado: boolean; permissao: NotificationPermission | 'indisponivel'; inscrito: boolean }): SituacaoAparelho {
  if (o.ios && !o.instalado) return 'iphone-instalar'; // no iPhone só funciona pelo ícone na tela de início
  if (!o.suporta) return 'sem-suporte';
  if (o.permissao === 'denied') return 'bloqueado';
  return o.inscrito && o.permissao === 'granted' ? 'ativo' : 'desligado';
}

// Chave pública VAPID (base64url) no formato que o navegador pede.
export function chaveParaBytes(b64url: string): Uint8Array {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
