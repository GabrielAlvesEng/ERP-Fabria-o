import { NavLink, Outlet } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export interface AbaModulo { to: string; rotulo: string; icone: LucideIcon; end?: boolean }

// Abas superiores dos módulos (redesign, decisão 51): linha roxa sob a aba ativa; no celular rolam de lado (decisão 59).
export function AbasModulo({ abas }: { abas: AbaModulo[] }) {
  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="abas gap-x-1 border-b border-borda" role="tablist">
        {abas.map((a) => (
          <NavLink key={a.to} to={a.to} end={a.end} role="tab"
            className={({ isActive }) => `-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors duration-150 ${isActive
              ? 'border-roxo-500 font-semibold text-roxo-600 dark:border-roxo-300 dark:text-roxo-100'
              : 'border-transparent text-suave hover:border-slate-300 hover:text-texto dark:hover:border-marinho-500'}`}>
            <a.icone size={16} /> {a.rotulo}
          </NavLink>
        ))}
      </div>
      <div className="flex-1 rounded-xl border border-borda bg-superficie p-3 shadow-sm sm:p-4 md:p-6">
        <Outlet />
      </div>
    </div>
  );
}
