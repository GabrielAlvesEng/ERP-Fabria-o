// Login por usuário para quem não tem e-mail (decisão 106). O Supabase Auth só entende e-mail, então o usuário
// "joao.silva" vira o endereço interno joao.silva@sem-email.fabriacobrasil.com.br, que nunca recebe mensagem.
export const DOMINIO_SEM_EMAIL = 'sem-email.fabriacobrasil.com.br';
export const USUARIO = /^[a-z0-9][a-z0-9._-]{2,39}$/;

export const semEmail = (email: string | null | undefined) => Boolean(email?.toLowerCase().endsWith(`@${DOMINIO_SEM_EMAIL}`));

// O que a pessoa digita na tela de entrada: e-mail, ou só o usuário.
export const emailDoLogin = (texto: string) => {
  const t = texto.trim().toLowerCase();
  return t.includes('@') ? t : `${t}@${DOMINIO_SEM_EMAIL}`;
};

// Como o login aparece na tela: o usuário, sem o domínio interno.
export const loginVisivel = (email: string | null | undefined) => (semEmail(email) ? email!.split('@')[0] : email ?? '');

// Sugestão de usuário a partir do nome: "João da Silva" vira "joao.silva".
export function sugerirUsuario(nome: string): string {
  const partes = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/).filter((p) => p && !['da', 'de', 'do', 'das', 'dos', 'e'].includes(p));
  if (!partes.length) return '';
  return (partes.length > 1 ? `${partes[0]}.${partes[partes.length - 1]}` : partes[0]).slice(0, 40);
}
