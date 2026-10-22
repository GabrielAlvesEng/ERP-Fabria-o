-- RH, entrega 3 (decisão 69, 22/10/2026): integrações nas empresas clientes e o bloqueio por data.
-- Cada cliente define a validade da sua integração (resposta 4) e os documentos que exige para entrar.
-- funcionario_liberado(funcionário, cliente, data) diz se a pessoa pode ir àquele cliente naquele dia (resposta 8);
-- a Agenda vai usá-la para impedir o agendamento. Nada é apagado: renovar guarda a anterior no histórico.
set lock_timeout = '10s';

-- O RH escolhe os clientes nas integrações (o cadastro de empresas é o de Vendas).
create policy empresas_ler_rh on public.empresas for select to authenticated using (tem_permissao('rh', 'ler') and excluido_em is null);

create table public.empresa_integracao (
  empresa_id uuid primary key references public.empresas(id),
  validade_meses integer not null check (validade_meses between 1 and 60),
  observacoes text not null default '',
  atualizado_em timestamptz not null default now()
);

create table public.empresa_documentos_exigidos (
  empresa_id uuid not null references public.empresas(id),
  tipo_documento_id uuid not null references public.tipos_documento(id),
  primary key (empresa_id, tipo_documento_id)
);

create table public.funcionario_integracoes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id),
  empresa_id uuid not null references public.empresas(id),
  realizada_em date not null,
  validade date not null,
  arquivo_caminho text,
  arquivo_nome text not null default '',
  observacoes text not null default '',
  substituido_em timestamptz,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.usuarios(id),
  constraint funcionario_integracoes_datas check (validade >= realizada_em)
);
create index funcionario_integracoes_func_idx on public.funcionario_integracoes (funcionario_id, empresa_id);

alter table public.empresa_integracao enable row level security;
alter table public.empresa_documentos_exigidos enable row level security;
alter table public.funcionario_integracoes enable row level security;

create policy empresa_integracao_ler on public.empresa_integracao for select to authenticated using (true);
create policy empresa_integracao_criar on public.empresa_integracao for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy empresa_integracao_editar on public.empresa_integracao for update to authenticated using (tem_permissao('rh', 'editar')) with check (tem_permissao('rh', 'editar'));
create policy empresa_documentos_exigidos_ler on public.empresa_documentos_exigidos for select to authenticated using (true);
create policy empresa_documentos_exigidos_criar on public.empresa_documentos_exigidos for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy empresa_documentos_exigidos_remover on public.empresa_documentos_exigidos for delete to authenticated using (tem_permissao('rh', 'editar'));
create policy funcionario_integracoes_ler on public.funcionario_integracoes for select to authenticated using (tem_permissao('rh', 'ler') or eh_meu_funcionario(funcionario_id::text));
create policy funcionario_integracoes_criar on public.funcionario_integracoes for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy funcionario_integracoes_editar on public.funcionario_integracoes for update to authenticated using (tem_permissao('rh', 'editar')) with check (tem_permissao('rh', 'editar'));

revoke all on public.empresa_integracao, public.empresa_documentos_exigidos, public.funcionario_integracoes from anon, authenticated;
grant select, insert, update on public.empresa_integracao, public.funcionario_integracoes to authenticated;
grant select, insert, delete on public.empresa_documentos_exigidos to authenticated;

create trigger empresa_integracao_atualizado before update on public.empresa_integracao for each row execute function tocar_atualizado_em();
create trigger empresa_integracao_auditoria after insert or update on public.empresa_integracao for each row execute function registrar_auditoria();
create trigger funcionario_integracoes_auditoria after insert or update on public.funcionario_integracoes for each row execute function registrar_auditoria();

create or replace function public.auditar_exigencia_empresa() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into auditoria (tabela, registro_id, acao, antes, depois)
  values (tg_table_name, r->>'empresa_id', tg_op, case when tg_op = 'DELETE' then r end, case when tg_op = 'INSERT' then r end);
  return null;
end;
$fn$;
revoke execute on function public.auditar_exigencia_empresa() from public, anon, authenticated;
create trigger empresa_documentos_exigidos_auditoria after insert or delete on public.empresa_documentos_exigidos for each row execute function auditar_exigencia_empresa();

-- Integração nova: o arquivo fica na pasta do funcionário e a anterior do mesmo cliente vai para o histórico.
-- Depois de lançada, só observações e a exclusão (lançada por engano) mudam; excluir a atual reativa a anterior.
create or replace function public.validar_integracao_funcionario() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'UPDATE' then
    if (new.funcionario_id, new.empresa_id, new.realizada_em, new.validade, new.arquivo_caminho)
       is distinct from (old.funcionario_id, old.empresa_id, old.realizada_em, old.validade, old.arquivo_caminho) then
      raise exception 'Integração lançada não muda: para corrigir, exclua e lance de novo, ou use Renovar.';
    end if;
    if old.excluido_em is not null and new.excluido_em is null then raise exception 'Integração excluída não volta.'; end if;
    return new;
  end if;
  if new.arquivo_caminho is not null and split_part(new.arquivo_caminho, '/', 1) <> new.funcionario_id::text then
    raise exception 'Arquivo fora da pasta do funcionário.';
  end if;
  new.substituido_em := null; new.excluido_em := null;
  update funcionario_integracoes set substituido_em = now()
  where funcionario_id = new.funcionario_id and empresa_id = new.empresa_id and substituido_em is null and excluido_em is null;
  return new;
end;
$fn$;
revoke execute on function public.validar_integracao_funcionario() from public, anon, authenticated;
create trigger funcionario_integracoes_validar before insert or update on public.funcionario_integracoes for each row execute function validar_integracao_funcionario();

