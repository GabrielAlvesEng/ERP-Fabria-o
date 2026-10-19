import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthProvider';
import { supabaseConfigurado } from '@/shared/lib/supabase';
import { AnoProvider } from './AnoContext';
import { Layout } from './Layout';
import { LoginPage } from './LoginPage';
import { DashboardPage } from '@/modules/vendas/dashboard/DashboardPage';
import { EmpresasPage } from '@/modules/vendas/empresas/EmpresasPage';
import { ContatosPage } from '@/modules/vendas/contatos/ContatosPage';
import { PropostasPage } from '@/modules/vendas/propostas/PropostasPage';

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
          <Route path="/vendas" element={<DashboardPage />} />
          <Route path="/vendas/empresas" element={<EmpresasPage />} />
          <Route path="/vendas/contatos" element={<ContatosPage />} />
          <Route path="/vendas/propostas" element={<PropostasPage />} />
          <Route path="*" element={<Navigate to="/vendas" replace />} />
        </Route>
      </Routes>
    </AnoProvider>
  );
}
