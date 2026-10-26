import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthProvider';
import { linkAuth, supabase, supabaseConfigurado } from '@/shared/lib/supabase';
import { BarraCarregamento, esconderPreloader } from '@/shared/ui/Carregando';
import { AnoProvider } from './AnoContext';
import { Inicio, Layout } from './Layout';
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
import { DashboardEngenharia } from '@/modules/engenharia/DashboardEngenharia';
import { ProjetoPage } from '@/modules/engenharia/ProjetoPage';
import { AlmoxarifadoLayout } from '@/modules/almoxarifado/AlmoxarifadoLayout';
import { PainelPage as AlmoxarifadoPainelPage } from '@/modules/almoxarifado/PainelPage';
import { EstoquePage } from '@/modules/almoxarifado/EstoquePage';
import { RetiradasPage } from '@/modules/almoxarifado/RetiradasPage';
import { RecebimentosPage } from '@/modules/almoxarifado/RecebimentosPage';
import { AdminLayout, ExcluidasPage, SenhasPage } from '@/modules/admin/AdminPages';
import { FrotaPage } from '@/modules/admin/FrotaPage';
import { ModelosPropostaPage } from '@/modules/admin/ModelosPropostaPage';
import { PredefinicoesPage } from '@/modules/admin/predefinicoes/PredefinicoesPage';
import { PerfilPage } from '@/modules/perfil/PerfilPage';
import { ComprasLayout } from '@/modules/compras/ComprasLayout';
import { PainelCompras } from '@/modules/compras/PainelCompras';
import { RequisicaoPage } from '@/modules/compras/RequisicaoPage';
import { OrdensPage } from '@/modules/compras/OrdensPage';
import { FornecedoresPage } from '@/modules/compras/FornecedoresPage';
import { FinanceiroLayout } from '@/modules/financeiro/FinanceiroLayout';
import { PainelFinanceiro } from '@/modules/financeiro/PainelFinanceiro';
import { ContasPage as ContasPagarPage } from '@/modules/financeiro/ContasPage';
import { ContaPage as ContaPagarPage } from '@/modules/financeiro/ContaPage';
import { FornecedoresPagamentoPage } from '@/modules/financeiro/FornecedoresPagamentoPage';
import { RhLayout } from '@/modules/rh/RhLayout';
import { FuncionariosPage } from '@/modules/rh/FuncionariosPage';
import { FuncionarioPage } from '@/modules/rh/FuncionarioPage';
import { SetoresPage } from '@/modules/rh/SetoresPage';
import { TiposDocumentoPage } from '@/modules/rh/TiposDocumentoPage';
import { VencimentosPage } from '@/modules/rh/VencimentosPage';
import { IntegracoesPage } from '@/modules/rh/IntegracoesPage';
import { CaixaEntradaPage, ComunicacaoLayout, EnviadosPage } from '@/modules/comunicacao/ComunicacaoPages';

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
  // Entrou com a senha provisória que o RH entregou: troca antes de abrir o ERP. Ao salvar, o Auth avisa
  // USER_UPDATED com trocar_senha falso e a sessão nova abre o ERP.
  if (session.user.user_metadata?.trocar_senha) {
    return <DefinirSenhaPage convite provisoria email={session.user.email ?? ''} onPronto={() => undefined} />;
  }

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
            <Route index element={<DashboardEngenharia />} />
            <Route path="projetos" element={<ProjetosPage />} />
            <Route path="projetos/:id" element={<ProjetoPage />} />
          </Route>
          <Route path="/compras" element={<ComprasLayout />}>
            <Route index element={<PainelCompras />} />
            <Route path="requisicoes/:id" element={<RequisicaoPage />} />
            <Route path="ordens" element={<OrdensPage />} />
            <Route path="fornecedores" element={<FornecedoresPage />} />
          </Route>
          <Route path="/almoxarifado" element={<AlmoxarifadoLayout />}>
            <Route index element={<AlmoxarifadoPainelPage />} />
            <Route path="estoque" element={<EstoquePage />} />
            <Route path="retiradas" element={<RetiradasPage />} />
            <Route path="recebimentos" element={<RecebimentosPage />} />
          </Route>
          <Route path="/rh" element={<RhLayout />}>
            <Route index element={<FuncionariosPage />} />
            <Route path="funcionarios/:id" element={<FuncionarioPage />} />
            <Route path="setores" element={<SetoresPage />} />
            <Route path="documentos" element={<TiposDocumentoPage />} />
            <Route path="vencimentos" element={<VencimentosPage />} />
            <Route path="integracoes" element={<IntegracoesPage />} />
          </Route>
          <Route path="/comunicacao" element={<ComunicacaoLayout />}>
            <Route index element={<CaixaEntradaPage />} />
            <Route path="enviados" element={<EnviadosPage />} />
          </Route>
          <Route path="/financeiro" element={<FinanceiroLayout />}>
            <Route index element={<PainelFinanceiro />} />
            <Route path="contas" element={<ContasPagarPage />} />
            <Route path="contas/:id" element={<ContaPagarPage />} />
            <Route path="fornecedores" element={<FornecedoresPagamentoPage />} />
          </Route>
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<SenhasPage />} />
            <Route path="excluidas" element={<ExcluidasPage />} />
            <Route path="frota" element={<FrotaPage />} />
            <Route path="modelos" element={<ModelosPropostaPage />} />
            <Route path="predefinicoes" element={<PredefinicoesPage />} />
          </Route>
          <Route path="*" element={<Inicio />} />
        </Route>
      </Routes>
    </AnoProvider>
  );
}
