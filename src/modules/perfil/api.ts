import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthProvider';
import { supabase } from '@/shared/lib/supabase';

// Meu perfil (decisão 68): dados pessoais e foto de cada usuário, editados por ele mesmo em qualquer módulo.
// A foto fica no espaço privado "perfis", em {id do usuário}/foto.jpg; o banco só aceita gravar na própria pasta.

export interface MeuUsuario {
  id: string; nome: string; email: string; telefone: string; nascimento: string | null;
  foto_caminho: string | null; foto_atualizada_em: string | null; perfis: string[];
}

function ok<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

export async function lerMeuUsuario(id: string): Promise<MeuUsuario> {
  const u = ok(await supabase.from('usuarios').select('id, nome, email, telefone, nascimento, foto_caminho, foto_atualizada_em').eq('id', id).single());
  const perfis = ok(await supabase.from('usuario_perfis').select('perfis(nome)').eq('usuario_id', id)) as unknown as { perfis: { nome: string } | null }[];
  return { ...(u as unknown as Omit<MeuUsuario, 'perfis'>), perfis: perfis.map((p) => p.perfis?.nome ?? '').filter(Boolean) };
}

export function useMeuUsuario() {
  const { session } = useAuth();
  return useQuery({ queryKey: ['meu_usuario', session?.user.id], queryFn: () => lerMeuUsuario(session!.user.id), enabled: Boolean(session) });
}

export async function salvarMeuPerfil(nome: string, telefone: string, nascimento: string | null): Promise<void> {
  ok(await supabase.rpc('salvar_meu_perfil', { p_nome: nome, p_telefone: telefone, p_nascimento: nascimento || null }));
}

// Recorta a foto no centro (quadrada) e reduz para 400 px antes de enviar.
async function fotoQuadrada(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const lado = Math.min(bitmap.width, bitmap.height);
  const saida = Math.min(400, lado);
  const canvas = document.createElement('canvas');
  canvas.width = saida; canvas.height = saida;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, saida, saida);
  ctx.drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, saida, saida);
  return new Promise((res, falha) => canvas.toBlob((b) => (b ? res(b) : falha(new Error('Não foi possível ler a imagem.'))), 'image/jpeg', 0.88));
}

export async function enviarMinhaFoto(usuarioId: string, arquivo: File): Promise<void> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha uma imagem (JPG, PNG ou WEBP).');
  const caminho = `${usuarioId}/foto.jpg`;
  ok(await supabase.storage.from('perfis').upload(caminho, await fotoQuadrada(arquivo), { upsert: true, contentType: 'image/jpeg' }));
  ok(await supabase.rpc('salvar_minha_foto', { p_caminho: caminho }));
}

export async function tirarMinhaFoto(): Promise<void> {
  ok(await supabase.rpc('salvar_minha_foto', { p_caminho: null }));
}

// Link temporário (1 h) da foto; a data da troca entra na chave para a foto nova aparecer na hora.
export function useFoto(caminho: string | null | undefined, versao?: string | null) {
  return useQuery({
    queryKey: ['foto_perfil', caminho, versao],
    enabled: Boolean(caminho),
    staleTime: 50 * 60 * 1000,
    queryFn: async () => ok(await supabase.storage.from('perfis').createSignedUrl(caminho!, 3600)).signedUrl,
  });
}