create or replace function public.reativar_integracao_anterior() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if old.excluido_em is null and new.excluido_em is not null and old.substituido_em is null then
    update funcionario_integracoes set substituido_em = null
    where id = (select id from funcionario_integracoes
                where funcionario_id = new.funcionario_id and empresa_id = new.empresa_id and id <> new.id and excluido_em is null
                order by criado_em desc limit 1);
  end if;
  return null;
end;
$fn$;
revoke execute on function public.reativar_integracao_anterior() from public, anon, authenticated;
create trigger funcionario_integracoes_reativar after update of excluido_em on public.funcionario_integracoes for each row execute function reativar_integracao_anterior();

-- Nome do cliente para quem não lê o cadastro de empresas (ex.: o funcionário vendo as próprias integrações).
create or replace function public.nome_empresa(p_id uuid) returns text
language sql stable security definer set search_path = public as $fn$
  select nome_fantasia from empresas where id = p_id;
$fn$;
revoke execute on function public.nome_empresa(uuid) from public, anon;
grant execute on function public.nome_empresa(uuid) to authenticated;

-- Integrações atuais com a situação de hoje (aviso 30 dias antes, como os documentos; resposta 5).
create or replace view public.situacao_integracoes with (security_invoker = true) as
select i.id, i.funcionario_id, i.empresa_id, nome_empresa(i.empresa_id) empresa_nome, i.realizada_em, i.validade,
  i.arquivo_caminho, i.arquivo_nome, i.observacoes,
  case
    when i.validade < (now() at time zone 'America/Sao_Paulo')::date then 'vencido'
    when i.validade <= (now() at time zone 'America/Sao_Paulo')::date + 30 then 'vencendo'
    else 'em_dia'
  end situacao
from funcionario_integracoes i
join funcionarios f on f.id = i.funcionario_id and f.situacao <> 'desligado'
where i.substituido_em is null and i.excluido_em is null;
revoke all on public.situacao_integracoes from anon, authenticated;
grant select on public.situacao_integracoes to authenticated;

-- Quem pode ir ao cliente na data (resposta 8). Bloqueia: desligado, férias ou afastado; integração exigida
-- pelo cliente faltando ou vencida na data; documento exigido (pela função, individual ou pelo cliente) faltando
-- ou vencido na data. Devolve só o id, se está liberado e os motivos (sem dados pessoais), para a Agenda usar.
create or replace function public.liberacao_no_cliente(p_empresa uuid, p_data date)
returns table (funcionario_id uuid, liberado boolean, motivos text[])
language sql stable security definer set search_path = public as $fn$
  with pessoas as (
    select f.id, f.situacao from funcionarios f where f.situacao <> 'desligado' and auth.uid() is not null
  ),
  exigidos as (
    select p.id funcionario_id, fr.tipo_documento_id from pessoas p join funcionarios f on f.id = p.id join funcao_requisitos fr on fr.funcao_id = f.funcao_id
    union select r.funcionario_id, r.tipo_documento_id from funcionario_requisitos r join pessoas p on p.id = r.funcionario_id
    union select p.id, e.tipo_documento_id from pessoas p cross join empresa_documentos_exigidos e where e.empresa_id = p_empresa
  ),
  docs as (
    select x.funcionario_id, t.nome, d.validade, d.id doc
    from exigidos x join tipos_documento t on t.id = x.tipo_documento_id
    left join funcionario_documentos d on d.funcionario_id = x.funcionario_id and d.tipo_documento_id = x.tipo_documento_id
      and d.substituido_em is null and d.excluido_em is null
  ),
  motivos as (
    select p.id, case p.situacao when 'ferias' then 'Está de férias.' when 'afastado' then 'Está afastado.' end m from pessoas p
    union all
    select p.id, case when i.id is null then 'Sem integração neste cliente.'
                      when i.validade < p_data then 'Integração vencida em ' || to_char(i.validade, 'DD/MM/YYYY') || '.' end
    from pessoas p join empresa_integracao ei on ei.empresa_id = p_empresa
    left join funcionario_integracoes i on i.funcionario_id = p.id and i.empresa_id = p_empresa and i.substituido_em is null and i.excluido_em is null
    union all
    select d.funcionario_id, case when d.doc is null then d.nome || ': faltando.'
                                  when d.validade < p_data then d.nome || ': vencido em ' || to_char(d.validade, 'DD/MM/YYYY') || '.' end
    from docs d
  )
  select p.id, coalesce(array_length(array_agg(m.m) filter (where m.m is not null), 1), 0) = 0,
    coalesce(array_agg(m.m order by m.m) filter (where m.m is not null), '{}')
  from pessoas p left join motivos m on m.id = p.id
  group by p.id;
$fn$;
revoke execute on function public.liberacao_no_cliente(uuid, date) from public, anon;
grant execute on function public.liberacao_no_cliente(uuid, date) to authenticated;

create or replace function public.funcionario_liberado(p_funcionario uuid, p_empresa uuid, p_data date)
returns table (liberado boolean, motivos text[])
language sql stable security definer set search_path = public as $fn$
  select coalesce(l.liberado, false), coalesce(l.motivos, array['Funcionário desligado ou não encontrado.'])
  from (select 1) um left join liberacao_no_cliente(p_empresa, p_data) l on l.funcionario_id = p_funcionario;
$fn$;
revoke execute on function public.funcionario_liberado(uuid, uuid, date) from public, anon;
grant execute on function public.funcionario_liberado(uuid, uuid, date) to authenticated;
