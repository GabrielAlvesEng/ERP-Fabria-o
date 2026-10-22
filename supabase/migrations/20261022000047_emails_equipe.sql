-- Decisão 87: no C/C do e-mail da proposta entram também os funcionários da Fabriaço.
-- Quem é do Comercial nem sempre pode ler o RH, então os nomes e e-mails da equipe vêm por esta função,
-- que devolve só nome e e-mail (corporativo, ou o do login) de quem não está desligado e de quem tem login ativo.
create or replace function public.emails_equipe()
returns table (nome text, email text)
language sql stable security definer set search_path = public as $$
  select distinct on (lower(x.email)) x.nome, x.email
  from (
    select f.nome, coalesce(nullif(trim(f.email_corporativo), ''), u.email) as email
      from funcionarios f left join usuarios u on u.id = f.usuario_id and u.ativo
     where f.situacao <> 'desligado'
    union all
    select u.nome, u.email from usuarios u
     where u.ativo and not exists (select 1 from funcionarios f where f.usuario_id = u.id)
  ) x
  where tem_permissao('vendas', 'ler') and coalesce(x.email, '') <> ''
  order by lower(x.email), x.nome;
$$;
revoke all on function public.emails_equipe() from public, anon;
grant execute on function public.emails_equipe() to authenticated;
