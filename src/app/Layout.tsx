import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BriefcaseBusiness, ChevronLeft, ChevronRight, Cog, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { useAno } from './AnoContext';
import { aplicarTema, lerTema, type Tema } from './tema';
import { RetornosSino } from '@/modules/vendas/RetornosSino';

// Um item por módulo. As áreas de cada módulo ficam em abas superiores dentro dele.
const modulos = [
  { to: '/vendas', rotulo: 'Vendas', icone: BriefcaseBusiness, modulo: 'vendas' },
  { to: '/engenharia', rotulo: 'Engenharia', icone: Cog, modulo: 'engenharia' },
  { to: '/admin', rotulo: 'Administração', icone: ShieldCheck, modulo: 'admin', acao: 'editar' as const },
];

export function Layout() {
  const { session, sair, pode } = useAuth();
  const menu = modulos.filter((m) => pode(m.modulo, ('acao' in m && m.acao) || 'ler'));
  const { ano, setAno } = useAno();
  const [tema, setTema] = useState<Tema>(lerTema);
  useEffect(() => aplicarTema(tema), [tema]);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-marinho-800 text-slate-200 md:flex">
        <div className="px-5 py-5">
          <div className="text-lg font-bold text-white">ERP Fabriaço</div>
          <div className="text-xs text-slate-400">Montagens Industriais e Caldeiraria</div>
        </div>
        <div className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Módulos</div>
        <nav className="flex-1 space-y-1 px-3">
          {menu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-roxo-500 text-white' : 'hover:bg-marinho-700'}`}
            >
              <m.icone size={18} /> {m.rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-marinho-700 px-5 py-4 text-xs text-slate-400">
          <div className="truncate">{session?.user.email}</div>
          <button onClick={sair} className="mt-2 inline-flex items-center gap-1 text-slate-300 hover:text-white">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-marinho-700 dark:bg-marinho-800">
          <nav className="flex gap-1 overflow-x-auto md:hidden">
            {menu.map((m) => (
              <NavLink key={m.to} to={m.to} title={m.rotulo} className={({ isActive }) => `rounded-lg p-2 ${isActive ? 'bg-roxo-500 text-white' : ''}`}>
                <m.icone size={18} />
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1 text-sm">
            <span className="mr-1 hidden text-slate-500 sm:inline">Ano comercial</span>
            <button className="rounded p-1 hover:bg-slate-100 dark:hover:bg-marinho-700" onClick={() => setAno(ano - 1)} aria-label="Ano anterior"><ChevronLeft size={16} /></button>
            <span className="w-12 text-center font-semibold">{ano}</span>
            <button className="rounded p-1 hover:bg-slate-100 dark:hover:bg-marinho-700" onClick={() => setAno(ano + 1)} aria-label="Próximo ano"><ChevronRight size={16} /></button>
          </div>
          <div className="flex items-center gap-2">
            <RetornosSino />
            <button onClick={() => setTema(tema === 'claro' ? 'escuro' : 'claro')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-marinho-700" aria-label="Alternar tema">
              {tema === 'claro' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button onClick={sair} className="rounded-lg p-2 hover:bg-slate-100 md:hidden dark:hover:bg-marinho-700" aria-label="Sair"><LogOut size={18} /></button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
