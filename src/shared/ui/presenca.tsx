import { createContext, useContext, type ReactNode } from 'react';

// Bolhas de presença (decisão 84): a foto de quem está mexendo num campo aparece ao lado dele.
// Cada campo tem um id (data-campo); blocos (seção, item) dão um prefixo aos campos de dentro.
export interface Bolha { id: string; nome: string; campo: string | null; avatar: ReactNode }

const Pessoas = createContext<Bolha[]>([]);
export const ProvedorBolhas = Pessoas.Provider;

const Prefixo = createContext('');
export function PrefixoCampo({ valor, children }: { valor: string; children: ReactNode }) {
  const antes = useContext(Prefixo);
  return <Prefixo.Provider value={antes + valor}>{children}</Prefixo.Provider>;
}
export const useIdCampo = (nome: string) => useContext(Prefixo) + nome;

// inicio: mostra também quem está em qualquer campo de dentro do bloco.
export function Bolhas({ campo, inicio = false, dica = 'está mexendo aqui' }: { campo: string; inicio?: boolean; dica?: string }) {
  const lista = useContext(Pessoas).filter((b) => b.campo && (inicio ? b.campo.startsWith(campo) : b.campo === campo));
  if (!lista.length) return null;
  return (
    <span className="-my-1 inline-flex shrink-0 -space-x-1.5 align-middle">
      {lista.map((b) => (
        <span key={b.id} title={`${b.nome} ${dica}`} className="bolha-presenca inline-flex rounded-full border-2 border-petroleo-500 bg-superficie">{b.avatar}</span>
      ))}
    </span>
  );
}
