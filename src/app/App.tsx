import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthProvider';
import { supabaseConfigurado } from '@/shared/lib/supabase';
import { AnoProvider } from './AnoContext';
import { Layout } from './Layout';
import { LoginPage } from './LoginPage';
import { VendasLayout } from '@/modules/vendas/VendasLayout';
import { DashboardPage } from '@/modules/vendas/dashboard/DashboardPage';
import { EmpresasPage } from '@/modules/vendas/empresas/EmpresasPage';
import { ContatosPage } from '@/modules/vendas/contatos/ContatosPage';
import { PropostasPage } from '@/modules/vendas/propostas/PropostasPage';
import { EngenhariaLayout } from '@/modules/engenharia/EngenhariaLayout';
import { ProjetosPage } from '@/modules/engenharia/ProjetosPage';
import { ProjetoPage } from '@/modules/engenharia/ProjetoPage';
import { AdminLayout, ExcluidasPage, SenhasPage } from '@/modules/admin/AdminPages';
import { FrotaPage } from '@/modules/admin/FrotaPage';

export function App() {
  const { session, carregando } = useAuth();

  if (!supabaseConfigurado) {
    return (
      <div className="p-8 text-sm">
        Configure <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> em <code>.env.local</code>.
      </div>
    );
  }
  if (carregando) return <div className="p-8 text-sm text-slate-500">Carregando…</div>;
  if (!session) return <LoginPage />;

  return (
    <AnoProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/vendas" element={<VendasLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="empresas" element={<EmpresasPage />} />
            <Route path="contatos" element={<ContatosPage />} />
            <Route path="propostas" element={<PropostasPage />} />
          </Route>
          <Route path="/engenharia" element={<EngenhariaLayout />}>
            <Route index element={<ProjetosPage />} />
            <Route path="projetos/:id" element={<ProjetoPage />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<SenhasPage />} />
            <Route path="excluidas" element={<ExcluidasPage />} />
            <Route path="frota" element={<FrotaPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/vendas" replace />} />
        </Route>
      </Routes>
    </AnoProvider>
  );
}
