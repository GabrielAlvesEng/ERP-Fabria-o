import { NavLink, Outlet } from 'react-router-dom';
import { Building2, KanbanSquare, LayoutDashboard, Users } from 'lucide-react';

// Abas superiores do módulo Vendas, no estilo de abas do Windows/navegador:
// a aba ativa "encosta" no painel de conteúdo logo abaixo.
const abas = [
  { to: '/vendas', rotulo: 'Dashboard', icone: LayoutDashboard, end: true },
  { to: '/vendas/empresas', rotulo: 'Empresas', icone: Building2 },
  { to: '/vendas/contatos', rotulo: 'Contatos', icone: Users },
  { to: '/vendas/propostas', rotulo: 'Propostas', icone: KanbanSquare },
];

export function VendasLayout() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-end gap-1 overflow-x-auto px-1" role="tablist">
        {abas.map((a) => (
          <NavLink
            key={a.to}
            to={a.to}
            end={a.end}
            role="tab"
            className={({ isActive }) =>
              `relative -mb-px flex shrink-0 items-center gap-2 rounded-t-xl border px-4 py-2 text-sm transition ${
                isActive
                  ? 'z-10 border-slate-200 border-b-white bg-white font-semibold text-roxo-600 dark:border-marinho-700 dark:border-b-marinho-800 dark:bg-marinho-800 dark:text-roxo-100'
                  : 'border-transparent bg-slate-200/70 text-slate-600 hover:bg-slate-200 dark:bg-marinho-900/60 dark:text-slate-300 dark:hover:bg-marinho-700'
              }`
            }
          >
            <a.icone size={16} /> {a.rotulo}
          </NavLink>
        ))}
      </div>
      <div className="flex-1 rounded-b-2xl rounded-tr-2xl border border-slate-200 bg-white p-4 md:p-6 dark:border-marinho-700 dark:bg-marinho-800">
        <Outlet />
      </div>
    </div>
  );
}
