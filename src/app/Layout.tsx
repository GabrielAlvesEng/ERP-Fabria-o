import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BriefcaseBusiness, ChevronLeft, ChevronRight, Cog, IdCard, LogOut, Menu, Moon, ShieldCheck, Sun, X } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { useAno } from './AnoContext';
import { aplicarTema, lerTema, type Tema } from './tema';
import { RetornosSino } from '@/modules/vendas/RetornosSino';
import { VencimentosSino } from '@/modules/rh/VencimentosSino';
import { Avatar } from '@/modules/perfil/Avatar';
import { useMeuUsuario } from '@/modules/perfil/api';

// Um item por módulo. As áreas de cada módulo ficam em abas superiores dentro dele.
// Decisão 78: o menu é dividido em Operacionais (a operação dos projetos: Vendas, Engenharia, Fabricação...)
// e Administrativos (RH, Financeiro, Administração...). Módulos novos entram no grupo certo.
const modulos = [
  { to: '/vendas', rotulo: 'Vendas', icone: BriefcaseBusiness, modulo: 'vendas', grupo: 'operacional' },
  { to: '/engenharia', rotulo: 'Engenharia', icone: Cog, modulo: 'engenharia', grupo: 'operacional' },
  { to: '/rh', rotulo: 'RH', icone: IdCard, modulo: 'rh', grupo: 'administrativo' },
  { to: '/admin', rotulo: 'Administração', icone: ShieldCheck, modulo: 'admin', acao: 'editar' as const, grupo: 'administrativo' },
];
const GRUPOS = [['operacional', 'Módulos operacionais'], ['administrativo', 'Módulos administrativos']] as const;

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
    <div className="flex h-[100dvh] overflow-hidden bg-pagina">
      {/* Sidebar clara com borda fina (redesign, decisão 51); no escuro, grafite. */}
      <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-borda bg-superficie md:flex">
        <div className="px-5 py-5"><Marca /></div>
        <ListaModulos menu={menu} />
        <Rodape email={session?.user.email} sair={sair} />
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-1 border-b border-borda bg-superficie/90 px-2 backdrop-blur sm:gap-3 sm:px-4">
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
            <VencimentosSino />
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
              <ListaModulos menu={menu} grande />
              <Rodape email={session?.user.email} sair={sair} />
            </aside>
          </div>
        )}
        {/* Só a área do conteúdo rola: a barra de rolagem fica dentro dela e o espaço já fica reservado,
            para a página não "encolher" quando uma aba tem rolagem. */}
        <div id="area-principal" className="area-rolagem min-h-0 flex-1 overflow-y-auto">
          <main className="mx-auto w-full min-w-0 max-w-[1600px] p-3 sm:p-4 md:p-6">
            <div key={local.pathname.split('/')[1]} className="entrar"><Outlet /></div>
          </main>
        </div>
      </div>
    </div>
  );
}

function ListaModulos({ menu, grande = false }: { menu: typeof modulos; grande?: boolean }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3">
      {GRUPOS.map(([grupo, titulo]) => {
        const itens = menu.filter((m) => m.grupo === grupo);
        if (!itens.length) return null;
        return (
          <div key={grupo} className="mb-4 space-y-0.5">
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-suave">{titulo}</div>
            {itens.map((m) => (
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
          </div>
        );
      })}
    </nav>
  );
}

// Pé do menu: foto e nome levam ao Meu perfil (decisão 68), em qualquer módulo.
function Rodape({ email, sair }: { email?: string; sair: () => void }) {
  const { data: eu } = useMeuUsuario();
  return (
    <div className="border-t border-borda px-3 py-3 text-xs text-suave">
      <NavLink to="/perfil" className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${isActive ? 'bg-roxo-50 dark:bg-roxo-500/20' : 'hover:bg-pagina dark:hover:bg-marinho-700'}`}>
        <Avatar caminho={eu?.foto_caminho} versao={eu?.foto_atualizada_em} nome={eu?.nome ?? email} tamanho={32} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-texto">{eu?.nome ?? email}</span>
          <span className="block truncate">Meu perfil · {email}</span>
        </span>
      </NavLink>
      <button onClick={sair} className="ml-2 mt-2 inline-flex items-center gap-1 hover:text-texto">
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
