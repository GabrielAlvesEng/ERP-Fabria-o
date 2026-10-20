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
    <div className="flex min-h-screen bg-pagina">
      {/* Sidebar clara com borda fina (redesign, decisão 51); no escuro, grafite. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-borda bg-superficie md:flex">
        <div className="px-5 py-5"><Marca /></div>
        <div className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-suave">Módulos</div>
        <nav className="flex-1 space-y-0.5 px-3">
          {menu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${isActive
                ? 'bg-roxo-50 font-medium text-roxo-600 dark:bg-roxo-500/20 dark:text-roxo-100'
                : 'text-suave hover:bg-pagina hover:text-texto dark:hover:bg-marinho-700'}`}
            >
              <m.icone size={18} /> {m.rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-borda px-5 py-4 text-xs text-suave">
          <div className="truncate">{session?.user.email}</div>
          <button onClick={sair} className="mt-2 inline-flex items-center gap-1 hover:text-texto">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-1 border-b border-borda bg-superficie/90 px-2 backdrop-blur sm:gap-3 sm:px-4">
          <nav className="flex items-center gap-0.5 md:hidden">
            <Marca compacta />
            {menu.map((m) => (
              <NavLink key={m.to} to={m.to} title={m.rotulo} className={({ isActive }) => `rounded-lg p-2 ${isActive ? 'bg-roxo-50 text-roxo-600 dark:bg-roxo-500/20 dark:text-roxo-100' : 'text-suave'}`}>
                <m.icone size={18} />
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1 text-sm">
            <span className="mr-1 hidden text-suave sm:inline">Ano comercial</span>
            <button className="rounded-md p-1 text-suave hover:bg-pagina hover:text-texto dark:hover:bg-marinho-700" onClick={() => setAno(ano - 1)} aria-label="Ano anterior"><ChevronLeft size={16} /></button>
            <span className="w-10 text-center font-semibold tabular-nums sm:w-12">{ano}</span>
            <button className="rounded-md p-1 text-suave hover:bg-pagina hover:text-texto dark:hover:bg-marinho-700" onClick={() => setAno(ano + 1)} aria-label="Próximo ano"><ChevronRight size={16} /></button>
          </div>
          <div className="flex items-center sm:gap-1">
            <RetornosSino />
            <button onClick={() => setTema(tema === 'claro' ? 'escuro' : 'claro')} className="rounded-lg p-2 text-suave hover:bg-pagina hover:text-texto dark:hover:bg-marinho-700" aria-label="Alternar tema">
              {tema === 'claro' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button onClick={sair} className="rounded-lg p-2 text-suave hover:bg-pagina md:hidden dark:hover:bg-marinho-700" aria-label="Sair"><LogOut size={18} /></button>
          </div>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Marca provisória: símbolo "F" no roxo da marca + nome. Troca pela Logo Moderna oficial quando os arquivos chegarem (public/marca/).
export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}marca/simbolo.svg`} alt="" className="h-8 w-8 shrink-0" />
      {!compacta && (
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-texto">FABRIAÇO</div>
          <div className="text-[10px] uppercase tracking-wider text-suave">Montagens Industriais e Caldeiraria</div>
        </div>
      )}
    </div>
  );
}
