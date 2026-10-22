import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthProvider';
import { linkAuth, supabase, supabaseConfigurado } from '@/shared/lib/supabase';
import { BarraCarregamento, esconderPreloader } from '@/shared/ui/Carregando';
import { AnoProvider } from './AnoContext';
import { Layout } from './Layout';
import { LoginPage } from './LoginPage';
import { DefinirSenhaPage } from './DefinirSenhaPage';
import { VendasLayout } from '@/modules/vendas/VendasLayout';
import { DashboardPage } from '@/modules/vendas/dashboard/DashboardPage';
import { EmpresasPage } from '@/modules/vendas/empresas/EmpresasPage';
import { ContatosPage } from '@/modules/vendas/contatos/ContatosPage';
import { PropostasPage } from '@/modules/vendas/propostas/PropostasPage';
import { VendedoresPage } from '@/modules/vendas/vendedores/VendedoresPage';
import { EngenhariaLayout } from '@/modules/engenharia/EngenhariaLayout';
import { ProjetosPage } from '@/modules/engenharia/ProjetosPage';
import { ProjetoPage } from '@/modules/engenharia/ProjetoPage';
import { AlmoxarifadoLayout } from '@/modules/almoxarifado/AlmoxarifadoLayout';
import { AlmoxarifadoInicioPage } from '@/modules/almoxarifado/AlmoxarifadoInicioPage';
import { AdminLayout, ExcluidasPage, SenhasPage } from '@/modules/admin/AdminPages';
import { FrotaPage } from '@/modules/admin/FrotaPage';
import { ModelosPropostaPage } from '@/modules/admin/ModelosPropostaPage';
import { PredefinicoesPage } from '@/modules/admin/predefinicoes/PredefinicoesPage';
import { PerfilPage } from '@/modules/perfil/PerfilPage';
import { ComprasLayout } from '@/modules/compras/ComprasLayout';
import { ComprasInicioPage } from '@/modules/compras/ComprasInicioPage';
import { FinanceiroPage } from '@/modules/financeiro/FinanceiroPage';
import { RhLayout } from '@/modules/rh/RhLayout';
import { FuncionariosPage } from '@/modules/rh/FuncionariosPage';
import { FuncionarioPage } from '@/modules/rh/FuncionarioPage';
import { SetoresPage } from '@/modules/rh/SetoresPage';
import { TiposDocumentoPage } from '@/modules/rh/TiposDocumentoPage';
import { VencimentosPage } from '@/modules/rh/VencimentosPage';
import { IntegracoesPage } from '@/modules/rh/IntegracoesPage';

export function App() {
  const { session, carregando } = useAuth();
  // Veio de um link de convite ou de nova senha: pede a senha antes de abrir o ERP.
  const [definirSenha, setDefinirSenha] = useState<'invite' | 'recovery' | null>(linkAuth.tipo);
  const [linkCodigo, setLinkCodigo] = useState(linkAuth.tokenHash);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === 'PASSWORD_RECOVERY') setDefinirSenha('recovery'); });
    return () => data.subscription.unsubscribe();
  }, []);
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
  if (linkCodigo) return <DefinirSenhaPage convite={linkCodigo.tipo === 'invite'} email={session?.user.email ?? ''} codigo={linkCodigo} onPronto={() => setLinkCodigo(null)} />;
  if (!session) return <LoginPage erroLink={linkAuth.erro} />;
  if (definirSenha) return <DefinirSenhaPage convite={definirSenha === 'invite'} email={session.user.email ?? ''} onPronto={() => setDefinirSenha(null)} />;

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
          <Route path="/compras" element={<ComprasLayout />}>
            <Route index element={<ComprasInicioPage />} />
          </Route>
          <Route path="/almoxarifado" element={<AlmoxarifadoLayout />}>
            <Route index element={<AlmoxarifadoInicioPage />} />
          </Route>
          <Route path="/rh" element={<RhLayout />}>
            <Route index element={<FuncionariosPage />} />
            <Route path="funcionarios/:id" element={<FuncionarioPage />} />
            <Route path="setores" element={<SetoresPage />} />
            <Route path="documentos" element={<TiposDocumentoPage />} />
            <Route path="vencimentos" element={<VencimentosPage />} />
            <Route path="integracoes" element={<IntegracoesPage />} />
          </Route>
          <Route path="/financeiro" element={<FinanceiroPage />} />
          <Route path="/perfil" element={<PerfilPage />} />
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
