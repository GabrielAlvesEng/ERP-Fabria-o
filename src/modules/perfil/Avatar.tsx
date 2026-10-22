import { UserRound } from 'lucide-react';
import { useFoto } from './api';

// Foto do usuário (Meu perfil) num círculo; sem foto, as iniciais do nome ou o ícone de pessoa.
export function Avatar({ caminho, versao, nome, tamanho = 40 }: { caminho?: string | null; versao?: string | null; nome?: string; tamanho?: number }) {
  const { data: url } = useFoto(caminho, versao);
  const iniciais = (nome ?? '').replace(/[._-]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-roxo-50 font-semibold text-roxo-600 dark:bg-roxo-500/20 dark:text-roxo-100"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.38 }}>
      {url ? <img src={url} alt={nome ?? 'Foto'} className="h-full w-full object-cover" />
        : iniciais || <UserRound size={tamanho * 0.5} />}
    </div>
  );
}
