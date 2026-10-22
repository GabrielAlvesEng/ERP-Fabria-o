-- Decisão 83: atualização ao vivo em Vendas (Supabase Realtime).
-- As tabelas entram na publicação do Realtime; o navegador só recebe o aviso de mudança das linhas que o RLS já deixa
-- a pessoa ler, e então recarrega a tela. Nenhuma permissão nova.
alter publication supabase_realtime add table
  public.propostas, public.proposta_revisoes, public.proposta_documentos, public.proposta_arquivos,
  public.proposta_eventos, public.proposta_aprovacoes, public.proposta_reprovacoes,
  public.custo_itens, public.custo_linhas, public.kickoffs, public.kickoff_itens,
  public.empresas, public.contatos, public.contato_anos, public.vendedores;

-- Quem está vendo cada proposta (presença). Canal privado "proposta:<id>": só entra quem pode ler Vendas.
create policy presenca_proposta_ler on realtime.messages for select to authenticated
  using (realtime.topic() like 'proposta:%' and extension = 'presence' and public.tem_permissao('vendas','ler'));
create policy presenca_proposta_gravar on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'proposta:%' and extension = 'presence' and public.tem_permissao('vendas','ler'));
