-- Este projeto Supabase não expõe automaticamente as tabelas novas à API.
-- Concede a "authenticated" só o necessário por tabela (o RLS continua decidindo as linhas).
-- "anon" não recebe nada. Contadores ficam sem acesso direto (só as RPCs mexem).

revoke all on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;

grant select on
  public.usuarios, public.perfis, public.permissoes, public.perfil_permissoes, public.usuario_perfis,
  public.usuario_permissoes, public.configuracoes, public.auditoria,
  public.segmentos, public.empresas, public.contatos, public.contato_anos, public.propostas,
  public.proposta_revisoes, public.proposta_arquivos, public.proposta_eventos, public.proposta_followups,
  public.proposta_aprovacoes, public.proposta_reprovacoes
to authenticated;

-- Cadastros de Vendas (RLS exige vendas.criar / vendas.editar).
grant insert, update on public.empresas, public.contatos to authenticated;
-- Proposta: edição do rascunho (gatilho proteger_proposta trava o resto).
grant update on public.propostas to authenticated;
-- Arquivos da revisão em rascunho.
grant insert, delete on public.proposta_arquivos to authenticated;
-- Administração (RLS exige admin.editar).
grant update on public.usuarios to authenticated;
grant insert, update, delete on public.perfil_permissoes, public.usuario_perfis, public.usuario_permissoes,
  public.configuracoes, public.segmentos to authenticated;
