-- Projeto sem orçamento (decisão 147, Gabriel em 23/11/2026): a Engenharia abre um projeto sem proposta,
-- pelo ERP ou pelo SolidAuto. Cliente obrigatório. Código no padrão normal AA-CC-NNN (CC do contato no ano e o
-- próximo número da sequência dele, que fica reservado como se fosse uma proposta) ou, para projetos de 2026 que
-- seguem o padrão antigo, o código digitado no formato AA-NNN-SIGLA (ex.: 26-061-EPP).

alter table public.projetos add column sem_orcamento boolean not null default false;
alter table public.projetos drop constraint projetos_origem;
alter table public.projetos add constraint projetos_origem
  check (exemplo or (empresa_id is not null and (proposta_id is not null or sem_orcamento)));

-- Clientes para escolher no projeto sem orçamento (a Engenharia não lê o cadastro de Vendas: só nome e contatos).
create or replace function public.clientes_para_projeto()
returns table (empresa_id uuid, empresa text, contato_id uuid, contato text)
language sql stable security definer set search_path = public as $$
  select e.id, e.nome_fantasia, c.id, c.nome
  from empresas e join contatos c on c.empresa_id = e.id and c.excluido_em is null
  where tem_permissao('engenharia', 'criar') and e.excluido_em is null
  order by e.nome_fantasia, c.nome;
$$;

-- p_dados: titulo, contato_id (padrão normal) ou empresa_id + codigo (padrão antigo).
create or replace function public.criar_projeto_sem_orcamento(p_dados jsonb) returns public.projetos
language plpgsql security definer set search_path = public as $$
declare
  v_ano integer := ano_atual();
  v_titulo text := trim(coalesce(p_dados->>'titulo', ''));
  v_codigo text := upper(trim(coalesce(p_dados->>'codigo', '')));
  v_contato contatos;
  v_empresa uuid;
  v_cc integer; v_seq integer;
  pj projetos;
begin
  if not tem_permissao('engenharia', 'criar') then raise exception 'Só a equipe de Engenharia abre projeto sem orçamento.'; end if;
  if length(v_titulo) < 3 then raise exception 'Digite o nome do projeto.'; end if;

  if v_codigo = '' then
    select * into v_contato from contatos where id = nullif(p_dados->>'contato_id', '')::uuid and excluido_em is null;
    if not found then raise exception 'Selecione o cliente (contato) do projeto.'; end if;
    v_empresa := v_contato.empresa_id;
    v_cc := garantir_contato_ano(v_contato.id, v_ano, 'proposta');
    -- Usa o próximo número da sequência do contato, como uma proposta: a próxima proposta dele pula este número.
    insert into contadores_proposta (ano, contato_id, ultimo_valor) values (v_ano, v_contato.id, 1)
    on conflict (ano, contato_id) do update set ultimo_valor = contadores_proposta.ultimo_valor + 1
    returning ultimo_valor into v_seq;
    v_codigo := right(v_ano::text, 2) || '-' || lpad(v_cc::text, 2, '0') || '-' || lpad(v_seq::text, 3, '0');
    while exists (select 1 from propostas where codigo = v_codigo) or exists (select 1 from projetos where codigo = v_codigo) loop
      update contadores_proposta set ultimo_valor = ultimo_valor + 1 where ano = v_ano and contato_id = v_contato.id
      returning ultimo_valor into v_seq;
      v_codigo := right(v_ano::text, 2) || '-' || lpad(v_cc::text, 2, '0') || '-' || lpad(v_seq::text, 3, '0');
    end loop;
  else
    if v_codigo !~ '^[0-9]{2}-[0-9]{3}-[A-Z]{2,6}$' then
      raise exception 'Código no padrão antigo deve ser AA-NNN-SIGLA (ex.: 26-061-EPP). Para o padrão normal, deixe o código em branco.';
    end if;
    if exists (select 1 from projetos where codigo = v_codigo) then raise exception 'Já existe um projeto com o código %.', v_codigo; end if;
    v_empresa := coalesce(nullif(p_dados->>'empresa_id', '')::uuid,
      (select empresa_id from contatos where id = nullif(p_dados->>'contato_id', '')::uuid));
    if v_empresa is null or not exists (select 1 from empresas where id = v_empresa and excluido_em is null) then
      raise exception 'Selecione o cliente do projeto.';
    end if;
  end if;

  perform set_config('erp.rpc', 'on', true);
  insert into projetos (codigo, titulo, empresa_id, sem_orcamento, responsavel_id)
  values (v_codigo, v_titulo, v_empresa, true, auth.uid()) returning * into pj;
  insert into projeto_conjuntos (projeto_id, tipo, sub, conj, codigo, nome)
  values (pj.id, 'geral', '00', 0, pj.codigo || '-00-00-000', 'Montagem geral');
  update projeto_eventos set justificativa = 'Projeto sem orçamento' where projeto_id = pj.id and tipo = 'criado';
  perform set_config('erp.rpc', 'off', true);
  return pj;
end;
$$;

-- O SolidAuto mostra "Criar projeto no ERP" só para quem pode criar.
create or replace function public.solidauto_eu()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', u.id, 'nome', u.nome, 'email', u.email, 'ativo', u.ativo,
    'ler', tem_permissao('engenharia', 'ler'),
    'editar', tem_permissao('engenharia', 'editar'),
    'criar', tem_permissao('engenharia', 'criar'))
  from usuarios u where u.id = auth.uid();
$$;

revoke all on function public.clientes_para_projeto() from public, anon;
revoke all on function public.criar_projeto_sem_orcamento(jsonb) from public, anon;
grant execute on function public.clientes_para_projeto() to authenticated;
grant execute on function public.criar_projeto_sem_orcamento(jsonb) to authenticated;
