import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BriefcaseBusiness, ChevronLeft, ChevronRight, Cog, LogOut, Menu, Moon, ShieldCheck, Sun, X } from 'lucide-react';
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
  // Celular: menu lateral que abre pelo botão ☰ e fecha ao trocar de tela, tocar fora ou apertar Esc.
  const [gaveta, setGaveta] = useState(false);
  const local = useLocation();
  useEffect(() => setGaveta(false), [local.pathname]);
  useEffect(() => {
    if (!gaveta) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setGaveta(false);
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [gaveta]);

  return (
    <div className="flex min-h-screen bg-pagina">
      {/* Sidebar clara com borda fina (redesign, decisão 51); no escuro, grafite. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-borda bg-superficie md:flex">
        <div className="px-5 py-5"><Marca /></div>
        <div className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-suave">Módulos</div>
        <ListaModulos menu={menu} />
        <Rodape email={session?.user.email} sair={sair} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-1 border-b border-borda bg-superficie/90 px-2 backdrop-blur sm:gap-3 sm:px-4">
          <div className="flex items-center gap-1 md:hidden">
            <button onClick={() => setGaveta(true)} className="rounded-lg p-2 text-texto hover:bg-pagina dark:hover:bg-marinho-700" aria-label="Abrir menu"><Menu size={20} /></button>
            <Marca compacta />
          </div>
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
          </div>
        </header>
        {gaveta && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-black/40 animate-[aparecer_150ms_ease-out]" onClick={() => setGaveta(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-superficie shadow-xl animate-[deslizar_200ms_ease-out]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <div className="flex items-center justify-between px-5 py-4">
                <Marca />
                <button onClick={() => setGaveta(false)} className="rounded-lg p-2 text-suave hover:bg-pagina dark:hover:bg-marinho-700" aria-label="Fechar menu"><X size={20} /></button>
              </div>
              <div className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-suave">Módulos</div>
              <ListaModulos menu={menu} grande />
              <Rodape email={session?.user.email} sair={sair} />
            </aside>
          </div>
        )}
        <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 p-3 sm:p-4 md:p-6">
          <div key={local.pathname.split('/')[1]} className="entrar"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}

function ListaModulos({ menu, grande = false }: { menu: typeof modulos; grande?: boolean }) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
      {menu.map((m) => (
        <NavLink
          key={m.to}
          to={m.to}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 ${grande ? 'py-3 text-[15px]' : 'py-2 text-sm'} transition-colors duration-150 ${isActive
            ? 'bg-roxo-50 font-medium text-roxo-600 dark:bg-roxo-500/20 dark:text-roxo-100'
            : 'text-suave hover:bg-pagina hover:text-texto dark:hover:bg-marinho-700'}`}
        >
          <m.icone size={grande ? 20 : 18} /> {m.rotulo}
        </NavLink>
      ))}
    </nav>
  );
}

function Rodape({ email, sair }: { email?: string; sair: () => void }) {
  return (
    <div className="border-t border-borda px-5 py-4 text-xs text-suave">
      <div className="truncate">{email}</div>
      <button onClick={sair} className="mt-2 inline-flex items-center gap-1 hover:text-texto">
        <LogOut size={14} /> Sair
      </button>
    </div>
  );
}

// Logo oficial (public/marca/, arquivos do Gabriel). No tema escuro entra a versão do manual: roxo #8B63E7 e branco.
const MARCA = `${import.meta.env.BASE_URL}marca/`;
function ImagemMarca({ nome, className }: { nome: string; className: string }) {
  return (
    <>
      <img src={`${MARCA}${nome}.svg`} alt="Fabriaço" className={`${className} dark:hidden`} />
      <img src={`${MARCA}${nome}-escuro.svg`} alt="Fabriaço" className={`${className} hidden dark:block`} />
    </>
  );
}

// variante "horizontal": símbolo + letreiro (sidebar); "compacta": só o símbolo (topo do celular); "vertical": logo completa (login).
export function Marca({ compacta = false, vertical = false }: { compacta?: boolean; vertical?: boolean }) {
  if (vertical) return (
    <div className="flex flex-col items-center gap-2">
      <ImagemMarca nome="fabriaco-logo-cor" className="h-20 w-auto" />
      <div className="text-[10px] uppercase tracking-[0.2em] text-suave">Montagens Industriais e Caldeiraria</div>
    </div>
  );
  return (
    <div className="flex items-center gap-2.5">
      <ImagemMarca nome="fabriaco-simbolo" className="h-8 w-auto shrink-0" />
      {!compacta && (
        <ImagemMarca nome="fabriaco-letreiro" className="h-5 w-auto" />
      )}
    </div>
  );
}
