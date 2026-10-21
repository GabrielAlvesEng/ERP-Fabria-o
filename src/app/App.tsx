import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthProvider';
import { supabaseConfigurado } from '@/shared/lib/supabase';
import { BarraCarregamento, esconderPreloader } from '@/shared/ui/Carregando';
import { AnoProvider } from './AnoContext';
import { Layout } from './Layout';
import { LoginPage } from './LoginPage';
import { VendasLayout } from '@/modules/vendas/VendasLayout';
import { DashboardPage } from '@/modules/vendas/dashboard/DashboardPage';
import { EmpresasPage } from '@/modules/vendas/empresas/EmpresasPage';
import { ContatosPage } from '@/modules/vendas/contatos/ContatosPage';
import { PropostasPage } from '@/modules/vendas/propostas/PropostasPage';
import { VendedoresPage } from '@/modules/vendas/vendedores/VendedoresPage';
import { EngenhariaLayout } from '@/modules/engenharia/EngenhariaLayout';
import { ProjetosPage } from '@/modules/engenharia/ProjetosPage';
import { ProjetoPage } from '@/modules/engenharia/ProjetoPage';
import { AdminLayout, ExcluidasPage, SenhasPage } from '@/modules/admin/AdminPages';
import { FrotaPage } from '@/modules/admin/FrotaPage';
import { ModelosPropostaPage } from '@/modules/admin/ModelosPropostaPage';
import { PredefinicoesPage } from '@/modules/admin/predefinicoes/PredefinicoesPage';

export function App() {
  const { session, carregando } = useAuth();
  // O preloader do index.html cobre a tela até a sessão ser conferida.
  useEffect(() => { if (carregando === false || !supabaseConfigurado) esconderPreloader(); }, [carregando]);

  if (!supabaseConfigurado) {
    return (
      <div className="p-8 text-sm">
        Configure <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> em <code>.env.local</code>.
      </div>
    );
  }
  if (carregando) return null;
  if (!session) return <LoginPage />;

  return (
    <AnoProvider>
      <BarraCarregamento />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/vendas" element={<VendasLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="empresas" element={<EmpresasPage />} />
            <Route path="contatos" element={<ContatosPage />} />
            <Route path="propostas" element={<PropostasPage />} />
            <Route path="vendedores" element={<VendedoresPage />} />
          </Route>
          <Route path="/engenharia" element={<EngenhariaLayout />}>
            <Route index element={<ProjetosPage />} />
            <Route path="projetos/:id" element={<ProjetoPage />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<SenhasPage />} />
            <Route path="excluidas" element={<ExcluidasPage />} />
            <Route path="frota" element={<FrotaPage />} />
            <Route path="modelos" element={<ModelosPropostaPage />} />
            <Route path="predefinicoes" element={<PredefinicoesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/vendas" replace />} />
        </Route>
      </Routes>
    </AnoProvider>
  );
}
