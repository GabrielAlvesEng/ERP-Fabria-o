-- A Engenharia passa a ler a Biblioteca de Materiais (decisão 53); continua só a Administração gravando.
-- alter policy (em vez de apagar e recriar) e espera curta por bloqueio: a primeira tentativa ficou presa esperando as tabelas.
set local lock_timeout = '8s';
alter policy bib_tipos_ler on public.bib_tipos using (tem_permissao('custos','ler') or tem_permissao('engenharia','ler') or tem_permissao('admin','editar'));
alter policy bib_pesos_perfil_ler on public.bib_pesos_perfil using (tem_permissao('custos','ler') or tem_permissao('engenharia','ler') or tem_permissao('admin','editar'));
alter policy bib_chapa_precos_ler on public.bib_chapa_precos using (tem_permissao('custos','ler') or tem_permissao('engenharia','ler') or tem_permissao('admin','editar'));
alter policy bib_chapas_ler on public.bib_chapas using (tem_permissao('custos','ler') or tem_permissao('engenharia','ler') or tem_permissao('admin','editar'));
alter policy bib_perfis_ler on public.bib_perfis using (tem_permissao('custos','ler') or tem_permissao('engenharia','ler') or tem_permissao('admin','editar'));
alter policy bib_itens_ler on public.bib_itens using (tem_permissao('custos','ler') or tem_permissao('engenharia','ler') or tem_permissao('admin','editar'));
