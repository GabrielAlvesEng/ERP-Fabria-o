import { createContext, useContext, useState, type ReactNode } from 'react';

// Ano comercial compartilhado entre Dashboard, Contatos e Propostas.
const anoInicial = Number(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 4));
const Ctx = createContext<{ ano: number; setAno: (a: number) => void }>({ ano: anoInicial, setAno: () => {} });

export function AnoProvider({ children }: { children: ReactNode }) {
  const [ano, setAno] = useState(anoInicial);
  return <Ctx.Provider value={{ ano, setAno }}>{children}</Ctx.Provider>;
}

export const useAno = () => useContext(Ctx);
